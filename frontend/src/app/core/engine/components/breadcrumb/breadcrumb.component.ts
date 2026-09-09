import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { mergeRouteParams } from '../../routing';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { PageMetaService } from '../../services/page-meta.service';
import { TranslateService } from '../../services/translate.service';
import { BreadcrumbService, type BreadcrumbItem } from '../../services/breadcrumb';

/**
 * BREADCRUMB COMPONENT
 *
 * Percorso Home → ... → pagina corrente, calcolato da `BreadcrumbService` (stessa fonte usata dal
 * JSON-LD `BreadcrumbList` in `PageMetaService`, così le due gerarchie non possono divergere).
 *
 * Visibilità di default "intelligente": compare da solo quando il percorso ha più di un
 * livello reale (Home + pagina corrente) — una pagina radice (la Home stessa) non
 * lo mostra mai, non serve spegnerlo a mano ovunque. `forceShow` (da `layout.showBreadcrumb` in
 * `site.ts`, via lo shell) sovrascrive esplicitamente in entrambe le direzioni.
 *
 * Reso volutamente minimale: testo in linea, separatore leggero, nessun badge/pillola per livello.
 * L'ultimo elemento non è mai un link, anche quando porta un `path` (usato invece dal JSON-LD).
 */
import { ContestoSito } from '../../../../site';

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

    /** Override esplicito di visibilità da `layout.showBreadcrumb` (via lo shell). `null`/assente
     *  → default intelligente (vedi sopra). */
    readonly forceShow = input<boolean | null>(null);

    readonly items = computed<BreadcrumbItem[]>(() => {
        const type = this.pageMeta.currentPageType();
        if (type == null) return [];
        return this.breadcrumb.trailFor(type, {
            lang: this.translate.currentLang(),
            params: mergeRouteParams(this.router.routerState.snapshot),
            currentTitle: this.pageMeta.resolvedTitle() || undefined,
        });
    });

    readonly displayedItems = computed(() => {
        const all = this.items();
        if (all.length > 4) {
            return [
                all[0],
                { label: '...' } as BreadcrumbItem,
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
