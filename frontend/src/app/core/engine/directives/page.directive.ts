import { computed, Directive, effect, inject, input, isDevMode } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContestoSito, PageType } from '../../../site';
import { applyPathParams } from '../siteBuilder';
import { TranslateService } from '../services/translate.service';

/**
 * PAGE DIRECTIVE
 *
 * Traduce un PageType nel path corrispondente e lo passa a RouterLink,
 * eliminando il boilerplate `[routerLink]="ContestoSito.getPath(PageType.X) ?? '/'"`.
 *
 *   <a [appPage]="PageType.Home">Home</a>
 *   <a [appPage]="PageType.PrivacyPolicy" class="footer-link">Privacy</a>
 *
 * Un `PageType` con segmenti `:xxx` (rotta parametrica, es. un solo pageType/componente per N
 * elementi del backend) altrimenti risolverebbe al template letterale, non a un link funzionante —
 * `appPageParams` li riempie, `appPageQueryParams` aggiunge la query string (separata, mai
 * concatenata a mano nel path):
 *
 *   <a [appPage]="PageType.GeneratorDetail" [appPageParams]="{ slug: 'incel' }">Incel</a>
 *   <a [appPage]="PageType.Piaciuti" [appPageQueryParams]="{ gen: 'incel' }">Piaciuti di questo</a>
 *
 * RouterLink è applicato come hostDirective: l'elemento host si comporta
 * esattamente come con [routerLink] (SPA navigation, keyboard, right-click).
 * Se il PageType non è registrato nel sito, naviga verso '/' (con un avviso in console, solo in dev).
 *
 * `href` è bindato esplicitamente (path + query, serializzati a mano) perché RouterLink come
 * hostDirective non aggiorna il proprio @HostBinding('attr.href') quando routerLink/queryParams
 * sono impostati via effect — altrimenti href=null e cursore testo. La navigazione reale resta
 * quella di RouterLink; questo href serve solo a mostrare/copiare l'URL giusto.
 */
@Directive({
    selector: '[appPage]',
    standalone: true,
    hostDirectives: [RouterLink],
    host: { '[attr.href]': '_href()' },
})
export class PageDirective {
    private readonly routerLink = inject(RouterLink);
    private readonly translate = inject(TranslateService);

    readonly appPage = input.required<PageType>();
    /** Valori per gli eventuali segmenti `:xxx` del path risolto — vedi `NavItemOptions.params`
     *  in shell-nav.ts, stessa regola di sostituzione. */
    readonly appPageParams = input<Record<string, string>>();
    /** Query params del link, bindati a parte su RouterLink — mai concatenati nel path. */
    readonly appPageQueryParams = input<Record<string, string>>();

    protected readonly _path = computed(() => {
        const type = this.appPage();
        const path = ContestoSito.getPath(type, this.translate.currentLang());
        if (path == null && isDevMode()) {
            console.warn(`[appPage] "${String(type)}" non risolve a nessuna pagina registrata (disabilitata o mai dichiarata in pages): link puntato a "/".`);
        }
        return applyPathParams(path ?? '/', this.appPageParams(), `[appPage]="${String(type)}"`);
    });

    protected readonly _href = computed(() => {
        const path = this._path();
        const qp = this.appPageQueryParams();
        return qp && Object.keys(qp).length > 0 ? `${path}?${new URLSearchParams(qp).toString()}` : path;
    });

    constructor() {
        effect(() => {
            this.routerLink.routerLink = this._path();
            this.routerLink.queryParams = this.appPageQueryParams() ?? null;
        });
    }
}
