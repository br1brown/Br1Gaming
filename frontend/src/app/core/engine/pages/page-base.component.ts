import { computed, Directive, effect, HostBinding, inject, input, PLATFORM_ID, resource, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { ApiError } from '../services/base-api.service';
import { AssetService } from '../services/asset.service';
import { NotificationService } from '../services/notification.service';
import { TranslateService } from '../services/translate.service';
import { PageMetaService } from '../services/page-meta.service';
import { PageType } from '../../../site';
import { ContentResolver, ResolvedPage } from './content.resolver';

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

    /** Lingua della route corrente (es. "it", "en"). Iniettata via route.data come `pageType` —
     *  è la fonte di verità URL→lingua: il costruttore la sincronizza su TranslateService. */
    protected readonly lang = input.required<string>();

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
    private readonly engineRouter = inject(Router);
    private readonly fadeAllowed = this.engineRouter.navigated;

    /**
     * Applica `.page-fade` sull'host quando il flag è attivo. DEVE essere @HostBinding, non
     * `host: {}` del decoratore: solo il primo si eredita nelle sottoclassi @Component — è ciò che
     * rende il fade automatico per ogni pagina. CSS e guardia reduced-motion in `base/_motion.scss`.
     */
    @HostBinding('class.page-fade')
    protected get pageFade(): boolean {
        return this.fadeAllowed && this.pageFadeEnabled();
    }

    /** Parametro `:slug` della rotta corrente, se presente — reattivo anche entro la stessa istanza
     *  componente (una rotta parametrica riusa l'istanza al cambio di solo `:slug`, senza
     *  ricreazione): senza questo, il ricaricato sotto perderebbe lo slug dopo la prima navigazione.
     *  Nome convenzionale, stesso di contentLoaderResolver. */
    private readonly activatedRoute = inject(ActivatedRoute);
    private readonly routeSlug = toSignal(
        this.activatedRoute.paramMap.pipe(map(pm => pm.get('slug') ?? undefined)),
        { initialValue: this.activatedRoute.snapshot.paramMap.get('slug') ?? undefined }
    );

    /**
     * Ricarica del contenuto al cambio lingua (lato browser). `resource()` sostituisce l'effect
     * scritto a mano + la guardia `reqId`: gestisce da solo la cancellazione delle richieste
     * obsolete (l'ultima `params` vince, niente risposte stantie). In SSR `params` torna `undefined`
     * → resource idle, nessuna fetch lato server: il contenuto del primo render arriva da
     * `contentByResolve` (resolver del router). `defaultValue: null` → `.value()` è `null` (mai
     * throw, anche in errore) finché non c'è un caricamento completato.
     */
    private readonly contentResource = resource<ResolvedPage<T> | null, { pageType: PageType; lang: string; slug?: string } | undefined>({
        params: () => isPlatformBrowser(this.platformId)
            // this.lang() (l'input di route, sincrono) e NON this.translate.currentLang(): quest'ultimo
            // si aggiorna in modo asincrono (l'effect sotto attende setLanguage()), this.lang() è già
            // corretto nello stesso istante — niente fetch nella lingua vecchia al mount della pagina.
            ? { pageType: this.pageType(), lang: this.lang(), slug: this.routeSlug() }
            : undefined, // SSR: nessuna fetch qui, il primo contenuto arriva da contentByResolve (resolver del router).
        // Ricaricato client (cambio lingua): non passa dal resolver del router, quindi un 404
        // (slug diventato invalido) non può tornare come UrlTree — l'unica via è navigare
        // esplicitamente. Stesso trattamento di contentLoaderResolver: solo il 404 dirotta, ogni
        // altro errore resta silenzioso (apiErrorInterceptor ha già avvisato l'utente).
        loader: ({ params }) => this.contentResolverService.loadResolved(params.pageType, params.lang, params.slug)
            .catch(error => {
                if (error instanceof ApiError && error.status === 404) {
                    void this.engineRouter.navigateByUrl('/error/404');
                    return null;
                }
                throw error;
            }) as Promise<ResolvedPage<T> | null>,
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

    /** Data ISO (YYYY-MM-DD) di ultimo aggiornamento REALE del contenuto, per `og:updated_time` e
     *  `dateModified` JSON-LD — diversa dalla data di build/deploy, che l'Engine già gestisce da sé.
     *  Default `null`: quasi nessuna pagina ne ha una vera. Override dove esiste (es. PolicyComponent,
     *  dalla data dichiarata in legal.pages.ts). */
    protected pageUpdatedOn(): string | null {
        return null;
    }

    constructor() {
        // PUNTO UNICO "URL → stato lingua app": ogni pagina, al mount, allinea TranslateService alla
        // lingua della propria route. Gira una volta per ogni NUOVA istanza di pagina (la route reuse
        // strategy di default ricrea sempre il componente quando il path cambia, es. /pagina → /en/pagina).
        effect(() => {
            const lang = this.lang(); // lingua dichiarata dalla route corrente (route.data.lang).
            // Guardia: senza, ogni navigazione — anche fra due pagine della STESSA lingua — rifetcherebbe
            // i cataloghi i18n inutilmente. Con una sola lingua configurata, lang === currentLang() SEMPRE
            // dopo il bootstrap: questo effect non fa mai nulla, zero overhead per i siti mono-lingua.
            // `untracked`: currentLang() va letto ma NON tracciato come dipendenza, altrimenti questo
            // effect si ririeseguirebbe ad ogni cambio lingua globale (anche innescato da un'ALTRA
            // istanza pagina in fase di navigazione/distruzione), rimettendo `this.lang()` (vecchia
            // route) come lingua corrente mentre il resolver della nuova pagina sta ancora fetchando —
            // causa della race che faceva tornare i dati in italiano dopo lo switch a inglese.
            if (lang !== untracked(() => this.translate.currentLang())) {
                void this.translate.setLanguage(lang); // async: carica i cataloghi JSON della nuova lingua.
            }
        });

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
                updatedTime: this.pageUpdatedOn(),
                structuredData,
                noindex: info.noindex,
            });
        });
    }
}
