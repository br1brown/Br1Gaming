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

type LegalPageId = (typeof LegalPages)[keyof typeof LegalPages];

/** Pagine legali del progetto: PageType + default dell'Engine (`STANDARD_LEGAL_PAGES`) via
 *  spread. Nessuna scorciatoia nascosta: sono voci come le altre di `legalPages` in site.ts, che
 *  le tratta tutte allo stesso modo. */
export const legalPagesDecl: LegalPageSpec[] = [
    { pageType: LegalPages.PrivacyPolicy, ...STANDARD_LEGAL_PAGES.privacy },
    { pageType: LegalPages.CookiePolicy, ...STANDARD_LEGAL_PAGES.cookie },
    { pageType: LegalPages.TermsOfService, ...STANDARD_LEGAL_PAGES.tos },
    { pageType: LegalPages.LegalNotice, ...STANDARD_LEGAL_PAGES.legal },
    { pageType: LegalPages.AccessibilityStatement, ...STANDARD_LEGAL_PAGES.accessibility },
];

/**
 * Data di "ultimo aggiornamento" per pagina legale, consumata da `PolicyComponent`. Dichiarata a
 * mano, non da git/mtime (non sopravvive a clone/Docker). ID senza data → nessuna riga mostrata.
 *
 * ⚠️ COOKIE: aggiorna la data di `CookiePolicy` ogni volta che modifichi `COOKIE_MAP`
 *    (`core/services/cookie-registry.ts`) o `ENGINE_COOKIE_MAP` (`services/cookie/cookie-type.ts`)
 *    — l'elenco cambia → la policy è "aggiornata".
 */
export const legalUpdated: Partial<Record<LegalPageId, Date>> = {
    [LegalPages.PrivacyPolicy]: new Date('2026-07-03'),
    [LegalPages.CookiePolicy]: new Date('2026-08-20'),
    [LegalPages.TermsOfService]: new Date('2026-07-03'),
    [LegalPages.LegalNotice]: new Date('2026-07-03'),
    [LegalPages.AccessibilityStatement]: new Date('2026-07-08'),
};
