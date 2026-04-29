import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import * as QRCode from 'qrcode';
import { ThemeService } from './theme.service';

export type QrConfig =
    | { type: 'whatsapp'; phone: string; text?: string }
    | { type: 'email'; to: string; subject?: string; body?: string }
    | { type: 'wifi'; ssid: string; password?: string; encryption?: 'WPA' | 'WEP' | 'nopass' }
    | { type: 'sepa'; iban: string; name: string; amount: number; remittance?: string }
    | { type: 'text'; content: string };

export const enum QrError {
    INVALID_INPUT     = 'INVALID_INPUT',
    PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
    CONVERSION_ERROR  = 'CONVERSION_ERROR',
    GENERATION_FAILED = 'GENERATION_FAILED',
    NOT_IN_BROWSER    = 'NOT_IN_BROWSER',
}

export type QrResponse =
    | { success: true; blob: Blob }
    | { success: false; error: QrError; message?: string };

/**
 * Generatore QR code — restituisce blob o SVG, nessuna logica UI.
 * Il chiamante gestisce download, condivisione e visualizzazione inline
 * tramite ShareService e AssetService secondo necessità.
 */
@Injectable({ providedIn: 'root' })
export class QrCodeService {
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private readonly theme = inject(ThemeService);
    private readonly cache = new Map<string, Blob>();

    // ─── Validator ───────────────────────────────────────────────────────

    private readonly validators = {
        phone: (p: string) => /^\+?[1-9]\d{1,14}$/.test(p),
        email: (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
        iban:  (i: string) => /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(i.replace(/\s/g, '')),
    };

    // ─── Builder payload ─────────────────────────────────────────────────

    private readonly builders = {
        whatsapp: (p: string, t = '') =>
            `https://wa.me/${p.replace(/\+/g, '')}?text=${encodeURIComponent(t)}`,
        email: (to: string, s = '', b = '') =>
            `mailto:${to}?subject=${encodeURIComponent(s)}&body=${encodeURIComponent(b)}`,
        wifi: (ssid: string, pwd = '', enc = 'WPA') =>
            `WIFI:T:${enc};S:${ssid};P:${pwd};;`,
        sepa: (iban: string, name: string, amount: number, remittance = '') =>
            ['BCD', '002', '1', 'SCT', '', name, iban.replace(/\s/g, ''), `EUR${amount.toFixed(2)}`, '', '', remittance].join('\n'),
        text: (c: string) => c,
    };

    // ─── API pubblica ────────────────────────────────────────────────────

    /**
     * Genera il QR come Blob PNG con i colori del tema attivo (colorPrimary + colorPrimaryText).
     * Risultato cachato per payload + colori identici.
     */
    async create(config: QrConfig): Promise<QrResponse> {
        return this.createWithColors(config, this.theme.colorPrimaryText(), this.theme.colorPrimary());
    }

    /** Genera il QR con colori espliciti anziché quelli del tema. */
    async createWithColors(config: QrConfig, fg: string, bg: string): Promise<QrResponse> {
        if (!this.isBrowser) return this.err(QrError.NOT_IN_BROWSER);
        const payload = this.buildPayload(config);
        if (typeof payload !== 'string') return payload;
        return this.generate(payload, fg, bg);
    }

    /** Genera il QR come stringa SVG con i colori del tema attivo. Browser-only, ritorna null su SSR. */
    async toSVG(config: QrConfig): Promise<string | null> {
        return this.toSVGWithColors(config, this.theme.colorPrimaryText(), this.theme.colorPrimary());
    }

    /** Genera il QR come stringa SVG con colori espliciti. Browser-only, ritorna null su SSR. */
    async toSVGWithColors(config: QrConfig, fg: string, bg: string): Promise<string | null> {
        if (!this.isBrowser) return null;
        const payload = this.buildPayload(config);
        if (typeof payload !== 'string') return null;
        return QRCode.toString(payload, { type: 'svg', color: { dark: fg, light: bg } });
    }

    // ─── Internals ───────────────────────────────────────────────────────

    private buildPayload(config: QrConfig): string | QrResponse {
        switch (config.type) {
            case 'whatsapp':
                return this.validators.phone(config.phone)
                    ? this.builders.whatsapp(config.phone, config.text)
                    : this.err(QrError.INVALID_INPUT, 'Numero di telefono non valido');
            case 'email':
                return this.validators.email(config.to)
                    ? this.builders.email(config.to, config.subject, config.body)
                    : this.err(QrError.INVALID_INPUT, 'Indirizzo email non valido');
            case 'wifi':
                return this.builders.wifi(config.ssid, config.password, config.encryption);
            case 'sepa':
                return this.validators.iban(config.iban)
                    ? this.builders.sepa(config.iban, config.name, config.amount, config.remittance)
                    : this.err(QrError.INVALID_INPUT, 'IBAN non valido');
            case 'text':
                return this.builders.text(config.content);
        }
    }

    private async generate(payload: string, fg: string, bg: string): Promise<QrResponse> {
        const cacheKey = `${payload}|${fg}|${bg}`;
        if (this.cache.has(cacheKey)) {
            return { success: true, blob: this.cache.get(cacheKey)! };
        }

        if (payload.length > 2953) {
            return this.err(QrError.PAYLOAD_TOO_LARGE, 'Payload supera il limite QR (2953 caratteri)');
        }

        try {
            const canvas = document.createElement('canvas');
            await QRCode.toCanvas(canvas, payload, {
                width: 512, margin: 2, errorCorrectionLevel: 'H',
                color: { dark: fg, light: bg },
            });

            return new Promise<QrResponse>(resolve => {
                canvas.toBlob(blob => {
                    if (blob) {
                        this.cache.set(cacheKey, blob);
                        resolve({ success: true, blob });
                    } else {
                        resolve(this.err(QrError.CONVERSION_ERROR, 'Conversione canvas→Blob fallita'));
                    }
                }, 'image/png');
            });
        } catch (e) {
            return this.err(QrError.GENERATION_FAILED, (e as Error).message);
        }
    }

    private err(error: QrError, message?: string): QrResponse {
        return { success: false, error, message };
    }
}
