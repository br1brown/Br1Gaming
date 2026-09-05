import { Directive, effect, inject, input, output, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ImgBuilderService, ImgBuildOptions } from '../services/img-builder.service';

/**
 * Configurazione per renderizzare un'immagine via ImgBuilderService:
 * estende ImgBuildOptions col testo da disegnare. L'`alt` non e' qui dentro
 * — va sull'<img> come attributo HTML standard.
 */
export interface ImgRenderConfig extends ImgBuildOptions {
    text: string;
}

/**
 * IMG RENDER DIRECTIVE
 * 
 * Trasforma un `<img>` nel render di un'immagine canvas da ImgBuilderService.
 * 
 * - Output `canvasChange`: emesso al render per download/condivisione.
 * - SSR / Fallback: su server o errore rimuove il `src`, ripiegando sul testo `alt`.
 * - Race-condition safe: ignora i risultati di build asincrone resi obsoleti.
 * 
 * Uso: `<img [appImgRender]="config" (canvasChange)="...">`
 */
@Directive({
    selector: 'img[appImgRender]',
    standalone: true,
    host: { '[src]': 'src()' },
})
export class ImgRenderDirective {
    private readonly imgBuilder = inject(ImgBuilderService);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    readonly appImgRender = input<ImgRenderConfig | null>(null);

    readonly canvasChange = output<HTMLCanvasElement | null>();

    protected readonly src = signal<string | null>(null);

    private renderToken = 0;

    constructor() {
        effect(() => {
            const cfg = this.appImgRender();
            if (!this.isBrowser || !cfg) {
                this.reset();
                return;
            }
            void this.render(cfg);
        });
    }

    private async render(cfg: ImgRenderConfig): Promise<void> {
        const token = ++this.renderToken;
        const { text, ...opts } = cfg;
        const canvas = await this.imgBuilder.buildCanvas(text, opts);
        if (token !== this.renderToken) return;
        if (!canvas) {
            this.reset();
            return;
        }
        this.canvasChange.emit(canvas);
        this.src.set(canvas.toDataURL('image/png'));
    }

    private reset(): void {
        this.src.set(null);
        this.canvasChange.emit(null);
    }
}
