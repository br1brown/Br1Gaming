import { Injectable, effect, computed, signal, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ContestoSito } from '../../site';

/**
 * Colore tema: imposta --colorTema su :root, espone il tono chiaro/scuro e calcola contrasto testo (WCAG 2.1).
 * Configurazione: colorTema in site.ts. Le variabili derivate usano color-mix() in base.css.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
    /** Riferimento al DOM per manipolare stili e attributi globali */
    private doc = inject(DOCUMENT);

    /** Stato reattivo del colore principale: inizializzato dalla config esterna */
    readonly colorTema = signal<string>(ContestoSito.config.colorTema);

    /**
     * Deroga intenzionale: mantiene il pannello centrale in modalita' light
     * per conservare leggibilita' sopra sfondi piu' scenografici.
     * Puo' restare indipendente dal tema globale anche in una futura
     * integrazione con prefers-color-scheme.
     */
    readonly panelForcedLight = signal(true);

    /** true se il nero offre piu' contrasto del bianco sul colore tema */
    readonly isDarkTextPreferred = computed(() =>
        ThemeService.prefersDarkText(this.colorTema())
    );

    /** Calcolo stringa: restituisce il codice esadecimale del testo leggibile (bianco o nero) */
    readonly colorTemaText = computed(() =>
        ThemeService.getReadableTextColor(this.colorTema())
    );

    /** Calcolo colore: genera una variante scurita del 40% rispetto al colore tema */
    readonly colorPrimary = computed(() =>
        ThemeService.mixHexColors(this.colorTema(), '#000000', 0.4)
    );

    /** Calcolo stringa: determina il colore testo leggibile sopra la variante scurita */
    readonly colorPrimaryText = computed(() =>
        ThemeService.getReadableTextColor(this.colorPrimary())
    );

    /** Tono globale di Bootstrap/UI ricavato automaticamente dal colore tema. */
    readonly themeTone = computed<'light' | 'dark'>(() =>
        this.isDarkTextPreferred() ? 'light' : 'dark'
    );

    /** Tema Bootstrap da applicare al pannello centrale; null = eredita dal tema globale. */
    readonly panelBootstrapTheme = computed<'light' | null>(() =>
        this.panelForcedLight() ? 'light' : null
    );

    constructor() {
        /** Reazione automatica: si attiva ogni volta che cambia il segnale colorTema */
        effect(() => {
            const color = this.colorTema();
            /** Valore attuale del tono chiaro/scuro calcolato */
            const themeTone = this.themeTone();
            /** Riferimento all'elemento HTML radice */
            const root = this.doc.documentElement;

            if (root) {
                /** Aggiorna la variabile CSS utilizzata nei fogli di stile */
                root.style?.setProperty('--colorTema', color);
                /** Inserisce un attributo personalizzato per selettori CSS specifici */
                root.setAttribute('data-theme-tone', themeTone);
                /** Imposta il tema nativo di Bootstrap 5 sull'elemento radice */
                root.setAttribute('data-bs-theme', themeTone);
            }

            /** Riferimento all'elemento Body */
            const body = this.doc.body;
            if (body) {
                /** Applica il tema Bootstrap anche al corpo per garantire coerenza */
                body.setAttribute('data-bs-theme', themeTone);
            }

            /** Cerca il meta tag che colora la UI del browser (es. Chrome su Android) */
            const meta = this.doc.querySelector('meta[name="theme-color"]');
            if (meta) {
                /** Sincronizza il colore del browser con il tema del sito */
                meta.setAttribute('content', color);
            }
        });
    }

    /** true se il testo nero offre almeno lo stesso contrasto del bianco. */
    static prefersDarkText(hexColor: string): boolean {
        return ThemeService.calcContrastRatio(hexColor, '#000000') >=
            ThemeService.calcContrastRatio(hexColor, '#ffffff');
    }

    /** Restituisce nero o bianco in base al contrasto migliore sul colore dato. */
    static getReadableTextColor(hexColor: string): '#000000' | '#ffffff' {
        return ThemeService.prefersDarkText(hexColor) ? '#000000' : '#ffffff';
    }

    /** Utility: miscela due colori esadecimali in base a un peso percentuale */
    static mixHexColors(baseHex: string, mixHex: string, mixWeight: number): string {
        /** Converte il primo colore in valori numerici R,G,B */
        const base = ThemeService.hexToRgb(baseHex);
        /** Converte il secondo colore in valori numerici R,G,B */
        const mix = ThemeService.hexToRgb(mixHex);
        /** Assicura che la percentuale di miscela sia tra 0 e 1 */
        const weight = ThemeService.clamp(mixWeight, 0, 1);

        /** Calcola la media pesata del canale Rosso */
        const r = Math.round(base.r * (1 - weight) + mix.r * weight);
        /** Calcola la media pesata del canale Verde */
        const g = Math.round(base.g * (1 - weight) + mix.g * weight);
        /** Calcola la media pesata del canale Blu */
        const b = Math.round(base.b * (1 - weight) + mix.b * weight);

        /** Converte i nuovi valori numerici di nuovo in una stringa esadecimale */
        return ThemeService.rgbToHex(r, g, b);
    }

    /** Rapporto di contrasto WCAG 2.1 tra due colori. */
    static calcContrastRatio(colorA: string, colorB: string): number {
        /** Ottiene la luminanza (luminosit� percepita) del primo colore */
        const luminanceA = ThemeService.calcLuminance(colorA);
        /** Ottiene la luminanza del secondo colore */
        const luminanceB = ThemeService.calcLuminance(colorB);
        /** Identifica il valore pi� alto (pi� chiaro) */
        const lighter = Math.max(luminanceA, luminanceB);
        /** Identifica il valore pi� basso (pi� scuro) */
        const darker = Math.min(luminanceA, luminanceB);
        /** Applica la formula del rapporto standard */
        return (lighter + 0.05) / (darker + 0.05);
    }

    /** Algoritmo: calcola la luminosit� di un colore corretta per l'occhio umano */
    static calcLuminance(hexColor: string): number {
        /** Rende la stringa hex uniforme (rimuove # e corregge lunghezze) */
        const normalized = ThemeService.normalizeHex(hexColor);
        /** Converte e linearizza il canale rosso */
        const r = ThemeService.toLinearChannel(parseInt(normalized.substring(0, 2), 16) / 255);
        /** Converte e linearizza il canale verde */
        const g = ThemeService.toLinearChannel(parseInt(normalized.substring(2, 4), 16) / 255);
        /** Converte e linearizza il canale blu */
        const b = ThemeService.toLinearChannel(parseInt(normalized.substring(4, 6), 16) / 255);
        /** Restituisce la somma pesata (il verde pesa di pi� per l'occhio) */
        return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    }

    /** Helper: trasforma una stringa esadecimale in un oggetto con tre canali numerici */
    private static hexToRgb(hexColor: string): { r: number; g: number; b: number } {
        const normalized = ThemeService.normalizeHex(hexColor);
        return {
            r: parseInt(normalized.slice(0, 2), 16),
            g: parseInt(normalized.slice(2, 4), 16),
            b: parseInt(normalized.slice(4, 6), 16)
        };
    }

    /** Helper: pulisce l'input esadecimale e gestisce i formati a 3 cifre (es: #F00) */
    private static normalizeHex(hexColor: string): string {
        const hex = hexColor.replace('#', '').trim();
        return hex.length === 3
            ? hex.split('').map(char => char + char).join('')
            : hex.padEnd(6, '0').slice(0, 6);
    }

    /** Helper: compone i tre valori numerici in una stringa formattata #RRGGBB */
    private static rgbToHex(r: number, g: number, b: number): string {
        return `#${ThemeService.toHex(r)}${ThemeService.toHex(g)}${ThemeService.toHex(b)}`;
    }

    /** Helper: converte un numero decimale 0-255 in una stringa hex a due cifre */
    private static toHex(value: number): string {
        return ThemeService.clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
    }

    /** Matematica: impedisce a un valore di superare i limiti minimi e massimi */
    private static clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }

    /** Matematica: rimuove la compressione gamma (sRGB) per i calcoli di luminanza */
    private static toLinearChannel(channel: number): number {
        return channel <= 0.04045
            ? channel / 12.92
            : Math.pow((channel + 0.055) / 1.055, 2.4);
    }
}