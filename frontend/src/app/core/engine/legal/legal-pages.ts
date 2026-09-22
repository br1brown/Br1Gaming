import type { Type } from '@angular/core';
import type { PageBaseComponent } from '../pages/page-base.component';
import type { PageType } from '../../../site';
import type { LegalPageSpec, ParentPageInput, SitePageInput } from '../siteBuilder';

/** Default "di sistema" per le 5 pagine legali standard (path, chiavi i18n, basename Markdown): dati, non meccanismo — il figlio li spreada col proprio `PageType`, o li ignora e scrive la propria voce per esteso. */
export const STANDARD_LEGAL_PAGES = {
    privacy:       { path: 'privacy',       titleKey: 'privacyPolicyMenu',       descriptionKey: 'privacyPolicyDescrizione',       markdownSlug: 'privacy' },
    cookie:        { path: 'cookie',        titleKey: 'cookiePolicyMenu',        descriptionKey: 'cookiePolicyDescrizione',        markdownSlug: 'cookie' },
    tos:           { path: 'termini',       titleKey: 'terminiPolicyMenu',       descriptionKey: 'terminiPolicyDescrizione',       markdownSlug: 'TOS' },
    legal:         { path: 'legal',         titleKey: 'noteLegaliPolicyMenu',    descriptionKey: 'noteLegaliPolicyDescrizione',    markdownSlug: 'legal' },
    accessibility: { path: 'accessibilita', titleKey: 'accessibilitaPolicyMenu', descriptionKey: 'accessibilitaPolicyDescrizione', markdownSlug: 'accessibility' },
} as const satisfies Record<string, Omit<LegalPageSpec, 'pageType'>>;

// import dinamico → nessun arco statico Engine→dominio; un solo chunk condiviso per le policy.
const loadPolicyComponent = (): Promise<Type<PageBaseComponent<string>>> =>
    import('../../../pages/policy/policy.component').then(m => m.PolicyComponent);

/** Sottoinsieme di `legalPages` gestito dall'Engine: esclude le voci il cui `pageType` il figlio
 *  ha già dichiarato a mano in `pages` (override — la sua vince, l'Engine non la crea e non ne
 *  carica il Markdown). */
export function filterManagedLegalPages(
    legalPages: readonly LegalPageSpec[],
    declared: ReadonlySet<PageType>,
): readonly LegalPageSpec[] {
    return legalPages.filter(spec => !declared.has(spec.pageType));
}

/** Nodo `policy/` con le pagine legali gestite dall'Engine (già filtrate da `filterManagedLegalPages`); null se vuota. Iniettato automaticamente da `buildSite`, stesso trattamento per ogni voce: la differenza vive solo nei dati. */
export function buildPolicySection(managed: readonly LegalPageSpec[]): ParentPageInput | null {
    if (managed.length === 0) return null;
    // role: 'legal' le fa interpretare come tali dal design system attivo (es. muro, che restituisce
    // il pannello per leggibilità). Niente smoke di default: LEGAL_CHROME_DEFAULT, scostabile via
    // ruoloPagina.legal.showSmoke.
    const children: SitePageInput[] = managed.map(spec => ({
        path: spec.path,
        title: spec.titleKey,
        description: spec.descriptionKey,
        pageType: spec.pageType,
        component: loadPolicyComponent,
        layout: { role: 'legal' },
        // Pagine di servizio: fuori indice e fuori sitemap per default (crawl budget sprecato su
        // contenuti che non portano traffico). Un figlio che le volesse indicizzate dichiara la
        // pagina a mano con `otherSEO.noindex: false` (override standard, vedi filterManagedLegalPages).
        otherSEO: { noindex: true },
    }));
    return { path: 'policy', title: 'policies', children };
}

/** Slug del Markdown legale per un PageType valorizzato, o `null` se non è una pagina legale
 *  gestita dall'Engine (assente, o overridden dal figlio). */
export function legalSlugFor(managed: readonly LegalPageSpec[], type: PageType): string | null {
    return managed.find(spec => spec.pageType === type)?.markdownSlug ?? null;
}
