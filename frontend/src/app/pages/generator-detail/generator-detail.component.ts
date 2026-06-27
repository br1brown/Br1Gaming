import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GeneratorInfo, GenerateResponse, GeneratorPageContent } from '../../core/dto/generator.dto';
import { ContestoSito, PageType } from '../../site';
import { SpeechService } from '../../core/engine/services/speech.service';
import { ImgBuilderService } from '../../core/engine/services/img-builder.service';
import { AssetDirective } from '../../core/engine/directives/asset.directive';
import { PageDirective } from '../../core/engine/directives/page.directive';
import { MarkdownPipe } from '../../core/engine/pipes/markdown.pipe';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
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
export class GeneratorDetailComponent extends PageBaseComponent<GeneratorPageContent> {
    /** Esposto al template per i link interni via [appPage] (es. verso i condivisi). */
    protected readonly PageType = PageType;
    /** Path della pagina condivisi, per il link "Condivisi di questo generatore" (con `?gen=`). */
    protected readonly condivisiPath = ContestoSito.getPath(PageType.Condivisi) ?? '/';
    /** Arrotonda il punteggio per il badge rarità. */
    protected readonly rounded = (n: number): number => Math.round(n);
    private readonly document = inject(DOCUMENT);
    private readonly router = inject(Router);
    private readonly speech = inject(SpeechService);
    private readonly imgBuilder = inject(ImgBuilderService);

    readonly generator = computed<GeneratorInfo | null>(() => this.pageContent()?.generator ?? null);
    readonly coverAssetId = computed(() => {
        const slug = this.generator()?.slug;
        return slug ? `generator.${slug}` : null;
    });
    readonly coverVisible = signal(true);

    /** Query param `?g=<id>`: se presente, all'avvio si recupera quella generazione condivisa
     *  invece di generarne una nuova (link condivisibile). Bind automatico via
     *  withComponentInputBinding. */
    readonly g = input<string>();

    /** Generazione prodotta dal client ("Ancora!"): quando c'è, vince sul `result` SSR del resolver. */
    private readonly localResult = signal<GenerateResponse | null>(null);
    /** Risultato mostrato: quello del client se presente, altrimenti quello SSR dal resolver (recupero `?g=`). */
    readonly result = computed<GenerateResponse | null>(() => this.localResult() ?? this.pageContent()?.result ?? null);
    readonly loading = signal(false);
    /** Id pubblico dell'ultima generazione condivisa (per il link condivisibile). */
    readonly savedId = signal<string | null>(null);
    /** true quando il risultato mostrato proviene dai condivisi (recupero `?g=`), non da una generazione client. */
    readonly recovered = computed(() => this.localResult() === null && (this.pageContent()?.recovered ?? false));

    constructor() {
        super();
        // Recupero `?g=`: la generazione è già risolta in SSR (resolver) → niente da fare. Altrimenti
        // genera lato client. Niente scroll: la pagina è appena arrivata.
        afterNextRender(() => {
            if (!this.result()) void this.generate();
        });
    }

