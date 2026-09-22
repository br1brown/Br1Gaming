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

/** Base comune per tutte le pagine. Il generic T è il tipo del contenuto caricato dal resolver
 *  (`class ArticoloComponent extends PageBaseComponent<ArticoloDTO>`): `pageContent()` è già
 *  tipizzato come T | null, nessun cast nei figli. I meta SEO si aggiornano via effect(). */
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

    /** Flag pageFade già risolto in routing.ts, iniettato via route.data. Alias necessario: deve combaciare con la chiave route.data['pageFade'], il nome interno resta libero per il getter @HostBinding `pageFade` sotto. */
    // eslint-disable-next-line @angular-eslint/no-input-rename
    protected readonly pageFadeEnabled = input<boolean>(false, { alias: 'pageFade' });

    /** Il fade è "tra pagine": non deve scattare al primo caricamento (SSR+idratazione), dove mostrerebbe lo stato sbagliato. `router.navigated` è false durante la prima navigazione: catturato alla costruzione, la pagina d'ingresso non sfuma. */
    private readonly engineRouter = inject(Router);
    private readonly fadeAllowed = this.engineRouter.navigated;

    /** Applica `.page-fade` sull'host. DEVE essere @HostBinding, non `host: {}` del decoratore: solo il primo si eredita nelle sottoclassi @Component. */
    @HostBinding('class.page-fade')
    protected get pageFade(): boolean {
        return this.fadeAllowed && this.pageFadeEnabled();
    }

    /** TUTTI i `:segmenti` della rotta corrente, come `route.paramMap` — reattivo anche entro la
     *  stessa istanza componente (una rotta parametrica riusa l'istanza al cambio di un solo
     *  segmento, senza ricreazione): senza questo, il ricaricato sotto perderebbe i parametri dopo
     *  la prima navigazione. Stessa forma di `contentLoaderResolver`. */
    private readonly activatedRoute = inject(ActivatedRoute);
    private readonly routeParams = toSignal(
        this.activatedRoute.paramMap.pipe(map(pm => Object.fromEntries(pm.keys.map(key => [key, pm.get(key)!])))),
        { initialValue: Object.fromEntries(this.activatedRoute.snapshot.paramMap.keys.map(key => [key, this.activatedRoute.snapshot.paramMap.get(key)!])) }
    );

    /** Ricarica del contenuto al cambio lingua (browser). `resource()` gestisce da solo la cancellazione delle richieste obsolete (l'ultima params vince). SSR: params torna undefined, nessuna fetch, il primo contenuto arriva da `contentByResolve`. */
    private readonly contentResource = resource<ResolvedPage<T> | null, { pageType: PageType; lang: string; params: Record<string, string> } | undefined>({
        params: () => isPlatformBrowser(this.platformId)
            // this.lang() (l'input di route, sincrono) e NON this.translate.currentLang(): quest'ultimo
            // si aggiorna in modo asincrono (l'effect sotto attende setLanguage()), this.lang() è già
            // corretto nello stesso istante — niente fetch nella lingua vecchia al mount della pagina.
            ? { pageType: this.pageType(), lang: this.lang(), params: this.routeParams() }
            : undefined, // SSR: nessuna fetch qui, il primo contenuto arriva da contentByResolve (resolver del router).
        // Ricaricato client (cambio lingua): non passa dal resolver del router, quindi un 404
        // (un parametro diventato invalido) non può tornare come UrlTree — l'unica via è navigare
        // esplicitamente. Stesso trattamento di contentLoaderResolver: solo il 404 dirotta, ogni
        // altro errore resta silenzioso (apiErrorInterceptor ha già avvisato l'utente).
        loader: ({ params }) => this.contentResolverService.loadResolved(params.pageType, params.lang, params.params)
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
        // lingua della propria route (gira una volta per ogni nuova istanza pagina).
        effect(() => {
            const lang = this.lang();
            // Guardia: senza, ogni navigazione rifetcherebbe i cataloghi i18n inutilmente. `untracked`:
            // currentLang() va letto ma NON tracciato, altrimenti l'effect si rieseguirebbe ad ogni
            // cambio lingua globale innescato da UN'ALTRA istanza pagina in navigazione/distruzione,
            // rimettendo la vecchia route come lingua corrente mentre il resolver della nuova pagina
            // sta ancora fetchando (race: i dati tornerebbero nella lingua sbagliata dopo lo switch).
            if (lang !== untracked(() => this.translate.currentLang())) {
                void this.translate.setLanguage(lang);
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
