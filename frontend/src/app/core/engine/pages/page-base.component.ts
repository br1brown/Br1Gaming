import { computed, Directive, effect, HostBinding, inject, input, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AssetService } from '../services/asset.service';
import { NotificationService } from '../services/notification.service';
import { TranslateService } from '../services/translate.service';
import { PageMetaService } from '../services/page-meta.service';
import { PageType } from '../../../site';
import type { ResolvedPage } from './content.resolver';

/** Base comune per tutte le pagine. Il generic T è il tipo del contenuto caricato dal resolver
 *  (`class ArticoloComponent extends PageBaseComponent<ArticoloDTO>`): `pageContent()` è già
 *  tipizzato come T | null, nessun cast nei figli. I meta SEO si aggiornano via effect(). */
@Directive()
export abstract class PageBaseComponent<T> {
    private readonly pageMeta = inject(PageMetaService);
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

    /** Contenuto risolto dal resolver del router: SSR, idratazione, cambio lingua (naviga alla rotta
     *  dell'altra lingua, quindi nuova istanza) e cambio parametri (il router riesegue il resolver). */
    private readonly _resolved = computed(() => this.contentByResolve());

    /** Titolo della pagina corrente, tradotto (lo stesso del `<title>` senza il nome del sito): per
     *  l'`<h1>` di una pagina che non ne ha uno suo nel contenuto — ogni pagina ne dichiara uno. */
    protected readonly pageTitle = this.pageMeta.resolvedTitle.asReadonly();

    /** Contenuto sempre aggiornato della pagina corrente, tipizzato come T. */
    protected readonly pageContent = computed<T | null>(() =>
        (this._resolved()?.content ?? null) as T | null
    );

    /** URL canonico della pagina corrente: esposto così le pagine figlie non hanno accesso all'intero PageMetaService. */
    protected getCurrentUrl(): string {
        return this.pageMeta.getCanonicalUrl();
    }

    /** Data ISO (YYYY-MM-DD) di ultimo aggiornamento REALE del contenuto, per `og:updated_time` e
     *  `dateModified` JSON-LD (non la data di build). Default `null`; override dove esiste (es.
     *  PolicyComponent, dalla sezione `legal` di site.ts). */
    protected pageUpdatedOn(): string | null {
        return null;
    }

    constructor() {
        // PUNTO UNICO "URL → stato lingua app": ogni pagina, al mount, allinea TranslateService alla
        // lingua della propria route (gira una volta per ogni nuova istanza pagina).
        effect(() => {
            const lang = this.lang();
            // `untracked`: senza, il cambio lingua di un'ALTRA istanza pagina in transizione
            // rieseguirebbe questo effect e rimetterebbe la lingua vecchia mentre il resolver
            // della nuova pagina sta ancora fetchando (race sulla lingua dopo lo switch).
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
