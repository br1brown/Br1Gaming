import { inject, Injectable, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from './translate.service';

/**
 * SPEECH SERVICE
 * Gestisce la sintesi vocale (Text-to-Speech) integrando il supporto multilingua.
 * Utilizza le API native del browser per leggere testi ad alta voce.
 */
@Injectable({ providedIn: 'root' })
export class SpeechService {
    private readonly translate = inject(TranslateService);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    /** Signal: indica se il browser sta riproducendo audio in questo momento */
    readonly isSpeaking = signal(false);

    /** Voci di sistema disponibili: si popolano in modo asincrono (evento `voiceschanged`),
     *  quindi sono un signal e non una lettura una-tantum. Vuoto in SSR. */
    private readonly voices = signal<SpeechSynthesisVoice[]>([]);

    /** Voce di sistema per la lingua corrente — derivata da (lingua × voci disponibili).
     *  È un `computed`: si riaggiorna sia al cambio lingua sia quando le voci finiscono di caricarsi. */
    readonly currentVoice = computed<SpeechSynthesisVoice | null>(
        () => this.findBestVoice(this.translate.currentLang(), this.voices())
    );

    constructor() {
        // La sintesi vocale è disponibile solo nel browser, non in SSR.
        if (this.isBrowser && window.speechSynthesis) {
            const sync = () => this.voices.set(window.speechSynthesis.getVoices());
            sync(); // le voci possono essere già pronte al primo accesso…
            window.speechSynthesis.addEventListener('voiceschanged', sync); // …o arrivare dopo
        }
    }

    /**
     * Legge un testo usando la sintesi vocale.
     * @param text Il testo da convertire in audio.
     * @param options Opzioni per velocità (rate) e tono (pitch).
     */
    speak(text: string, options?: { rate?: number; pitch?: number }): void {
        if (!this.isBrowser || !window.speechSynthesis) return;

        // Interrompe eventuali letture precedenti per evitare sovrapposizioni
        this.stop();

        // Crea l'oggetto "frase" (Utterance)
        const utterance = new SpeechSynthesisUtterance(text);

        // Sincronizza la lingua con quella dell'app
        utterance.lang = this.translate.currentLang();

        // Tenta di assegnare la voce migliore disponibile per quella lingua
        const voice = this.findBestVoice(utterance.lang, this.voices());
        if (voice) utterance.voice = voice;

        // Configura parametri opzionali (default: 1)
        utterance.rate = options?.rate ?? 1;   // Velocità (0.1 a 10)
        utterance.pitch = options?.pitch ?? 1; // Tono (0 a 2)

        // Gestione dello Stato tramite Signal
        utterance.onstart = () => this.isSpeaking.set(true);
        utterance.onend = () => this.isSpeaking.set(false);
        utterance.onerror = () => this.isSpeaking.set(false);

        // Avvia la riproduzione
        window.speechSynthesis.speak(utterance);
    }

    /** Interrompe immediatamente la sintesi vocale e resetta lo stato. */
    stop(): void {
        if (this.isBrowser && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            this.isSpeaking.set(false);
        }
    }

    /**
     * Voce più adatta alla lingua, tra quelle passate. Funzione **pura** (nessun accesso a `window`):
     * SSR-safe per costruzione — con lista vuota (SSR o voci non ancora caricate) ritorna null.
     * Strategia: match esatto (es. `it-IT`) → prefisso (`it`) → null (il browser usa la voce di default).
     */
    private findBestVoice(lang: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
        if (!voices.length) return null;
        return voices.find(v => v.lang === lang)
            ?? voices.find(v => v.lang.startsWith(lang.split('-')[0]))
            ?? null;
    }
}
