import type { Route, Routes } from '@angular/router';

/** Precaricamento per intento, parte pura: `buildPrefetchIndex` ricava dalle rotte le foglie col percorso completo,
 *  `matchPrefetchTarget` sceglie la foglia di un percorso. */

export interface PrefetchTarget {
    segments: readonly string[];
    load: () => unknown;
}

/** Le rotte foglia che caricano un componente a richiesta (`loadComponent`), con il percorso completo dei genitori. Ignora `**` e i reindirizzamenti. */
export function buildPrefetchIndex(routes: Routes, prefix: readonly string[] = []): PrefetchTarget[] {
    const index: PrefetchTarget[] = [];
    for (const route of routes) {
        if (route.redirectTo !== undefined || route.path === '**') continue;
        const segments = [...prefix, ...(route.path ?? '').split('/').filter(Boolean)];
        if (route.loadComponent) index.push({ segments, load: () => (route as Required<Pick<Route, 'loadComponent'>>).loadComponent() });
        if (route.children) index.push(...buildPrefetchIndex(route.children, segments));
    }
    return index;
}

/** La foglia da scaricare per un percorso senza query né hash, o `null`. I segmenti letterali vincono su `:param`, come nel router;
 *  un percorso con segmenti vuoti (`/a//b`) non corrisponde a niente. */
export function matchPrefetchTarget(index: readonly PrefetchTarget[], pathname: string): PrefetchTarget | null {
    if (pathname.includes('//')) return null;
    const parts = pathname.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch { return p; } });
    let best: PrefetchTarget | null = null;
    let bestScore = -1;
    for (const target of index) {
        if (target.segments.length !== parts.length) continue;
        let score = 0;
        let ok = true;
        for (let i = 0; i < parts.length; i++) {
            const segment = target.segments[i];
            if (segment.startsWith(':')) continue;
            if (segment !== parts[i]) { ok = false; break; }
            score++;
        }
        if (ok && score > bestScore) { best = target; bestScore = score; }
    }
    return best;
}

/** Il percorso interno di un link senza `baseHref`, o `null` per un altro sito, un `target` non `_self`, un download, `mailto:`/`tel:`
 *  o un'àncora sulla stessa pagina. */
export function internalPathOf(anchor: Pick<HTMLAnchorElement, 'href' | 'target' | 'hasAttribute'>, origin: string, baseHref = '/'): string | null {
    if (anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return null;
    let url: URL;
    try { url = new URL(anchor.href, origin); } catch { return null; }
    if (url.origin !== origin) return null;
    let path = url.pathname;
    const base = baseHref.endsWith('/') ? baseHref : baseHref + '/';
    if (base !== '/' && path.startsWith(base)) path = '/' + path.slice(base.length);
    return path;
}

/** Il precaricamento è lecito adesso: la scheda è visibile e chi naviga non ha chiesto di risparmiare dati (`saveData`) né ha una connessione lenta (2G). */
export function intentAllowed(connection: { saveData?: boolean; effectiveType?: string } | undefined, hidden: boolean): boolean {
    if (hidden) return false;
    if (connection?.saveData) return false;
    return connection?.effectiveType !== 'slow-2g' && connection?.effectiveType !== '2g';
}
