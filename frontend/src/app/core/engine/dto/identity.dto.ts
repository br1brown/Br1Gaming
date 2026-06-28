export interface Address {
    via?: string;
    civico?: string;
    cap?: string;
    citta?: string;
    provincia?: string;
    /** Paese come codice ISO 3166-1 alpha-2 (es. "IT"); il footer ne deriva il nome localizzato. */
    nazione?: string;
}

export interface ContactInfo {
    telefono?: string;
    email?: string;
    pec?: string;
}

export interface CompanyDetails {
    registroImprese?: string;
    numeroRea?: string;
    capitaleSociale?: number;
    capitaleInteramenteVersato?: boolean;
    isSocioUnico?: boolean;
    inLiquidazione?: boolean;
    codiceSdi?: string;
}

/** Profilo social del brand: URL (icona + sameAs) con etichetta opzionale resa solo nel footer.
 *  Il backend normalizza ogni voce a questa forma (anche le stringhe nude di identity.json). */
export interface SocialLink {
    url: string;
    /** Nome leggibile per il footer; assente → si ripiega sul social dedotto dall'URL. */
    name?: string;
}

/** Nome giorno = nome `DayOfWeek` del backend (= nome schema.org). Sorgente unica e tipizzata. */
export type DayName = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

/** I giorni in ordine di settimana (Lun-prima), per la resa raggruppata e il lookup dei nomi. */
export const DAY_ORDER: readonly DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Una fascia oraria: giorno + apertura/chiusura "HH:mm". Il modello backend la tipizza (DayOfWeek + TimeOnly). */
export interface OpeningInterval {
    day: DayName;
    opens: string;
    closes: string;
}

/** Orari come **lista di intervalli**. Più voci sullo stesso giorno = più fasce (pausa pranzo);
 *  un giorno assente = chiuso. La resa (raggruppamento "Lun–Ven", JSON-LD) la deriva il frontend. */
export type OpeningHours = OpeningInterval[];

/**
 * Identità del sito restituita da GET /identity: dati legali/anagrafici, contatti, profili social
 * del brand e natura dell'entità. È la sorgente unica per footer, pagine legali e dati strutturati
 * SEO (JSON-LD). `null` quando il sito non la configura → i consumer si nascondono da soli.
 */
export interface Identity {
    /** false (default) = Organization, true = Person (sito personale/portfolio). Decide il @type del brand nel JSON-LD. */
    personal?: boolean;
    /** Tipo schema.org se il brand è un'attività fisica (es. "Restaurant", "Store", "LocalBusiness").
     *  Valorizzato → l'entità brand diventa quel @type, con indirizzo e openingHoursSpecification sul
     *  nodo (segnali "attività locale" di Google); ha la precedenza su `personal`. Omesso → Organization/Person. */
    businessType?: string;
    ragioneSociale?: string;
    partitaIva?: string;
    codiceFiscale?: string;
    sedeLegale?: Address;
    /** Indirizzo della sede fisica aperta al pubblico, se diversa dalla legale. Usata come `address` del
     *  brand solo con `businessType` valorizzato; assente → ripiega su `sedeLegale`. */
    sedeOperativa?: Address;
    contatti?: ContactInfo;
    datiSocietari?: CompanyDetails;
    /** Profili social ufficiali del brand: icone del footer + sameAs JSON-LD. L'icona è dedotta
     *  dall'URL (più profili dello stesso social convivono); il `name` è un'etichetta solo footer. */
    social?: SocialLink[];
    /** Orari di apertura per-giorno. Su Organization → `hoursAvailable` del ContactPoint; con `businessType`
     *  (LocalBusiness) → `openingHoursSpecification` sul nodo. Più la resa localizzata nel footer. */
    openingHours?: OpeningHours;
    /** Valuta ISO 4217 dei valori monetari (es. capitale sociale). Omessa → EUR. */
    currency?: string;
    /** Rappresentante legale (campo noto e tipizzato, reso dal footer/pagine legali). */
    rappresentanteLegale?: string;
    /** Metadati custom generici: NON resi dall'identità (solo dati noti); contenitore per il progetto. */
    metadatiAggiuntivi?: Record<string, string>;
    /** Proprietà schema.org extra fuse PER ULTIME nel nodo entità brand → sovrascrivono i default (anche
     *  `@type`); l'Engine si tiene solo `@context` e `@id`. Validità a carico del progetto. */
    extra?: Record<string, unknown>;
}
