import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NotificationService } from './notification.service';
import { TranslateService } from './translate.service';

/**
 * SHARE SERVICE
 * Servizio centralizzato per le operazioni di interazione con il sistema operativo:
 * copia negli appunti, condivisione nativa e salvataggio file.
 */
@Injectable({ providedIn: 'root' })
export class ShareService {
    private readonly notify = inject(NotificationService);
    private readonly translate = inject(TranslateService);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    // ─── CLIPBOARD (APPUNTI) ──────────────────────────────────────────────

    /** 
     * Copia il testo negli appunti e invia un feedback visivo all'utente.
     * @param text Il contenuto da copiare.
     */
    async copyText(text: string): Promise<boolean> {
        const copied = await this.writeToClipboard(text);

        // Notifica l'esito tramite il servizio di Toast
        this.notify.toast(
            this.translate.translate(copied ? 'clipboardCopied' : 'clipboardEmpty'),
            copied ? 'success' : 'warning'
        );
        return copied;
    }

    /** 
     * Logica di scrittura negli appunti.
     * Tenta l'uso della moderna Clipboard API; in caso di errore o mancanza di permessi,
     * utilizza il vecchio metodo basato sul DOM.
     */
    private async writeToClipboard(text: string): Promise<boolean> {
        try {
            // Metodo moderno (richiede contesto sicuro/HTTPS)
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fallback per browser datati o contesti HTTP
            return this.execCommandCopy(text);
        }
    }

    /** 
     * Metodo di ripiego: crea un elemento temporaneo nel DOM, lo seleziona 
     * ed esegue il comando di copia del sistema.
     */
    private execCommandCopy(text: string): boolean {
        if (!this.isBrowser) return false;

        const textarea = document.createElement('textarea');
        textarea.value = text;
        // Impedisce lo scroll della pagina durante la creazione dell'elemento
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);

        textarea.select(); // Seleziona il testo
        const ok = document.execCommand('copy'); // Esegue la copia

        document.body.removeChild(textarea); // Pulizia del DOM
        return ok;
    }

    /** 
     * Legge il contenuto testuale dagli appunti del sistema.
     * Richiede solitamente l'interazione esplicita dell'utente e permessi browser.
     */
    async readText(): Promise<string> {
        try {
            return await navigator.clipboard.readText();
        } catch {
            return '';
        }
    }

    // ─── WEB SHARE API (CONDIVISIONE NATIVA) ─────────────────────────────

    /** 
     * Verifica la disponibilità della condivisione nativa (es. il menu "Condividi" su iOS/Android).
     */
    get canShare(): boolean {
        return typeof navigator !== 'undefined' && !!navigator.share;
    }

    /** 
     * Apre il menu di condivisione di sistema per inviare testo o link.
     */
    async shareText(text: string, title?: string): Promise<boolean> {
        if (!this.canShare) return false;
        try {
            await navigator.share({ title, text });
            return true;
        } catch {
            return false; // L'utente potrebbe aver annullato la condivisione
        }
    }

    /**
     * Condivide un file reale (es. un'immagine generata).
     * Se il browser non supporta la condivisione di file, scarica l'asset localmente.
     */
    async shareFile(blob: Blob, filename: string, title?: string): Promise<void> {
        if (this.canShare) {
            try {
                // Converte il Blob in un oggetto File compatibile con la Share API
                const file = new File([blob], filename, { type: blob.type });
                await navigator.share({ title, files: [file] });
                return;
            } catch {
                // Fallback in caso di errore o annullamento
            }
        }
        // Se non possiamo condividere, offriamo il download diretto
        this.downloadBlob(blob, filename);
    }

    /**
     * Cattura il contenuto di un elemento Canvas e lo condivide come immagine.
     */
    async shareCanvas(canvas: HTMLCanvasElement, title?: string, filename = 'immagine.png'): Promise<void> {
        return new Promise<void>((resolve) => {
            canvas.toBlob(async (blob) => {
                if (blob) {
                    await this.shareFile(blob, filename, title);
                }
                resolve();
            }, 'image/png');
        });
    }

    // ─── DOWNLOAD GESTITO ────────────────────────────────────────────────

    /** 
     * Forza il download di un file binario creando un link "anchor" virtuale.
     */
    downloadBlob(blob: Blob, filename: string): void {
        if (!this.isBrowser) return;

        // Crea un URL temporaneo che punta ai dati in memoria (RAM)
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;

        link.click(); // Simula il click per avviare il download

        // Importante: rilascia la memoria una volta terminato
        URL.revokeObjectURL(url);
    }

    /** 
     * Esegue il download immediato di un Canvas trasformandolo in una stringa Base64.
     */
    downloadCanvas(canvas: HTMLCanvasElement, filename = 'immagine.png'): void {
        if (!this.isBrowser) return;

        const link = document.createElement('a');
        link.download = filename;
        // toDataURL converte l'immagine in una stringa di dati codificata
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
}