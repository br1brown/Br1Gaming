/**
 * Utility di parsing/serializzazione della Content-Security-Policy come stringa a direttive
 * (`nome valore1 valore2; nome2 valore1; ...`). Usata da security-headers.ts per estendere la
 * CSP del template con le sorgenti dichiarate dal progetto figlio in
 * security-headers.override.json (mai in sostituzione, solo aggiunta).
 */

import { Transform } from 'node:stream';

/** Estensioni dichiarative per direttiva CSP: nome direttiva (es. "connect-src") → sorgenti
 *  extra da aggiungere. Letto da security-headers.override.json (vedi server-env.ts). */
export type CspOverride = Readonly<Record<string, readonly string[]>>;

function parseCsp(csp: string): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const part of csp.split(';')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const [name, ...values] = trimmed.split(/\s+/);
        map.set(name.toLowerCase(), values);
    }
    return map;
}

function serializeCsp(map: Map<string, string[]>): string {
    return [...map.entries()]
        .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(' ')}` : name))
        .join('; ');
}

/**
 * Estende `baseCsp` aggiungendo, per ogni direttiva presente in `override`, le sorgenti che
 * mancano (dedup, ordine di apparizione preservato). Una direttiva assente nella CSP base viene
 * creata ex-novo con le sole sorgenti dell'override. `null`/`undefined` → CSP invariata.
 */
export function extendCsp(baseCsp: string, override: CspOverride | null | undefined): string {
    if (!override) return baseCsp;
    const map = parseCsp(baseCsp);
    for (const [directive, sources] of Object.entries(override)) {
        if (!sources || sources.length === 0) continue;
        const key = directive.toLowerCase();
        const existing = map.get(key) ?? [];
        for (const src of sources) {
            if (!existing.includes(src)) existing.push(src);
        }
        map.set(key, existing);
    }
    return serializeCsp(map);
}

/**
 * Angular applica automaticamente il nonce CSP agli `<style>` che crea lui (encapsulation) SOLO
 * quando `CSP_NONCE` è iniettabile nel bootstrap: per le pagine renderizzate server-side succede
 * (app.config.server.ts lo fornisce da REQUEST_CONTEXT), ma per il bootstrap che avviene
 * INTERAMENTE nel browser — rotte `RenderMode.Client` (jolly `/error/**`, pagine
 * `requiresAuth`) e qualunque navigazione client-side successiva a un componente lazy non ancora
 * caricato — non c'è alcun REQUEST_CONTEXT: Angular userebbe il fallback di default di
 * `CSP_NONCE`, che legge l'attributo `ngCspNonce` dal primo elemento di `<body>` che lo porta
 * (`@angular/core`, factory di CSP_NONCE). Senza quell'attributo gli `<style>` creati lì
 * nascono senza nonce e la CSP (`style-src-elem 'nonce-...'`) li scarta silenziosamente.
 *
 * Questo Transform inietta `ngCspNonce="<nonce>"` sul tag `<app-root` (primo figlio di `<body>`
 * in ogni variante di pagina, SSR o solo-shell) mentre la risposta scorre in streaming verso il
 * client, così il bootstrap browser trova sempre un nonce valido — innocuo sulle pagine già
 * renderizzate server-side, dove l'attributo resta semplicemente inutilizzato.
 *
 * Opera solo su byte grezzi (mai una decodifica testo dello stream intero): la ricerca del tag e
 * l'inserimento avvengono con `Buffer.indexOf`/`Buffer.concat`, quindi una sequenza UTF-8
 * multi-byte spezzata a metà da un confine di chunk (es. testo tradotto nei tag <meta> prima di
 * <body>) non viene mai toccata né può corrompersi.
 */
export function injectCspNonceIntoAppRoot(nonce: string): Transform {
    const needle = Buffer.from('<app-root', 'utf-8');
    const attr = Buffer.from(` ngCspNonce="${nonce}"`, 'utf-8');
    let injected = false;
    let carry: Buffer<ArrayBufferLike> = Buffer.alloc(0);

    return new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            if (injected) {
                callback(null, chunk);
                return;
            }
            const buf = carry.length > 0 ? Buffer.concat([carry, chunk]) : chunk;
            const idx = buf.indexOf(needle);
            if (idx !== -1) {
                const splitAt = idx + needle.length;
                injected = true;
                callback(null, Buffer.concat([buf.subarray(0, splitAt), attr, buf.subarray(splitAt)]));
                return;
            }
            // Nessun match ancora: trattiene solo la coda minima necessaria a intercettare il
            // tag se spezzato esattamente sul confine tra due chunk, il resto scorre subito.
            const keep = Math.min(buf.length, needle.length - 1);
            carry = buf.subarray(buf.length - keep);
            callback(null, buf.subarray(0, buf.length - keep));
        },
        flush(callback) {
            // <app-root> è sempre presente in ogni pagina dell'app: se `injected` è ancora
            // false a fine stream, la coda trattenuta non conteneva altro che byte residui
            // innocui da riconsegnare così come sono.
            callback(null, carry.length > 0 ? carry : undefined);
        },
    });
}
