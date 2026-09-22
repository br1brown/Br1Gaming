import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { mergeRouteParams } from '../../routing';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { PageMetaService } from '../../services/page-meta.service';
import { TranslateService } from '../../services/translate.service';
import { BreadcrumbService, type BreadcrumbItem } from '../../services/breadcrumb';
import { ContestoSito } from '../../../../site';
import { BREADCRUMB_SEPARATORE } from '../../design-system-presets';

/** Voce visualizzata dal template: stessa forma per una voce vera del trail e per il segnaposto di
 *  troncamento (`ellipsis: true`, `label`/`path` inutilizzati) — niente unione discriminata, il
 *  template legge `item.ellipsis`/`item.label`/`item.path` senza narrowing, e niente più stringa
 *  magica (`label === '...'`) da confrontare per riconoscerlo. */
type DisplayedBreadcrumbItem = BreadcrumbItem & { ellipsis?: boolean };

/** Percorso Home → ... → pagina corrente, da `BreadcrumbService` (stessa fonte del JSON-LD
 *  `BreadcrumbList` in `PageMetaService`, le due gerarchie non possono divergere). Visibilità
 *  di default "intelligente": compare da solo oltre un livello reale (Home + pagina corrente),
 *  `forceShow` sovrascrive in entrambe le direzioni. L'ultimo elemento non è mai un link, anche
 *  quando porta un `path` (usato invece dal JSON-LD). */
@Component({
    selector: 'app-breadcrumb',
    imports: [RouterLink, TranslatePipe],
    templateUrl: './breadcrumb.component.html',
    styleUrl: './breadcrumb.component.scss',
})
export class BreadcrumbComponent {
    private readonly router = inject(Router);
    private readonly translate = inject(TranslateService);
    private readonly breadcrumb = inject(BreadcrumbService);
    private readonly pageMeta = inject(PageMetaService);

    /** Override esplicito di visibilità da `ruoloPagina.<ruolo>.showBreadcrumb` (via lo shell).
     *  `null`/assente → default intelligente (vedi sopra). */
    readonly forceShow = input<boolean | null>(null);

    /** Separatore fra le voci, deciso dal design system attivo — `DesignSystemPreset.breadcrumbStile`
     *  (default `'traccia'`, il carattere storico `/`). */
    readonly separator = BREADCRUMB_SEPARATORE[ContestoSito.config.breadcrumbStile];

    readonly items = computed<BreadcrumbItem[]>(() => {
        const type = this.pageMeta.currentPageType();
        if (type == null) return [];
        return this.breadcrumb.trailFor(type, {
            lang: this.translate.currentLang(),
            params: mergeRouteParams(this.router.routerState.snapshot),
            currentTitle: this.pageMeta.resolvedTitle() || undefined,
        });
    });

    readonly displayedItems = computed<DisplayedBreadcrumbItem[]>(() => {
        const all = this.items();
        const maxItems = ContestoSito.config.breadcrumbMaxItems;
        if (maxItems !== 'none' && all.length > maxItems) {
            return [
                all[0],
                { label: '', ellipsis: true },
                all[all.length - 2],
                all[all.length - 1]
            ];
        }
        return all;
    });

    readonly visible = computed(() => {
        const type = this.pageMeta.currentPageType();
        const isNotHome = type != null && type !== ContestoSito.config.homePage;
        return (this.forceShow() ?? true) && isNotHome;
    });
}
