import { Component, effect, inject, OnDestroy, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { CopyActionComponent } from '../../components/shared/action/copy-action/copy-action.component';
import { ShareActionComponent } from '../../components/shared/action/share-action/share-action.component';
import { SpeechActionComponent } from '../../components/shared/action/speech-action/speech-action.component';
import { TranslatorSpeechService } from './translator-speech.service';

/**
 * Translator ITA → ESP: il "traduttore" scherzoso verso il finto spagnolo. La logica vive nel
 * backend C# (fonte unica, come i generatori): qui si chiama l'API `translate` con un piccolo
 * debounce mentre si digita (come un traduttore vero). Interfaccia a due pannelli (stile DeepL),
 * tema/colori da Bootstrap + ThemeService, toolbar coi componenti-azione dell'Engine.
 */
@Component({
    selector: 'app-translator',
    standalone: true,
    imports: [TranslatePipe, CopyActionComponent, ShareActionComponent, SpeechActionComponent],
    providers: [TranslatorSpeechService],
    templateUrl: './translator.component.html',
})
export class TranslatorComponent extends PageBaseComponent<unknown> implements OnDestroy {
    /** TTS di dominio che forza lo spagnolo (l'Engine leggerebbe con voce italiana). */
    private readonly speech = inject(TranslatorSpeechService);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    /** Stato del bottone "ascolta" (true mentre legge). */
    protected readonly parla = this.speech.isSpeaking;

    /** Tetto di caratteri (allineato a FintoSpagnoloTranslator.MaxCaratteri lato backend): oltre, il
     *  server tronca all'ultima parola. Qui limita anche la textarea, così l'utente non lo supera. */
    protected readonly maxChars = 13000;

    /** Testo italiano digitato dall'utente. */
    protected readonly testo = signal('');

    /** Traduzione "finto spagnolo" restituita dal backend (aggiornata col debounce). */
    protected readonly tradotto = signal('');

    /** Timer del debounce e id di richiesta (per scartare risposte fuori ordine). */
    private timer?: ReturnType<typeof setTimeout>;
    private richiesta = 0;

    constructor() {
        super();
        // Debounce: a ogni modifica del testo si annulla il timer precedente e, dopo una pausa, si
        // chiede la traduzione al backend. Solo lato browser (in SSR non si chiama l'API).
        effect(() => {
            const t = this.testo();
            if (!this.isBrowser) return;
            clearTimeout(this.timer);
            if (!t.trim()) { this.tradotto.set(''); return; }
            const mia = ++this.richiesta;
            this.timer = setTimeout(() => {
                this.api.tradurre(t)
                    .then(res => { if (mia === this.richiesta) this.tradotto.set(res); })
                    .catch(() => { /* errore silenzioso: si tiene l'ultima traduzione valida */ });
            }, 350);
        });
    }

    /** Sorgente per l'ascolto italiano (bottone Engine: legge con la lingua dell'app = italiano). */
    protected readonly leggiTesto = (): string => this.testo();

    /**
     * Testo esportato da copia/condividi: la traduzione più una firma con il link alla pagina
     * (come i generatori). L'URL arriva dal service (getCanonicalUrl via PageBaseComponent), non da window.
     */
    protected readonly esportaTradotto = (): string => {
        const testo = this.tradotto();
        if (!testo) return testo;
        return `${testo}\n\n${this.translate.translate('translatorFirma', this.getCurrentUrl())}`;
    };

    /** Aggiorna il testo dal textarea (niente FormsModule: basta l'evento input). */
    protected onInput(event: Event): void {
        this.testo.set((event.target as HTMLTextAreaElement).value);
    }

    /** Ascolta/interrompe la traduzione letta con voce spagnola. */
    protected ascolta(): void {
        if (this.speech.isSpeaking()) this.speech.stop();
        else this.speech.speak(this.tradotto());
    }

    /** Svuota input e output. */
    protected pulisci(): void {
        this.testo.set('');
    }

    /** Ferma la sintesi vocale e annulla il debounce lasciando la pagina. */
    ngOnDestroy(): void {
        clearTimeout(this.timer);
        this.speech.stop();
    }
}
