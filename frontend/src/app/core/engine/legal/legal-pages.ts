import type { Type } from '@angular/core';
import type { PageBaseComponent } from '../pages/page-base.component';
import type { PageType } from '../../../site';
import type { ParentPageInput, SitePageInput } from '../siteBuilder';
import { COOKIE_MAP } from '../../services/cookie-registry';
import { ConsentCategory, type CookieConfig } from '../services/cookie/cookie-type';
import { environment } from '../../../../environments/environment';
import { FooterField } from '../footer-content';

/** Parti contestuali di una policy: `assets/legal/<pagina>/<nome>/<lingua>.md`, incluse solo se la
 *  funzione omonima è attiva (`<nome>/off/<lingua>.md`, facoltativo, solo se è spenta). */
export const LEGAL_PARTIALS = ['login', 'form', 'mail', 'errorReporting', 'analytics', 'profiling', 'tracking', 'cookiePolicy'] as const;
export type LegalPartial = (typeof LEGAL_PARTIALS)[number];

/** Sezione d'identità in coda a una policy: titolo (chiave i18n) e campi di `Identity` che la pagina
 *  deve mostrare, nell'ordine; un campo non valorizzato non compare, e senza campi la sezione non c'è. */
export interface LegalIdentity {
    titleKey: string;
    fields: readonly FooterField[];
}

/** Come si compone una policy tra `intro` e `outro`: parti contestuali in ordine, elenco cookie
 *  dopo l'intro, identità in coda. */
export interface LegalRecipe {
    partials?: readonly LegalPartial[];
    cookieList?: boolean;
    /** Stato di conformità reso dall'Engine dopo l'intro (Dichiarazione di accessibilità). */
    accessibilityStatus?: boolean;
    /** Sezione "Dati di navigazione" resa dall'Engine dopo l'intro, dai fatti dell'installazione (Privacy Policy). */
    navigationData?: boolean;
    identity?: LegalIdentity;
}

const F = FooterField;
const CONTATTI = [F.Email, F.Pec, F.Telefono] as const;
/** Privacy e Cookie (art. 13 GDPR): chi è il titolare e come contattarlo, DPO compreso. */
const IDENTITA_TITOLARE: LegalIdentity = {
    titleKey: 'titolareDelTrattamentoAzienda',
    fields: [F.RagioneSociale, F.SedeLegale, F.PartitaIvaCodiceFiscale, F.TitolareDelTrattamento, F.ResponsabileProtezioneDati, ...CONTATTI],
};
/** Termini: chi fornisce il servizio e come contattarlo. */
const IDENTITA_GESTORE: LegalIdentity = {
    titleKey: 'gestoreSitoPolicy',
    fields: [F.RagioneSociale, F.SedeLegale, F.PartitaIvaCodiceFiscale, ...CONTATTI],
};
/** Note legali (D.Lgs. 70/2003 art. 7, art. 2250 c.c.): identità completa dell'impresa. */
const IDENTITA_NOTE_LEGALI: LegalIdentity = {
    titleKey: 'gestoreSitoPolicy',
    fields: [F.RagioneSociale, F.SedeLegale, F.PartitaIvaCodiceFiscale, F.RegistroImprese, F.NumeroRea,
        F.CapitaleSociale, F.CapitaleVersato, F.SocioUnico, F.InLiquidazione, ...CONTATTI],
};
/** Dichiarazione di accessibilità: i recapiti per segnalare una barriera. */
const IDENTITA_CONTATTI: LegalIdentity = {
    titleKey: 'contattiAzienda',
    fields: [F.RagioneSociale, F.Email, F.Telefono],
};

/** Contenuto caricato di una policy: il PolicyComponent lo rende nell'ordine della ricetta. */
export interface LegalContent {
    intro: string;
    sections: string[];
    outro: string | null;
}

/** Quali parti contestuali sono attive: `Features` compilato (login solo se pubblico: quello riservato
 *  è degli amministratori), categorie di COOKIE_MAP, esistenza della Cookie Policy. */
export function activeLegalPartials(
    features: { publicLogin: boolean; forms: boolean; mail: boolean; errorReporting: boolean } | undefined,
    hasCookiePolicy: boolean,
): Record<LegalPartial, boolean> {
    const categories = (Object.values(COOKIE_MAP) as CookieConfig[]).map(c => c.category);
    const analytics = categories.includes(ConsentCategory.Analytics);
    const profiling = categories.includes(ConsentCategory.Profiling);
    return {
        login: features?.publicLogin ?? false,
        form: features?.forms ?? false,
        mail: features?.mail ?? false,
        errorReporting: features?.errorReporting ?? false,
        analytics,
        profiling,
        tracking: analytics || profiling,
        cookiePolicy: hasCookiePolicy,
    };
}

