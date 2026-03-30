import { Component, input, inject } from '@angular/core';
import { BaseActionComponent } from '../../base/base-action.component';
import { ShareResult, ShareService, shareResultNotice } from '../../../../core/engine/services/share.service';

/** Dati che il componente sa condividere autonomamente. */
type ShareInput = string | Blob | HTMLCanvasElement;

@Component({
    selector: 'app-share-action',
    standalone: true,
    imports: [],
    templateUrl: './share-action.component.html',
})
export class ShareActionComponent extends BaseActionComponent {
    private readonly share = inject(ShareService);

    protected readonly defaultLabelKey = 'condividiAzione';

    /**
     * Funzione che restituisce il dato da condividere (sync o async).
     * Il componente smista da solo verso shareText / shareBlob / shareCanvas
     * in base al tipo: il chiamante non tocca mai ShareService.
     */
    readonly action = input.required<() => ShareInput | Promise<ShareInput>>();

    /** Titolo passato alla Web Share API. */
    readonly title = input<string>('');

    /** Nome del file per la condivisione di Blob/canvas. */
    readonly filename = input<string>();

    protected onClick(): void {
        void this.run(async () => {
            const data = await this.action()();
            const title = this.title() || undefined;

            let result: ShareResult;
            if (typeof data === 'string') {
                result = await this.share.shareText(this.title(), data);
            } else if (data instanceof HTMLCanvasElement) {
                result = await this.share.shareCanvas(data, this.filename(), title);
            } else {
                result = await this.share.shareBlob(data, this.filename() ?? 'file', title);
            }

            // La notifica è del bottone: il servizio condivide e restituisce l'esito.
            const notice = shareResultNotice(result);
            if (notice) this.notify.toast(this.translate.translate(notice.key), notice.type);
        });
    }
}
