import { Component, ElementRef, OnDestroy, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';

type LombrosoStatus = 'init' | 'live' | 'scanning' | 'result' | 'error';

interface Verdict { title: string; desc: string; }

/**
 * Finto tabellone di misurazione: righe che compaiono in sequenza durante 'scanning', puro colore
 * — nessuna vera analisi dell'immagine oltre all'hash che sceglie il verdetto. Strumenti e termini
 * sono quelli VERI del gabinetto di Lombroso (antropometro, estesiometro per la sensibilità al
 * dolore, ergografo per la forza muscolare — esposti ancora oggi al Museo di Antropologia Criminale
 * di Torino, che lui stesso fondò nel 1876): i numeri con cui li riempiamo, ovviamente, no.
 */
const MEASURING_STEPS: readonly string[] = [
    'Antropometro in posizione: rilevamento del profilo frontale…',
    "Calcolo dell'angolo facciale di Camper… 71,4° (esatto, giuro)",
    'Indice cranico (cefalico): 79,2 — mesocefalo borderline',
    "Ispezione dell'arcata sopraccigliare e dei seni frontali…",
    'Estesiometro applicato: soglia del dolore fuori norma',
    "Ergografo: affaticamento muscolare sotto la media dell'atlante",
    "Bernoccolo dell'onestà (regione parietale): assente. Nessun margine d'errore, parola di antropologo",
    "Confronto con l'atlante del Museo di Antropologia Criminale, Torino 1876…",
];

/**
 * Archetipi assurdi, tono demenziale coerente col resto del sito: "crimini" innocui, mai un tratto
 * reale di una persona reale — il bersaglio della battuta è la pseudoscienza stessa. Le "stigmate"
 * citate (zigomi sporgenti, arcata sopraccigliare pronunciata, prognatismo, orecchie a manico
 * d'ansa, asimmetria cranica...) sono quelle vere che Lombroso elencava nell'Uomo delinquente —
 * qui applicate a reati immaginari da bar, non a persone vere.
 */
const VERDICTS: readonly Verdict[] = [
    { title: 'Ladro di polli seriale', desc: 'Zigomi sporgenti e arcata sopraccigliare pronunciata: classico profilo da pollaio, giuro che è scienza.' },
    { title: 'Innocente ma sospetto', desc: 'Nessuna stigmata rilevata — ed è proprio questo, secondo il calibro, a insospettire. Ci credo davvero.' },
    { title: 'Recidivo da parcheggio in doppia fila', desc: 'Lieve prognatismo: mascella di chi non arretra di un centimetro.' },
    { title: 'Sovversivo da bar sport', desc: 'Seni frontali pronunciati: la fronte grida "arbitro venduto" da sola, non ci crederai ma è tutto vero.' },
    { title: 'Manomettitore di distributori automatici', desc: "Mani grandi rispetto al busto, ergografo compatibile con lo scuotimento energico." },
    { title: 'Evasore della fila alle Poste', desc: 'Mandibola sviluppata, tipica di chi si intrufola senza chiedere permesso.' },
    { title: 'Tagliatore di code al supermercato', desc: "Orecchie a manico d'ansa: nell'atlante del 1876 era già un classico, parola d'onore." },
    { title: 'Sabotatore di gruppi WhatsApp', desc: 'Asimmetria cranica lieve, compatibile con il "rispondo dopo".' },
    { title: 'Occupante abusivo di ombrellone', desc: 'Zigomi larghi e indice cranico da mattiniero seriale. Giuro, l\'ho misurato io stesso.' },
    { title: 'Falso invalido nel parcheggio disabili', desc: "Fronte sfuggente: il Museo di Torino non avrebbe avuto dubbi, ci metto la faccia." },
    { title: 'Rosicatore di parmigiano altrui dal frigo condiviso', desc: 'Narici dilatate, compatibili con l\'intenditore furtivo.' },
    { title: 'Molestatore seriale del pulsante "rispondi a tutti"', desc: 'Mandibola pronunciata, tipica del reply-all recidivo. Scienza pura, credimi.' },
];

/**
 * LOMBROSO SCANNER — parodia della fisiognomica criminale ottocentesca (Cesare Lombroso):
 * inquadrati, scatta, finta analisi antropometrica, verdetto assurdo. Bersaglio della battuta è
 * la PSEUDOSCIENZA stessa (già ampiamente screditata, da qui i riferimenti espliciti al 1876) —
 * niente tratti reali, solo "crimini" innocui da meme.
 *
 * La foto non lascia mai il browser: si scatta su un canvas in memoria, se ne calcola un hash
 * (stesso frame → stesso verdetto, non è vero random) e si scarta subito — nessun upload, nessun
 * salvataggio su cookie/localStorage, la fotocamera si spegne appena finito lo scatto.
 */
@Component({
    selector: 'app-lombroso',
    standalone: true,
    imports: [RouterLink, TranslatePipe],
    templateUrl: './lombroso.component.html',
    styleUrl: './lombroso.component.css',
})
export class LombrosoComponent extends PageBaseComponent<void> implements OnDestroy {
    protected readonly MEASURING_STEPS = MEASURING_STEPS;

    readonly status = signal<LombrosoStatus>('init');
    readonly errorMsg = signal('');
    /** Anteprima dello scatto, SOLO in memoria (data URL locale): mai inviata, mai persistita.
     *  Azzerata a ogni reset/uscita dalla pagina. */
    readonly frozenFrame = signal<string | null>(null);
    readonly verdict = signal<Verdict | null>(null);
    /** Quante righe del tabellone sono già comparse (reveal progressivo durante 'scanning'). */
    readonly visibleSteps = signal(0);

    private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoRef');
    private stream: MediaStream | null = null;
    private scanTimers: ReturnType<typeof setTimeout>[] = [];

    // Stesso schema di burocrazia.component.ts: AppearanceService non espone più
    // prefersReducedMotion, matchMedia locale dove serve solo qui.
    private readonly reduceMotion = signal(
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    constructor() {
        super();
        // Collega lo stream al <video> non appena l'elemento esiste (rientra nel DOM solo
        // quando status passa a 'live', vedi @switch nel template).
        effect(() => {
            const el = this.videoRef()?.nativeElement;
            if (el && this.stream && el.srcObject !== this.stream) {
                el.srcObject = this.stream;
                void el.play().catch(() => { /* autoplay bloccato: l'utente vede comunque il feed dopo l'interazione */ });
            }
        });
    }

    ngOnDestroy(): void {
        this.stopCamera();
        this.clearScanTimers();
    }

    async startCamera(): Promise<void> {
        if (!navigator.mediaDevices?.getUserMedia) {
            this.fail('lombrosoErrNoCamera');
            return;
        }
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            this.status.set('live');
        } catch {
            this.fail('lombrosoErrDenied');
        }
    }

    /** Scatta: disegna il frame corrente su un canvas volante, calcola il verdetto dall'hash dei
     *  pixel, spegne subito la fotocamera. Il canvas non viene mai conservato oltre questa chiamata. */
    capture(): void {
        const video = this.videoRef()?.nativeElement;
        if (!video || video.videoWidth === 0) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);

        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const index = LombrosoComponent.hashFrame(pixels) % VERDICTS.length;

        this.frozenFrame.set(canvas.toDataURL('image/jpeg', 0.7));
        this.verdict.set(VERDICTS[index]);
        this.stopCamera();
        this.runScan();
    }

    /** Riprova: stessa istanza pagina, si torna dritti alla fotocamera (il permesso resta valido,
     *  niente doppio prompt del browser). */
    retry(): void {
        this.reset();
        void this.startCamera();
    }

    private runScan(): void {
        this.status.set('scanning');
        this.visibleSteps.set(0);
        const stepDelay = this.reduceMotion() ? 0 : 450;
        MEASURING_STEPS.forEach((_, i) => {
            this.scanTimers.push(setTimeout(() => this.visibleSteps.set(i + 1), stepDelay * (i + 1)));
        });
        const resultDelay = stepDelay * MEASURING_STEPS.length + (this.reduceMotion() ? 0 : 700);
        this.scanTimers.push(setTimeout(() => this.status.set('result'), resultDelay));
    }

    private stopCamera(): void {
        this.stream?.getTracks().forEach(t => t.stop());
        this.stream = null;
        const el = this.videoRef()?.nativeElement;
        if (el) el.srcObject = null;
    }

    private clearScanTimers(): void {
        this.scanTimers.forEach(clearTimeout);
        this.scanTimers = [];
    }

    private reset(): void {
        this.clearScanTimers();
        this.visibleSteps.set(0);
        this.frozenFrame.set(null);
        this.verdict.set(null);
    }

    private fail(key: string): void {
        this.status.set('error');
        this.errorMsg.set(key);
    }

    /** Somma campionata dei byte RGBA (passo dispari, non multiplo di 4: attraversa canali diversi
     *  a ogni giro invece di leggere sempre lo stesso) — deterministico sullo stesso frame, cambia
     *  con l'immagine. Non è (e non vuole essere) un'analisi vera: è il "tiro di dado" truccato che
     *  dà sempre la stessa risposta alla stessa foto, così la battuta regge anche a chi la ripete. */
    private static hashFrame(data: Uint8ClampedArray): number {
        let sum = 0;
        for (let i = 0; i < data.length; i += 401) sum += data[i];
        return sum;
    }
}
