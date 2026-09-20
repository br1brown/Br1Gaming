import { Component, ElementRef, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContestoSito } from '../../site';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { ImgBuilderService } from '../../core/engine/services/img-builder.service';
import { AppearanceService } from '../../core/engine/services/appearance.service';
import { LightboxDirective } from '../../core/engine/directives/lightbox.directive';
import { ShareActionComponent } from '../../core/engine/components/share-action/share-action.component';

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
 * Archetipi assurdi, tono demenziale coerente col resto del sito: "crimini" innocui, mai un tratto
 * reale di una persona reale — il bersaglio della battuta è la pseudoscienza stessa. Le "stigmate"
 * citate (zigomi sporgenti, arcata sopraccigliare pronunciata, prognatismo, orecchie a manico
 * d'ansa, asimmetria cranica...) sono quelle vere che Lombroso elencava nell'Uomo delinquente;
 * mescolate al gergo altrettanto vero (e altrettanto pseudo-scientifico) del "looksmaxxing" da
 * forum incel — canthal tilt, gonial angle, midface ratio, hunter eyes: la stessa ossessione di
 * misurare il volto per dedurne un giudizio assoluto, solo un secolo e mezzo dopo. Applicate
 * sempre a reati immaginari da bar, non a persone vere: la battuta è nel metodo, non nel viso.
 *
 * Seconda metà dell'elenco: stessa struttura ma bersaglio più specifico, l'economia del grift che
 * gira proprio intorno a quell'ossessione — guru del looksmaxxing, corsi di seduzione, piramidi di
 * affiliazioni crypto/MLM, lo stesso ecosistema da cui l'incel importa idoli e vocabolario (vedi
 * IncelGenerator.Idoli/ProfessioniIncel). Il bersaglio resta il metodo/il giro, mai un tratto reale.
 */
