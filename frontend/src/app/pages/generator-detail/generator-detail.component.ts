import { DOCUMENT } from '@angular/common';
import { LoadingComponent } from '../../core/engine/components/loading/loading.component';
import { BusyIconComponent } from '../../core/engine/components/busy-icon/busy-icon.component';
import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { GeneratorInfo, GenerateResponse, GeneratorPageContent } from '../../core/dto/generator.dto';
import { ContestoSito, PageType } from '../../site';
import { SpeechService } from '../../core/engine/services/speech.service';
import { ImgBuilderService } from '../../core/engine/services/img-builder.service';
import { AppearanceService } from '../../core/engine/services/appearance.service';
import { AssetDirective } from '../../core/engine/directives/asset.directive';
import { PageDirective } from '../../core/engine/directives/page.directive';
import { MarkdownPipe } from '../../core/engine/pipes/markdown.pipe';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { LikeActionComponent } from '../../core/engine/components/like-action/like-action.component';
import { ShareActionComponent } from '../../core/engine/components/share-action/share-action.component';
import { SpeechActionComponent } from '../../core/engine/components/speech-action/speech-action.component';
import { VariantWheelComponent } from '../../components/shared/variant-wheel/variant-wheel.component';
import { VariantToggleComponent } from '../../components/shared/variant-toggle/variant-toggle.component';
import { VariantButtonsComponent } from '../../components/shared/variant-buttons/variant-buttons.component';


@Component({
    selector: 'app-generator-detail',
    imports: [LoadingComponent, BusyIconComponent, 
        TranslatePipe,
        MarkdownPipe,
        AssetDirective,
        PageDirective,
        LikeActionComponent,
        ShareActionComponent,
        SpeechActionComponent,
        VariantWheelComponent,
        VariantToggleComponent,
        VariantButtonsComponent,
    ],
    templateUrl: './generator-detail.component.html',
    // Il risultato viene ricreato a ogni generazione (@if su result()): l'animazione
    // si riavvia da sola a ogni "Ancora!", dando un feedback visivo allo spam.
    styles: [`
        /* Cover rotta (AssetDirective la nasconde): via il contenitore. */
        .gen-cover:has(> img.asset-broken--decorative) { display: none; }
        .gen-result { min-height: 9rem; animation: genPop .28s ease-out; }
        @keyframes genPop {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: none; }
        }

        .gen-lever {
            display: inline-flex;
            justify-content: center;
            align-items: center;
            gap: .4rem;
            padding: .65rem 1.2rem;
            border-radius: 999px;
            border: none;
            background: var(--colorSurface, rgba(0, 0, 0, .65));
            color: var(--colorSurfaceText, #fff);
            font-weight: 700;
            font-size: 1rem;
            min-width: 0;
            transition: background-color .15s ease, transform .15s ease;
        }
        /* Stati dai token del tema (testo garantito anche sulla superficie hover), non da un filtro di luminosità. */
        .gen-lever:hover:not(:disabled) { background: var(--colorSurfaceHover); }
        .gen-lever:active:not(:disabled) { transform: translateY(1px); }
        .gen-lever:disabled { cursor: default; }
        @media (prefers-reduced-motion: reduce) {
            .gen-lever, .gen-lever:hover, .gen-lever:active { transition: none; transform: none; }
        }
    `],
})
export class GeneratorDetailComponent extends PageBaseComponent<GeneratorPageContent> {
    /** Esposto al template per i link interni via [appPage] (es. verso i condivisi). */
    protected readonly PageType = PageType;
    private readonly document = inject(DOCUMENT);
    private readonly speech = inject(SpeechService);
    private readonly imgBuilder = inject(ImgBuilderService);
    private readonly appearance = inject(AppearanceService);

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
     *  come valore a VariantWheelComponent (stesso pattern di speakText/buildShareData). */
    readonly pickVariant = (key: string): void => {
        this.pickedVariant.set(key);
        void this.generate(true);
    };

    readonly coverAssetId = computed(() => {
        const slug = this.generator()?.slug;
        return slug ? `generator.${slug}` : null;
    });

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
        const slug = this.generator()?.slug;
        try {
            const res = await this.fetchGeneratedText();
            // Nel frattempo si è passati a un altro generatore: la risposta non è più sua.
            if (this.generator()?.slug !== slug) return;
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


    // Porta in vista il risultato appena rigenerato (block: 'nearest' = non si muove se già visibile).
    private scrollToResult(): void {
        const win = this.document.defaultView;
        win?.requestAnimationFrame(() =>
            this.document.querySelector('.gen-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
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
     * Dato da condividere: la card immagine (`'fittedCaption'`, Engine: altezza e maxLines dalla
     * lunghezza di `res.text`, testo mai troncato) se il generatore ha la sua immagine `.og`,
     * altrimenti solo testo (frase + link). Un generatore senza immagine, o con immagine che non
     * si carica, resta condivisibile. Non registra nulla tra i piaciuti: condivisione e "mi piace"
     * sono azioni indipendenti. `scrimColor` esplicito: il default (`colorPrimary`, scurito per il
     * contrasto) rende la fascia un blu-petrolio poco fedele al brand; qui il brand vero
     * (`colorTema`), col testo che si adatta da sé al contrasto.
     */
    readonly buildShareData = async (): Promise<HTMLCanvasElement | string> => {
        const res = this.result();
        const gen = this.generator();
        if (!res || !gen) throw new Error('Nessun risultato da condividere');
        try {
            const canvas = await this.imgBuilder.buildCanvas({
                style: 'fittedCaption',
                imageSrc: this.asset.getUrl(`generator.${gen.slug}.og`),
                captionOpts: {
                    text: res.text,
                    subtitle: `${gen.name} | ${ContestoSito.config.appName}`,
                    scrimColor: this.appearance.colorTema(),
                },
                imgOpts: { width: 1200 },
            });
            if (canvas) return canvas;
        } catch {
            // Immagine assente o non caricabile: ripiega sul solo testo.
        }
        return `${res.text}

${this.shareTitle()}`;
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

    /** Genera per il generatore corrente (slug da `pageContent()`, valido sia sul playground che
     *  sulla rotta "frase condivisa"): `inputs` è il dizionario d'ingresso della variante — chiave
     *  presa da `variant.key` (es. 'segno' per l'oroscopo), non hardcoded qui. */
    private fetchGeneratedText(): Promise<GenerateResponse> {
        const slug = this.generator()?.slug;
        if (!slug) throw new Error('Generatore non ancora caricato');
        const variant = this.variant();
        const inputs = variant ? { [variant.key]: this.activeVariant() ?? '' } : undefined;
        return this.api.generate(slug, inputs);
    }
}
