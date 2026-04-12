import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GeneratorInfo, GenerateResponse } from '../../core/dto/generator.dto';
import { ApiService } from '../../core/services/api.service';
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
    private readonly api = inject(ApiService);
    private readonly share = inject(ShareService);
    private readonly theme = inject(ThemeService);

    readonly generator = signal<GeneratorInfo | null>(null);
    readonly result = signal<GenerateResponse | null>(null);
    readonly loading = signal(false);
    readonly sharing = signal(false);

    private readonly colorTema = this.theme.colorTema;
    private readonly colorTesto = this.theme.colorTemaText;

    async ngOnInit(): Promise<void> {
        const slug = this.route.snapshot.paramMap.get('slug') ?? '';
        try {
            const detail = await firstValueFrom(this.api.getGenerator(slug));
            this.generator.set(detail);
        } catch {
            this.notify.handleApiError(404, null);
        }
    }

    async generate(): Promise<void> {
        const gen = this.generator();
        if (!gen) return;

        this.loading.set(true);
        this.result.set(null);
        try {
            const res = await firstValueFrom(
                this.api.generate(gen.slug, {})
            );
            this.result.set(res);
        } catch {
            this.notify.handleApiError(500, null);
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
                text: `${res.text}\n\nDal ${gen.name}`,
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
}
