/** Copre `systemFontHandler` DAL VIVO (funzione reale) con `node:fs` mockato — CI-safe fuori da un
 *  container Alpine. `vi.mock` non funziona su import relativi in `ng test` (solo su specificatori
 *  bare come `node:fs`), quindi il ramo custom dell'endpoint non è esercitato qui: lo è dal vivo e
 *  strutturalmente dal test "raggiungibile ⇔ censito" in `design-system-presets.spec.ts`. Copre
 *  comunque l'invariante che conta per il ramo SystemFont: ogni key/indice dichiarato risolve a un
 *  file, ogni altra combinazione (key ignota, indice fuori range, path traversal) mai. */
import { describe, it, expect, vi } from 'vitest';

// SystemFont.Roboto/0 è un percorso reale del catalogo di sistema — preso da SYSTEM_FONTS
// (font-system.ts) così un domani un refactor dei percorsi non slega silenziosamente il mock da
// quello vero. SystemFont.NotoSerif/0 è deliberatamente ASSENTE da knownFiles, vedi test dedicato.
const ROBOTO_REGULAR_PATH = '/usr/share/fonts/roboto/Roboto-Regular.ttf';
const knownFiles = new Set([ROBOTO_REGULAR_PATH]);

vi.mock('node:fs', () => {
    const existsSync = (p: string): boolean => knownFiles.has(p);
    return { existsSync, default: { existsSync } };
});

function mockRes() {
    const state: { statusCode: number; headers: Record<string, string>; sentFile: string | null } = {
        statusCode: 200, headers: {}, sentFile: null,
    };
    const res = {
        status(code: number) { state.statusCode = code; return res; },
        setHeader(k: string, v: string) { state.headers[k] = v; },
        sendFile(p: string) { state.sentFile = p; },
        end() { /* no-op */ },
    };
    return { res, state };
}

async function callHandler(key: string | string[], index: string) {
    const { systemFontHandler } = await import('../core/engine/server/routes/system-font');
    const { res, state } = mockRes();
    systemFontHandler({ params: { key, index } } as never, res as never);
    return state;
}

describe('systemFontHandler — reachability e adversarial, sulla funzione REALE (non ricopiata)', () => {
    it('SystemFont valido (Roboto/0): sendFile sul path del catalogo, Content-Type font/ttf, cache immutabile, 200', async () => {
        const state = await callHandler('Roboto', '0');
        expect(state.sentFile).toBe(ROBOTO_REGULAR_PATH);
        expect(state.headers['Content-Type']).toBe('font/ttf');
        expect(state.headers['Cache-Control']).toContain('immutable');
        expect(state.statusCode).toBe(200);
    });

    it('key sconosciuta (né SystemFont né nel catalogo custom, vuoto in questo sito): 404, nessun sendFile', async () => {
        const state = await callHandler('nonexistent', '0');
        expect(state.sentFile).toBeNull();
        expect(state.statusCode).toBe(404);
    });

    it('indice fuori range su un SystemFont valido: 404', async () => {
        expect((await callHandler('Roboto', '99')).statusCode).toBe(404);
    });

    it('indice negativo, non numerico, o non intero: 404 — guardia PRIMA di qualunque lookup su key valide', async () => {
        for (const index of ['-1', 'abc', '1.5', '']) {
            expect((await callHandler('Roboto', index)).statusCode).toBe(404);
        }
    });

    it('key vuota: 404', async () => {
        expect((await callHandler('', '0')).statusCode).toBe(404);
    });

    it('path traversal nella key: 404 — non risolve mai a un path fuori da fontsDir/SYSTEM_FONTS (nessun nome di file dall\'esterno, per costruzione)', async () => {
        for (const key of ['../../../etc/passwd', 'Roboto/../../../etc/passwd', '..%2F..%2Fetc%2Fpasswd']) {
            expect((await callHandler(key, '0')).statusCode).toBe(404);
        }
    });

    it('case-mismatch sulla key: 404 — "roboto" non è "Roboto", nessuna normalizzazione implicita', async () => {
        expect((await callHandler('roboto', '0')).statusCode).toBe(404);
    });

    it('key come array (Express può darla string[] su alcune configurazioni di routing): prende il primo elemento', async () => {
        const state = await callHandler(['Roboto', 'Noto'], '0');
        expect(state.sentFile).toBe(ROBOTO_REGULAR_PATH);
    });

    it('file assente su disco anche per una key/indice altrimenti validi: 404 (mai un crash, mai un file inventato)', async () => {
        // SystemFont.NotoSerif/0 è una key valida del catalogo di sistema ma il suo file NON è fra
        // quelli noti al mock di existsSync — replica lo scenario reale "immagine Docker mal costruita".
        const state = await callHandler('NotoSerif', '0');
        expect(state.sentFile).toBeNull();
        expect(state.statusCode).toBe(404);
    });
});