    /**
     * Genera un nuovo testo. <paramref name="scrollToResult"/> = true (click utente su "Ancora!")
     * porta il risultato in vista su mobile; false (auto al primo render) non muove la pagina.
     */
    async generate(scrollToResult = false): Promise<void> {
        this.speech.stop();
        this.loading.set(true);
        this.localResult.set(null);
        this.savedId.set(null);
        try {
            const res = await this.fetchGeneratedText();
            this.localResult.set(res);
            if (scrollToResult) this.scrollToResult();
        } catch {
            // L'apiErrorInterceptor ha già notificato l'utente: qui resettiamo solo lo stato UI.
            this.localResult.set(null);
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Assicura che il risultato corrente sia tra i condivisi e restituisce il link
     * condivisibile che punta a *quell'* oggetto (`?g=<id>`). È il cuore del nuovo flusso di
     * condivisione: prima si registra (una volta sola: l'id viene riusato), poi il chiamante usa
     * il link come URL allegato alla condivisione (`shareTitle`).
     *
     * - Generazione genuina (con firma HMAC) non ancora condivisa → la condivide e ottiene l'id.
     * - Già condivisa in questa sessione → riusa `savedId`, niente doppia registrazione.
     * - Risultato recuperato dai condivisi (`?g=`, sig vuota) → è già un oggetto: link al suo id.
     *
     * Un errore di registrazione propaga: la share-action annulla la condivisione e notifica,
     * così non si finisce mai a condividere un link "nudo" che non punta alla frase mostrata.
     */
    private async ensureSavedLink(): Promise<string> {
        if (this.savedId()) return `${this.getCurrentUrl()}?g=${this.savedId()}`;
        const recoveredId = this.g();
        if (recoveredId) return `${this.getCurrentUrl()}?g=${recoveredId}`;

        const res = this.result();
        const slug = this.generator()?.slug;
        if (!res?.sig || !slug) return this.getCurrentUrl();

        const { id } = await this.api.saveGeneration(slug, { markdown: res.markdown, score: res.score, sig: res.sig });
        this.savedId.set(id);
        return `${this.getCurrentUrl()}?g=${id}`;
    }

    /**
     * Dallo stato "frase recuperata" (`?g=`) torna al generatore "vuoto": rimuove la query dall'URL
     * e produce subito una generazione nuova. La navigazione riusa l'istanza del componente (stessa
     * rotta), quindi `afterNextRender` non riparte: la generazione la lanciamo a mano.
     */
    goToGenerator(): void {
        const path = ContestoSito.getPath(this.pageType());
        if (path) void this.router.navigateByUrl(path);
        void this.generate(true);
    }

    // Porta in vista il risultato appena rigenerato (block: 'nearest' = non si muove se già visibile).
    private scrollToResult(): void {
        const win = this.document.defaultView;
        win?.requestAnimationFrame(() =>
            this.document.querySelector('.gen-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }

    // ── Sorgenti dati per i bottoni azione (share / speech) ──────────────
    //
    // I componenti `action` del template ricevono una funzione che produce il
    // dato e gestiscono da soli il servizio, lo stato di loading, il toast di
    // esito e gli errori. Il componente di pagina non tocca più ShareService.

    /** Testo da leggere ad alta voce. */
    readonly speakText = (): string => this.result()?.text ?? '';

    /**
     * Canvas immagine da condividere. Prima registra la generazione tra i condivisi (`ensureSavedLink`),
     * così `shareTitle()` può allegare il link a *quell'* oggetto; l'immagine però mostra solo la frase
     * (niente URL trascritto). La share-action smista verso shareCanvas e, dopo questo await, legge
     * `shareTitle()` con l'id ormai disponibile.
     */
    readonly buildShareCanvas = async (): Promise<HTMLCanvasElement> => {
        const res = this.result();
        if (!res) throw new Error('Nessun risultato da condividere');
        // Registra la generazione tra i condivisi (serve per il link allegato alla condivisione via
        // shareTitle), ma NON trascriviamo l'URL nell'immagine: lì resterebbe testo morto, non cliccabile.
        await this.ensureSavedLink();
        const footer = `\n\nDal ${this.generator()?.name ?? ''}`;
        const canvas = await this.imgBuilder.buildCanvas(`${res.text}\n${footer}`, { maxWidth: 1200 });
        if (!canvas) throw new Error('Errore nella generazione dell\'immagine');
        return canvas as HTMLCanvasElement;
    };

    /**
     * Titolo per la Web Share API, con il link all'oggetto condiviso. Letto dalla share-action
     * dopo `buildShareCanvas`, quindi `savedId()` è già valorizzato per una generazione appena
     * salvata; `g()` copre il caso di frase recuperata.
     */
    readonly shareTitle = computed(() => {
        const gen = this.generator();
        if (!gen) return '';
        const id = this.savedId() ?? this.g();
        const url = id ? `${this.getCurrentUrl()}?g=${id}` : this.getCurrentUrl();
        return `${gen.name}: ${url}`;
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
