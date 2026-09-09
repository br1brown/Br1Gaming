import { CSP_NONCE, inject, Injectable, InjectionToken, DOCUMENT, signal, Signal } from '@angular/core';

import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { ContestoSito, PageType } from '../../../site';
import { onNavigationEnd, mergeRouteParams } from '../routing';
import { applyPathParams, pickLocaleText } from '../siteBuilder';
import { CdnCgi } from './asset.service';
import { TranslateService } from './translate.service';
import { IdentityService } from './identity.service';
import { type Identity, type Address, type DayName, DAY_ORDER } from '../dto/identity.dto';
import { type StructuredDataInput, buildStructuredDataGraph } from './structured-data';
import { BreadcrumbService, toJsonLdTrail } from './breadcrumb';

/** Orario "HH:mm" (24h): difesa contro valori sporchi prima di mapparli su JSON-LD. */
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function isHm(value: unknown): value is string {
    return typeof value === 'string' && HM_RE.test(value);
}

/** Input di {@link PageMetaService.setPageMeta}. Tutti i campi tranne `title` sono opzionali. */
export interface PageMetaInput {
    /** Titolo grezzo della pagina (es. "Home", non "Home | Template"). */
    title: string;
    /** Meta-description. Se assente/null si usa la `site.description` di default (localizzata). */
    description?: string | null;
    /** ID asset anteprima: `string` = variante immagine; `false` = nessuna anteprima; assente = variante testuale. */
    imgId?: string | null | false;
    /** Tipo Open Graph (es. 'website', 'article'). Default: 'website'. */
    ogType?: string | null;
    /** Timestamp ISO 8601 ultima modifica (og:updated_time). Se assente resta il valore di build. */
    updatedTime?: string | null;
    /** Dati strutturati ricchi tipizzati: un item o una lista (vedi `structured-data.ts`). Tradotti in JSON-LD. */
    structuredData?: StructuredDataInput | null;
    /** Se true, emette `<meta name="robots" content="noindex, nofollow">`. */
    noindex?: boolean | null;
}

/** Funzione sincrona di cifratura del payload preview (disponibile solo in SSR). */
export const SSR_PREVIEW_ENCRYPT_FN =
    new InjectionToken<(payload: Record<string, string>) => string>('SSR_PREVIEW_ENCRYPT_FN');

/** Origin canonico del frontend letto da FRONTEND_BASE_URL (SSR). */
export const SSR_FRONTEND_ORIGIN =
    new InjectionToken<string>('SSR_FRONTEND_ORIGIN');

/** Gestisce l'aggiornamento dinamico del titolo della pagina e dei meta tag. */
@Injectable({ providedIn: 'root' })
export class PageMetaService {
    private readonly title = inject(Title);
    private readonly meta = inject(Meta);
    private readonly document = inject(DOCUMENT);
    private readonly translate = inject(TranslateService);
    private readonly identity = inject(IdentityService);
    private readonly breadcrumb = inject(BreadcrumbService);
    private readonly router = inject(Router);
    private readonly cspNonce = inject(CSP_NONCE, { optional: true });

    /** Cifratura preview: disponibile solo in SSR, null nel browser. */
    private readonly encryptFn = inject(SSR_PREVIEW_ENCRYPT_FN, { optional: true });
    /** Origin del frontend: fornito in SSR, null nel browser. */
    private readonly frontendOrigin = inject(SSR_FRONTEND_ORIGIN, { optional: true });

    /** Titolo browser dell'ultima navigazione per annunci aria-live. */
    readonly announcedTitle = signal('');

    /** Titolo risolto dell'ultima pagina senza il suffisso dell'app. */
    readonly resolvedTitle = signal('');

    /** Trova l'ultima rotta figlia attiva nell'albero delle rotte. */
    static getLeaf(route: ActivatedRouteSnapshot | RouterStateSnapshot): ActivatedRouteSnapshot {
        let leaf = route instanceof RouterStateSnapshot ? route.root : route;
        while (leaf.firstChild) leaf = leaf.firstChild;
        return leaf;
    }

