import { DOCUMENT } from '@angular/core';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser, LocationStrategy } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_CONFIG } from '../siteBuilder';
import { buildPrefetchIndex, intentAllowed, internalPathOf, matchPrefetchTarget, type PrefetchTarget } from './page-prefetch';

/** Quanto resta fermo il puntatore su un link prima di scaricare la pagina: un passaggio in volo (verso un altro link) non scarica niente. */
const HOVER_DELAY_MS = 100;
/** Quanti download di pagine alla volta: se ne chiedono altri, la richiesta si perde (arriverà con il prossimo intento). */
const MAX_IN_FLIGHT = 2;

/** Con `prefetchOnIntent: true` in `site.ts`, scarica il codice di una pagina interna quando il puntatore si ferma 100 ms su un suo link,
 *  al focus o all'inizio di un tocco: un ascolto solo sul documento, una volta per pagina, due download alla volta al massimo.
 *  Non scarica con `saveData`, in 2G o a scheda nascosta; un errore di rete si ignora e il prossimo intento riprova. */
@Injectable({ providedIn: 'root' })
export class PagePrefetchService {
    private readonly router = inject(Router);
    private readonly document = inject(DOCUMENT);
    private readonly location = inject(LocationStrategy);
    private readonly enabled = inject(SITE_CONFIG, { optional: true })?.prefetchOnIntent === true;

    private index: PrefetchTarget[] | null = null;
    private indexFor: unknown = null;
    private readonly requested = new Set<PrefetchTarget>();
    private inFlight = 0;
    private current: Element | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        if (!this.enabled || !isPlatformBrowser(inject(PLATFORM_ID))) return;
        const doc = this.document;
        // `pointerType === 'touch'` lo gestisce `touchstart`: un tocco emette anche pointerover, e due strade per lo stesso gesto non servono.
        doc.addEventListener('pointerover', e => { if ((e as PointerEvent).pointerType !== 'touch') this.hover(e.target); }, { passive: true });
        doc.addEventListener('pointerout', e => this.leave(e as PointerEvent), { passive: true });
        doc.addEventListener('focusin', e => this.prefetchFrom(e.target), { passive: true });
        doc.addEventListener('touchstart', e => this.prefetchFrom(e.target), { passive: true });
    }

    private anchorOf(target: EventTarget | null): HTMLAnchorElement | null {
        return target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
    }

    private hover(target: EventTarget | null): void {
        const anchor = this.anchorOf(target);
        if (!anchor || anchor === this.current) return;
        this.cancel();
        this.current = anchor;
        this.timer = setTimeout(() => { this.timer = null; this.prefetch(anchor); }, HOVER_DELAY_MS);
    }

    private leave(event: PointerEvent): void {
        if (!this.current) return;
        // Il puntatore passa da un figlio all'altro dello stesso link: non è un'uscita.
        if (event.relatedTarget instanceof Node && this.current.contains(event.relatedTarget)) return;
        this.cancel();
    }

    private cancel(): void {
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
        this.current = null;
    }

    private prefetchFrom(target: EventTarget | null): void {
        const anchor = this.anchorOf(target);
        if (anchor) this.prefetch(anchor);
    }

    private prefetch(anchor: HTMLAnchorElement): void {
        const view = this.document.defaultView;
        if (!view) return;
        const connection = (view.navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
        if (!intentAllowed(connection, this.document.visibilityState === 'hidden')) return;

        const path = internalPathOf(anchor, view.location.origin, this.location.getBaseHref());
        if (path === null) return;
        if (this.indexFor !== this.router.config) {
            this.index = buildPrefetchIndex(this.router.config);
            this.indexFor = this.router.config;
        }
        const target = matchPrefetchTarget(this.index ?? [], path);
        if (!target || this.requested.has(target) || this.inFlight >= MAX_IN_FLIGHT) return;

        this.requested.add(target);
        this.inFlight++;
        Promise.resolve()
            .then(() => target.load())
            .catch(() => this.requested.delete(target)) // un errore di rete non si ricorda: il prossimo intento (o il clic) riprova
            .finally(() => { this.inFlight--; });
    }
}
