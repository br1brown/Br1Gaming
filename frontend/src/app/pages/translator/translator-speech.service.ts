import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * TTS dedicato al finto spagnolo: legge il testo forzando la lingua spagnola (es-ES), invece di
 * seguire la lingua dell'app come fa lo `SpeechService` dell'Engine (che qui leggerebbe con voce
 * italiana). È un servizio di DOMINIO: NON tocca l'Engine, usa direttamente la Web Speech API.
 * Fornito a livello di pagina (providers del componente), non root: serve solo al Translator.
 */
@Injectable()
export class TranslatorSpeechService {
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    /** Voci di sistema (asincrone: arrivano con `voiceschanged`). Vuote in SSR. */
    private readonly voices = signal<SpeechSynthesisVoice[]>([]);

    /** true mentre sta leggendo (per lo stato del bottone). */
    readonly isSpeaking = signal(false);

    constructor() {
        if (this.isBrowser && window.speechSynthesis) {
            const sync = () => this.voices.set(window.speechSynthesis.getVoices());
            sync();
            window.speechSynthesis.addEventListener('voiceschanged', sync);
        }
    }

    /** Legge il testo forzando `es-ES`, con una voce spagnola se disponibile (altrimenti default). */
    speak(text: string): void {
        if (!this.isBrowser || !window.speechSynthesis || !text) return;
        this.stop();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        const voce = this.voices().find(v => v.lang === 'es-ES')
            ?? this.voices().find(v => v.lang.toLowerCase().startsWith('es'))
            ?? null;
        if (voce) utterance.voice = voce;

        utterance.onstart = () => this.isSpeaking.set(true);
        utterance.onend = () => this.isSpeaking.set(false);
        utterance.onerror = () => this.isSpeaking.set(false);

        window.speechSynthesis.speak(utterance);
    }

    /** Interrompe la lettura e resetta lo stato. */
    stop(): void {
        if (this.isBrowser && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            this.isSpeaking.set(false);
        }
    }
}
