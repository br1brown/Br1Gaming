import { Injectable, inject } from '@angular/core';
import { DialogService, type DialogRef } from './dialog.service';
import { ImageLightboxOverlayComponent, type LightboxSource } from '../components/image-lightbox/image-lightbox-overlay.component';

/** Apertura/chiusura del lightbox immagine: il meccanismo (overlay, backdrop, Escape, focus) è di
 *  `DialogService`, qui restano solo il contenuto e la regola "uno alla volta". Condiviso da chi lo
 *  attiva (`AssetDirective`, `LightboxDirective`). */
@Injectable({ providedIn: 'root' })
export class ImageLightboxService {
    private readonly dialog = inject(DialogService);
    private current: DialogRef<ImageLightboxOverlayComponent> | null = null;

    open(source: LightboxSource, alt: string, returnFocusTo: HTMLElement): void {
        this.close();
        const ref = this.dialog.open(ImageLightboxOverlayComponent, { returnFocusTo, inputs: { source, alt } });
        ref.instance?.closeRequested.subscribe(() => void ref.close());
        this.current = ref;
        void ref.afterClosed.then(() => { if (this.current === ref) this.current = null; });
    }

    close(): void {
        void this.current?.close();
    }
}
