import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { GeneratorInfo, GenerateResponse } from '../../core/dto/generator.dto';
import { ApiService } from '../../core/services/api.service';
import { PageMetaService } from '../../core/services/page-meta.service';
import { ContestoSito } from '../../site';
import { PageType } from '../../app.routes';
import { ShareService } from '../../core/services/share.service';
import { renderToCanvas } from '../../core/services/img-builder.service';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { PageBaseComponent } from '../page-base.component';
import { ThemeService } from '../../core/services/theme.service';

@Component({
    selector: 'app-generator-detail',
    imports: [TranslatePipe, MarkdownPipe],
    templateUrl: './generator-detail.component.html'
})
export class GeneratorDetailComponent extends PageBaseComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly pageMeta = inject(PageMetaService);
    private readonly api = inject(ApiService);
    private readonly share = inject(ShareService);
    private readonly theme = inject(ThemeService);

    readonly generator = signal<GeneratorInfo | null>(null);
    readonly result = signal<GenerateResponse | null>(null);
    readonly loading = signal(false);
    readonly sharing = signal(false);

    private readonly colorTema = this.theme.colorTema;
    private readonly colorTesto = this.theme.colorTemaText;
    private readonly defaultPageDescription = this.route.snapshot.data['pageDescription'] as string | null | undefined;

    constructor() {
        super();

        effect(() => {
            this.translate.currentLang();
            this.updatePageMeta(this.generator());
        });
    }

    async ngOnInit(): Promise<void> {
        try {
            const detail = await firstValueFrom(this.fetchGeneratorInfo());
            this.generator.set(detail);
        } catch (error) {
            await this.handleGeneratorLoadError(error);
        }
    }

    async generate(): Promise<void> {
        this.loading.set(true);
        this.result.set(null);
        try {
            const res = await firstValueFrom(this.fetchGeneratedText());
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
        await this.share.copyText(res.markdown);
    }

    async shareResult(): Promise<void> {
        const res = this.result();
        const gen = this.generator();
        if (!res || !gen) return;

        this.sharing.set(true);
        try {
            const canvas = document.createElement('canvas');
            renderToCanvas(canvas, {
                text: `${res.text}\n\nDal ${gen.name}\n${window.location}`,
                bgColor: this.colorTema(),
                textColor: this.colorTesto(),
                fontSize: 25,
                canvasWidth: 900,
                fontFamily: 'Verdana',
                margin: 50
            });
            await this.share.shareCanvas(canvas, gen.name, `${gen.slug}.png`);
        } finally {
            this.sharing.set(false);
        }
    }

    // ── Dispatch per generatore ──────────────────────────────────────

    private fetchGeneratorInfo(): Observable<GeneratorInfo> {
        switch (this.PageType) {
            case PageType.GeneratorIncel:   return this.api.getIncel();
            case PageType.GeneratorAuto:    return this.api.getAuto();
            case PageType.GeneratorAntiveg: return this.api.getAntiveg();
            case PageType.GeneratorLocali:  return this.api.getLocali();
            case PageType.GeneratorMbeb:    return this.api.getMbeb();
            default: throw new Error(`PageType non è un generatore: ${this.PageType}`);
        }
    }

    private fetchGeneratedText(): Observable<GenerateResponse> {
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

    private async handleGeneratorLoadError(error: unknown): Promise<void> {
        if (error instanceof HttpErrorResponse && error.status === 404) {
            await this.router.navigateByUrl('/error/404');
            return;
        }
        this.handleRequestError(error);
    }

    private handleRequestError(error: unknown): void {
        const httpStatus = error instanceof HttpErrorResponse ? error.status || 500 : 500;
        const responseBody = error instanceof HttpErrorResponse ? error.error : null;
        this.notify.handleApiError(httpStatus, responseBody);
    }

    private updatePageMeta(generator: GeneratorInfo | null): void {
        const raw = generator
            ? this.translate.translate('generatoreDetail', generator.name)
            : this.translate.translate('generatori');
        const title = `${raw} | ${ContestoSito.config.appName}`;
        const description = generator?.description
            ?? this.defaultPageDescription
            ?? ContestoSito.config.description;

        this.pageMeta.setTitle(title, description);
    }
}
