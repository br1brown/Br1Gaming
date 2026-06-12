import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { GeneratorInfo, GenerateResponse } from '../../core/dto/generator.dto';
import { PageType } from '../../site';
import { SpeechService } from '../../core/engine/services/speech.service';
import { ImgBuilderService } from '../../core/engine/services/img-builder.service';
import { AssetDirective } from '../../core/engine/directives/asset.directive';
import { MarkdownPipe } from '../../core/engine/pipes/markdown.pipe';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { PageBaseComponent } from '../page-base.component';
import { CopyActionComponent } from '../../components/shared/action/copy-action/copy-action.component';
import { ShareActionComponent } from '../../components/shared/action/share-action/share-action.component';
import { SpeechActionComponent } from '../../components/shared/action/speech-action/speech-action.component';


@Component({
    selector: 'app-generator-detail',
    imports: [
        TranslatePipe,
        MarkdownPipe,
        AssetDirective,
        CopyActionComponent,
        ShareActionComponent,
        SpeechActionComponent,
    ],
    templateUrl: './generator-detail.component.html',
    host: { class: 'd-block' },
})
export class GeneratorDetailComponent extends PageBaseComponent<GeneratorInfo> {
    private readonly document = inject(DOCUMENT);
    private readonly speech = inject(SpeechService);
    private readonly imgBuilder = inject(ImgBuilderService);

    readonly generator = computed<GeneratorInfo | null>(() => this.pageContent());
    readonly coverAssetId = computed(() => {
        const slug = this.generator()?.slug;
        return slug ? `generator.${slug}` : null;
    });
    readonly coverVisible = signal(true);

    readonly result = signal<GenerateResponse | null>(null);
    readonly loading = signal(false);
    private allaFine = '';

    constructor() {
        super();
        afterNextRender(() => void this.generate());
    }

    async generate(): Promise<void> {
        this.speech.stop();
        this.loading.set(true);
        this.result.set(null);
        this.allaFine = `\n\nDal ${this.generator()?.name ?? ''}\n${this.document.URL}`;
        try {
            const res = await this.fetchGeneratedText();
            this.result.set(res);
        } catch {
            // L'apiErrorInterceptor ha già notificato l'utente: qui resettiamo solo lo stato UI.
            this.result.set(null);
        } finally {
            this.loading.set(false);
        }
    }

    // ── Sorgenti dati per i bottoni azione (copy / share / speech) ───────
    //
    // I componenti `action` del template ricevono una funzione che produce il
    // dato e gestiscono da soli il servizio, lo stato di loading, il toast di
    // esito e gli errori. Il componente di pagina non tocca più ShareService.

    /** Testo da copiare negli appunti. */
    readonly copyText = (): string => (this.result()?.markdown ?? '') + this.allaFine;

    /** Testo da leggere ad alta voce. */
    readonly speakText = (): string => this.result()?.text ?? '';

    /** Canvas immagine da condividere (la share-action smista verso shareCanvas). */
    readonly buildShareCanvas = async (): Promise<HTMLCanvasElement> => {
        const res = this.result();
        if (!res) throw new Error('Nessun risultato da condividere');
        const canvas = await this.imgBuilder.buildCanvas(
            `${res.text}\n${this.allaFine}`,
            { maxWidth: 1200 }
        );
        if (!canvas) throw new Error('Errore nella generazione dell\'immagine');
        return canvas as HTMLCanvasElement;
    };

    /** Titolo per la Web Share API. */
    readonly shareTitle = computed(() => {
        const gen = this.generator();
        return gen ? `${gen.name}: ${this.document.URL}` : '';
    });

    /** Nome del file immagine condiviso. */
    readonly shareFilename = computed(() => {
        const gen = this.generator();
        return gen ? `${gen.slug}.png` : 'risultato.png';
    });

    // ── Dispatch per generatore (wrapper tipizzati: niente slug a mano) ──

    private fetchGeneratedText(): Promise<GenerateResponse> {
        switch (this.pageType()) {
            case PageType.GeneratorIncel: return this.api.generateIncel();
            case PageType.GeneratorAuto: return this.api.generateAuto();
            case PageType.GeneratorAntiveg: return this.api.generateAntiveg();
            case PageType.GeneratorLocali: return this.api.generateLocali();
            case PageType.GeneratorMbeb: return this.api.generateMbeb();
            default: throw new Error(`PageType non è un generatore: ${this.pageType()}`);
        }
    }
}
