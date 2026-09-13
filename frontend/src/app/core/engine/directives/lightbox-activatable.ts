import { Directive, ElementRef, HostBinding, HostListener, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ImageLightboxService } from '../services/image-lightbox.service';
import type { LightboxSource } from '../components/image-lightbox/image-lightbox-overlay.component';

/**
 * Attivazione lightbox condivisa da `AssetDirective` (`appAssetLightbox`) e `LightboxDirective`
 * (`appLightbox`): cursore/tabindex/role/click/tastiera per aprire `ImageLightboxService`. Estratta
 * qui perché le due directive differiscono solo nella sorgente (`{assetId}` risolto da
 * `AssetService` vs `{blob}` locale) — un fix all'accessibilità di uno si applica automaticamente
 * anche all'altro, invece di dover essere ricopiato a mano.
 */
@Directive()
export abstract class LightboxActivatable {
    private readonly lightboxService = inject(ImageLightboxService);
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

    /** `role="button"` fa calcolare il nome accessibile con l'algoritmo generico (contenuto/
     *  aria-label/aria-labelledby), non più quello specifico di `<img>` — `alt` da solo smette di
     *  contare, anche se il DOM lo porta ancora. Specchiarlo qui è l'unico modo per non perdere il
     *  nome accessibile quando l'affordance è attiva (rilevato da pa11y, WCAG2AA.4_1_2/H91.Img.Name). */
    @HostBinding('attr.aria-label')
    protected get lightboxAriaLabel(): string | null {
        return this.lightboxEnabled() ? this.hostEl.getAttribute('alt') : null;
    }

    @HostListener('click', ['$event'])
    @HostListener('keydown.enter', ['$event'])
    @HostListener('keydown.space', ['$event'])
    protected onLightboxActivate(event?: Event): void {
        if (!this.lightboxEnabled() || !this.isBrowser) return;
        const source = this.lightboxSource();
        if (!source) return;
        event?.preventDefault();
        this.lightboxService.open(source, this.hostEl.getAttribute('alt') ?? '', this.hostEl);
    }
}
