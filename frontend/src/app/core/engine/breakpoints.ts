/** Breakpoint `md` (768px, Bootstrap) letto a runtime dalla custom property `--bp-md` (impostata
 *  su `html` da `lib.$bp-md`): fonte unica condivisa con le media query SCSS, invece di duplicare
 *  "768" a mano ovunque JS debba replicare la stessa soglia. Fallback difensivo se assente. */
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

/** True se il dispositivo ha un puntatore capace di hover reale (mouse/trackpad), false per un
 *  touchscreen puro. `isDesktopViewport()` guarda solo la LARGHEZZA: un tablet o laptop touch
 *  può riportare `>= md` px senza avere hover reale — chi apre un pannello su `:hover` via CSS
 *  ha bisogno di questo per sapere quando serve un fallback al tap. Solo browser, stessa regola
 *  di `isDesktopViewport()`. */
export function supportsHover(): boolean {
    return window.matchMedia('(hover: hover)').matches;
}
