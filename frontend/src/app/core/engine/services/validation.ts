/**
 * VALIDATION — regole di validazione e normalizzazione condivise dell'intero sito.
 *
 * Un unico posto per le regole che prima vivevano sparse (validatori inline di `QrCodeService`,
 * strip del telefono in `ContactUrl`). Le usano i builder di link (`ContactUrl`), il generatore di
 * QR (`QrCodeService`) e chiunque debba validare un input dell'utente/config.
 *
 * **Contratto condiviso col backend:** le regole di `phone` (charset + numero singolo) rispecchiano
 * `ValidPhone` di `backend/Engine/Identity/Identity.cs`; `email`/`url` rispecchiano `MailAddress`/`Uri`
 * dell'identità. Il backend valida alla fonte (fail-fast), il frontend riusa la stessa forma qui —
 * due implementazioni della *stessa* regola, una per tier (C# non condivide codice con TS).
 *
 * **Telefono, Opzione A:** il validatore base accetta anche i numeri *nazionali* (es. `06/1234567`):
 * "un solo numero", con spazi e separatori. La forma E.164 stretta (`isE164`) è un controllo *in più*,
 * richiesto solo dove serve un numero internazionale dialabile senza contesto (WhatsApp/`wa.me`).
 */
export const Validation = {
    phone: {
        /**
         * Forma "dialabile": solo cifre ed eventuale `+`, separatori visivi rimossi. È ciò che diventa
         * l'href `tel:` nel footer e il payload del QR. Es. `"06/1234 567"` → `"061234567"`.
         */
        toDial: (value: string): string => value.replace(/[^\d+]/g, ''),

        /**
         * Charset ammesso per l'intera stringa: solo cifre e separatori visivi di un numero
         * (spazi, `+ / - . ( )`). Niente lettere, testo o markup. Rispecchia `PhoneShape` del backend.
         */
        hasValidShape: (value: string): boolean => /^[+\d\s/().-]+$/.test(value.trim()),

        /**
         * `true` se, ridotta a cifre + `+`, la stringa è **un solo** numero E.164-plausibile
         * (un `+` iniziale al più, 6–15 cifre). Rispecchia `SingleNumber` del backend. Accetta i
         * nazionali (Opzione A): `"061234567"` è ok.
         */
        isSingle: (value: string): boolean => /^\+?\d{6,15}$/.test(Validation.phone.toDial(value)),

        /**
         * Numero valido secondo il contratto condiviso: charset corretto **e** numero singolo.
         * È la regola usata dall'identità (backend) e dai link del footer.
         */
        isValid: (value: string): boolean =>
            Validation.phone.hasValidShape(value) && Validation.phone.isSingle(value),

        /**
         * E.164 internazionale stretto: prefisso paese, prima cifra 1–9 (niente `0` iniziale nazionale),
         * fino a 15 cifre. Più severo di `isValid`: serve dove il numero dev'essere dialabile a livello
         * mondiale senza contesto locale (WhatsApp/`wa.me`).
         */
        isE164: (value: string): boolean => /^\+?[1-9]\d{1,14}$/.test(Validation.phone.toDial(value)),
    },

    /** Email in forma base (`local@dominio.tld`). Il backend usa `MailAddress`; qui il gemello lato client. */
    email: (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),

    /** IBAN (formato strutturale, spazi ignorati). */
    iban: (value: string): boolean => /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(value.replace(/\s/g, '').toUpperCase()),

    /** URL assoluto http/https (gemello lato client di `Uri.TryCreate` usato per i social dell'identità). */
    url: (value: string): boolean => {
        try {
            const u = new URL(value.trim());
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
            return false;
        }
    },
} as const;
