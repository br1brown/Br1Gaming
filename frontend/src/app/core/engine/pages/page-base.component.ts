import { computed, Directive, effect, HostBinding, inject, input, PLATFORM_ID, resource } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AssetService } from '../services/asset.service';
import { NotificationService } from '../services/notification.service';
import { TranslateService } from '../services/translate.service';
import { PageMetaService } from '../services/page-meta.service';
import { PageType } from '../../../site';
import { ContentResolver, ResolvedPage } from '../../../pages/content.resolver';

/**
 * Base comune per tutte le pagine.
 *
 * Il generic T descrive il tipo del contenuto caricato dal resolver:
 *   class ArticoloComponent extends PageBaseComponent<ArticoloDTO> { ... }
 *
 * pageContent() è già tipizzato come T | null — nessun cast nei componenti figli.
 *
 * I meta tag SEO (titolo, descrizione, og:image) vengono aggiornati automaticamente
 * via effect() ogni volta che il contenuto cambia, incluso il cambio lingua.
 */
@Directive()
export abstract class PageBaseComponent<T> {
    private readonly contentResolverService = inject(ContentResolver);
    private readonly pageMeta = inject(PageMetaService);
    private readonly platformId = inject(PLATFORM_ID);
    readonly translate = inject(TranslateService);
    readonly api = inject(ApiService);
    readonly asset = inject(AssetService);
    readonly notify = inject(NotificationService);

    /** Tipo logico della pagina. Iniettato via route.data con withComponentInputBinding. */
    protected readonly pageType = input.required<PageType>();

    /** Dati grezzi dal resolver al momento della navigazione (SSR + client). */
    protected readonly contentByResolve = input<ResolvedPage<T> | null>(null);

    /**
     * Flag pageFade già risolto in routing.ts (gate: globale `shell.pageFade` + override per-pagina
     * `layout.pageFade`), iniettato via route.data come `pageType`. L'alias tiene libero il nome
     * `pageFade` per il getter @HostBinding sotto.
     */
    protected readonly pageFadeEnabled = input<boolean>(false, { alias: 'pageFade' });

    /**
     * Il fade è "tra pagine": NON deve scattare al primo caricamento (SSR + idratazione), dove la
     * shell sta ancora risolvendo i flag di layout della route e mostrerebbe lo stato sbagliato.
     * `router.navigated` è `false` durante la prima navigazione (passa a `true` solo al primo
     * NavigationEnd): catturandolo alla costruzione, la pagina d'ingresso non sfuma, quelle
     * raggiunte navigando sì. SSR e idratazione concordano (entrambi prima navigazione) → niente
     * mismatch sulla classe. Si somma a `withViewTransitions({ skipInitialTransition: true })`.
     */
    private readonly fadeAllowed = inject(Router).navigated;

    /**
     * Applica `.page-fade` sull'host quando il flag è attivo. DEVE essere @HostBinding, non
     * `host: {}` del decoratore: solo il primo si eredita nelle sottoclassi @Component — è ciò che
     * rende il fade automatico per ogni pagina. CSS e guardia reduced-motion in `base/_motion.scss`.
     */
    @HostBinding('class.page-fade')
    protected get pageFade(): boolean {
        return this.fadeAllowed && this.pageFadeEnabled();
    }

    /**
     * Ricarica del contenuto al cambio lingua (lato browser). `resource()` sostituisce l'effect
     * scritto a mano + la guardia `reqId`: gestisce da solo la cancellazione delle richieste
     * obsolete (l'ultima `params` vince, niente risposte stantie). In SSR `params` torna `undefined`
     * → resource idle, nessuna fetch lato server: il contenuto del primo render arriva da
     * `contentByResolve` (resolver del router). `defaultValue: null` → `.value()` è `null` (mai
     * throw, anche in errore) finché non c'è un caricamento completato.
     */
    private readonly contentResource = resource<ResolvedPage<T> | null, { pageType: PageType; lang: string } | undefined>({
        params: () => isPlatformBrowser(this.platformId)
            ? { pageType: this.pageType(), lang: this.translate.currentLang() }
            : undefined,
        loader: ({ params }) => this.contentResolverService.loadResolved(params.pageType, params.lang) as Promise<ResolvedPage<T>>,
        defaultValue: null,
    });

    /**
     * Contenuto risolto della pagina: il ricaricato dal browser (resource) quando c'è, altrimenti
     * quello del resolver del router. Così SSR / primo render usano `contentByResolve`, e dopo
     * l'idratazione il valore si aggiorna ad ogni cambio lingua.
     */
    private readonly _resolved = computed(() => this.contentResource.value() ?? this.contentByResolve());

    /** Contenuto sempre aggiornato della pagina corrente, tipizzato come T. */
    protected readonly pageContent = computed<T | null>(() =>
        (this._resolved()?.content ?? null) as T | null
    );

    /**
     * URL canonico della pagina corrente (senza query/hash, con origin forzato a
     * FRONTEND_BASE_URL in SSR). Espone alle pagine figlie solo "dove si è",
     * senza dare loro accesso all'intero PageMetaService.
     */
    protected getCurrentUrl(): string {
        return this.pageMeta.getCanonicalUrl();
    }

    constructor() {
        effect(() => {
            const resolved = this._resolved();
            const info = resolved?.info;
            if (!info) return;
            const title = info.title ? this.translate.translate(info.title) : '';
            const description = info.description ? this.translate.translate(info.description) : null;
            // structuredData dinamico (dal resolver, derivato dal contenuto) ha la precedenza sullo
            // statico dichiarato in site.ts (otherSEO.structuredData → info.structuredData).
            const structuredData = resolved?.structuredData ?? info.structuredData ?? null;
            this.pageMeta.setPageMeta({
                title, description,
                imgId: info.ogImage, ogType: info.ogType,
                structuredData,
            });
        });
    }
}