    /** Applica metadati, Open Graph, Twitter card e structured data alla pagina corrente. */
    setPageMeta(input: PageMetaInput): void {
        const { title: pageTitle, description, imgId, ogType, updatedTime, structuredData, noindex } = input;

        // Titolo browser: "Pagina | AppName", oppure solo "AppName" se pageTitle è vuoto
        const { appName } = ContestoSito.config;
        const browserTitle = pageTitle ? `${pageTitle} | ${appName}` : appName;

        // Aggiorna il tag <title> del browser
        this.title.setTitle(browserTitle);
        this.announcedTitle.set(browserTitle);
        this.resolvedTitle.set(pageTitle || appName);

        // noindex di istanza: assente/false → nessun tag (la pagina segue l'indicizzazione di
        // default, eventualmente già coperta dall'header statico). true → meta esplicito, letto
        // dai crawler sull'HTML SSR esattamente come l'header, senza bisogno di eseguire JS.
        if (noindex) {
            this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
        } else {
            this.meta.removeTag('name="robots"');
        }

        // Aggiorna i tag per i social (Open Graph e Twitter)
        this.meta.updateTag({ name: 'twitter:title', content: browserTitle });
        this.meta.updateTag({ property: 'og:title', content: browserTitle });

        // twitter:site (@handle del brand) derivato dai profili social, se ce n'è uno Twitter/X.
        const twitterSite = this.twitterSiteHandle();
        if (twitterSite) this.meta.updateTag({ name: 'twitter:site', content: twitterSite });

        // Description: se la pagina non ne ha una, si ricade sulla description di default del
        // sito (localizzata) anziché lasciare quella della pagina precedente — che in navigazione
        // SPA resterebbe "stantia". I crawler vedono l'SSR fresco, ma così è coerente anche lato client.
        const metaDescription = description
            ?? pickLocaleText(ContestoSito.config.description, this.translate.currentLang());
        if (metaDescription) {
            this.meta.updateTag({ name: 'description', content: metaDescription });
            this.meta.updateTag({ property: 'og:description', content: metaDescription });
            this.meta.updateTag({ name: 'twitter:description', content: metaDescription });
        }

        const canonicalUrl = this.getCanonicalUrl();
        const origin = this.getCanonicalOrigin(canonicalUrl);

        this.meta.updateTag({ property: 'og:url', content: canonicalUrl });

        // Gestione del tag rel="canonical"
        this.updateCanonical(canonicalUrl);

        // Aggiorna og:type (default: website)
        this.meta.updateTag({ property: 'og:type', content: ogType || 'website' });

        // Override per-pagina di og:updated_time. Se assente resta il valore
        // globale di build (segnale di refresh per gli scraper social a ogni deploy).
        if (updatedTime) {
            this.meta.updateTag({ property: 'og:updated_time', content: updatedTime });
        }

        // Aggiorna og:locale e og:locale:alternate per i18n
        this.updateLocaleMetaTags();
        // hreflang: per le pagine con più varianti lingua (URL distinti per lingua).
        this.updateHreflangTags(origin);

        // Anteprima social: in SSR cifra il payload e genera l'URL
        let imageUrl: string | null = null;
        if (imgId === false) {
            this.meta.removeTag('property="og:image"');
            this.meta.removeTag('name="twitter:image"');
            this.removeImageDimensionTags();
            this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
        } else if (this.encryptFn) {
            const payload: Record<string, string> = { title: pageTitle };
            if (description) payload['subtitle'] = description;
            if (imgId) payload['id'] = imgId;
            if (ContestoSito.config.onlyPlainImage) payload['onlyImage'] = 'true';
            const blob = this.encryptFn(payload);
            imageUrl = `${origin}${CdnCgi.preview}?p=${blob}`;
            this.meta.updateTag({ property: 'og:image', content: imageUrl });
            this.meta.updateTag({ name: 'twitter:image', content: imageUrl });

            this.meta.updateTag({ property: 'og:image:width', content: '1200' });
            this.meta.updateTag({ property: 'og:image:height', content: '630' });
            this.meta.updateTag({ property: 'og:image:type', content: imgId ? 'image/jpeg' : 'image/png' });
            this.meta.updateTag({ property: 'og:image:alt', content: browserTitle });
            this.meta.updateTag({ name: 'twitter:image:alt', content: browserTitle });
            if (imageUrl.startsWith('https:')) {
                this.meta.updateTag({ property: 'og:image:secure_url', content: imageUrl });
            }
            this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
        }

        // Aggiorna JSON-LD structured data (usa la description risolta, coerente con i meta tag)
        this.updateStructuredData(pageTitle || appName, metaDescription, imageUrl, canonicalUrl, structuredData, updatedTime);
    }

