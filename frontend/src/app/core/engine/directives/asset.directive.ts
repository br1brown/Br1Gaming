import { computed, Directive, inject, input } from '@angular/core';
import { AssetService } from '../services/asset.service';
import { ALLOWED_WIDTHS, type AssetWidth } from '../asset-config';
import { LightboxActivatable } from './lightbox-activatable';
import type { LightboxSource } from '../components/image-lightbox/image-lightbox-overlay.component';

/** Collega reattivamente l'ID di un asset al `src` di tag multimediali (img, video, iframe, ecc.);
 *  su `<img>` aggiunge anche `decoding="async"`, `loading="lazy"` (se non priority) e srcset/sizes
 *  responsive. */
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
export class AssetDirective extends LightboxActivatable {
    private readonly asset = inject(AssetService);
    /** L'host è un <img>? Solo lì hanno senso srcset/sizes/decoding/loading/fetchpriority/lightbox. */
    private readonly isImg = this.hostEl.tagName === 'IMG';

    readonly appAsset = input.required<string>();
    readonly appAssetWidth = input<AssetWidth>();
    /** Opt-in responsive: il valore `sizes` (es. `100vw`). Se valorizzato (e senza
     *  `appAssetWidth`), la directive emette `srcset` su <img>. Vuoto = una sola sorgente. */
    readonly appAssetSizes = input<string>();
    /** `true` per l'immagine LCP above-the-fold: `loading=eager` + `fetchpriority=high`. Default: pigra. */
    readonly appAssetPriority = input(false);
    /** `true` apre un lightbox fullscreen (CDK Overlay) al click/Invio/Spazio. Solo su <img>,
     *  default disattivato: opt-in esplicito, non un comportamento implicito di ogni immagine. */
    readonly appAssetLightbox = input(false);

    protected lightboxEnabled(): boolean {
        return this.isImg && this.appAssetLightbox();
    }

    protected lightboxSource(): LightboxSource | null {
        return { assetId: this.appAsset() };
    }

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

/** Variante di AssetDirective per elementi che usano `href` invece di `src` (link di download,
 *  `<link>` di preload). Selector vincolato a `a`/`link` per evitare usi su elementi che non
 *  supportano href. */
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
