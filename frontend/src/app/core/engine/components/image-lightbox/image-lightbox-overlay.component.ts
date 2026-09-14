import { Component, ElementRef, computed, inject, input, output, viewChild } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AssetService } from '../../services/asset.service';
import { ALLOWED_WIDTHS } from '../../asset-config';
import { TranslateService } from '../../services/translate.service';

/** Sorgente dell'immagine ingrandita: un `[appAsset]` risolto dal backend, oppure un `Blob`
 *  generato client-side (canvas del builder immagini, QR code...). */
export type LightboxSource = { assetId: string } | { blob: Blob };

/** UI del lightbox, creata dentro un overlay CDK da `ImageLightboxService`. Non va usata
 *  direttamente: apertura/backdrop/Esc li gestisce il servizio, qui solo il contenuto — dialog
 *  modale ARIA (focus dentro, intrappolato, ripristinato dal servizio alla chiusura), stesso
 *  pattern del WAI-ARIA Dialog Pattern. */
@Component({
    selector: 'app-image-lightbox-overlay',
    standalone: true,
    imports: [TranslatePipe],
    templateUrl: './image-lightbox-overlay.component.html',
    styleUrl: './image-lightbox-overlay.component.scss',
    host: { '(keydown)': 'onKeydown($event)' },
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
    protected readonly dialogLabel = computed(() => this.alt() || this.translate.translate('immagineIngranditaNav'));

    /** Sposta il focus dentro il dialog all'apertura (WAI-ARIA Dialog Pattern) — l'unico elemento
     *  interattivo qui dentro è il bottone di chiusura. */
    focusClose(): void {
        requestAnimationFrame(() => this.closeBtn()?.nativeElement.focus());
    }

    /** Focus trap: un solo elemento interattivo nel dialog, quindi Tab/Shift+Tab ci restano
     *  sempre sopra invece di uscire verso la pagina sotto (CDK Overlay non lo fa da solo,
     *  a differenza di un <dialog> nativo). */
    protected onKeydown(event: KeyboardEvent): void {
        if (event.key !== 'Tab') return;
        event.preventDefault();
        this.closeBtn()?.nativeElement.focus();
    }
}
