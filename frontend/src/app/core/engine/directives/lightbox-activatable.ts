import { Directive, ElementRef, HostBinding, HostListener, inject, Injector, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { LightboxSource } from '../components/image-lightbox/image-lightbox-overlay.component';

/** Attivazione lightbox condivisa da `AssetDirective` e `LightboxDirective`. `ImageLightboxService`
 *  (CDK Overlay) si importa dinamicamente solo dentro `onLightboxActivate()`, mai in cima al file:
 *  un `import` statico lo trascinerebbe nel bundle eager anche dove il lightbox resta spento. */
@Directive()
export abstract class LightboxActivatable {
    private readonly injector = inject(Injector);
    protected readonly hostEl = inject(ElementRef).nativeElement as HTMLElement;
    protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    /** Falso: nessuna affordance (cursore/tabindex/role) e attivazione no-op. */
    protected abstract lightboxEnabled(): boolean;
    /** Cosa aprire; `null` per non aprire nulla anche a `lightboxEnabled()` vero. */
    protected abstract lightboxSource(): LightboxSource | null;

    @HostBinding('class.cursor-zoom-in')
    protected get lightboxCursor(): boolean {
        return this.lightboxEnabled();
    }

    @HostBinding('attr.tabindex')
    protected get lightboxTabIndex(): number | null {
        return this.lightboxEnabled() ? 0 : null;
    }

    @HostBinding('attr.role')
    protected get lightboxRole(): string | null {
        return this.lightboxEnabled() ? 'button' : null;
    }

    /** Dice a chi usa uno screen reader che il bottone apre un dialog, non un'azione sul posto. */
    @HostBinding('attr.aria-haspopup')
    protected get lightboxHasPopup(): string | null {
        return this.lightboxEnabled() ? 'dialog' : null;
    }

    /** Con `role="button"` il nome accessibile si calcola con l'algoritmo generico, e `alt` da solo
     *  smette di contare: lo specchiamo qui per non perderlo quando l'affordance è attiva. */
    @HostBinding('attr.aria-label')
    protected get lightboxAriaLabel(): string | null {
        return this.lightboxEnabled() ? this.hostEl.getAttribute('alt') : null;
    }

    @HostListener('click', ['$event'])
    @HostListener('keydown.enter', ['$event'])
    @HostListener('keydown.space', ['$event'])
    protected async onLightboxActivate(event?: Event): Promise<void> {
        if (!this.lightboxEnabled() || !this.isBrowser) return;
        const source = this.lightboxSource();
        if (!source) return;
        event?.preventDefault();
        const { ImageLightboxService } = await import('../services/image-lightbox.service');
        this.injector.get(ImageLightboxService).open(source, this.hostEl.getAttribute('alt') ?? '', this.hostEl);
    }
}
