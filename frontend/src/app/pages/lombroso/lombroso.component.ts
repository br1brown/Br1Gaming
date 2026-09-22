import { Component, ElementRef, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContestoSito } from '../../site';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { ImgBuilderService } from '../../core/engine/services/img-builder.service';
import { AppearanceService } from '../../core/engine/services/appearance.service';
import { LightboxDirective } from '../../core/engine/directives/lightbox.directive';
import { ShareActionComponent } from '../../core/engine/components/share-action/share-action.component';
import { LombrosoVerdict } from '../../core/dto/lombroso.dto';

type LombrosoStatus = 'init' | 'live' | 'scanning' | 'result' | 'error';

/**
 * Finto tabellone di misurazione: righe che compaiono in sequenza durante 'scanning', puro colore
 * — nessuna vera analisi dell'immagine oltre all'hash che sceglie l'archetipo. Strumenti e termini
 * sono quelli VERI del gabinetto di Lombroso (antropometro, estesiometro per la sensibilità al
 * dolore, ergografo per la forza muscolare — esposti ancora oggi al Museo di Antropologia Criminale
 * di Torino, che lui stesso fondò nel 1876): i numeri con cui li riempiamo, ovviamente, no.
 */
const MEASURING_STEPS: readonly string[] = [
    'Rilevamento del profilo frontale…',
    "Prominenza della mascella e calcolo dell'angolo facciale…",
    'Indice cranico (cefalico): 79,2 — mesocefalo borderline',
    "Ispezione dell'arcata sopraccigliare e dei seni frontali…",
    'Estesiometro applicato: soglia del dolore fuori norma',
    "Ergografo: affaticamento muscolare sotto la media dell'atlante",
    "Bernoccolo dell'onestà (regione parietale): assente. Nessun margine d'errore",
    "Confronto con l'atlante del Museo di Antropologia Criminale, Torino 1876…",
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
    imports: [RouterLink, TranslatePipe, LightboxDirective, ShareActionComponent],
    templateUrl: './lombroso.component.html',
    styleUrl: './lombroso.component.css',
})
export class LombrosoComponent extends PageBaseComponent<void> implements OnDestroy {
    protected readonly MEASURING_STEPS = MEASURING_STEPS;

    private readonly imgBuilder = inject(ImgBuilderService);
    private readonly appearance = inject(AppearanceService);

    readonly status = signal<LombrosoStatus>('init');
    readonly errorMsg = signal('');
    /** Anteprima dello scatto, SOLO in memoria (data URL locale): mai inviata, mai persistita.
     *  Azzerata a ogni reset/uscita dalla pagina. */
    readonly frozenFrame = signal<string | null>(null);
    /** Stesso scatto, come Blob: sorgente del lightbox ([appLightbox]) e della card di
     *  condivisione (ImgBuilderService vuole un Blob/URL, non una data URL). */
    readonly frozenFrameBlob = signal<Blob | null>(null);
    readonly verdict = signal<LombrosoVerdict | null>(null);
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

    /** Scatta: disegna il frame corrente su un canvas volante, calcola l'hash dei pixel, spegne
     *  subito la fotocamera. Il canvas non viene mai conservato oltre questa chiamata — solo l'hash
     *  (il "colore", non la foto) viaggia verso il backend per il verdetto, vedi resolveVerdict(). */
    capture(): void {
        const video = this.videoRef()?.nativeElement;
        if (!video || video.videoWidth === 0) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Specchiato come l'anteprima live (.lombroso-mirrored in CSS): il canvas legge il buffer
        // video reale, ignaro del transform CSS sull'elemento, quindi va ribaltato qui a mano —
        // altrimenti lo scatto congelato/condiviso non combacerebbe con quanto visto inquadrando.
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);

        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const hash = LombrosoComponent.hashFrame(pixels);

        this.frozenFrame.set(canvas.toDataURL('image/jpeg', 0.7));
        canvas.toBlob(blob => this.frozenFrameBlob.set(blob), 'image/jpeg', 0.7);
        this.stopCamera();
        void this.resolveVerdict(hash);
    }

    /**
     * Chiede al backend il verdetto per l'hash (il "colore" campionato dai pixel — mai la foto, che
     * non lascia mai capture()). Il backend possiede i 36 archetipi e li ricombina con la grammatica
     * dei generatori (nomi, città, professioni, date...): stesso hash → stesso archetipo, corredo
     * variabile a ogni scatto. Attesa PRIMA di avviare l'animazione di scansione (non in parallelo):
     * così runScan() parte già col verdetto in mano, nessuna corsa fra rete e timer dell'animazione.
     */
    private async resolveVerdict(hash: number): Promise<void> {
        try {
            this.verdict.set(await this.api.lombrosoVerdict(hash));
            this.runScan();
        } catch {
            this.fail('lombrosoErrBackend');
        }
    }

    /**
     * Canvas della card da condividere: la foto scattata (mai lasciata il browser finora, resta
     * così anche qui — nessun upload) più il verdetto come didascalia. Titolo e descrizione stanno
     * insieme nel blocco principale (mai troncato con ellissi, vedi `buildFittedCaptionCanvas`):
     * il `subtitle` da solo tronca a una riga, quindi non può portare il titolo del verdetto, che
     * per costruzione è battuta quanto la descrizione — condividere la card non deve perdere metà
     * della battuta rispetto a quello che si legge in pagina. `subtitle` resta solo per il branding
     * (nome pagina + app), sempre corto, sempre entro una riga. `scrimColor` esplicito: il default
     * (`colorPrimary`, scurito per il contrasto testo-su-pagina) darebbe una fascia blu scuro poco
     * fedele al brand — qui il brand vero (`colorTema`, chiaro), testo adattato da sé.
     */
    readonly buildShareCanvas = async (): Promise<HTMLCanvasElement> => {
        const blob = this.frozenFrameBlob();
        const v = this.verdict();
        if (!blob || !v) throw new Error('Nessun risultato da condividere');
        const canvas = await this.imgBuilder.buildCanvas({
            style: 'fittedCaption',
            imageSrc: blob,
            captionOpts: {
                text: `${v.title}\n\n${v.desc}`,
                subtitle: `${this.translate.translate('lombroso')} | ${ContestoSito.config.appName}`,
                scrimColor: this.appearance.colorTema(),
            },
            imgOpts: { width: 1200 },
        });
        if (!canvas) throw new Error('Errore nella generazione dell\'immagine');
        return canvas;
    };

    /** Titolo per la Web Share API — come nei generatori (nome: link), qui col verdetto in mezzo:
     *  chi riceve la condivisione (solo canvas immagine + questo titolo, niente `text` separato,
     *  vedi ShareService.shareFile) deve poter tornare alla pagina, non solo vedere lo screenshot. */
    readonly shareTitle = computed(() => {
        const v = this.verdict();
        return v ? `${this.translate.translate('lombroso')}: ${v.title} — ${this.getCurrentUrl()}` : '';
    });

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
        this.frozenFrameBlob.set(null);
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