    /** Aggiorna i meta tag Open Graph `article:*`. */
    private updateArticleMeta(ogMeta: { property: string; content: string }[]): void {
        this.document.querySelectorAll('meta[property^="article:"]').forEach(tag => tag.remove());
        for (const { property, content } of ogMeta) {
            this.meta.addTag({ property, content });
        }
    }

    /** Estrae l'handle Twitter/X dai profili social per `twitter:site`. */
    private twitterSiteHandle(): string | null {
        const social = this.identity.identity()?.social;
        if (!Array.isArray(social)) return null;
        for (const entry of social) {
            if (typeof entry?.url !== 'string') continue;
            let parsed: URL;
            try { parsed = new URL(entry.url); } catch { continue; }
            const host = parsed.hostname.replace(/^www\./, '');
            if (host !== 'twitter.com' && host !== 'x.com') continue;
            const handle = parsed.pathname.split('/').filter(Boolean)[0]?.replace(/^@/, '');
            if (handle && /^[A-Za-z0-9_]{1,15}$/.test(handle)) return `@${handle}`;
        }
        return null;
    }

    /** `PostalAddress` da un indirizzo dell'identità (sede legale o operativa). Null se nessun campo utile. */
    private buildPostalAddress(a: Address | null | undefined): Record<string, unknown> | null {
        if (!a) return null;
        const street = [a.via, a.civico].filter(s => typeof s === 'string' && s.trim()).join(' ').trim();
        const addr: Record<string, unknown> = { '@type': 'PostalAddress' };
        if (street) addr['streetAddress'] = street;
        if (a.cap?.trim()) addr['postalCode'] = a.cap.trim();
        if (a.citta?.trim()) addr['addressLocality'] = a.citta.trim();
        if (a.provincia?.trim()) addr['addressRegion'] = a.provincia.trim();
        // Codice ISO 3166-1 alpha-2
        if (a.nazione?.trim()) addr['addressCountry'] = a.nazione.trim();
        return Object.keys(addr).length > 1 ? addr : null;
    }

    /** Costruisce il nodo schema.org `ContactPoint` con contatti, orari e lingue. */
    private buildContactPoint(identity: Identity | null, includeHours = true): Record<string, unknown> | null {
        const c = identity?.contatti;
        const hours = includeHours ? this.buildOpeningHours(identity) : [];
        const cp: Record<string, unknown> = { '@type': 'ContactPoint', contactType: 'customer service' };
        const { jsonld } = ContestoSito.config;
        if (jsonld.telefono && c?.telefono?.trim()) cp['telephone'] = c.telefono.trim();
        if (jsonld.email && c?.email?.trim()) cp['email'] = c.email.trim();
        if (hours.length) cp['hoursAvailable'] = hours;
        if (!cp['telephone'] && !cp['email'] && !hours.length) return null;
        const langs = this.translate.availableLangs();
        if (Array.isArray(langs) && langs.length) cp['availableLanguage'] = langs;
        return cp;
    }

