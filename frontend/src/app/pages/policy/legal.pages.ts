import type { LegalPagesConfig } from '../../core/engine/siteBuilder';

// Area "legal": ID, slot attivi e date delle pagine legali del progetto (non in site.ts).
//
// SCELTA DI PRODOTTO: è instradata la SOLA Cookie Policy (obbligatoria con cookie/PWA/multilingua).
// Privacy, Termini e Note Legali hanno il contenuto già pronto in `assets/legal/` ma NON sono
// mappati a uno slot in `legalSlots`, quindi restano fuori dalle rotte `/policy/*` e dal footer —
// esattamente com'era prima del refactor "PageType in oggetti per area". Per esporli in futuro basta
// aggiungere lo slot corrispondente qui sotto (e la voce nel footer di site.ts).
export const LegalPages = {
    PrivacyPolicy: 'legal.privacy',
    CookiePolicy: 'legal.cookie',
    TermsOfService: 'legal.tos',
    LegalNotice: 'legal.notice',
} as const;

type LegalPageId = (typeof LegalPages)[keyof typeof LegalPages];

/** Slot dell'Engine → PageType del figlio. Assemblato in site.ts → legalPages. Solo la Cookie Policy. */
export const legalSlots: LegalPagesConfig = {
    cookie: LegalPages.CookiePolicy,
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
};
