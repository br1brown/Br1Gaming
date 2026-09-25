import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AssetService } from '../../services/asset.service';
import { ALLOWED_WIDTHS } from '../../asset-config';
import { TranslateService } from '../../services/translate.service';

/** Sorgente dell'immagine ingrandita: un `[appAsset]` risolto dal backend, oppure un `Blob`
 *  generato client-side (canvas del builder immagini, QR code...). */
export type LightboxSource = { assetId: string } | { blob: Blob };

/** UI del lightbox, montata in un overlay CDK da `ImageLightboxService` (apertura/backdrop/Esc a suo
 *  carico). Dialog modale ARIA con focus intrappolato via `cdkTrapFocus`. */
@Component({
    selector: 'app-image-lightbox-overlay',
    standalone: true,
    imports: [TranslatePipe, CdkTrapFocus],
    templateUrl: './image-lightbox-overlay.component.html',
    styleUrl: './image-lightbox-overlay.component.scss',
})
export class ImageLightboxOverlayComponent {
    private readonly asset = inject(AssetService);
    private readonly translate = inject(TranslateService);

    readonly source = input.required<LightboxSource>();
    readonly alt = input<string>('');
    readonly closeRequested = output<void>();

    readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

    /** Sempre alla risoluzione massima della whitelist per un asset: qui l'immagine è il
     *  contenuto, non una thumbnail. Un Blob è già alla sua risoluzione, nessun resize da chiedere. */
    protected readonly src = computed(() => {
        const s = this.source();
        return 'blob' in s
            ? this.asset.getUrlFromBlob(s.blob).angularUrl
            : this.asset.getUrl(s.assetId, ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1]);
    });
    /** Il file non si è caricato: al suo posto un messaggio (vedi template). */
    protected readonly broken = signal(false);
    protected readonly dialogLabel = computed(() => this.alt() || this.translate.translate('immagineIngranditaNav'));

    /** Sposta il focus sul bottone di chiusura all'apertura (WAI-ARIA Dialog Pattern); il trap
     *  Tab/Shift+Tab è `cdkTrapFocus` nel template, CDK Overlay non lo fa da solo. */
    focusClose(): void {
        requestAnimationFrame(() => this.closeBtn()?.nativeElement.focus());
    }
}
