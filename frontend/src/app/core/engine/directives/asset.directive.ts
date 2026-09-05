import { computed, Directive, ElementRef, inject, input } from '@angular/core';
import { AssetService } from '../services/asset.service';
import { ALLOWED_WIDTHS, type AssetWidth } from '../asset-config';

/**
 * ASSET DIRECTIVE
 *
 * Collega reattivamente l'ID di un asset al `src` di tag multimediali (img, video, iframe, ecc.).
 *
 * - Base: `<img appAsset="icon">`
 * - Fissa: `<img appAsset="thumb" [appAssetWidth]="320">`
 * - Responsive: `<img appAsset="hero" appAssetSizes="100vw">` (genera `srcset` automatico)
 * - LCP Priority: Aggiungere `[appAssetPriority]="true"` per fetchpriority=high e loading=eager.
 *
 * Ottimizzazioni automatiche (solo su `<img>`):
 * - `decoding="async"`
 * - `loading="lazy"` (se non priority)
 * - `appAssetWidth` ha precedenza su srcset. Viene ignorato dal backend per file non-raster.
 *
 * Tipato sul tag: errore in compilazione se applicato a elementi privi di `src`.
 */
@Directive({
    selector: 'img[appAsset], video[appAsset], audio[appAsset], source[appAsset], iframe[appAsset], embed[appAsset]',
    standalone: true,
    host: {
        '[src]': 'src()',
        '[attr.srcset]': 'srcset()',
        '[attr.sizes]': 'sizes()',
        '[attr.decoding]': 'decoding()',
        '[attr.loading]': 'loading()',
        '[attr.fetchpriority]': 'fetchPriority()',
    },
})
export class AssetDirective {
    private readonly asset = inject(AssetService);
    /** L'host è un <img>? Solo lì hanno senso srcset/sizes/decoding/loading/fetchpriority. */
    private readonly isImg = (inject(ElementRef).nativeElement as HTMLElement).tagName === 'IMG';

    readonly appAsset = input.required<string>();
    readonly appAssetWidth = input<AssetWidth>();
    /** Opt-in responsive: il valore `sizes` (es. `100vw`). Se valorizzato (e senza
     *  `appAssetWidth`), la directive emette `srcset` su <img>. Vuoto = una sola sorgente. */
    readonly appAssetSizes = input<string>();
    /** `true` per l'immagine LCP above-the-fold: `loading=eager` + `fetchpriority=high`. Default: pigra. */
    readonly appAssetPriority = input(false);

    protected readonly src = computed(() => this.asset.getUrl(this.appAsset(), this.appAssetWidth()));

    /** srcset responsive: solo su <img>, solo se `appAssetSizes` è valorizzato e la width non è fissata. */
    protected readonly srcset = computed(() => {
        if (!this.isImg || !this.appAssetSizes() || this.appAssetWidth() != null) return null;
        const id = this.appAsset();
        return ALLOWED_WIDTHS.map(w => `${this.asset.getUrl(id, w)} ${w}w`).join(', ');
    });

    protected readonly sizes = computed(() => (this.srcset() ? this.appAssetSizes() : null));

    protected readonly decoding = computed(() => (this.isImg ? 'async' : null));
    protected readonly loading = computed(() =>
        this.isImg ? (this.appAssetPriority() ? 'eager' : 'lazy') : null
    );
    protected readonly fetchPriority = computed(() =>
        this.isImg && this.appAssetPriority() ? 'high' : null
    );
}

/**
 * ASSET HREF DIRECTIVE
 *
 * Variante di AssetDirective per gli elementi che usano `href` invece di
 * `src` (link di download, `<link>` di preload, ecc.). Stesso service e
 * stessi input, solo l'attributo target cambia.
 *
 *   <a [appAssetHref]="'manuale'" download="manuale.pdf">Scarica manuale</a>
 *   <link rel="preload" as="image" [appAssetHref]="'hero'" [appAssetWidth]="1024">
 *
 * Selector vincolato a a[appAssetHref] e link[appAssetHref] per evitare
 * usi accidentali su elementi che non supportano href.
 */
@Directive({
    selector: 'a[appAssetHref], link[appAssetHref]',
    standalone: true,
    host: { '[href]': 'href()' },
})
export class AssetHrefDirective {
    private readonly asset = inject(AssetService);

    readonly appAssetHref = input.required<string>();
    readonly appAssetWidth = input<AssetWidth>();

    protected readonly href = computed(() => this.asset.getUrl(this.appAssetHref(), this.appAssetWidth()));
}
