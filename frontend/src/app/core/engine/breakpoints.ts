/** Breakpoint Bootstrap letti a runtime dalle custom property `--bp-*` (impostate su `html` da
 *  `lib.$bp-*`): fonte unica condivisa con le media query SCSS, invece di duplicare "768"/"992" a
 *  mano ovunque JS debba replicare la stessa soglia. Fallback difensivi se assenti. */
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

const FALLBACK_PX: Record<Breakpoint, number> = { sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1400 };

const cache = new Map<Breakpoint, number>();

function breakpointPx(bp: Breakpoint): number {
    let px = cache.get(bp);
    if (px === undefined) {
        const parsed = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--bp-${bp}`));
        px = Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_PX[bp];
        cache.set(bp, px);
    }
    return px;
}

/** La media query "almeno `bp`", per chi deve anche reagire al suo cambio (`change`). Solo browser. */
export function viewportAtLeastQuery(bp: Breakpoint): MediaQueryList {
    return window.matchMedia(`(min-width: ${breakpointPx(bp)}px)`);
}

/** True se il viewport è largo almeno quanto il breakpoint dato. Solo browser: chi chiama deve già
 *  trovarsi in codice che gira solo lato client (`afterNextRender`, guardia `isBrowser`, ecc.). */
export function isViewportAtLeast(bp: Breakpoint): boolean {
    return viewportAtLeastQuery(bp).matches;
}

/** True dal breakpoint `md` in su: il confine mobile/desktop di navbar e menu (non "un desktop" in
 *  senso stretto: un tablet in orizzontale ci rientra). Stesse regole di `isViewportAtLeast`. */
export function isDesktopViewport(): boolean {
    return isViewportAtLeast('md');
}

/** True se il dispositivo ha hover reale (mouse/trackpad): un tablet/laptop touch può essere >= md
 *  senza hover, e chi apre un pannello su `:hover` via CSS usa questo per decidere il fallback al tap. Solo browser. */
export function supportsHover(): boolean {
    return window.matchMedia('(hover: hover)').matches;
}
