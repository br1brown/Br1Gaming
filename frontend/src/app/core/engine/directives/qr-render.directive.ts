import { Directive, effect, inject, input, output, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SafeUrl } from '@angular/platform-browser';
import { QrCodeService, QrConfig } from '../services/qr-code.service';
import { AssetService } from '../services/asset.service';

/**
 * QR RENDER DIRECTIVE
 * 
 * Trasforma un `<img>` nel render di un QR code, aggiornandone il `src` in automatico.
 * 
 * - Output `blobChange`: emesso al render, utile per bottoni di download/condivisione.
 * - Output `errorChange`: emette l'errore localizzato se la generazione fallisce.
 * - SSR / Fallback: su server o in caso d'errore rimuove il `src`, ripiegando sul testo `alt`.
 * - Race-condition safe: ignora i risultati di render asincroni resi obsoleti da nuovi input.
 * 
 * Uso: `<img [appQrContent]="config" (blobChange)="..." (errorChange)="...">`
 */
@Directive({
    selector: 'img[appQrContent]',
    standalone: true,
    host: { '[src]': 'src()' },
})
export class QrRenderDirective {
    private readonly qrCode = inject(QrCodeService);
    private readonly asset = inject(AssetService);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    readonly appQrContent = input<QrConfig | null>(null);

    readonly blobChange = output<Blob | null>();
    readonly errorChange = output<string | null>();

    protected readonly src = signal<SafeUrl | null>(null);

    private renderToken = 0;

    constructor() {
        effect(() => {
            const cfg = this.appQrContent();
            if (!this.isBrowser || !cfg) {
                this.reset();
                return;
            }
            void this.render(cfg);
        });
    }

    private async render(cfg: QrConfig): Promise<void> {
        const token = ++this.renderToken;
        const result = await this.qrCode.create(cfg);
        if (token !== this.renderToken) return;
        if (!result.success) {
            this.src.set(null);
            this.blobChange.emit(null);
            this.errorChange.emit(result.message);
            return;
        }
        this.errorChange.emit(null);
        this.blobChange.emit(result.blob);
        this.src.set(this.asset.getUrlFromBlob(result.blob).angularUrl);
    }

    private reset(): void {
        this.src.set(null);
        this.blobChange.emit(null);
        this.errorChange.emit(null);
    }
}
