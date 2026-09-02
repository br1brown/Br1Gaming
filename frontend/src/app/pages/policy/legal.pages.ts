import { STANDARD_LEGAL_PAGES, type LegalPageSpec } from '../../core/engine/siteBuilder';

// Area "legal": ID, pagine attive e date delle pagine legali (non in site.ts).
// Voce presente in `legalPagesDecl` = pagina creata, assente = pagina non creata; con cookie di
// progetto o PWA una voce deve essere abbinata a `cookiePolicy` in site.ts (errore al build se manca).
// Dettagli: frontend/README.md §"Pagine legali".
export const LegalPages = {
    PrivacyPolicy: 'legal.privacy',
    CookiePolicy: 'legal.cookie',
    TermsOfService: 'legal.tos',
    LegalNotice: 'legal.notice',
    AccessibilityStatement: 'legal.accessibility',
} as const;

export type LegalPageId = (typeof LegalPages)[keyof typeof LegalPages];

/** Pagine legali del progetto: PageType + default dell'Engine (`STANDARD_LEGAL_PAGES`) via
 *  spread. Nessuna scorciatoia nascosta: sono voci come le altre di `legalPages` in site.ts, che
 *  le tratta tutte allo stesso modo.
 *
 *  Live solo Cookie e Privacy: Br1Gaming non ha un'identità societaria registrata (nessun
 *  `data/identity.json` nel backend), quindi ToS/Note Legali/Accessibility restano commentate,
 *  non cancellate — pronte se in futuro cambia lo status del progetto. Cookie serve comunque
 *  (cookie tecnici di salvataggio partite + Mapbox come Analytics di terze parti, vedi
 *  `cookie-registry.ts`); Privacy per lo stesso motivo (dati trattati anche senza un'entità
 *  registrata dietro). ToS rivendicherebbe la proprietà dei contenuti per un'entità che non
 *  esiste; Note Legali è l'identificazione di un prestatore di servizi commerciale (D.Lgs
 *  70/2003) che qui non si applica; Accessibility riguarda PA/e-commerce/soglie di fatturato,
 *  fuori scope per un progetto personale. */
export const legalPagesDecl: LegalPageSpec[] = [
    { pageType: LegalPages.PrivacyPolicy, ...STANDARD_LEGAL_PAGES.privacy },
    { pageType: LegalPages.CookiePolicy, ...STANDARD_LEGAL_PAGES.cookie },
    // { pageType: LegalPages.TermsOfService, ...STANDARD_LEGAL_PAGES.tos },
    // { pageType: LegalPages.LegalNotice, ...STANDARD_LEGAL_PAGES.legal },
    // { pageType: LegalPages.AccessibilityStatement, ...STANDARD_LEGAL_PAGES.accessibility },
];

/** Config per pagina legale: data di "ultimo aggiornamento" (opzionale, assente = nessuna riga) +
 *  i 4 flag di `app-identity-render`, dichiarati per esteso pagina per pagina. */
export interface LegalPageConfig {
    updated?: Date;
    showCompanyDetails: boolean;
    showLegalDetails: boolean;
    showContacts: boolean;
    showOpeningHours: boolean;
}

/**
 * Config delle 5 pagine legali standard. Dati legali (capitale sociale, socio unico, in
 * liquidazione) solo su Note Legali e Termini — trasparenza societaria richiesta da art. 2250 c.c.
 * e Codice del Consumo. Orari di contatto mai in pagina: pertinenti al footer, non a un documento
 * di disclosure legale.
 *
 * ⚠️ COOKIE: aggiorna la data di `CookiePolicy` quando cambi `COOKIE_MAP` o `ENGINE_COOKIE_MAP`.
 */
export const legalPages: Partial<Record<LegalPageId, LegalPageConfig>> = {
    [LegalPages.PrivacyPolicy]: {
        updated: new Date('2026-07-03'),
        showCompanyDetails: true, showLegalDetails: false, showContacts: true, showOpeningHours: false,
    },
    [LegalPages.CookiePolicy]: {
        updated: new Date('2026-08-20'),
        showCompanyDetails: true, showLegalDetails: false, showContacts: true, showOpeningHours: false,
    },
    // [LegalPages.TermsOfService]: {
    //     updated: new Date('2026-07-03'),
    //     showCompanyDetails: true, showLegalDetails: true, showContacts: true, showOpeningHours: false,
    // },
    // [LegalPages.LegalNotice]: {
    //     updated: new Date('2026-07-03'),
    //     showCompanyDetails: true, showLegalDetails: true, showContacts: true, showOpeningHours: false,
    // },
    // [LegalPages.AccessibilityStatement]: {
    //     updated: new Date('2026-07-08'),
    //     showCompanyDetails: true, showLegalDetails: false, showContacts: true, showOpeningHours: false,
    // },
};

/** Default per un `pageType` assente da `legalPages`: societari + contatti, nessuna data. */
const DEFAULT_LEGAL_PAGE_CONFIG: LegalPageConfig = {
    showCompanyDetails: true, showLegalDetails: false, showContacts: true, showOpeningHours: false,
};

/** Config della pagina legale per `pageType`, o il default se assente da `legalPages`. */
export function legalPageConfig(pageType: string): LegalPageConfig {
    return legalPages[pageType as LegalPageId] ?? DEFAULT_LEGAL_PAGE_CONFIG;
}