/** Segmento della rotta sotto `policy/`: uno per tutte le lingue, o uno per lingua (stessa forma di
 *  `path` delle pagine). Negli slot standard una lingua senza chiave usa il segmento inglese dell'Engine; nelle
 *  `extra`, come nelle pagine, quello della lingua di default. */
export type LegalPath = string | Partial<Record<string, string>>;

/** Una pagina legale in uno slot: il suo `PageType`, con la data di ultimo aggiornamento, il segmento di
 *  rotta e un Markdown sostitutivo se servono (stessa forma di `loginPage`: il `PageType` nudo basta).
 *  `markdown: 'nome'` fa della pagina il file `assets/legal/<nome>.<lingua>.md`: niente testi composti
 *  dall'Engine (dati di navigazione compresi), stato di accessibilità né sezione identità; la Cookie Policy tiene
 *  elenco cookie e pannello. */
export type LegalSlot = PageType | { page: PageType; updated?: Date; path?: LegalPath; markdown?: string };

/** Contenuto non accessibile noto, con testi in `addon.*.json`. */
export interface ContenutoNonAccessibile {
    /** Chiave i18n: quale contenuto e perché non è accessibile. */
    descrizioneKey: string;
    /** `non-conformita`: requisito non rispettato; `onere-sproporzionato`: deroga motivata;
     *  `fuori-ambito`: contenuto escluso dalla normativa (es. di terze parti fuori dal tuo controllo). */
    motivo: 'non-conformita' | 'onere-sproporzionato' | 'fuori-ambito';
    /** Chiave i18n dell'alternativa accessibile offerta, se c'è. */
    alternativaKey?: string;
}

/** Slot della Dichiarazione di accessibilità: come gli altri, più i contenuti non accessibili noti, che
 *  l'Engine elenca sotto lo stato di conformità (assenti o vuoti = stato pieno, senza criticità). */
export type AccessibilitySlot = PageType | { page: PageType; updated?: Date; path?: LegalPath; markdown?: string; nonAccessibili?: readonly ContenutoNonAccessibile[] };

/** Pagina legale in più (es. diritto di recesso): stesso trattamento delle standard (rotta sotto
 *  `policy/`, markdown in `assets/legal`, link nella fascia del footer), ma rotta e testi li dichiari tu. */
export interface ExtraLegalPage {
    page: PageType;
    /** Segmento sotto `policy/`, uno solo o uno per lingua. */
    path: LegalPath;
    /** Chiave i18n del titolo. */
    titleKey: string;
    /** Chiave i18n della descrizione. */
    descriptionKey: string;
    /** Nome del file: `assets/legal/<markdown>.<lingua>.md`, uno per lingua, aperto dal titolo `# `. */
    markdown: string;
    updated?: Date;
}

/** Sezione `legal` di `site.ts`: uno slot per pagina standard, valorizzato col `PageType` che il
 *  progetto sceglie. È lo slot a dare il significato: rotta, titolo e markdown li sa l'Engine. */
export interface LegalDefinition {
    /** Privacy Policy: obbligatoria, ogni sito riceve almeno l'IP dei visitatori. */
    privacy: LegalSlot;
    /** Cookie Policy: obbligatoria se il sito usa cookie di progetto o PWA (errore al build se manca);
     *  senza cookie la pagina non viene creata anche se lo slot è valorizzato. */
    cookie?: LegalSlot;
    termsOfService?: LegalSlot;
    legalNotice?: LegalSlot;
    accessibility?: AccessibilitySlot;
    /** Pagine legali in più, in coda alle standard. */
    extra?: readonly ExtraLegalPage[];
}

/** Pagina legale risolta: quella che l'Engine crea davvero. */
export interface LegalPageSpec {
    page: PageType;
    path: LegalPath;
    titleKey: string;
    descriptionKey: string;
    /** Cartella `assets/legal/<folder>/` di una pagina composta; assente con `markdown`. */
    folder?: string;
    updated?: Date;
    recipe: LegalRecipe;
    /** Markdown sostitutivo: la pagina è `assets/legal/<markdown>.<lingua>.md`, senza composizione. */
    markdown?: string;
    /** True per le pagine di `extra` (sempre con `markdown`). */
    extra?: boolean;
    /** Slot standard da cui viene la pagina (bersaglio dei link `policy:<slot>`); assente per le `extra`. */
    slot?: StandardSlot;
    /** Solo Dichiarazione di accessibilità: contenuti non accessibili noti. */
    nonAccessibili?: readonly ContenutoNonAccessibile[];
}

export type StandardSlot = 'privacy' | 'cookie' | 'termsOfService' | 'legalNotice' | 'accessibility';

