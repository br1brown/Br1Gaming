import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AssetDirective } from '../../../core/engine/directives/asset.directive';
import { ContestoSito, PageType } from '../../../site';

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

    readonly path = computed(() => ContestoSito.getPath(this.pageType()) ?? '/');

    readonly imageVisible = signal(true);

    onImageError(): void {
        this.imageVisible.set(false);
    }
}
