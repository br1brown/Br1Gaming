import type { LegalPagesConfig } from '../../core/engine/siteBuilder';

// Area "legal": ID, slot attivi e date delle pagine legali (non in site.ts).
// Slot valorizzato = pagina creata, omesso = assente; con cookie/multilingua/PWA
// lo slot `cookie` è obbligatorio (errore al build se manca).
// Dettagli: frontend/README.md §"Pagine legali".
export const LegalPages = {
    PrivacyPolicy: 'legal.privacy',
    CookiePolicy: 'legal.cookie',
    TermsOfService: 'legal.tos',
    LegalNotice: 'legal.notice',
    AccessibilityStatement: 'legal.accessibility',
} as const;

type LegalPageId = (typeof LegalPages)[keyof typeof LegalPages];

/** Slot dell'Engine → PageType del figlio. Assemblato in site.ts → legalPages. */
export const legalSlots: LegalPagesConfig = {
    privacy: LegalPages.PrivacyPolicy,
    cookie: LegalPages.CookiePolicy,
    tos: LegalPages.TermsOfService,
    legal: LegalPages.LegalNotice,
    accessibility: LegalPages.AccessibilityStatement,
};

/**
 * Data di "ultimo aggiornamento" per pagina legale, consumata da `PolicyComponent`. Dichiarata a
 * mano, non da git/mtime (non sopravvive a clone/Docker). ID senza data → nessuna riga mostrata.
 *
 * ⚠️ COOKIE: aggiorna la data di `CookiePolicy` ogni volta che modifichi `COOKIE_MAP`
 *    (`core/services/cookie-registry.ts`) — l'elenco cambia → la policy è "aggiornata".
 */
export const legalUpdated: Partial<Record<LegalPageId, Date>> = {
    [LegalPages.PrivacyPolicy]: new Date('2026-07-03'),
    [LegalPages.CookiePolicy]: new Date('2026-07-03'),
    [LegalPages.TermsOfService]: new Date('2026-07-03'),
    [LegalPages.LegalNotice]: new Date('2026-07-03'),
    [LegalPages.AccessibilityStatement]: new Date('2026-07-08'),
};
