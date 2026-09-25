import { Component, effect, inject, OnDestroy, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { CopyActionComponent } from '../../core/engine/components/copy-action/copy-action.component';
import { ShareActionComponent } from '../../core/engine/components/share-action/share-action.component';
import { SpeechActionComponent } from '../../core/engine/components/speech-action/speech-action.component';

/**
 * Translator ITA → ESP: il "traduttore" scherzoso verso il finto spagnolo. La logica vive nel
 * backend C# (fonte unica, come i generatori): qui si chiama l'API `translate` con un piccolo
 * debounce mentre si digita (come un traduttore vero). Interfaccia a due pannelli (stile DeepL),
 * tema/colori da Bootstrap + AppearanceService, toolbar coi componenti-azione dell'Engine.
 */
@Component({
    selector: 'app-translator',
    standalone: true,
    imports: [TranslatePipe, CopyActionComponent, ShareActionComponent, SpeechActionComponent],
    templateUrl: './translator.component.html',
})
export class TranslatorComponent extends PageBaseComponent<unknown> implements OnDestroy {
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

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

    /** Sorgente per l'ascolto della traduzione: stesso bottone Engine, ma con `lang="es-ES"` nel
     *  template, così il finto spagnolo ha una voce spagnola (prima serviva un TTS di dominio). */
    protected readonly leggiTradotto = (): string => this.tradotto();

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

    /** Svuota input e output. */
    protected pulisci(): void {
        this.testo.set('');
    }

    /** Annulla il debounce lasciando la pagina (la voce la ferma app-speech-action da sé). */
    ngOnDestroy(): void {
        clearTimeout(this.timer);
    }
}
