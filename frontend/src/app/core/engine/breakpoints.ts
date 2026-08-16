/**
 * Breakpoint `md` (768px, Bootstrap) letto a runtime dalla custom property `--bp-md`
 * (impostata su `html` in base/_base.scss a partire da `lib.$bp-md`): fonte unica condivisa
 * con le media query SCSS, invece di duplicare "768" a mano in ogni componente che deve
 * replicare da JS la stessa soglia (`window.matchMedia` non può leggere una variabile SCSS).
 * 768 resta solo come fallback difensivo se la custom property non fosse presente.
 */
const FALLBACK_BP_MD_PX = 768;

let cachedBpMdPx: number | null = null;

function bpMdPx(): number {
    if (cachedBpMdPx === null) {
        const raw = getComputedStyle(document.documentElement).getPropertyValue('--bp-md');
        const parsed = parseFloat(raw);
        cachedBpMdPx = Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_BP_MD_PX;
    }
    return cachedBpMdPx;
}

/** True se il viewport è al breakpoint `md` o oltre (desktop). Solo browser: chi chiama deve
 *  già trovarsi in codice che gira solo lato client (`afterNextRender`, guardia `isBrowser`, ecc.). */
export function isDesktopViewport(): boolean {
    return window.matchMedia(`(min-width: ${bpMdPx()}px)`).matches;
}
