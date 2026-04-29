import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, OnDestroy, OnInit, PLATFORM_ID, signal } from '@angular/core';
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

/**
 * Mappa statica dei metadati di ogni generatore, indicizzata per PageType.
 *
 * Usata per derivare i metadati in SSR tramite computed() a partire dal
 * pageType (input obbligatorio, sempre disponibile prima del render).
 * Evita la dipendenza da withComponentInputBinding, che può avere problemi
 * di timing con afterNextRender nelle versioni correnti di Angular SSR.
 */
const GENERATOR_INFO_MAP: Partial<Record<PageType, GeneratorInfo>> = {
    [PageType.GeneratorIncel]:   { slug: 'incel',   name: 'Generatore Incel',      description: 'Genera il tuo incel di fiducia' },
    [PageType.GeneratorAuto]:    { slug: 'auto',    name: 'Generatore Auto',        description: 'Genera storie di automobilisti' },
    [PageType.GeneratorAntiveg]: { slug: 'antiveg', name: 'Generatore Antivegano',  description: "Genera il profilo dell'antivegano" },
    [PageType.GeneratorLocali]:  { slug: 'locali',  name: 'Generatore Locali',      description: 'Trova il nome del tuo locale tutto italiano' },
    [PageType.GeneratorMbeb]:    { slug: 'mbeb',    name: 'Generatore Mbeb',        description: 'Genera il tuo mbeb' },
};

@Component({
    selector: 'app-generator-detail',
    imports: [TranslatePipe, MarkdownPipe],
    templateUrl: './generator-detail.component.html',
    styleUrl: './generator-detail.component.css'
})
export class GeneratorDetailComponent extends PageBaseComponent implements OnInit, OnDestroy {
    private readonly pageMeta = inject(PageMetaService);
    private readonly share = inject(ShareService);
    private readonly document = inject(DOCUMENT);
    private readonly platformId = inject(PLATFORM_ID);
    readonly speech = inject(SpeechService);
    private readonly theme = inject(ThemeService);

    /**
     * Metadati del generatore corrente, derivati in modo sincrono dal pageType.
     *
     * pageType è un input obbligatorio di PageBaseComponent, sempre disponibile
     * prima del primo ciclo di change detection sia in SSR che nel browser.
     * L'uso di computed() garantisce che generator() non sia mai null per le
     * pagine generatore, eliminando lo spinner nell'HTML servito in SSR.
     */
    readonly generator = computed<GeneratorInfo | null>(() => GENERATOR_INFO_MAP[this.pageType()] ?? null);

    readonly result = signal<GenerateResponse | null>(null);
    readonly loading = signal(false);
    readonly sharing = signal(false);
    private allaFine = '';

    private readonly colorTema = this.theme.colorTema;
    private readonly colorTesto = this.theme.colorTemaText;

    constructor() {
        super();

        effect(() => {
            this.translate.currentLang();
            this.updatePageMeta(this.generator());
        });
    }

    ngOnInit(): void {
        // La prima generazione usa POST: ha senso solo nel browser.
        // L'SSR si occupa solo del rendering del meta SEO tramite computed().
        if (!isPlatformBrowser(this.platformId)) return;
        void this.generate();
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

    private fetchGeneratedText(): Promise<GenerateResponse> {
        switch (this.pageType()) {
            case PageType.GeneratorIncel:   return this.api.generateIncel({});
            case PageType.GeneratorAuto:    return this.api.generateAuto({});
            case PageType.GeneratorAntiveg: return this.api.generateAntiveg({});
            case PageType.GeneratorLocali:  return this.api.generateLocali({});
            case PageType.GeneratorMbeb:    return this.api.generateMbeb({});
            default: throw new Error(`PageType non è un generatore: ${this.pageType()}`);
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