    /** Converte gli orari di apertura in `OpeningHoursSpecification[]`. */
    private buildOpeningHours(identity: Identity | null): Record<string, unknown>[] {
        const list = identity?.openingHours;
        if (!Array.isArray(list)) return [];

        const byRange = new Map<string, { opens: string; closes: string; days: DayName[] }>();
        for (const it of list) {
            if (!it || !DAY_ORDER.includes(it.day) || !isHm(it.opens) || !isHm(it.closes)) continue;
            const group = byRange.get(`${it.opens}-${it.closes}`);
            if (group) { if (!group.days.includes(it.day)) group.days.push(it.day); }
            else byRange.set(`${it.opens}-${it.closes}`, { opens: it.opens, closes: it.closes, days: [it.day] });
        }

        const out: Record<string, unknown>[] = [];
        for (const { opens, closes, days } of byRange.values()) {
            out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: days.map(d => `https://schema.org/${d}`), opens, closes });
        }
        return out;
    }

    /** Rimuove i tag accessori dell'immagine di anteprima. */
    private removeImageDimensionTags(): void {
        this.meta.removeTag('property="og:image:width"');
        this.meta.removeTag('property="og:image:height"');
        this.meta.removeTag('property="og:image:type"');
        this.meta.removeTag('property="og:image:alt"');
        this.meta.removeTag('property="og:image:secure_url"');
        this.meta.removeTag('name="twitter:image:alt"');
    }

    /** Aggiorna og:locale e og:locale:alternate per la lingua corrente e le alternative. */
    private updateLocaleMetaTags(): void {
        const currentLang = this.translate.currentLang();
        const allLangs = this.translate.availableLangs();

        const localeFormat = (lang: string): string => {
            try {
                const locale = new Intl.Locale(lang).maximize();
                return locale.region ? `${locale.language}_${locale.region}` : locale.language;
            } catch {
                const [base] = lang.split('-');
                return `${base}_${base.toUpperCase()}`;
            }
        };

        this.meta.updateTag({ property: 'og:locale', content: localeFormat(currentLang) });

        // Alternate locales per le altre lingue disponibili
        this.document
            .querySelectorAll('meta[property="og:locale:alternate"]')
            .forEach(tag => tag.remove());
        allLangs
            .filter(l => l !== currentLang)
            .forEach(lang => {
                this.meta.addTag({ property: 'og:locale:alternate', content: localeFormat(lang) });
            });
    }

    /** Aggiorna i tag `<link rel="alternate" hreflang="...">` e `x-default`. */
    private updateHreflangTags(origin: string): void {
        this.document
            .querySelectorAll('link[rel="alternate"][hreflang]')
            .forEach(tag => tag.remove());

        const allLangs = this.translate.availableLangs();
        if (allLangs.length <= 1) return;

        const pageType = this.currentPageType();
        if (pageType == null) return;

        const params = mergeRouteParams(this.router.routerState.snapshot);

        const addHreflang = (hreflang: string, path: string): void => {
            const link = this.document.createElement('link');
            link.rel = 'alternate';
            link.setAttribute('hreflang', hreflang);
            link.href = `${origin}${path}`;
            this.document.head.appendChild(link);
        };

        for (const lang of allLangs) {
            const path = ContestoSito.getPath(pageType, lang);
            if (path) addHreflang(lang, applyPathParams(path, params, 'PageMetaService.updateHreflangTags'));
        }
        const defaultPath = ContestoSito.getPath(pageType, this.translate.defaultLang);
        if (defaultPath) addHreflang('x-default', applyPathParams(defaultPath, params, 'PageMetaService.updateHreflangTags'));
    }

    /** Aggiorna gli script JSON-LD con structured data coerenti con il canonical. */
    private updateStructuredData(
        title: string,
        description?: string | null,
        imageUrl?: string | null,
        canonicalUrl: string = this.getCanonicalUrl(),
        structuredData?: StructuredDataInput | null,
        dateModified?: string | null,
    ): void {
        const { appName } = ContestoSito.config;
        const siteUrl = this.getSiteUrl(canonicalUrl);
        const currentLang = this.translate.currentLang();
        const identity = this.identity.identity();
        const businessType = typeof identity?.businessType === 'string' && identity.businessType.trim()
            ? identity.businessType.trim() : null;
        const isPerson = (identity?.personal ?? false) && !businessType;
        const publisherId = `${siteUrl}#${isPerson ? 'person' : 'organization'}`;
        const websiteId = `${siteUrl}#website`;
        const pageId = `${canonicalUrl}#webpage`;

        const social = Array.isArray(identity?.social)
            ? identity.social.map(s => s?.url).filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
            : [];
        const brandImage = `${siteUrl}icons/icon-512x512.png`;
        const address = ContestoSito.config.jsonld.indirizzo
            ? this.buildPostalAddress(
                (businessType && identity?.sedeOperativa) ? identity.sedeOperativa : identity?.sedeLegale)
            : null;
        const openingHours = businessType ? this.buildOpeningHours(identity) : [];
        const contactPoint = this.buildContactPoint(identity, !businessType);
        const publisher = {
            '@type': businessType ?? (isPerson ? 'Person' : 'Organization'),
            name: identity?.ragioneSociale || appName,
            url: siteUrl,
            ...(isPerson ? { image: brandImage } : { logo: brandImage }),
            ...(!isPerson && identity?.ragioneSociale && { legalName: identity.ragioneSociale }),
            ...(!isPerson && ContestoSito.config.jsonld.partitaIva && identity?.partitaIva && { vatID: identity.partitaIva }),
            ...(!isPerson && ContestoSito.config.jsonld.codiceFiscale && identity?.codiceFiscale && { taxID: identity.codiceFiscale }),
            ...(social.length > 0 && { sameAs: social }),
            ...(address && { address }),
            ...(openingHours.length > 0 && { openingHoursSpecification: openingHours }),
            ...(contactPoint && { contactPoint }),
            ...(identity?.extra && typeof identity.extra === 'object' ? identity.extra : {}),
            '@context': 'https://schema.org',
            '@id': publisherId,
        };

        const siteDescription = pickLocaleText(ContestoSito.config.description, currentLang);
        const website = {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            '@id': websiteId,
            url: siteUrl,
            name: appName,
            ...(siteDescription && { description: siteDescription }),
            inLanguage: currentLang,
            publisher: { '@id': publisherId },
        };

        const sd = buildStructuredDataGraph(structuredData, { pageName: title, imageUrl, dateModified: dateModified ?? undefined, publisherId });

        this.updateArticleMeta(sd.ogMeta);

        const webPage = {
            '@context': 'https://schema.org',
            '@type': sd.pageType ?? 'WebPage',
            '@id': pageId,
            name: title,
            ...(description && { description }),
            url: canonicalUrl,
            inLanguage: currentLang,
            ...(dateModified && { dateModified }),
            isPartOf: { '@id': websiteId },
            publisher: { '@id': publisherId },
            ...(imageUrl && {
                image: {
                    '@type': 'ImageObject',
                    url: imageUrl
                }
            }),
            ...sd.pageProps,
        };

        const graph: object[] = [publisher, website, webPage, ...sd.nodes];
        const breadcrumb = this.buildBreadcrumbData(title, siteUrl);
        if (breadcrumb) graph.push(breadcrumb);

        this.document
            .querySelectorAll('script[type="application/ld+json"][data-br1-jsonld]')
            .forEach(script => script.remove());

        graph.forEach((data, index) => {
            const script = this.document.createElement('script');
            script.type = 'application/ld+json';
            script.setAttribute('data-br1-jsonld', String(index));
            if (this.cspNonce) script.nonce = this.cspNonce;
            // Escape caratteri speciali per prevenzione XSS
            script.textContent = JSON.stringify(data)
                .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
            this.document.head.appendChild(script);
        });
    }

    /** Costruisce il canonical URL rimuovendo query e hash (con origin forzato in SSR). */
    public getCanonicalUrl(): string {
        try {
            const parsed = new URL(this.document.URL);
            parsed.search = '';
            parsed.hash = '';

            const configuredOrigin = this.frontendOrigin?.replace(/\/$/, '');
            if (configuredOrigin) {
                const configured = new URL(configuredOrigin);
                parsed.protocol = configured.protocol;
                parsed.host = configured.host;
            }

            return parsed.toString();
        } catch {
            return this.frontendOrigin?.replace(/\/$/, '') || '/';
        }
    }

    public readonly currentPageType: Signal<PageType | undefined> = onNavigationEnd(
        router => PageMetaService.getLeaf(router.routerState.snapshot).data['pageType'] as PageType | undefined,
        PageMetaService.getLeaf(inject(Router).routerState.snapshot).data['pageType'] as PageType | undefined
    );

    private getCanonicalOrigin(canonicalUrl: string): string {
        try { return new URL(canonicalUrl).origin; } catch { return ''; }
    }

    private getSiteUrl(canonicalUrl: string): string {
        const origin = this.getCanonicalOrigin(canonicalUrl);
        return origin ? `${origin}/` : '/';
    }

    /** Costruisce il nodo schema.org `BreadcrumbList` per la pagina corrente. */
    private buildBreadcrumbData(title: string, siteUrl: string): object | null {
        const pageType = this.currentPageType();
        if (pageType == null) return null;

        const trail = this.breadcrumb.trailFor(pageType, {
            lang: this.translate.currentLang(),
            params: mergeRouteParams(this.router.routerState.snapshot),
            currentTitle: title,
        });
        const collapsed = toJsonLdTrail(trail);
        if (!collapsed) return null;

        const origin = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
        return {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: collapsed.map((item, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: item.label,
                ...(item.path && { item: `${origin}${item.path}` }),
            })),
        };
    }

    /** Aggiorna o inserisce il tag `<link rel="canonical">` nel `<head>`. */
    private updateCanonical(url: string): void {
        const existing = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (existing) {
            existing.href = url;
            return;
        }
        const link = this.document.createElement('link');
        link.rel = 'canonical';
        link.href = url;
        this.document.head.appendChild(link);
    }
}
