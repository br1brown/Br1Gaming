
import { inject, Injectable, isDevMode, REQUEST, signal, DOCUMENT } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { InjectionToken, makeStateKey } from '@angular/core';

export interface LocaleConfig {
    readonly defaultLang: string;
    readonly availableLanguages: readonly string[];
}

/** Token DI per la configurazione locale */
export const LOCALE_CONFIG = new InjectionToken<LocaleConfig>('LOCALE_CONFIG', {
    factory: () => ({ defaultLang: 'it', availableLanguages: ['it'] })
});

/** Chiave TransferState per propagare la config locale server→browser. */
export const LOCALE_STATE_KEY = makeStateKey<LocaleConfig>('br1_locale');

// Lingue RTL (right-to-left) note: arabo, ebraico, persiano, urdu, pashto, sindhi, yiddish,
// divehi, curdo sorani. Confrontata sul sottotag base già normalizzato (es. "ar", non "ar-SA").
// Lista statica invece di `Intl.Locale.prototype.getTextInfo()`: quell'API non è ancora baseline
// (Firefox non la supporta, verificato 2026) — girerebbe rotto proprio nel browser dove serve di più.
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'dv', 'ckb']);

type TranslationDictionary = Record<string, string>;

/**
 * TRANSLATE SERVICE
 *
 * Gestisce lingue, caricamento JSON e formattazione stringhe.
 * È anche il punto canonico per le utility BCP-47 (normalizeBcp47).
 *
 * Per aggiungere una lingua:
 *   1. Aggiungere il codice a Localization.SupportedLanguages in global-settings.json
 *   2. Creare /assets/i18n/basic.{lang}.json e addon.{lang}.json
 *
 * La lista lingue disponibili viene interamente da LOCALE_CONFIG (global-settings.json).
 * Se un file JSON manca, fetchCatalogs fallisce silenziosamente e l'app usa
 * defaultLang come fallback — la lingua rimane nel selettore ma non si carica.
 */
@Injectable({ providedIn: 'root' })
export class TranslateService {
    private readonly localeConfig = inject(LOCALE_CONFIG);
    private readonly document = inject(DOCUMENT);
    private readonly http = inject(HttpClient);
    private readonly request = inject(REQUEST, { optional: true });

    readonly currentLang = signal<string>(this.localeConfig.defaultLang);
    private translations = signal<TranslationDictionary>({});

    // Token di sequenza per setLanguage(): senza, due chiamate concorrenti (es. click veloce su due
    // lingue diverse, o guard + effect che scattano nello stesso istante) potrebbero risolversi fuori
    // ordine — l'ultima a partire non è detto sia l'ultima ad arrivare — lasciando currentLang/<html
    // lang> allineati a una lingua diversa da quella dell'URL corrente finché una nuova navigazione
    // non li corregge per caso. Stesso pattern di `renderToken` in img-render.directive.ts.
    private setLanguageToken = 0;

    /** Lingua predefinita, come dichiarata in global-settings.json via LOCALE_CONFIG. */
    readonly defaultLang = this.localeConfig.defaultLang;

    /** Lingue disponibili, come dichiarate in global-settings.json via LOCALE_CONFIG. */
    readonly availableLangs = signal<readonly string[]>(this.localeConfig.availableLanguages);

    // ─── BCP-47 ───────────────────────────────────────────────────────────

    /**
     * Normalizza un tag lingua BCP-47 estraendo solo il sottotag lingua (ISO 639-1).
     * Ritorna null se il tag è malformato o non riconosciuto.
     * Esempi: "it-IT" → "it", "en-US" → "en", "it" → "it", "xyz" → null.
     */
    static normalizeBcp47(tag: string | null | undefined): string | null {
        if (typeof tag !== 'string' || !tag.trim()) return null;
        try {
            return new Intl.Locale(tag.trim()).language ?? null;
        } catch {
            return null;
        }
    }

    // ─── Pubblico ─────────────────────────────────────────────────────────

    async loadTranslations(lang: string): Promise<void> {
        const resolved = this.resolveLanguage(lang);
        this.translations.set(await this.fetchAndMergeCatalogs(resolved));
    }

    async setLanguage(lang: string): Promise<void> {
        const resolved = this.resolveLanguage(lang);
        const token = ++this.setLanguageToken;
        const merged = await this.fetchAndMergeCatalogs(resolved);
        // Una setLanguage() più recente è partita (ed è magari già arrivata) nel frattempo: questa
        // risposta è obsoleta, non deve sovrascrivere uno stato lingua già più aggiornato del suo.
        if (token !== this.setLanguageToken) return;
        this.translations.set(merged);
        this.currentLang.set(resolved);
        this.updateDocumentLanguage(resolved);
    }