const VERDICTS: readonly Verdict[] = [
    { title: 'Ladro di polli seriale', desc: "Zigomi sporgenti, gonial angle acuto e canthal tilt positivo da manuale: profilo da pollaio conforme in ogni misura." },
    { title: 'Innocente ma sospetto', desc: 'Midface ratio nella norma, canthal tilt neutro: nessuna stigmata rilevata — ed è proprio questo, secondo lo scanner, a insospettire.' },
    { title: 'Recidivo da parcheggio in doppia fila', desc: 'Lieve prognatismo e gonial angle da bulldog: mascella di chi non arretra di un centimetro, tanto meno in retromarcia.' },
    { title: 'Sovversivo da bar sport', desc: 'Seni frontali pronunciati e arcata sopraccigliare a tenda: la fronte grida "arbitro venduto" da sola.' },
    { title: 'Manomettitore di distributori automatici', desc: "Mani grandi rispetto al busto, ergografo compatibile con lo scuotimento energico." },
    { title: 'Evasore della fila alle Poste', desc: 'Mandibola sviluppata e gonial angle da looksmaxxing riuscito, tipica di chi si intrufola senza chiedere permesso.' },
    { title: 'Tagliatore di code al supermercato', desc: "Orecchie a manico d'ansa e lieve asimmetria del padiglione: nell'atlante del 1876 era già un classico." },
    { title: 'Sabotatore di gruppi WhatsApp', desc: 'Asimmetria cranica lieve, compatibile con il "rispondo dopo".' },
    { title: 'Occupante abusivo di ombrellone', desc: 'Zigomi larghi, sguardo da hunter eyes e indice cranico da mattiniero seriale: primo in spiaggia, primo ovunque.' },
    { title: 'Falso invalido nel parcheggio disabili', desc: "Fronte sfuggente e canthal tilt negativo: il Museo di Torino non avrebbe avuto dubbi." },
    { title: 'Rosicatore di parmigiano altrui dal frigo condiviso', desc: 'Narici dilatate, compatibili con l\'intenditore furtivo.' },
    { title: 'Molestatore seriale del pulsante "rispondi a tutti"', desc: 'Mandibola pronunciata e midface ratio da manuale, tipica del reply-all recidivo.' },
    { title: 'Guru del corso "Diventa Chad in 30 giorni"', desc: 'Gonial angle da miniatura di YouTube, canthal tilt corretto in post-produzione: l\'antropometro non mente, il pacchetto Premium sì.' },
    { title: 'Rivenditore di integratori per il gonial angle', desc: 'Scorta di flaconi "BoneBroth Maxxer" nel bagagliaio, mandibola pubblicizzata come "chirurgicamente naturale".' },
    { title: 'Fondatore di una piramide di affiliazioni in criptovalute', desc: 'Zigomi da webinar, sorriso da landing page: promette il 10x a chi entra prima delle 23:59.' },
    { title: 'Life coach della "red pill" immobiliare', desc: 'Fronte ampia da stratega, portafoglio da esordiente: il vero investimento resta il suo corso da 997€.' },
    { title: 'Truffatore di corsi di seduzione via videochiamata', desc: 'Canthal tilt disegnato col trucco, voce da podcast motivazionale: "hunter eyes" garantite o rimborso (mai).' },
    { title: 'Rivenditore di calibri e gadget da looksmaxxing sul Marketplace', desc: 'Un calibro di plastica e un "mewing trainer" di gomma: l\'antropometro certifica solo la truffa, non la mascella.' },
    { title: 'Promotore di NFT del "volto perfetto"', desc: 'Midface ratio calcolato su un\'immagine generata, portafoglio crypto vuoto da tre cicli di mercato consecutivi.' },
    { title: 'Ambasciatore non retribuito di un multilivello di proteine', desc: 'Zigomi enfatizzati dal filtro, scorta di barrette invendute in garage: indice cranico da chi ci crede ancora.' },
    { title: 'Fondatore della setta del "mewing estremo"', desc: 'Mandibola serrata H24 nonostante il dentista lo sconsigli da anni, seguaci convinti comunque.' },
    { title: 'Coach di looksmaxxing certificato da un forum', desc: 'Diploma auto-rilasciato, gonial angle misurato con un righello dell\'IKEA: stessa serietà del calibro, zero credenziali in più.' },
    { title: 'Affiliato di terzo livello in una piramide di corsi motivazionali', desc: 'Presentazione da quaranta slide, unico guadagno reale quello di chi gliel\'ha venduta.' },
    { title: 'Investitore nella criptovaluta lanciata dal suo idolo da "red pill"', desc: 'Convinto sia "la prossima Bitcoin": portafoglio già a -97%, canthal tilt inalterato.' },
    { title: 'Ex allievo del bootcamp "Alpha Transformation Weekend"', desc: 'Certificato plastificato in tasca, prognatismo da chi sostiene ancora sia valso i 1.500€.' },
    { title: 'Sostenitore instancabile degli scout', desc: 'Nodo Savoia già pronto nel taschino, mandibola quadrata da capo-reparto: fedeltà al giglio rilevata anche a quarant\'anni suonati.' },
    { title: 'Occupante di un parcheggio non ancora libero', desc: 'Piedi piantati sulla striscia bianca: gonial angle da guardiano non retribuito, il posto è già suo.' },
    { title: 'Incontinente verbale cronico', desc: 'Midface iperattivo, nessuna pausa articolatoria rilevata dallo scanner: il flusso prosegue anche in assenza di ascoltatori.' },
    { title: 'Sovrapponitore seriale di conversazioni altrui', desc: 'Mandibola già in movimento mentre l\'interlocutore è a metà frase: ha sempre "giusto una cosa veloce" da aggiungere.' },
    { title: 'Sminuitore professionista dei problemi altrui', desc: 'Sopracciglio sollevato in automatico a ogni lamentela ricevuta, seguito immancabilmente da "eh ma io ho avuto di peggio".' },
    { title: 'Pedante correttore compulsivo', desc: 'Indice cranico da enciclopedia vivente, mandibola pronta a intervenire su ogni congiuntivo sbagliato altrui — richiesto o meno.' },
    { title: 'Automobilista con lo sguardo fisso sul telefono', desc: 'Canthal tilt rivolto verso il basso, verso lo schermo, non verso la strada: priorità alterate secondo ogni misurazione.' },
    { title: 'Interlocutore che guarda il telefono mentre gli parli', desc: 'Hunter eyes puntati altrove, sul telefono, mentre annuisce a un discorso che non sta ascoltando.' },
    { title: 'Lamentoso cronico', desc: 'Rughe di espressione già scavate in assetto permanente "poteva andare peggio, e infatti".' },
    { title: 'Rispondente perennemente glaciale', desc: 'Temperatura del tono costantemente sotto zero indipendentemente dalla domanda ricevuta: un "ok" è già un\'apertura generosa.' },
    { title: 'Mansplainer seriale', desc: 'Sopracciglio inarcato in modalità "lascia che ti spieghi": midface ratio di chi crede di aver capito tutto per primo.' },
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
        canvas.toBlob(blob => this.frozenFrameBlob.set(blob), 'image/jpeg', 0.7);
        this.verdict.set(VERDICTS[index]);
        this.stopCamera();
        this.runScan();
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

    /** Titolo per la Web Share API. */
    readonly shareTitle = computed(() => {
        const v = this.verdict();
        return v ? `${this.translate.translate('lombroso')}: ${v.title}` : '';
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
