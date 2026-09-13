import { Directive, input } from '@angular/core';
import { LightboxActivatable } from './lightbox-activatable';
import type { LightboxSource } from '../components/image-lightbox/image-lightbox-overlay.component';

/**
 * Lightbox fullscreen per un'immagine generata client-side (`Blob`) — es. il canvas del builder
 * immagini o un QR code — non un `[appAsset]` risolto dal backend (per quello vedi
 * `AssetDirective.appAssetLightbox`, stesso comportamento, condiviso via `LightboxActivatable`).
 *
 * `<img [appLightbox]="miaBlob()">` — `null`/assente disattiva (nessun handler, nessun affordance).
 */
@Directive({
    selector: 'img[appLightbox]',
    standalone: true,
})
export class LightboxDirective extends LightboxActivatable {
    readonly appLightbox = input<Blob | null>(null);

    protected lightboxEnabled(): boolean {
        return this.appLightbox() != null;
    }

    protected lightboxSource(): LightboxSource | null {
        const blob = this.appLightbox();
        return blob ? { blob } : null;
    }
}
