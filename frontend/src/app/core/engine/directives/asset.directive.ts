import { computed, Directive, inject, input, signal } from '@angular/core';
import { AssetService } from '../services/asset.service';
import { ALLOWED_WIDTHS, type AssetWidth } from '../asset-config';
import { LightboxActivatable } from './lightbox-activatable';
import type { LightboxSource } from '../components/image-lightbox/image-lightbox-overlay.component';
import { BROKEN_IMAGE_PLACEHOLDER } from './img-fallback.directive';

/** Su un `<img>` rotto (asset cancellato, blob scaduto) mostra un segnaposto neutro invece dell'icona
 *  rotta del browser, o nulla se l'immagine è decorativa (`alt=""`). */
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
        '[class.asset-broken]': 'isBroken()',
        '[class.asset-broken--decorative]': 'isBroken() && isDecorative()',
        '(error)': 'onError()',
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
        return this.isImg && this.appAssetLightbox() && !this.isBroken();
    }

    protected lightboxSource(): LightboxSource | null {
        return { assetId: this.appAsset() };
    }

    /** Id dell'asset il cui file non si è caricato: legato all'id, così un cambio di `appAsset`
     *  riprova il file nuovo invece di restare sul segnaposto. */
    private readonly brokenId = signal<string | null>(null);
    protected readonly isBroken = computed(() => this.isImg && this.brokenId() === this.appAsset());

    protected onError(): void {
        if (this.isImg) this.brokenId.set(this.appAsset());
    }

    /** Immagine decorativa (`alt=""`): rotta, sparisce invece di mostrare il segnaposto — un logo di
     *  contorno mancante non deve diventare una cornice vuota in navbar. */
    protected isDecorative(): boolean {
        return this.isImg && this.hostEl.getAttribute('alt') === '';
    }

    protected readonly src = computed(() => this.isBroken()
        ? BROKEN_IMAGE_PLACEHOLDER
        : this.asset.getUrl(this.appAsset(), this.appAssetWidth()));

    /** srcset responsive: solo su <img>, solo se `appAssetSizes` è valorizzato e la width non è fissata. */
    protected readonly srcset = computed(() => {
        if (this.isBroken() || !this.isImg || !this.appAssetSizes() || this.appAssetWidth() != null) return null;
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
