/**
 * Attese e scroll per le liste che si ricaricano (cambio pagina, filtri applicati).
 *
 * Lo scroll verso l'inizio di un elenco va fatto DOPO che i dati nuovi sono arrivati e il browser li ha disegnati:
 * prima, la pagina può accorciarsi o allungarsi e si resta dove si era (in fondo). `PagedListComponent` lo fa da sé;
 * chi ha una lista propria usa queste due funzioni.
 */

/** Si risolve dopo che il browser ha disegnato quanto è già stato aggiornato (due frame). Sul server si risolve subito. */
export function nextPaint(): Promise<void> {
    if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
    return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/** Porta l'inizio dell'elemento in vista, a disegno finito, e (di serie) gli dà il focus senza scorrere ancora. Sul server non fa niente. */
export async function scrollToAfterPaint(el: HTMLElement | null | undefined, opts: { focus?: boolean } = {}): Promise<void> {
    if (!el) return;
    await nextPaint();
    el.scrollIntoView({ block: 'start' });
    if (opts.focus ?? true) el.focus({ preventScroll: true });
}
