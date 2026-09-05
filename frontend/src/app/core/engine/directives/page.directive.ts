import { computed, Directive, effect, inject, input, isDevMode } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContestoSito, PageType } from '../../../site';
import { applyPathParams } from '../siteBuilder';
import { TranslateService } from '../services/translate.service';

/**
 * PAGE DIRECTIVE
 *
 * Risolve un `PageType` e naviga via `RouterLink` (aggiunto come hostDirective).
 * Selezionare sempre tramite PageType per mantenere i link aggiornati se i path cambiano.
 *
 * - Base: `<a [appPage]="PageType.Home">Home</a>`
 * - Path Params (es. /user/:id): `<a [appPage]="PageType.User" [appPageParams]="{ id: '1' }">`
 * - Query Params: `<a [appPage]="PageType.Search" [appPageQueryParams]="{ q: 'test' }">`
 *
 * Nota su `href`: viene re-iniettato a mano perché `RouterLink` via `hostDirectives`
 * non aggiorna nativamente l'attributo DOM `href` in tempo reale, necessario per il "Copia Link".
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
