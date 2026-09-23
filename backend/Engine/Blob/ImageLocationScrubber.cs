using System.Buffers.Binary;
using System.Text;
using Backend.Models;

namespace Backend.Blob;

/// <summary>Toglie da JPEG, PNG e WebP i metadati di posizione (GPS dell'EXIF, XMP, IPTC, dati in coda all'immagine) senza
/// ricodificare i pixel (art. 5.1.c GDPR); restano ICC, orientamento e il resto dell'EXIF. Altri formati passano invariati.</summary>
public static class ImageLocationScrubber
{
    /// <summary>Byte iniziali che bastano a <see cref="IsSupported"/> per riconoscere il formato.</summary>
    public const int HeaderLength = 12;

    private static readonly byte[] ExifHeader = "Exif\0\0"u8.ToArray();
    private static readonly byte[] JpegXmpHeader = Encoding.ASCII.GetBytes("http://ns.adobe.com/xap/1.0/\0");
    private static readonly byte[] JpegExtendedXmpHeader = Encoding.ASCII.GetBytes("http://ns.adobe.com/xmp/extension/\0");
    private static readonly byte[] MpfHeader = "MPF\0"u8.ToArray();
    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private const string PngRawProfilePrefix = "Raw profile type ";
    // Profili di ImageMagick che trasportano EXIF, XMP o IPTC; "icc"/"icm" (profilo colore) restano.
    private static readonly HashSet<string> PngRawProfilesWithLocation = new(StringComparer.OrdinalIgnoreCase) { "exif", "APP1", "xmp", "iptc", "8bim" };
    private const ushort GpsIfdTag = 0x8825;

    private enum Format { None, Jpeg, Png, Webp }

    /// <summary>True se <paramref name="header"/> (i primi <see cref="HeaderLength"/> byte) è di un JPEG, PNG o WebP.</summary>
    public static bool IsSupported(ReadOnlySpan<byte> header) => Detect(header) != Format.None;

    /// <summary>JPEG/PNG/WebP: una copia ripulita (l'input non viene modificato). Altri formati: <paramref name="data"/>
    /// com'è, senza copia. Lancia <see cref="InvalidImageException"/> se un JPEG/PNG/WebP non si legge fino in fondo.</summary>
    public static ArraySegment<byte> Scrub(byte[] data)
    {
        var format = Detect(data);
        if (format == Format.None)
            return data;

        // Si tolgono byte, non se ne aggiungono: la capacità iniziale basta e il buffer non viene mai riallocato.
        var output = new MemoryStream(data.Length);
        try
        {
            switch (format)
            {
                case Format.Jpeg: ScrubJpeg(data, output); break;
                case Format.Png: ScrubPng(data, output); break;
                case Format.Webp: ScrubWebp(data, output); break;
            }
        }
        catch (Exception e) when (e is ArgumentOutOfRangeException or IndexOutOfRangeException)
        {
            // Un offset interno fuori dal file: struttura non leggibile, i metadati non sono rimovibili con certezza.
            throw new InvalidImageException();
        }
        return new ArraySegment<byte>(output.GetBuffer(), 0, (int)output.Length);
    }

    private static Format Detect(ReadOnlySpan<byte> h)
    {
        // Basta l'SOI: un decoder JPEG salta i byte estranei che lo seguono, quindi il file va trattato (o rifiutato) come JPEG.
        if (h.Length >= 2 && h[0] == 0xFF && h[1] == 0xD8) return Format.Jpeg;
        if (h.StartsWith(PngSignature)) return Format.Png;
        if (h.Length >= 12 && h[..4].SequenceEqual("RIFF"u8) && h.Slice(8, 4).SequenceEqual("WEBP"u8)) return Format.Webp;
        return Format.None;
    }