/** Rotta, chiavi i18n, cartella e ricetta di ogni slot standard, nell'ordine della fascia del footer. */
const STANDARD: Record<StandardSlot, Omit<LegalPageSpec, 'page' | 'updated'>> = {
    privacy: {
        path: 'privacy', titleKey: 'privacyPolicyMenu', descriptionKey: 'privacyPolicyDescrizione', folder: 'privacy',
        recipe: { navigationData: true, partials: ['login', 'form', 'mail', 'errorReporting', 'analytics', 'profiling', 'cookiePolicy'], identity: IDENTITA_TITOLARE },
    },
    cookie: {
        path: 'cookie', titleKey: 'cookiePolicyMenu', descriptionKey: 'cookiePolicyDescrizione', folder: 'cookie',
        recipe: { cookieList: true, partials: ['tracking'], identity: IDENTITA_TITOLARE },
    },
    termsOfService: {
        path: { it: 'termini', en: 'terms' }, titleKey: 'terminiPolicyMenu', descriptionKey: 'terminiPolicyDescrizione', folder: 'TOS',
        recipe: { identity: IDENTITA_GESTORE },
    },
    legalNotice: {
        path: 'legal', titleKey: 'noteLegaliPolicyMenu', descriptionKey: 'noteLegaliPolicyDescrizione', folder: 'legal',
        recipe: { identity: IDENTITA_NOTE_LEGALI },
    },
    accessibility: {
        path: { it: 'accessibilita', en: 'accessibility' }, titleKey: 'accessibilitaPolicyMenu', descriptionKey: 'accessibilitaPolicyDescrizione', folder: 'accessibility',
        recipe: { accessibilityStatus: true, identity: IDENTITA_CONTATTI },
    },
};

/** Link a un'altra pagina legale nei testi Markdown: `[Cookie Policy](policy:cookie)`, bersaglio = nome dello slot. */
export const LEGAL_LINK = /\[([^\]]*)\]\(policy:([A-Za-z]+)\)/g;

/** Slot standard, validi come bersaglio di `policy:<slot>`. */
export const STANDARD_SLOTS: readonly StandardSlot[] = ['privacy', 'cookie', 'termsOfService', 'legalNotice', 'accessibility'];

/** Riscrive i link `policy:<slot>` nel percorso della pagina di quello slot (`pathOf`, già nella lingua giusta);
 *  una pagina che non esiste lascia il solo testo del link. */
export function resolveLegalLinks(markdown: string, pathOf: (slot: string) => string | null): string {
    return markdown.replace(LEGAL_LINK, (_, text: string, slot: string) => {
        const path = pathOf(slot);
        return path != null ? `[${text}](${path})` : text;
    });
}

/** Nome di un Markdown sostitutivo o di una pagina `extra`: un solo nome di file, senza estensione né lingua. */
export const LEGAL_MARKDOWN_NAME = /^[A-Za-z0-9_-]+$/;

function unwrap(slot: LegalSlot | AccessibilitySlot): { page: PageType; updated?: Date; path?: LegalPath; markdown?: string; nonAccessibili?: readonly ContenutoNonAccessibile[] } {
    return typeof slot === 'object' ? slot : { page: slot };
}

/** Nome valido e non già usato da un'altra pagina (senza maiuscole: su Windows e macOS coincidono). */
function checkMarkdownName(name: string, where: string, seen: Set<string>): void {
    if (!LEGAL_MARKDOWN_NAME.test(name)) {
        throw new Error(`[SiteBuilder] ${where}: markdown "${name}" non valido (lettere, cifre, "_" e "-": il file è assets/legal/<markdown>.<lingua>.md).`);
    }
    if (seen.has(name.toLowerCase())) throw new Error(`[SiteBuilder] ${where}: markdown "${name}" usato da più pagine legali.`);
    seen.add(name.toLowerCase());
}

/** Segmento per ogni lingua del sito: quello dichiarato dal progetto, poi quello dell'Engine, poi
 *  l'inglese dell'Engine per una lingua che nessuno dei due nomina (es. `fr`). */
function pathPerLingua(engine: LegalPath, progetto: LegalPath | undefined): LegalPath {
    if (typeof progetto === 'string') return progetto;
    if (typeof engine === 'string' && progetto == null) return engine;
    const base: Partial<Record<string, string>> = typeof engine === 'string' ? {} : engine;
    const neutro = typeof engine === 'string' ? engine : (engine['en'] ?? Object.values(engine)[0] ?? '');
    return Object.fromEntries(environment.availableLanguages.map(lang =>
        [lang, progetto?.[lang] ?? base[lang] ?? neutro]));
}

const MOTIVI_NON_ACCESSIBILE: readonly string[] = ['non-conformita', 'onere-sproporzionato', 'fuori-ambito'];

