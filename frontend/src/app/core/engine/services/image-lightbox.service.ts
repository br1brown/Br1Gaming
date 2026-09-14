import { Injectable, inject } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ImageLightboxOverlayComponent, type LightboxSource } from '../components/image-lightbox/image-lightbox-overlay.component';

/** Apertura/chiusura del lightbox immagine via CDK Overlay: un solo posto per il meccanismo
 *  (overlay, backdrop, focus), condiviso da chi lo attiva (`AssetDirective`, `LightboxDirective`). */
@Injectable({ providedIn: 'root' })
export class ImageLightboxService {
    private readonly overlay = inject(Overlay);
    private overlayRef: OverlayRef | null = null;
    private returnFocusTo: HTMLElement | null = null;

    open(source: LightboxSource, alt: string, returnFocusTo: HTMLElement): void {
        this.close();
        this.returnFocusTo = returnFocusTo;

        this.overlayRef = this.overlay.create({
            positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
            scrollStrategy: this.overlay.scrollStrategies.block(),
            hasBackdrop: true,
            backdropClass: 'cdk-overlay-dark-backdrop',
            disposeOnNavigation: true,
        });

        const ref = this.overlayRef.attach(new ComponentPortal(ImageLightboxOverlayComponent));
        ref.setInput('source', source);
        ref.setInput('alt', alt);
        ref.instance.closeRequested.subscribe(() => this.close());
        ref.instance.focusClose();

        this.overlayRef.backdropClick().subscribe(() => this.close());
        this.overlayRef.keydownEvents().subscribe(e => {
            if (e.key === 'Escape') this.close();
        });
    }

    close(): void {
        if (!this.overlayRef) return;
        this.overlayRef.dispose(); // completa anche backdropClick/keydownEvents
        this.overlayRef = null;
        this.returnFocusTo?.focus({ preventScroll: true });
        this.returnFocusTo = null;
    }
}
