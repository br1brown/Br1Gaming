import { Directive, ElementRef, inject } from '@angular/core';

/** Segnaposto di un'immagine non raggiungibile: una cornice col glifo "immagine" in grigio medio,
 *  leggibile su fondo chiaro e scuro (lo sfondo lo dà `.asset-broken` dal tema). Inline: non può
 *  fallire a sua volta, e `img-src data:` è già nella CSP del template. */
export const BROKEN_IMAGE_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#8a8f98" stroke-width="3" '
    + 'stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="14" width="44" height="36" rx="4"/>'
    + '<circle cx="24" cy="27" r="4"/><path d="M12 46l13-13 9 9 7-7 11 11"/></svg>');

/** Per un `<img>` con `src` diretto: se il file non si carica mostra un segnaposto invece dell'icona rotta del browser (o nulla, se decorativa). */
@Directive({
    selector: 'img[appImgFallback]',
    host: { '(error)': 'onError()' },
})
export class ImgFallbackDirective {
    private readonly img = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;

    protected onError(): void {
        if (this.img.src === BROKEN_IMAGE_PLACEHOLDER) return;
        this.img.removeAttribute('srcset');
        this.img.src = BROKEN_IMAGE_PLACEHOLDER;
        this.img.classList.add('asset-broken');
        // Decorativa (alt=""): nessun segnaposto, sparisce (stessa regola di AssetDirective).
        if (this.img.getAttribute('alt') === '') this.img.classList.add('asset-broken--decorative');
    }
}