    /// <summary>Segmenti JPEG dall'SOI all'EOI dell'immagine principale: Exif ripulito, segmenti con posizione scartati,
    /// dati compressi delle scansioni copiati invariati, byte dopo l'EOI troncati.</summary>
    private static void ScrubJpeg(byte[] data, MemoryStream output)
    {
        output.Write(data, 0, 2); // SOI
        var pos = 2;
        while (true)
        {
            if (pos >= data.Length || data[pos] != 0xFF)
                throw new InvalidImageException();
            // 0xFF di riempimento prima del marker: non ricopiati.
            while (pos + 1 < data.Length && data[pos + 1] == 0xFF) pos++;
            if (pos + 1 >= data.Length)
                throw new InvalidImageException();

            var marker = data[pos + 1];
            if (marker == 0xD9)
            {
                output.Write(data, pos, 2); // EOI dell'immagine principale: ciò che segue non viene copiato
                return;
            }
            if (marker is 0x01 or (>= 0xD0 and <= 0xD7))
            {
                output.Write(data, pos, 2); // marker senza lunghezza
                pos += 2;
                continue;
            }
            if (marker is 0x00 or 0xD8 || pos + 4 > data.Length)
                throw new InvalidImageException();

            var length = BinaryPrimitives.ReadUInt16BigEndian(data.AsSpan(pos + 2, 2));
            var end = pos + 2 + length;
            if (length < 2 || end > data.Length)
                throw new InvalidImageException();

            var payload = data.AsSpan(pos + 4, length - 2);
            if (IsLocationSegment(marker, payload))
            {
                pos = end;
                continue;
            }
            if (marker == 0xE1 && payload.StartsWith(ExifHeader))
            {
                var segment = data.AsSpan(pos, end - pos).ToArray();
                ClearGpsIfd(segment.AsSpan(4 + ExifHeader.Length));
                output.Write(segment);
            }
            else
            {
                output.Write(data, pos, end - pos);
            }
            pos = end;

            if (marker == 0xDA)
                pos = CopyScanData(data, pos, output);
        }
    }

    /// <summary>APP1 XMP (anche esteso), APP13 (Photoshop/IPTC: città, luogo, nazione) e APP2 MPF (indice delle
    /// immagini secondarie accodate dopo l'EOI, che vengono troncate).</summary>
    private static bool IsLocationSegment(byte marker, ReadOnlySpan<byte> payload) => marker switch
    {
        0xE1 => payload.StartsWith(JpegXmpHeader) || payload.StartsWith(JpegExtendedXmpHeader),
        0xED => true,
        0xE2 => payload.StartsWith(MpfHeader),
        _ => false,
    };

    /// <summary>Copia i dati compressi di una scansione (dopo l'SOS) e restituisce la posizione del marker che la chiude:
    /// 0xFF 0x00 è un byte 0xFF dei dati, 0xFF 0xD0-0xD7 un marker di restart, entrambi parte della scansione.</summary>
    private static int CopyScanData(byte[] data, int start, MemoryStream output)
    {
        var pos = start;
        while (true)
        {
            var ff = data.AsSpan(pos).IndexOf((byte)0xFF);
            if (ff < 0)
                throw new InvalidImageException(); // file finito dentro la scansione: manca l'EOI
            pos += ff;
            var next = pos + 1;
            while (next < data.Length && data[next] == 0xFF) next++;
            if (next >= data.Length)
                throw new InvalidImageException();
            if (data[next] is 0x00 or (>= 0xD0 and <= 0xD7))
            {
                pos = next + 1;
                continue;
            }
            output.Write(data, start, pos - start);
            return pos;
        }
    }

