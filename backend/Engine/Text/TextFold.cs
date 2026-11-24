using System.Globalization;
using System.Text;

namespace Backend.Engine;

/// <summary>Testo senza maiuscole né accenti per i confronti («forli» trova «Forlì») e in forma di indirizzo (<see cref="Slugify"/>).
/// Dà lo stesso risultato di <c>foldText</c>/<c>slugify</c> del frontend.</summary>
public static class TextFold
{
    /// <summary>Lettere che nessuna scomposizione Unicode riduce all'alfabeto latino di base: la loro forma ASCII (uguale nel frontend).</summary>
    private static readonly Dictionary<char, string> LettereAscii = new()
    {
        ['ß'] = "ss", ['æ'] = "ae", ['œ'] = "oe", ['ø'] = "o", ['ł'] = "l", ['đ'] = "d", ['þ'] = "th", ['ð'] = "d", ['ı'] = "i", ['ħ'] = "h",
    };

    /// <summary>Minuscolo (cultura invariante) e senza segni diacritici; legature, larghezza piena e lettere come <c>ß</c>, <c>ø</c>, <c>ł</c>
    /// diventano lettere di base («Straße» → «strasse»). <c>null</c> vale stringa vuota.</summary>
    public static string Fold(string? text)
    {
        if (string.IsNullOrEmpty(text)) return "";
        var decomposed = text.Normalize(NormalizationForm.FormKD);
        var sb = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
        {
            // Tutti i segni (Unicode categoria M: come `\p{M}` del frontend), non solo i non spaziati.
            if (CharUnicodeInfo.GetUnicodeCategory(c) is not (UnicodeCategory.NonSpacingMark or UnicodeCategory.SpacingCombiningMark or UnicodeCategory.EnclosingMark)) sb.Append(c);
        }
        // Minuscolo sull'intera stringa (copre anche i caratteri fuori dal piano di base), poi le lettere senza scomposizione.
        var lower = sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
        sb.Clear();
        foreach (var c in lower)
        {
            if (LettereAscii.TryGetValue(c, out var ascii)) sb.Append(ascii); else sb.Append(c);
        }
        return sb.ToString();
    }

    /// <summary>Segmento di indirizzo: lettere e cifre ASCII minuscole separate da un trattino, mai ai bordi, tagliato a <paramref name="maxLength"/>.
    /// <paramref name="fallback"/> se non resta niente.</summary>
    public static string Slugify(string? text, int maxLength = 60, string fallback = "")
    {
        var sb = new StringBuilder();
        var pendingSeparator = false; // un separatore in sospeso si scrive solo se segue una lettera
        foreach (var c in Fold(text))
        {
            if (c is >= 'a' and <= 'z' or >= '0' and <= '9')
            {
                if (pendingSeparator && sb.Length > 0) sb.Append('-');
                sb.Append(c);
                pendingSeparator = false;
            }
            else
            {
                pendingSeparator = true;
            }
        }

        var slug = sb.ToString();
        if (maxLength > 0 && slug.Length > maxLength) slug = slug[..maxLength].TrimEnd('-');
        return slug.Length == 0 ? fallback : slug;
    }
}
