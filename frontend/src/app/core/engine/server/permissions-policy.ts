/**
 * Utility di parsing/serializzazione della Permissions-Policy come stringa a direttive
 * (`nome=(valore1 valore2), nome2=(valore3), ...`). Usata da security-headers.ts per estendere
 * la Permissions-Policy del template con le origini dichiarate dal progetto figlio in
 * security-headers.override.json (mai in sostituzione, solo aggiunta).
 */

/** Estensioni dichiarative per direttiva Permissions-Policy: nome feature (es. "geolocation") →
 *  origini extra da autorizzare (es. "self"). Letto da security-headers.override.json (vedi server-env.ts). */
export type PermissionsPolicyOverride = Readonly<Record<string, readonly string[]>>;

function parsePermissionsPolicy(policy: string): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const part of policy.split(',')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const match = /^([\w-]+)=\(([^)]*)\)$/.exec(trimmed);
        if (!match) continue;
        const [, name, valuesRaw] = match;
        map.set(name.toLowerCase(), valuesRaw.split(/\s+/).filter(Boolean));
    }
    return map;
}

function serializePermissionsPolicy(map: Map<string, string[]>): string {
    return [...map.entries()]
        .map(([name, values]) => `${name}=(${values.join(' ')})`)
        .join(', ');
}

/**
 * Estende `basePolicy` aggiungendo, per ogni feature presente in `override`, le origini che
 * mancano (dedup, ordine di apparizione preservato). Una feature assente nella policy base viene
 * creata ex-novo con le sole origini dell'override. `null`/`undefined` → policy invariata.
 */
export function extendPermissionsPolicy(basePolicy: string, override: PermissionsPolicyOverride | null | undefined): string {
    if (!override) return basePolicy;
    const map = parsePermissionsPolicy(basePolicy);
    for (const [feature, origins] of Object.entries(override)) {
        if (!origins || origins.length === 0) continue;
        const key = feature.toLowerCase();
        const existing = map.get(key) ?? [];
        for (const origin of origins) {
            if (!existing.includes(origin)) existing.push(origin);
        }
        map.set(key, existing);
    }
    return serializePermissionsPolicy(map);
}