    /** Cataloghi basic+addon di `resolved`, con fallback al defaultLang se mancanti, uniti in un unico dizionario. */
    private async fetchAndMergeCatalogs(resolved: string): Promise<TranslationDictionary> {
        const primary = await this.fetchCatalogs(resolved);
        // Fallback al defaultLang solo se diverso da resolved — evita di scaricare
        // gli stessi file due volte quando resolved è già la lingua di default.
        const catalogs = primary
            ?? (resolved !== this.localeConfig.defaultLang
                ? await this.fetchCatalogs(this.localeConfig.defaultLang)
                : undefined)
            ?? [];
        return Object.assign({}, ...catalogs);
    }

    /**
     * Chiamato una volta al bootstrap, prima che il router attivi la prima route: garantisce che
     * i cataloghi i18n siano già caricati quando l'app comincia a tradurre i titoli di rotta.
     * Risolve sempre alla lingua default — l'URL è l'unica fonte di verità sulla lingua reale
     * della richiesta: la corregge subito dopo `PageBaseComponent`, leggendo `route.data.lang`,
     * appena la prima pagina monta.
     */
    async setInitialLanguage(): Promise<void> {
        await this.setLanguage(this.localeConfig.defaultLang);
    }

    /**
     * Cerca la chiave nelle traduzioni e sostituisce i segnaposto posizionali.
     * Es: translate("saluto", "Mario") → "Ciao {0}" diventa "Ciao Mario"
     */
    translate(key: string, ...args: unknown[]): string {
        const template = this.translations()[key];
        if (!template) {
            if (this.availableLangs().length > 1 && isDevMode()) {
                console.warn(`Translation key "${key}" not found`);
            }
            return key;
        }
        if (args.length === 0) return template;

        let result = template;
        for (let i = 0; i < args.length; i++) {
            result = result.replaceAll(`{${i}}`, String(args[i] ?? ''));
        }
        return result;
    }

    t(key: string, ...args: unknown[]): string {
        return this.translate(key, ...args);
    }

    // ─── Privato ──────────────────────────────────────────────────────────

    private async fetchCatalogs(lang: string): Promise<TranslationDictionary[] | undefined> {
        if (!this.isSupportedLanguage(lang)) return undefined;
        try {
            const [basic, addon] = await Promise.all([
                firstValueFrom(this.http.get<TranslationDictionary>(this.assetUrl(`/assets/i18n/basic.${lang}.json`))),
                firstValueFrom(this.http.get<TranslationDictionary>(this.assetUrl(`/assets/i18n/addon.${lang}.json`))),
            ]);
            return [basic, addon];
        } catch {
            // In produzione non dovrebbe accadere: scripts/test/i18n-check.sh verifica
            // a CI time che basic.{lang}.json e addon.{lang}.json esistano per ogni lingua
            // configurata in global-settings.json. Se arriva qui, l'app ricade sul defaultLang.
            console.warn(`[TranslateService] Impossibile caricare i cataloghi per "${lang}". Eseguire scripts/test/i18n-check.sh per diagnosticare.`);
            return undefined;
        }
    }

    /** Costruisce URL assoluti in SSR (REQUEST), relativi nel browser. */
    private assetUrl(path: string): string {
        return this.request ? new URL(path, this.request.url).toString() : path;
    }

    private isSupportedLanguage(lang: string | null | undefined): lang is string {
        return typeof lang === 'string' && this.availableLangs().includes(lang);
    }

    private resolveLanguage(lang: string | null | undefined): string {
        const normalized = TranslateService.normalizeBcp47(lang);
        return normalized && this.isSupportedLanguage(normalized)
            ? normalized
            : this.localeConfig.defaultLang;
    }

    private updateDocumentLanguage(lang: string): void {
        const root = this.document.documentElement; // <html> — sia in SSR (DOM del renderer) sia nel browser.
        if (!root) return;
        root.setAttribute('lang', lang); // annuncio agli screen reader/motori di ricerca della lingua della pagina.
        // dir: senza, una lingua RTL avrebbe il TESTO letto giusto ma il LAYOUT (allineamento, ordine
        // flex/grid, scroll) ancora da sinistra a destra — pagina rotta, non solo "meno elegante".
        root.setAttribute('dir', RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr');
    }
}
