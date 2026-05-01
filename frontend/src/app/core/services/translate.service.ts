import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { CookieConsentService } from './cookie-consent.service';
import { hasTranslationCatalogs, loadTranslationCatalogs } from '../i18n/translation-catalogs';
import { tryNormalizeBcp47 } from '../i18n/bcp47';
import { ContestoSito } from '../../site';

/**
 * TRANSLATE SERVICE
 * Gestisce il caricamento dei dizionari JSON, la lingua corrente e la 
 * formattazione delle stringhe con parametri.
 */
@Injectable({ providedIn: 'root' })
export class TranslateService {
    private readonly document = inject(DOCUMENT);
    private readonly consent = inject(CookieConsentService);

    // Flag interno per distinguere il caricamento iniziale dai cambi lingua successivi
    private hasInitializedLanguage = false;

    /** 
     * Lingua corrente dell'app (Signal). 
     * Qualsiasi componente che legge questo signal si aggiornerà automaticamente al variare del valore.
     */
    readonly currentLang = signal<string>(ContestoSito.config.defaultLang);

    /** 
     * Archivio delle traduzioni caricate (Signal).
     * Contiene una mappa chiave -> valore (es: { "home.title": "Benvenuto" })
     */
    private translations = signal<Record<string, string>>({});

    /** 
     * Determina quale lingua caricare all'avvio.
     * Priorità: Lingua salvata nei cookie -> Lingua di default del sito.
     */
    getInitialLanguage(): string {
        // Se il sito supporta una sola lingua, inutile cercare preferenze salvate
        if (!this.hasMultipleLanguages()) {
            this.clearSavedLanguage();
            return ContestoSito.config.defaultLang;
        }

        const saved = this.consent.getSavedLanguage();
        return this.resolveLanguage(saved);
    }

    /**
     * Carica i file JSON delle traduzioni.
     * Implementa un sistema di fallback: se la lingua richiesta non ha cataloghi, 
     * prova a caricare quella di default per non lasciare l'utente senza testi.
     */
    async loadTranslations(lang: string): Promise<void> {
        const resolved = this.resolveLanguage(lang);

        // Caricamento asincrono dei cataloghi (basic + addon)
        const catalogs =
            await loadTranslationCatalogs(resolved)
            ?? await loadTranslationCatalogs(ContestoSito.config.defaultLang)
            ?? [];

        // Fonde i cataloghi in un unico oggetto. Se una chiave esiste in entrambi, 
        // l'ultimo (addon) sovrascrive il primo (basic).
        this.translations.set(Object.assign({}, ...catalogs));
    }

    /**
     * Cambia la lingua: carica i JSON, aggiorna il signal (triggera UI),
     * imposta lang sull'HTML e persiste la scelta se c'è il consenso cookie.
     */
    async setLanguage(lang: string): Promise<void> {
        const resolved = this.resolveLanguage(lang);

        await this.loadTranslations(resolved);
        this.currentLang.set(resolved);
        this.updateDocumentLanguage(resolved);

        // Salva la preferenza solo se non è il primo init e se il sito è multilingua
        if (this.hasMultipleLanguages() && this.hasInitializedLanguage) {
            this.persistLanguage(resolved);
        }

        this.hasInitializedLanguage = true;
    }

    /** Inizializza il servizio al bootstrap dell'applicazione. */
    async setInitialLanguage(): Promise<void> {
        await this.setLanguage(this.getInitialLanguage());
    }

    /** Ritorna l'array delle lingue configurate per il sito (es: ['it', 'en']). */
    getAvailableLanguages(): string[] {
        return TranslateService.availableLanguages();
    }

    /**
     * Cerca la chiave nelle traduzioni e sostituisce i segnaposto posizionali.
     * Es: translate("saluto", "Mario") → "Ciao {0}" diventa "Ciao Mario"
     */
    translate(key: string, ...args: any[]): string {
        const translations = this.translations();
        const template = translations[key];

        // Debug: se la chiave manca, ritorna la chiave stessa per evidenziare l'errore nel template
        if (!template) return key;

        if (args.length === 0) return template;

        // Sostituzione posizionale dei parametri
        let result = template;
        for (let i = 0; i < args.length; i++) {
            result = result.replaceAll(`{${i}}`, String(args[i] ?? ''));
        }
        return result;
    }

    /** Alias rapido per il metodo translate() da usare nei template. */
    t(key: string, ...args: any[]): string {
        return this.translate(key, ...args);
    }

    // ─── PRIVATE UTILITIES ──────────────────────────────────────────────

    /** Verifica se una stringa è inclusa nell'elenco delle lingue supportate dal sito. */
    private isSupportedLanguage(lang: string | null | undefined): lang is string {
        return typeof lang === 'string' && TranslateService.availableLanguages().includes(lang);
    }

    /**
     * Risolve il codice lingua assicurandosi che sia valido.
     * Se riceve un codice non supportato o malformato, ricade sulla defaultLang.
     */
    private resolveLanguage(lang: string | null | undefined): string {
        const normalized = tryNormalizeBcp47(lang);
        if (normalized && this.isSupportedLanguage(normalized) && hasTranslationCatalogs(normalized)) {
            return normalized;
        }
        return ContestoSito.config.defaultLang;
    }

    private hasMultipleLanguages(): boolean {
        return TranslateService.availableLanguages().length > 1;
    }

    /** Scrive la preferenza lingua — il CookieConsentService blocca se non c'è consenso. */
    private persistLanguage(lang: string): void {
        this.consent.setSavedLanguage(lang);
    }

    /** Rimuove la preferenza salvata — la pulizia è sempre consentita. */
    private clearSavedLanguage(): void {
        this.consent.clearSavedLanguage();
    }

    /** Aggiorna <html lang="..."> per i motori di ricerca e screen reader. */
    private updateDocumentLanguage(lang: string): void {
        this.document.documentElement?.setAttribute('lang', lang);
    }

    /** Metodo statico per accedere alle lingue configurate nel sito. */
    public static availableLanguages(): string[] {
        return ContestoSito.config.availableLanguages;
    }
}