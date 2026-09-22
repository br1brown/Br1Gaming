import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Esito di un'operazione di condivisione: il servizio si limita a fare, il componente decide se avvisare l'utente (vedi `shareResultNotice`). 'shared'/'cancelled' hanno già un feedback dell'OS. */
export type ShareResult = 'shared' | 'copied' | 'downloaded' | 'cancelled' | 'error';

/** Descrittore di un toast: chiave i18n + tipo. */
export interface ShareNotice {
    key: string;
    type: 'success' | 'error';
}

/** Mappa un {@link ShareResult} al toast appropriato, null quando non serve avvisare. Funzione pura: non mostra nulla, è il componente a chiamare `notify.toast(...)`. */
export function shareResultNotice(result: ShareResult): ShareNotice | null {
    switch (result) {
        case 'copied': return { key: 'clipboardCopied', type: 'success' };
        case 'error': return { key: 'shareError', type: 'error' };
        default: return null;
    }
}

/** Copia negli appunti, condivisione nativa (Web Share API), download locale. Esegue e ritorna l'esito, non mostra toast (compito del componente chiamante). Gerarchia: download → downloadCanvas → downloadBlob; share → shareCanvas → shareBlob → shareFile. */
@Injectable({ providedIn: 'root' })
export class ShareService {
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    // ───────────────────────────────────────────────────────────────
    // Utility interna
    // ───────────────────────────────────────────────────────────────

    /**
     * Converte un canvas in Blob PNG.
     */
    private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    // ─── CLIPBOARD ─────────────────────────────────────────────────

    /**
     * Copia testo negli appunti tramite Clipboard API.
     * Restituisce `true` se la copia è riuscita: l'eventuale toast è del chiamante.
     */
    async copyText(text: string): Promise<boolean> {
        if (!this.isBrowser || !text) return false;

        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Legge il contenuto testuale dagli appunti del sistema.
     * Richiede solitamente l'interazione esplicita dell'utente e permessi browser.
     */
    async readText(): Promise<string> {
        if (!this.isBrowser) return "";
        try {
            return await navigator.clipboard.readText();
        } catch {
            return '';

        }
    }

    // ─── SHARE CHAIN ───────────────────────────────────────────────

    /**
     * Condivide testo/URL via Web Share API.
     * Fallback: copia negli appunti se la Web Share API non è disponibile o fallisce.
     */
    async shareText(title: string, text: string): Promise<ShareResult> {
        if (this.isBrowser && navigator.share) {
            try {
                await navigator.share({ title, text });
                return 'shared';
            } catch (err) {
                if ((err as Error).name === 'AbortError') return 'cancelled';
            }
        }
        return (await this.copyText(text)) ? 'copied' : 'error';
    }

    /**
     * Condivide un canvas convertendolo prima in Blob.
     */
    async shareCanvas(canvas: HTMLCanvasElement, filename = 'immagine.png', title?: string): Promise<ShareResult> {
        const blob = await this.canvasToBlob(canvas);
        if (!blob) return 'error';
        return this.shareBlob(blob, filename, title);
    }

    /**
     * Condivide un Blob convertendolo prima in File.
     */
    async shareBlob(blob: Blob, filename: string, title?: string): Promise<ShareResult> {
        const file = new File([blob], filename, { type: blob.type });
        return this.shareFile(file, title);
    }

    /** CORE SHARE: usa la Web Share API se disponibile, fallback al download su errore o mancanza di supporto. */
    async shareFile(file: File, title?: string): Promise<ShareResult> {
        if (this.isBrowser && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    title: title || file.name,
                    files: [file]
                });
                return 'shared';
            } catch (err) {
                if ((err as Error).name === 'AbortError') return 'cancelled';
            }
        }

        // Fallback automatico
        this.downloadBlob(file, file.name);
        return 'downloaded';
    }

    // ─── DOWNLOAD CHAIN ────────────────────────────────────────────

    /**
     * Converte un canvas in Blob e lo scarica localmente.
     */
    async downloadCanvas(canvas: HTMLCanvasElement, filename = 'immagine.png'): Promise<void> {
        const blob = await this.canvasToBlob(canvas);
        if (blob) this.downloadBlob(blob, filename);
    }

    /**
     * CORE DOWNLOAD
     *
     * Crea un URL temporaneo e simula il click su un anchor invisibile.
     */
    downloadBlob(blob: Blob, filename: string): void {
        if (!this.isBrowser) return;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
}
