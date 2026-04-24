import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, OnDestroy, signal, afterNextRender } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GeneratorInfo, GenerateResponse } from '../../core/dto/generator.dto';
import { ApiService } from '../../core/services/api.service';
import { PageMetaService } from '../../core/services/page-meta.service';
import { ContestoSito } from '../../site';
import { PageType } from '../../site';
import { ShareService } from '../../core/services/share.service';
import { SpeechService } from '../../core/services/speech.service';
import { renderToCanvas } from '../../core/services/img-builder.service';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { PageBaseComponent } from '../page-base.component';
import { ThemeService } from '../../core/services/theme.service';

@Component({
    selector: 'app-generator-detail',
    imports: [TranslatePipe, MarkdownPipe],
    templateUrl: './generator-detail.component.html',
    styleUrl: './generator-detail.component.css'
})
export class GeneratorDetailComponent extends PageBaseComponent implements OnDestroy {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly pageMeta = inject(PageMetaService);
    private readonly api = inject(ApiService);
    private readonly share = inject(ShareService);
    private readonly document = inject(DOCUMENT);
    readonly speech = inject(SpeechService);
    private readonly theme = inject(ThemeService);

    readonly generator = signal<GeneratorInfo | null>(null);
    readonly result = signal<GenerateResponse | null>(null);
    readonly loading = signal(false);
    readonly sharing = signal(false);
    private allaFine = '';

    private readonly colorTema = this.theme.colorTema;
    private readonly colorTesto = this.theme.colorTemaText;

    constructor() {
        super();

        const generator = this.route.snapshot.data['generator'] as GeneratorInfo;
        this.generator.set(generator);

        effect(() => {
            this.translate.currentLang();
            this.updatePageMeta(this.generator());
        });

        // Avvia la prima generazione solo sul client (browser) per evitare
        // che l'SSR (Server-Side Rendering) chiami l'API e si appenda o rallenti.
        afterNextRender(async () => {
            // Se i dati del generatore mancano (perché saltati in SSR), li carichiamo ora
            if (!this.generator()) {
                try {
                    const info = await this.fetchGeneratorInfo();
                    this.generator.set(info);
                } catch (error) {
                    this.handleRequestError(error);
                }
            }
            this.generate();
        });
    }

    ngOnDestroy(): void {
        this.speech.stop();
    }

    async generate(): Promise<void> {
        this.speech.stop();
        this.loading.set(true);
        this.result.set(null);
        this.allaFine = `\n\nDal ${this.generator()?.name ?? ''}\n${this.document.URL}`;
        try {
            const res = await this.fetchGeneratedText();
            this.result.set(res);
        } catch (error) {
            this.handleRequestError(error);
        } finally {
            this.loading.set(false);
        }
    }

    async copyResult(): Promise<void> {
        const res = this.result();
        if (!res) return;
        await this.share.copyText(res.markdown + this.allaFine);
    }

    async shareResult(): Promise<void> {
        const res = this.result();
        const gen = this.generator();
        if (!res || !gen) return;

        this.sharing.set(true);
        try {
            const canvas = document.createElement('canvas');
            renderToCanvas(canvas, {
                text: `${res.text}\n${this.allaFine}`,
                bgColor: this.colorTema(),
                textColor: this.colorTesto(),
                fontSize: 25,
                canvasWidth: 900,
                fontFamily: 'Verdana',
                margin: 50
            });
            await this.share.shareCanvas(canvas, `${gen.name}: ${this.document.URL}`, `${gen.slug}.png`);
        } finally {
            this.sharing.set(false);
        }
    }

    toggleAudio(): void {
        const res = this.result();
        if (!res) return;

        if (this.speech.isSpeaking()) {
            this.speech.stop();
            return;
        }

        this.speech.speak(res.text);
    }

    // ── Dispatch per generatore ──────────────────────────────────────

    private fetchGeneratorInfo(): Promise<GeneratorInfo> {
        switch (this.PageType) {
            case PageType.GeneratorIncel:   return this.api.getIncel();
            case PageType.GeneratorAuto:    return this.api.getAuto();
            case PageType.GeneratorAntiveg: return this.api.getAntiveg();
            case PageType.GeneratorLocali:  return this.api.getLocali();
            case PageType.GeneratorMbeb:    return this.api.getMbeb();
            default: throw new Error(`PageType non è un generatore: ${this.PageType}`);
        }
    }

    private fetchGeneratedText(): Promise<GenerateResponse> {
        switch (this.PageType) {
            case PageType.GeneratorIncel:   return this.api.generateIncel({});
            case PageType.GeneratorAuto:    return this.api.generateAuto({});
            case PageType.GeneratorAntiveg: return this.api.generateAntiveg({});
            case PageType.GeneratorLocali:  return this.api.generateLocali({});
            case PageType.GeneratorMbeb:    return this.api.generateMbeb({});
            default: throw new Error(`PageType non è un generatore: ${this.PageType}`);
        }
    }

    // ── Gestione errori e meta ───────────────────────────────────────

    private handleRequestError(error: unknown): void {
        const httpStatus = error instanceof HttpErrorResponse ? error.status || 500 : 500;
        const responseBody = error instanceof HttpErrorResponse ? error.error : null;
        this.notify.handleApiError(httpStatus, responseBody);
    }

    private updatePageMeta(generator: GeneratorInfo | null): void {
        if (!generator) return;
        const title = `${this.translate.translate('generatoreDetail', generator.name)} | ${ContestoSito.config.appName}`;
        const description = generator.description ?? ContestoSito.config.description;
        this.pageMeta.setTitle(title, description);
    }
}
