import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GeneratorInfo, GenerateResponse, GeneratorPageContent } from '../../core/dto/generator.dto';
import { ContestoSito, PageType } from '../../site';
import { GENERATOR_SLUG_TO_PAGE_TYPE } from '../app.pages';
import { SpeechService } from '../../core/engine/services/speech.service';
import { ImgBuilderService } from '../../core/engine/services/img-builder.service';
import { AssetDirective } from '../../core/engine/directives/asset.directive';
import { PageDirective } from '../../core/engine/directives/page.directive';
import { MarkdownPipe } from '../../core/engine/pipes/markdown.pipe';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { LikeActionComponent } from '../../core/engine/components/like-action/like-action.component';
import { ShareActionComponent } from '../../core/engine/components/share-action/share-action.component';
import { SpeechActionComponent } from '../../core/engine/components/speech-action/speech-action.component';
import { VariantWheelComponent } from '../../components/shared/variant-wheel/variant-wheel.component';


@Component({
    selector: 'app-generator-detail',
    imports: [
        TranslatePipe,
        MarkdownPipe,
        AssetDirective,
        PageDirective,
        RouterLink,
        LikeActionComponent,
        ShareActionComponent,
        SpeechActionComponent,
        VariantWheelComponent,
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
    /** Path della pagina piaciuti, per il link "Piaciuti di questo generatore" (con `?gen=`). */
    protected readonly piaciutiPath = ContestoSito.getPath(PageType.Piaciuti) ?? '/';
    private readonly document = inject(DOCUMENT);
    private readonly router = inject(Router);
    private readonly speech = inject(SpeechService);
    private readonly imgBuilder = inject(ImgBuilderService);

    readonly generator = computed<GeneratorInfo | null>(() => this.pageContent()?.generator ?? null);

    /** La variante del generatore (es. i 12 segni dell'oroscopo), o null per i generatori normali. */
    readonly variant = computed(() => this.generator()?.variant ?? null);
    /** Opzione scelta dall'utente (chiave), o null finché non ne tocca una. */
    private readonly pickedVariant = signal<string | null>(null);
    /** Opzione attiva: quella scelta, altrimenti la prima (default). Usata sia per l'evidenza dei
     *  pulsanti sia come parametro di generazione. */
    readonly activeVariant = computed<string | null>(() =>
        this.pickedVariant() ?? this.variant()?.options?.[0]?.key ?? null);

    /** Sceglie un'opzione della variante (es. un segno) e rigenera subito. Arrow function: passata
     *  come valore a VariantWheelComponent (stesso pattern di speakText/buildShareCanvas). */
    readonly pickVariant = (key: string): void => {
        this.pickedVariant.set(key);
        void this.generate(true);
    };

    readonly coverAssetId = computed(() => {
        const slug = this.generator()?.slug;
        return slug ? `generator.${slug}` : null;
    });
    readonly coverVisible = signal(true);

    /** Generazione prodotta dal client ("Ancora!"): quando c'è, vince sul `result` SSR del resolver. */
    private readonly localResult = signal<GenerateResponse | null>(null);
    /** Risultato mostrato: quello del client se presente, altrimenti quello SSR dal resolver (rotta
     *  "frase condivisa" `/generatori/<slug>/:id`, `pageContent().recovered`). */
    readonly result = computed<GenerateResponse | null>(() => this.localResult() ?? this.pageContent()?.result ?? null);
    readonly loading = signal(false);
    /** Id pubblico dell'ultima generazione condivisa in QUESTA sessione (per il link condivisibile,
     *  costruito da `ensureSavedLink`). Sulla rotta "frase condivisa" il link è già l'URL corrente:
     *  non serve un id salvato a parte, vedi `pageContent().recovered`. */
    readonly savedId = signal<string | null>(null);
    /** true quando il risultato mostrato proviene dalla rotta "frase condivisa"
     *  (`/generatori/<slug>/:id`), non da una generazione client. */
    readonly recovered = computed(() => this.localResult() === null && (this.pageContent()?.recovered ?? false));
    /** true se il risultato mostrato è già tra i piaciuti (registrato in questa sessione, o la
     *  pagina stessa è la rotta "frase condivisa" di un piaciuto). */
    readonly liked = computed(() => this.savedId() !== null || this.recovered());

    constructor() {
        super();
        // Rotta "frase condivisa": il contenuto arriva già risolto in SSR (resolver) → niente da
        // fare. Playground: genera lato client. Niente scroll: la pagina è appena arrivata.
        afterNextRender(() => {
            if (!this.result() && !this.pageContent()?.recovered) void this.generate();
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
     * Assicura che il risultato corrente sia tra i piaciuti e restituisce il link condivisibile
     * che punta a *quell'* oggetto (`/generatori/<slug>/<id>`, non più `?g=<id>`). È il cuore del
     * "mi piace": registra (una volta sola: l'id viene riusato) e dà al chiamante un link stabile.
     *
     * - Già sulla rotta "frase condivisa" → l'URL corrente È GIÀ quel link, nessuna registrazione.
     * - Generazione genuina (con firma HMAC) non ancora piaciuta → la registra e ottiene l'id.
     * - Già registrata in questa sessione → riusa `savedId`, niente doppia registrazione.
     *
     * Un errore propaga: il chiamante (like-action) lo mostra come toast d'errore.
     */
    private async ensureSavedLink(): Promise<string> {
        if (this.pageContent()?.recovered) return this.getCurrentUrl();
        if (this.savedId()) return `${this.getCurrentUrl()}/${this.savedId()}`;

        const res = this.result();
        const slug = this.generator()?.slug;
        if (!res?.sig || !slug) return this.getCurrentUrl();

        const { id } = await this.api.saveGeneration(slug, { markdown: res.markdown, score: res.score, sig: res.sig });
        this.savedId.set(id);
        return `${this.getCurrentUrl()}/${id}`;
    }

    /**
     * Dalla rotta "frase condivisa" (`/generatori/<slug>/:id`) torna al playground del generatore.
     * Naviga verso una rotta diversa (PageType diverso da quello "condiviso"): l'istanza del
     * componente NON viene riusata, quindi non generiamo qui — il playground appena montato lo fa
     * da sé al proprio `afterNextRender` (niente doppia chiamata al backend).
     */
    goToGenerator(): void {
        const slug = this.generator()?.slug;
        const basePageType = slug ? GENERATOR_SLUG_TO_PAGE_TYPE[slug] : null;
        const path = basePageType ? ContestoSito.getPath(basePageType) : null;
        if (path) void this.router.navigateByUrl(path);
    }

    // Porta in vista il risultato appena rigenerato (block: 'nearest' = non si muove se già visibile).
    private scrollToResult(): void {
        const win = this.document.defaultView;
        win?.requestAnimationFrame(() =>
            this.document.querySelector('.gen-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }

    // ── Sorgenti dati per i bottoni azione (like / share / speech) ────────
    //
    // I componenti `action` del template ricevono una funzione che produce il
    // dato e gestiscono da soli il servizio, lo stato di loading, il toast di
    // esito e gli errori. Il componente di pagina non tocca più ShareService.

    /** Testo da leggere ad alta voce. */
    readonly speakText = (): string => this.result()?.text ?? '';

    /** Registra il risultato mostrato tra i piaciuti (bottone "mi piace"). */
    readonly likeThis = async (): Promise<void> => {
        await this.ensureSavedLink();
    };

    /**
     * Canvas immagine da condividere. Non registra più nulla tra i piaciuti (quello lo fa il
     * bottone "mi piace" a parte): condivisione e "mi piace" sono azioni indipendenti.
     */
    readonly buildShareCanvas = async (): Promise<HTMLCanvasElement> => {
        const res = this.result();
        if (!res) throw new Error('Nessun risultato da condividere');
        const footer = `\n\nDal ${this.generator()?.name ?? ''}`;
        const canvas = await this.imgBuilder.buildCanvas(`${res.text}\n${footer}`, { maxWidth: 1200 });
        if (!canvas) throw new Error('Errore nella generazione dell\'immagine');
        return canvas as HTMLCanvasElement;
    };

    /**
     * Titolo per la Web Share API. Sulla rotta "frase condivisa" l'URL corrente è già il link
     * all'oggetto; sul playground, se già piaciuta in questa sessione (like-action premuto prima)
     * allega il link a *quell'* oggetto; altrimenti il link generico alla pagina del generatore.
     */
    readonly shareTitle = computed(() => {
        const gen = this.generator();
        if (!gen) return '';
        if (this.pageContent()?.recovered) return `${gen.name}: ${this.getCurrentUrl()}`;
        const id = this.savedId();
        const url = id ? `${this.getCurrentUrl()}/${id}` : this.getCurrentUrl();
        return `${gen.name}: ${url}`;
    });

    /** Nome del file immagine condiviso. */
    readonly shareFilename = computed(() => {
        const gen = this.generator();
        return gen ? `${gen.slug}.png` : 'risultato.png';
    });

    // ── Dispatch per generatore (wrapper tipizzati: niente slug a mano nelle chiamate API) ──
    //
    // Chiave = slug del generatore (da pageContent(), non pageType()): questo componente serve sia
    // il playground (/generatori/<slug>) sia la rotta "frase condivisa" (/generatori/<slug>/:id,
    // PageType diverso ma stesso generatore) — lo slug è l'identità stabile tra le due.

    private fetchGeneratedText(): Promise<GenerateResponse> {
        const slug = this.generator()?.slug;
        switch (slug) {
            case 'incel': return this.api.generateIncel();
            case 'startup': return this.api.generateStartup();
            case 'auto': return this.api.generateAuto();
            case 'antiveg': return this.api.generateAntiveg();
            case 'locali': return this.api.generateLocali();
            case 'kebab': return this.api.generateKebab();
            case 'mbeb': return this.api.generateMbeb();
            case 'oroscopo': return this.api.generateOroscopo(this.activeVariant() ?? '');
            default: throw new Error(`Slug non è un generatore noto: ${slug}`);
        }
    }
}
