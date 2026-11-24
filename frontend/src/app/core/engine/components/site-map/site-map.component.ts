import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ContestoSito, type PageType } from '../../../../site';
import { PageDirective } from '../../directives/page.directive';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslateService } from '../../services/translate.service';

/** Un nodo della mappa: una pagina (`page`) oppure una sezione (`title` + `children`). */
interface MapNode {
    key: string;
    title: string;
    page?: { pageType: PageType; description?: string };
    children: MapNode[];
}

/** Mappa del sito in HTML (WCAG 2.4.5): le pagine pubbliche nella lingua corrente, raggruppate per sezione nell'ordine di `site.ts`.
 *  Una sezione con una sola pagina non fa gruppo. Escluse riservate, login, rotte con parametri e `inSiteMap: false` (`getSiteMapPages`). */
@Component({
    selector: 'app-site-map',
    imports: [PageDirective, TranslatePipe, NgTemplateOutlet],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <ng-template #nodes let-list let-depth="depth">
            @for (node of list; track node.key) {
                <li [class]="depth === 0 ? 'col' : ''">
                    @if (node.page) {
                        <div class="mb-3">
                            <a class="fw-semibold" [appPage]="node.page.pageType">{{ node.title | translate }}</a>
                            @if (node.page.description) { <div class="text-body-secondary small">{{ node.page.description | translate }}</div> }
                        </div>
                    } @else {
                        <div class="mb-3">
                            <div role="heading" [attr.aria-level]="depth + 2" class="h6 text-body-secondary mb-2">{{ node.title | translate }}</div>
                            <ul class="list-unstyled border-start ps-3 mb-0">
                                <ng-container *ngTemplateOutlet="nodes; context: { $implicit: node.children, depth: depth + 1 }" />
                            </ul>
                        </div>
                    }
                </li>
            }
        </ng-template>
        <ul class="list-unstyled row row-cols-1 row-cols-md-2 g-3 mb-0">
            <ng-container *ngTemplateOutlet="nodes; context: { $implicit: tree(), depth: 0 }" />
        </ul>
    `,
})
export class SiteMapComponent {
    private readonly translate = inject(TranslateService);

    protected readonly tree = computed<MapNode[]>(() => {
        const lang = this.translate.currentLang();
        const root: MapNode = { key: '', title: '', children: [] };
        for (const entry of ContestoSito.getSiteMapPages().filter(e => e.lang === lang)) {
            // La home può non avere un titolo (nel menu c'è il brand): senza un nome il collegamento non direbbe niente, quindi «Home» come il breadcrumb.
            const title = ContestoSito.getPageInfo(entry.pageType, lang)?.title
                || (entry.pageType === ContestoSito.config.homePage ? 'breadcrumbHome' : entry.path);
            // Scende nelle sezioni (riusa l'ultima se ha lo stesso titolo: le pagine di una sezione sono vicine), poi aggiunge la pagina.
            let level = root;
            for (const section of entry.trail ?? []) {
                const last = level.children.at(-1);
                if (last && !last.page && last.title === section) level = last;
                else { const node: MapNode = { key: `${level.key}/${section}`, title: section, children: [] }; level.children.push(node); level = node; }
            }
            level.children.push({ key: entry.path, title, page: { pageType: entry.pageType, description: entry.description }, children: [] });
        }
        return SiteMapComponent.flatten(root.children);
    });

    /** Una sezione che contiene una sola pagina (e nient'altro) non fa gruppo: resta la pagina, con il suo nome. */
    private static flatten(nodes: MapNode[]): MapNode[] {
        return nodes.map((n): MapNode => {
            if (n.page) return n;
            const inner = SiteMapComponent.flatten(n.children);
            return inner.length === 1 && inner[0].page ? inner[0] : { ...n, children: inner };
        });
    }
}