    /// <summary>Chunk PNG fino a IEND: eXIf ripulito (CRC ricalcolato), testi XMP/EXIF/IPTC scartati, byte dopo IEND troncati.</summary>
    private static void ScrubPng(byte[] data, MemoryStream output)
    {
        output.Write(data, 0, PngSignature.Length);
        var pos = PngSignature.Length;
        while (true)
        {
            if (pos + 12 > data.Length)
                throw new InvalidImageException(); // file finito prima di IEND
            var length = BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(pos, 4));
            if (length > int.MaxValue || pos + 12L + length > data.Length)
                throw new InvalidImageException();
            var size = (int)length;
            var end = pos + 12 + size;

            var type = data.AsSpan(pos + 4, 4);
            var isEnd = type.SequenceEqual("IEND"u8);
            if (IsLocationTextChunk(type, data.AsSpan(pos + 8, size)))
            {
                pos = end;
                continue;
            }
            if (type.SequenceEqual("eXIf"u8))
            {
                var chunk = data.AsSpan(pos, end - pos).ToArray();
                var tiff = chunk.AsSpan(8, size);
                if (tiff.StartsWith(ExifHeader)) tiff = tiff[ExifHeader.Length..];
                if (ClearGpsIfd(tiff))
                    BinaryPrimitives.WriteUInt32BigEndian(chunk.AsSpan(8 + size, 4), Crc32(chunk.AsSpan(4, 4 + size)));
                output.Write(chunk);
            }
            else
            {
                output.Write(data, pos, end - pos);
            }
            if (isEnd)
                return;
            pos = end;
        }
    }

    /// <summary>tEXt/zTXt/iTXt con parola chiave <c>XML:com.adobe.xmp</c> o <c>Raw profile type</c> exif/APP1/xmp/iptc/8bim.</summary>
    private static bool IsLocationTextChunk(ReadOnlySpan<byte> type, ReadOnlySpan<byte> body)
    {
        if (!type.SequenceEqual("tEXt"u8) && !type.SequenceEqual("zTXt"u8) && !type.SequenceEqual("iTXt"u8))
            return false;
        var nul = body.IndexOf((byte)0);
        var keyword = Encoding.Latin1.GetString(nul < 0 ? body : body[..nul]);
        return keyword == "XML:com.adobe.xmp"
            || (keyword.StartsWith(PngRawProfilePrefix, StringComparison.Ordinal)
                && PngRawProfilesWithLocation.Contains(keyword[PngRawProfilePrefix.Length..]));
    }

    /// <summary>Chunk WebP entro la dimensione RIFF: EXIF ripulito, XMP scartato; dimensione RIFF e flag XMP di VP8X ricalcolati.</summary>
    private static void ScrubWebp(byte[] data, MemoryStream output)
    {
        var riffSize = BinaryPrimitives.ReadUInt32LittleEndian(data.AsSpan(4, 4));
        if (riffSize < 4 || 8L + riffSize > data.Length)
            throw new InvalidImageException();
        var limit = 8 + (int)riffSize; // oltre: byte fuori dal RIFF, non copiati

        output.Write(data, 0, 12);
        var pos = 12;
        while (pos < limit)
        {
            if (pos + 8 > limit)
                throw new InvalidImageException();
            var size = BinaryPrimitives.ReadUInt32LittleEndian(data.AsSpan(pos + 4, 4));
            if (pos + 8L + size > limit)
                throw new InvalidImageException();
            // Un chunk di dimensione dispari ha un byte di padding; all'ultimo chunk può mancare.
            var end = (int)Math.Min(pos + 8L + size + (size & 1), limit);

            var fourcc = data.AsSpan(pos, 4);
            if (fourcc.SequenceEqual("XMP "u8))
            {
                pos = end;
                continue;
            }
            if (fourcc.SequenceEqual("EXIF"u8))
            {
                var chunk = data.AsSpan(pos, end - pos).ToArray();
                var tiff = chunk.AsSpan(8, (int)size);
                ClearGpsIfd(tiff.StartsWith(ExifHeader) ? tiff[ExifHeader.Length..] : tiff);
                output.Write(chunk);
            }
            else
            {
                output.Write(data, pos, end - pos);
            }
            pos = end;
        }

        var result = output.GetBuffer().AsSpan(0, (int)output.Length);
        BinaryPrimitives.WriteUInt32LittleEndian(result.Slice(4, 4), (uint)(result.Length - 8));
        // VP8X (se c'è, è il primo chunk): bit 0x04 del primo byte = "contiene XMP", ora sempre falso.
        if (result.Length > 20 && result.Slice(12, 4).SequenceEqual("VP8X"u8))
            result[20] &= unchecked((byte)~0x04);
    }

    /// <summary>Nel blocco TIFF (formato dell'EXIF) svuota la sezione GPS: valori e voci azzerati, conteggio a zero,
    /// così resta valida ma vuota e il resto non si sposta. True se ha modificato qualcosa; un puntatore GPS fuori
    /// dal blocco non porta a nessun dato e resta com'è.</summary>
    private static bool ClearGpsIfd(Span<byte> tiff)
    {
        if (tiff.Length < 8) return false;
        bool little;
        if (tiff[0] == (byte)'I' && tiff[1] == (byte)'I') little = true;
        else if (tiff[0] == (byte)'M' && tiff[1] == (byte)'M') little = false;
        else return false;

        var ifd0 = U32(tiff, 4, little);
        if (ifd0 < 8 || ifd0 + 2L > tiff.Length) return false;
        var count0 = U16(tiff, (int)ifd0, little);

        long gps = -1;
        for (var i = 0; i < count0; i++)
        {
            var entry = (int)ifd0 + 2 + i * 12;
            if (entry + 12 > tiff.Length) return false;
            if (U16(tiff, entry, little) == GpsIfdTag) { gps = U32(tiff, entry + 8, little); break; }
        }
        if (gps < 8 || gps + 2 > tiff.Length) return false;

        var at = (int)gps;
        var count = U16(tiff, at, little);
        var entriesEnd = at + 2 + count * 12;
        // Sezione GPS che comincia nel blocco ma ne esce: un lettore permissivo ne leggerebbe le prime voci.
        if (entriesEnd > tiff.Length)
            throw new InvalidImageException();
        for (var i = 0; i < count; i++)
        {
            var entry = at + 2 + i * 12;
            var size = TypeSize(U16(tiff, entry + 2, little)) * (long)U32(tiff, entry + 4, little);
            if (size <= 4) continue; // valore contenuto nella voce stessa, azzerato sotto
            var offset = (long)U32(tiff, entry + 8, little);
            if (offset >= 8 && offset < tiff.Length)
                tiff.Slice((int)offset, (int)Math.Min(size, tiff.Length - offset)).Clear();
        }
        // Voci azzerate e conteggio a 0: il puntatore "sezione successiva" che segue ora legge 0.
        tiff.Slice(at, Math.Min(entriesEnd + 4, tiff.Length) - at).Clear();
        return true;
    }

    private static ushort U16(ReadOnlySpan<byte> s, int at, bool little) =>
        little ? BinaryPrimitives.ReadUInt16LittleEndian(s.Slice(at, 2)) : BinaryPrimitives.ReadUInt16BigEndian(s.Slice(at, 2));

    private static uint U32(ReadOnlySpan<byte> s, int at, bool little) =>
        little ? BinaryPrimitives.ReadUInt32LittleEndian(s.Slice(at, 4)) : BinaryPrimitives.ReadUInt32BigEndian(s.Slice(at, 4));

    private static int TypeSize(ushort type) => type switch
    {
        1 or 2 or 6 or 7 => 1,
        3 or 8 => 2,
        4 or 9 or 11 => 4,
        5 or 10 or 12 => 8,
        _ => 0,
    };

    private static readonly uint[] CrcTable = BuildCrcTable();

    private static uint[] BuildCrcTable()
    {
        var table = new uint[256];
        for (uint n = 0; n < 256; n++)
        {
            var c = n;
            for (var k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
            table[n] = c;
        }
        return table;
    }

    /// <summary>CRC-32 dei chunk PNG (tipo + dati).</summary>
    private static uint Crc32(ReadOnlySpan<byte> bytes)
    {
        var c = 0xFFFFFFFFu;
        foreach (var b in bytes) c = CrcTable[(c ^ b) & 0xFF] ^ (c >> 8);
        return c ^ 0xFFFFFFFFu;
    }
}