/** Voci di `nonAccessibili` complete e con un motivo previsto. */
function checkNonAccessibili(voci: readonly ContenutoNonAccessibile[] | undefined): void {
    for (const c of voci ?? []) {
        if (!c?.descrizioneKey?.trim()) throw new Error('[SiteBuilder] legal.accessibility.nonAccessibili: ogni voce vuole una descrizioneKey.');
        if (!MOTIVI_NON_ACCESSIBILE.includes(c.motivo)) {
            throw new Error(`[SiteBuilder] legal.accessibility.nonAccessibili: motivo "${c.motivo}" non valido (${MOTIVI_NON_ACCESSIBILE.join(' | ')}).`);
        }
    }
}


/** Pagine legali del sito: gli slot valorizzati, con la Cookie Policy solo se `usesCookies`
 *  (`hasCookiesConfigured`), poi `extra`. */
export function resolveLegalPages(legal: LegalDefinition, usesCookies: boolean): LegalPageSpec[] {
    if (usesCookies && legal.cookie == null) {
        throw new Error(
            '[SiteBuilder] Il sito usa cookie (PWA o voci in COOKIE_MAP) ma `legal.cookie` non è ' +
            'valorizzato in site.ts: la Cookie Policy è obbligatoria, assegnale un PageType.'
        );
    }
    const markdownNames = new Set<string>();
    const standard = (Object.keys(STANDARD) as StandardSlot[])
        .filter(slot => legal[slot] != null && (slot !== 'cookie' || usesCookies))
        .map((slot): LegalPageSpec => {
            const declared = unwrap(legal[slot]!);
            const spec: LegalPageSpec = { ...STANDARD[slot], ...declared, slot, path: pathPerLingua(STANDARD[slot].path, declared.path) };
            if (declared.markdown == null) {
                if (slot === 'accessibility') checkNonAccessibili(declared.nonAccessibili);
                return spec;
            }
            checkMarkdownName(declared.markdown, `legal.${slot}`, markdownNames);
            if (declared.nonAccessibili != null) {
                throw new Error('[SiteBuilder] legal.accessibility: con `markdown` la pagina è il file e basta, `nonAccessibili` non si usa.');
            }
            // Il testo è del progetto; l'elenco cookie resta dell'Engine, perché lo genera COOKIE_MAP.
            return { ...spec, recipe: { cookieList: spec.recipe.cookieList } };
        });
    const extra = (legal.extra ?? []).map((page): LegalPageSpec => {
        checkMarkdownName(page.markdown, 'legal.extra', markdownNames);
        return { ...page, recipe: {}, extra: true };
    });
    return [...standard, ...extra];
}

// import dinamico → nessun arco statico Engine→dominio; un solo chunk condiviso per le policy.
const loadPolicyComponent = (): Promise<Type<PageBaseComponent<LegalContent>>> =>
    import('../pages/policy/policy.component').then(m => m.PolicyComponent);

/** Sottoinsieme gestito dall'Engine: esclude le pagine il cui `PageType` il progetto ha già
 *  dichiarato a mano in `pages` (override — la sua vince, l'Engine non la crea e non ne carica il
 *  Markdown). */
export function filterManagedLegalPages(
    legalPages: readonly LegalPageSpec[],
    declared: ReadonlySet<PageType>,
): readonly LegalPageSpec[] {
    return legalPages.filter(spec => !declared.has(spec.page));
}

/** Nodo `policy/` con le pagine legali gestite dall'Engine (già filtrate da `filterManagedLegalPages`); null se vuota. Iniettato automaticamente da `buildSite`, stesso trattamento per ogni voce: la differenza vive solo nei dati. */
export function buildPolicySection(managed: readonly LegalPageSpec[]): ParentPageInput | null {
    if (managed.length === 0) return null;
    // role: 'legal' le affida al design system attivo tramite ruoloPagina.legal. Di serie niente
    // smoke (LEGAL_CHROME_DEFAULT); il ruolo può spegnere altro, mai accendere ciò che il design system tiene spento.
    const children: SitePageInput[] = managed.map(spec => ({
        path: spec.path,
        title: spec.titleKey,
        description: spec.descriptionKey,
        pageType: spec.page,
        component: loadPolicyComponent,
        layout: { role: 'legal' },
        // Pagine di servizio: fuori indice e fuori sitemap per default (crawl budget sprecato su
        // contenuti che non portano traffico). Un figlio che le volesse indicizzate dichiara la
        // pagina a mano con `otherSEO.noindex: false` (override standard, vedi filterManagedLegalPages).
        otherSEO: { noindex: true },
    }));
    return { path: 'policy', title: 'policies', children };
}
