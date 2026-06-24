import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GeneratorInfo, GenerateResponse } from '../../core/dto/generator.dto';
import { ContestoSito, PageType } from '../../site';
import { SpeechService } from '../../core/engine/services/speech.service';
import { ImgBuilderService } from '../../core/engine/services/img-builder.service';
import { AssetDirective } from '../../core/engine/directives/asset.directive';
import { PageDirective } from '../../core/engine/directives/page.directive';
import { MarkdownPipe } from '../../core/engine/pipes/markdown.pipe';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { CopyActionComponent } from '../../components/shared/action/copy-action/copy-action.component';
import { ShareActionComponent } from '../../components/shared/action/share-action/share-action.component';
import { SpeechActionComponent } from '../../components/shared/action/speech-action/speech-action.component';


@Component({
    selector: 'app-generator-detail',
    imports: [
        TranslatePipe,
        MarkdownPipe,
        AssetDirective,
        PageDirective,
        RouterLink,
        CopyActionComponent,
        ShareActionComponent,
        SpeechActionComponent,
    ],
    templateUrl: './generator-detail.component.html',
    // Il risultato viene ricreato a ogni generazione (@if su result()): l'animazione
    // si riavvia da sola a ogni "Ancora!", dando un feedback visivo allo spam.
    styles: [`
        .gen-result { animation: genPop .28s ease-out; }
        @keyframes genPop {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: none; }
        }
    `],
})
export class GeneratorDetailComponent extends PageBaseComponent<GeneratorInfo> {
    /** Esposto al template per i link interni via [appPage] (es. verso la galleria). */
    protected readonly PageType = PageType;
    /** Path della pagina galleria, per il link "Galleria di questo generatore" (con `?gen=`). */
    protected readonly galleriaPath = ContestoSito.getPath(PageType.Galleria) ?? '/';
    /** Arrotonda il punteggio per il badge rarità. */
    protected readonly rounded = (n: number): number => Math.round(n);
    private readonly document = inject(DOCUMENT);
    private readonly speech = inject(SpeechService);
    private readonly imgBuilder = inject(ImgBuilderService);

    readonly generator = computed<GeneratorInfo | null>(() => this.pageContent());
    readonly coverAssetId = computed(() => {
        const slug = this.generator()?.slug;
        return slug ? `generator.${slug}` : null;
    });
    readonly coverVisible = signal(true);

    /** Query param `?g=<id>`: se presente, all'avvio si recupera quella generazione salvata
     *  invece di generarne una nuova (link condivisibile della galleria). Bind automatico via
     *  withComponentInputBinding. */
    readonly g = input<string>();

    readonly result = signal<GenerateResponse | null>(null);
    readonly loading = signal(false);
    readonly saving = signal(false);
    /** Id pubblico dell'ultima generazione salvata in galleria (per il link condivisibile). */
    readonly savedId = signal<string | null>(null);
    /** true quando il risultato mostrato proviene dalla galleria (recupero `?g=`), non da una generazione. */
    readonly recovered = signal(false);
    private allaFine = '';

    constructor() {
        super();
        // All'avvio: con `?g=` recupera la generazione salvata, altrimenti ne genera una nuova.
        // Niente scroll: la pagina è appena arrivata.
        afterNextRender(() => {
            const id = this.g();
            if (id) void this.recover(id);
            else void this.generate();
        });
    }

    /**
     * Genera un nuovo testo. <paramref name="scrollToResult"/> = true (click utente su "Ancora!")
     * porta il risultato in vista su mobile; false (auto al primo render) non muove la pagina.
     */
    async generate(scrollToResult = false): Promise<void> {
        this.speech.stop();
        this.loading.set(true);
        this.result.set(null);
        this.savedId.set(null);
        this.recovered.set(false);
        this.allaFine = `\n\nDal ${this.generator()?.name ?? ''}\n${this.getCurrentUrl()}`;
        try {
            const res = await this.fetchGeneratedText();
            this.result.set(res);
            if (scrollToResult) this.scrollToResult();
        } catch {
            // L'apiErrorInterceptor ha già notificato l'utente: qui resettiamo solo lo stato UI.
            this.result.set(null);
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Recupera dalla galleria la generazione con l'id dato e la mostra. Id assente o non valido →
     * si ricade su una generazione normale, così il link resta sempre utilizzabile.
     */
    private async recover(id: string): Promise<void> {
        this.speech.stop();
        this.loading.set(true);
        this.result.set(null);
        this.savedId.set(null);
        try {
            const entry = await this.api.getGeneration(id);
            this.allaFine = `\n\nDal ${this.generator()?.name ?? ''}\n${this.getCurrentUrl()}?g=${id}`;
            // sig vuota: un risultato recuperato è già in galleria, non si ri-salva.
            this.result.set({ text: entry.text, markdown: entry.markdown, score: entry.score, sig: '' });
            this.recovered.set(true);
        } catch {
            await this.generate();
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Salva il risultato corrente nella galleria pubblica e copia negli appunti il link
     * condivisibile (`?g=<id>`). Disponibile solo per generazioni genuine (con firma HMAC).
     */
    async save(): Promise<void> {
        const res = this.result();
        const slug = this.generator()?.slug;
        if (!res || !res.sig || !slug || this.saving()) return;
        this.saving.set(true);
        try {
            const { id } = await this.api.saveGeneration(slug, { markdown: res.markdown, score: res.score, sig: res.sig });
            this.savedId.set(id);
            const url = `${this.getCurrentUrl()}?g=${id}`;
            try {
                await this.document.defaultView?.navigator.clipboard.writeText(url);
                this.notify.toast(this.translate.translate('galleriaSalvataLinkCopiato'), 'success');
            } catch {
                // Clipboard non disponibile (permessi/contesto non sicuro): il salvataggio è comunque riuscito.
                this.notify.toast(this.translate.translate('galleriaSalvata'), 'success');
            }
        } catch {
            // L'apiErrorInterceptor ha già notificato l'utente.
        } finally {
            this.saving.set(false);
        }
    }

    // Porta in vista il risultato appena rigenerato (block: 'nearest' = non si muove se già visibile).
    private scrollToResult(): void {
        const win = this.document.defaultView;
        win?.requestAnimationFrame(() =>
            this.document.querySelector('.gen-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
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
        return gen ? `${gen.name}: ${this.getCurrentUrl()}` : '';
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
