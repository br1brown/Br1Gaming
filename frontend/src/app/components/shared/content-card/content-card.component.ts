import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AssetDirective } from '../../../core/engine/directives/asset.directive';
import { ContestoSito, PageType } from '../../../site';
import { applyPathParams } from '../../../core/engine/siteBuilder';

@Component({
    selector: 'app-content-card',
    standalone: true,
    imports: [RouterLink, AssetDirective],
    templateUrl: './content-card.component.html',
    styleUrl: './content-card.component.css'
})
export class ContentCardComponent {
    readonly title = input.required<string>();
    readonly subtitle = input<string | null>(null);
    readonly imageId = input<string | null>(null);
    readonly pageType = input.required<PageType>();
    /** Valori per gli eventuali segmenti `:xxx` del path (es. `{ slug: 'incel' }`), stessa regola
     *  di sostituzione di `[appPageParams]` — assente per le pagine non parametriche. */
    readonly params = input<Record<string, string>>();

    readonly path = computed(() =>
        applyPathParams(ContestoSito.getPath(this.pageType()) ?? '/', this.params(), 'ContentCardComponent'));

    readonly imageVisible = signal(true);

    onImageError(): void {
        this.imageVisible.set(false);
    }
}
