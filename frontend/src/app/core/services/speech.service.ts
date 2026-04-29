import { inject, Injectable, signal, effect, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from './translate.service';

@Injectable({ providedIn: 'root' })
export class SpeechService {
    private readonly translate = inject(TranslateService);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    readonly isSpeaking = signal(false);
    readonly currentVoice = signal<SpeechSynthesisVoice | null>(null);

    constructor() {
        if (this.isBrowser && window.speechSynthesis) {
            window.speechSynthesis.addEventListener('voiceschanged', () => this.updateVoice());
            effect(() => {
                this.translate.currentLang();
                this.updateVoice();
            });
        }
    }

    speak(text: string, options?: { rate?: number; pitch?: number }): void {
        if (!this.isBrowser || !window.speechSynthesis) return;

        this.stop();

        const utterance = new SpeechSynthesisUtterance(text);

        // Configurazione lingua e voce
        utterance.lang = this.translate.currentLang();
        const voice = this.findBestVoice(utterance.lang);
        if (voice) utterance.voice = voice;

        // Opzioni extra (velocità e tono)
        utterance.rate = options?.rate ?? 1;
        utterance.pitch = options?.pitch ?? 1;

        // Gestione Stato
        utterance.onstart = () => this.isSpeaking.set(true);
        utterance.onend = () => this.isSpeaking.set(false);
        utterance.onerror = () => this.isSpeaking.set(false);

        window.speechSynthesis.speak(utterance);
    }

    stop(): void {
        if (this.isBrowser && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            this.isSpeaking.set(false);
        }
    }

    private findBestVoice(lang: string): SpeechSynthesisVoice | null {
        const voices = window.speechSynthesis.getVoices();
        // Cerchiamo prima una corrispondenza esatta (es. it-IT), poi parziale (it)
        return voices.find(v => v.lang === lang)
            ?? voices.find(v => v.lang.startsWith(lang.split('-')[0]))
            ?? null;
    }

    private updateVoice(): void {
        this.currentVoice.set(this.findBestVoice(this.translate.currentLang()));
    }
}
