import { Injectable, inject } from '@angular/core';
import { NotificationService, type ModalRef } from './notification.service';
import { TranslateService } from './translate.service';
import { ImageLightboxOverlayComponent, type LightboxSource } from '../components/image-lightbox/image-lightbox-overlay.component';

/** Lightbox immagine: una modale di `NotificationService` con contenuto "nudo", una alla volta.
 *  Condiviso da chi lo attiva (`AssetDirective`, `LightboxDirective`). */
@Injectable({ providedIn: 'root' })
export class ImageLightboxService {
    private readonly notify = inject(NotificationService);
    private readonly translate = inject(TranslateService);
    private current: ModalRef<ImageLightboxOverlayComponent> | null = null;

    open(source: LightboxSource, alt: string, returnFocusTo: HTMLElement): void {
        this.close();
        const ref = this.notify.modal(ImageLightboxOverlayComponent, {
            returnFocusTo,
            inputs: { source, alt },
            bare: true,
            dialogClass: 'modal-dialog-centered modal-dialog-fit',
            ariaLabel: alt || this.translate.translate('immagineIngranditaNav'),
        });
        ref.instance?.closeRequested.subscribe(() => void ref.close());
        this.current = ref;
        void ref.afterClosed.then(() => { if (this.current === ref) this.current = null; });
    }

    close(): void {
        void this.current?.close();
    }
}
