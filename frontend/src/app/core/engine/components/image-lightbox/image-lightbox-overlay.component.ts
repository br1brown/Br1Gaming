import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AssetService } from '../../services/asset.service';
import { ALLOWED_WIDTHS } from '../../asset-config';

/** Sorgente dell'immagine ingrandita: un `[appAsset]` risolto dal backend, oppure un `Blob`
 *  generato client-side (canvas del builder immagini, QR code...). */
export type LightboxSource = { assetId: string } | { blob: Blob };

/** Contenuto del lightbox, montato da `ImageLightboxService` in una modale di `NotificationService`
 *  (dialog ARIA, focus trap, Escape e backdrop a carico suo). */
@Component({
    selector: 'app-image-lightbox-overlay',
    standalone: true,
    imports: [TranslatePipe],
    templateUrl: './image-lightbox-overlay.component.html',
    styleUrl: './image-lightbox-overlay.component.scss',
})
export class ImageLightboxOverlayComponent {
    private readonly asset = inject(AssetService);

    readonly source = input.required<LightboxSource>();
    readonly alt = input<string>('');
    readonly closeRequested = output<void>();

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

}
