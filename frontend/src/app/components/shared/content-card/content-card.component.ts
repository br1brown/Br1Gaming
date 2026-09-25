import { Component, input } from '@angular/core';
import { AssetDirective } from '../../../core/engine/directives/asset.directive';
import { PageDirective } from '../../../core/engine/directives/page.directive';
import { PageType } from '../../../site';

@Component({
    selector: 'app-content-card',
    standalone: true,
    imports: [PageDirective, AssetDirective],
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
}
