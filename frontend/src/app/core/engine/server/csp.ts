/**
 * Utility di parsing/serializzazione della Content-Security-Policy come stringa a direttive
 * (`nome valore1 valore2; nome2 valore1; ...`). Usata da security-headers.ts per estendere la
 * CSP del template con le sorgenti dichiarate dal progetto figlio in
 * security-headers.override.json (mai in sostituzione, solo aggiunta).
 */

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
