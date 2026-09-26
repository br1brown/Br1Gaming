import { Directive, ElementRef, HostBinding, HostListener, inject, Injector, isDevMode, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '../services/translate.service';
import type { LightboxSource } from '../components/image-lightbox/image-lightbox-overlay.component';

let altMancanteSegnalato = false;

/** Attivazione lightbox condivisa da `AssetDirective` e `LightboxDirective`. `ImageLightboxService`
 *  (CDK Overlay) si importa dinamicamente solo dentro `onLightboxActivate()`, mai in cima al file:
 *  un `import` statico lo trascinerebbe nel bundle eager anche dove il lightbox resta spento. */
@Directive()
export abstract class LightboxActivatable {
    private readonly injector = inject(Injector);
    private readonly translate = inject(TranslateService);
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

    /** Con `role="button"` `alt` smette di contare: lo specchiamo qui. Senza `alt` il bottone resterebbe
     *  senza nome (WCAG 4.1.2), quindi ripieghiamo su un'etichetta di serie. */
    @HostBinding('attr.aria-label')
    protected get lightboxAriaLabel(): string | null {
        if (!this.lightboxEnabled()) return null;
        const alt = this.altText();
        if (!alt && isDevMode() && this.isBrowser && !altMancanteSegnalato) {
            altMancanteSegnalato = true;
            console.warn('Immagine ingrandibile senza alt: uso il nome di serie, che non è una descrizione.', this.hostEl);
        }
        return alt || this.translate.t('lightboxIngrandisci');
    }

    private altText(): string {
        return this.hostEl.getAttribute('alt')?.trim() ?? '';
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
        this.injector.get(ImageLightboxService).open(source, this.altText(), this.hostEl);
    }
}
