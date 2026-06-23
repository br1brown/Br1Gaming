import { computed, Directive, ElementRef, inject, input } from '@angular/core';
import { AssetService } from '../services/asset.service';
import { ALLOWED_WIDTHS, type AssetWidth } from '../asset-config';

/**
 * ASSET DIRECTIVE
 *
 * Applica `src` a un elemento HTML che supporta src (img, video, audio,
 * source, iframe, embed) a partire dall'id dell'asset e da una width
 * opzionale. Il src si aggiorna reattivamente al cambio degli input.
 *
 *   <img appAsset="hero" appAssetSizes="100vw" alt="...">              ← responsive (srcset)
 *   <img appAsset="hero" appAssetSizes="100vw" [appAssetPriority]="true" alt="..."> ← LCP above-the-fold
 *   <img appAsset="thumb" [appAssetWidth]="320" alt="...">             ← una misura fissa
 *   <img appAsset="icon" alt="...">                                    ← originale, una sola sorgente
 *   <video appAsset="intro" controls></video>
 *   <iframe appAsset="manuale" title="..."></iframe>
 *
 * Hint moderni applicati a OGNI `<img>` gestita (mai su video/iframe/…):
 *  - `decoding="async"` (decodifica fuori dal main thread);
 *  - `loading` = `lazy` di default, `eager` + `fetchpriority="high"` se `appAssetPriority`
 *    (marca l'immagine LCP above-the-fold come prioritaria, lascia pigre le altre).
 *
 * Immagini RESPONSIVE (opt-in): valorizza `appAssetSizes` (es. `100vw` o
 * `(min-width:768px) 50vw, 100vw`). La directive emette allora `srcset` con tutte le
 * larghezze whitelisted (`ALLOWED_WIDTHS`) + `sizes`: il browser scarica la misura giusta
 * per viewport/DPR — meno banda su mobile, LCP migliore. Senza `appAssetSizes` resta una
 * sola sorgente (comportamento storico). `appAssetWidth` (misura fissa) ha la precedenza
 * e disattiva lo srcset.
 *
 * `appAssetWidth` ha senso solo per immagini raster: il server lo ignora
 * automaticamente per video / pdf / svg restituendo lo stream originale,
 * quindi e' sicuro lasciarlo non valorizzato anche per quei tag. Su tag non-`<img>`
 * (video/iframe/…) gli attributi responsive non vengono emessi.
 *
 * Il selector e' vincolato ai tag elencati: errore a compile time se la
 * directive viene applicata a un elemento privo di `src`.
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
