import { Component, DestroyRef, ElementRef, PLATFORM_ID, afterNextRender, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** Per quanto resta visibile "Connessione ripristinata" prima di sparire da solo. */
const RIPRISTINO_VISIBILE_MS = 4000;

/** Stato di rete del browser: fascia in fondo quando la rete cade, "Connessione ripristinata" al
 *  ritorno. Distinto dall'errore API — un backend giù e un telefono senza rete sono cose diverse.
 *  Scrive la propria altezza in `--bottomBarOffset` così i FAB non finiscono coperti. */
@Component({
    selector: 'app-offline-banner',
    imports: [TranslatePipe],
    templateUrl: './offline-banner.component.html',
    styleUrl: './offline-banner.component.scss',
})
export class OfflineBannerComponent {
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private readonly destroyRef = inject(DestroyRef);
    private ripristinoTimer: ReturnType<typeof setTimeout> | null = null;

    /** `'offline'` finché la rete manca, `'ripristinato'` per pochi secondi al ritorno, poi `null`. */
    readonly stato = signal<'offline' | 'ripristinato' | null>(null);
    private readonly bannerEl = viewChild<ElementRef<HTMLElement>>('bannerEl');

    constructor() {
        if (!this.isBrowser) return;
        // Altezza reale della fascia (il testo può andare a capo) → --bottomBarOffset, tolta quando sparisce.
        const rootStyle = document.documentElement.style;
        effect((onCleanup) => {
            const el = this.bannerEl()?.nativeElement;
            if (!el) { rootStyle.removeProperty('--bottomBarOffset'); return; }
            const write = (): void => rootStyle.setProperty('--bottomBarOffset', `${el.offsetHeight}px`);
            untracked(write);
            const observer = new ResizeObserver(write);
            observer.observe(el);
            onCleanup(() => observer.disconnect());
        });
        this.destroyRef.onDestroy(() => rootStyle.removeProperty('--bottomBarOffset'));
        afterNextRender(() => {
            const onOffline = (): void => {
                this.cancellaTimer();
                this.stato.set('offline');
            };
            const onOnline = (): void => {
                // Solo se c'era stato un "offline": al primo render con rete non c'è niente da annunciare.
                if (this.stato() !== 'offline') return;
                this.stato.set('ripristinato');
                this.ripristinoTimer = setTimeout(() => this.stato.set(null), RIPRISTINO_VISIBILE_MS);
            };
            if (!navigator.onLine) onOffline();
            window.addEventListener('offline', onOffline);
            window.addEventListener('online', onOnline);
            this.destroyRef.onDestroy(() => {
                window.removeEventListener('offline', onOffline);
                window.removeEventListener('online', onOnline);
                this.cancellaTimer();
            });
        });
    }

    private cancellaTimer(): void {
        if (this.ripristinoTimer !== null) clearTimeout(this.ripristinoTimer);
        this.ripristinoTimer = null;
    }
}
