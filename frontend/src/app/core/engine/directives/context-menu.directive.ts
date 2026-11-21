import {
    DestroyRef,
    Directive,
    ElementRef,
    PLATFORM_ID,
    inject,
    input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ContextMenuOption } from '../components/context-menu/context-menu.models';
import { ContextMenuOverlayComponent } from '../components/context-menu/context-menu-overlay.component';

/** Menu contestuale su qualsiasi elemento (`[appContextMenu]`). L'overlay (creazione,
 *  posizionamento viewport-aware, dismiss su click-fuori/Escape) è gestito da CDK Overlay; resta
 *  custom solo la UX di apertura: right-click su desktop, long-press su touch (con soppressione
 *  del click sintetico che il browser emette dopo il long-press).
 *
 *  Il menu si apre anche da codice, ancorato a un elemento, con `openFromElement()` (`exportAs: 'appContextMenu'`):
 *  è ciò che usa `app-action-menu` per il bottone «⋮», che si scopre da solo (tasto destro e long-press no). */
@Directive({
    selector: '[appContextMenu]',
    exportAs: 'appContextMenu',
    standalone: true,
    host: {
        '(contextmenu)': 'onContextMenu($event)',
        '(pointerdown)': 'onPointerDown($event)',
        '(pointermove)': 'onPointerMove($event)',
        '(pointerup)': 'onPointerUp($event)',
        '(pointercancel)': 'onPointerCancel($event)',
    },
})
export class ContextMenuDirective {
    readonly options = input<ContextMenuOption[]>([], { alias: 'appContextMenu' });

    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private readonly overlay = inject(Overlay);
    private readonly hostEl = inject(ElementRef).nativeElement as HTMLElement;

    private overlayRef: OverlayRef | null = null;
    private triggerEl: Element | null = null;
    /** L'elemento a cui è ancorato il menu aperto con `openFromElement()`: un clic su di lui lo chiude, non lo riapre. */
    private anchorEl: HTMLElement | null = null;
    private suppressReopen = false;
    private longPressTimer: number | null = null;
    private suppressNextClickTimer: number | null = null;
    private pointerOrigin: { x: number; y: number } | null = null;
    private suppressNextContextMenu = false;
    private suppressNextClick = false;
    private readonly longPressDelayMs = 450;
    private readonly touchMoveThresholdPx = 12;
    /** Finestra di sicurezza per il click sintetico post-pointerup: oltre questa il flag si azzera. */
    private readonly suppressClickWindowMs = 600;

    constructor() {
        inject(DestroyRef).onDestroy(() => this.close());
    }

    onContextMenu(event: MouseEvent): void {
        if (!this.isBrowser) return;

        if (this.suppressNextContextMenu) {
            this.suppressNextContextMenu = false;
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        // Touch primario (mobile reale, DevTools device mode): il contextmenu arriva da long-press
        // → bottom sheet a tutta larghezza, più adatto al pollice e ai testi lunghi.
        const isCoarse = window.matchMedia('(pointer: coarse)').matches;
        this.openMenu(event.clientX, event.clientY, isCoarse ? 'sheet' : 'popover');
    }

    /**
     * Pointer Events unificati: touch reale, penna ed emulazione touch di DevTools.
     * Il mouse "vero" (pointerType === 'mouse') è ignorato qui — usa `(contextmenu)`.
     */
    onPointerDown(event: PointerEvent): void {
        if (!this.isBrowser || this.options().length === 0) return;
        if (event.pointerType === 'mouse') return;

        this.pointerOrigin = { x: event.clientX, y: event.clientY };
        this.clearLongPressTimer();
        this.longPressTimer = window.setTimeout(() => {
            if (!this.pointerOrigin) return;

            this.suppressNextContextMenu = true;
            // Dopo pointerup su touch il browser emette un click sintetico sull'elemento
            // originale, che chiuderebbe subito il menu: lo ignoriamo una volta.
            this.armSuppressNextClick();
            this.openMenu(this.pointerOrigin.x, this.pointerOrigin.y, 'sheet');
        }, this.longPressDelayMs);
    }

    onPointerMove(event: PointerEvent): void {
        if (!this.pointerOrigin || event.pointerType === 'mouse') return;

        const movedX = Math.abs(event.clientX - this.pointerOrigin.x);
        const movedY = Math.abs(event.clientY - this.pointerOrigin.y);
        if (movedX > this.touchMoveThresholdPx || movedY > this.touchMoveThresholdPx) {
            this.clearLongPressState();
        }
    }

    onPointerUp(event: PointerEvent): void {
        if (event.pointerType === 'mouse') return;
        this.clearLongPressState();
    }

    onPointerCancel(event: PointerEvent): void {
        if (event.pointerType === 'mouse') return;
        this.clearLongPressState();
    }

    /**
     * Apre il menu ancorato a un elemento (di norma l'host stesso, un bottone «⋮»): un popover attaccato al bottone, sotto di lui e allineato al suo bordo
     * destro (sopra, se sotto non c'è posto), su desktop come su touch. Il bottom sheet resta per il tasto destro e la pressione lunga, dove non c'è un bottone
     * da cui il menu possa «uscire»: qui, in fondo allo schermo, non si capirebbe da dove arriva.
     * Un secondo clic sull'elemento mentre il menu è aperto lo chiude (il clic fuori lo chiude già: qui non lo si riapre nello stesso gesto).
     */
    openFromElement(anchor: HTMLElement = this.hostEl): void {
        if (!this.isBrowser || this.options().length === 0 || this.suppressReopen) return;
        const r = anchor.getBoundingClientRect();
        this.openMenu(r.left, r.bottom, 'popover', anchor);
        this.anchorEl = anchor;
    }

    private openMenu(clientX: number, clientY: number, presentation: 'popover' | 'sheet', anchor?: HTMLElement): void {
        this.close();

        // Elemento a cui restituire il focus alla chiusura (fallback all'host se activeElement è il body).
        const active = this.isBrowser ? document.activeElement : null;
        this.triggerEl = (active && active !== document.body) ? active : this.hostEl;

        // Popover → ancorato al punto del cursore (o al bottone che lo apre) con push nel viewport; sheet → centrato in basso.
        const positionStrategy = presentation === 'sheet'
            ? this.overlay.position().global().centerHorizontally()
                .bottom('max(0.75rem, env(safe-area-inset-bottom, 0px))')
            : anchor
            // Aperto da un bottone: attaccato a lui, allineato al suo bordo destro (il «⋮» sta di solito a destra), sopra se sotto non c'è posto.
            ? this.overlay.position()
                .flexibleConnectedTo(anchor)
                .withFlexibleDimensions(false)
                .withPush(true)
                .withPositions([
                    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
                    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
                    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
                    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
                ])
            : this.overlay.position()
                .flexibleConnectedTo({ x: clientX, y: clientY })
                .withFlexibleDimensions(false)
                .withPush(true)
                .withPositions([
                    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'top' },
                    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'bottom' },
                    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'top' },
                    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'bottom' },
                ]);

        this.overlayRef = this.overlay.create({
            positionStrategy,
            scrollStrategy: this.overlay.scrollStrategies.reposition(),
            hasBackdrop: false,
            disposeOnNavigation: true,
        });

        const ref = this.overlayRef.attach(new ComponentPortal(ContextMenuOverlayComponent));
        ref.setInput('options', this.options());
        ref.setInput('presentation', presentation);

        ref.instance.optionSelected.subscribe((option: ContextMenuOption) => {
            option.action?.();
            this.close();
        });
        ref.instance.menuDismissed.subscribe(() => this.close());
        ref.instance.focusFirst();

        // Dismiss su click/tap fuori; soppressione del click sintetico post long-press (touch).
        this.overlayRef.outsidePointerEvents().subscribe((e) => {
            if (this.suppressNextClick && e.type === 'click') {
                this.clearSuppressNextClick();
                // Il click sintetico del rilascio, se cade sul «⋮» stesso, arriverebbe dopo a `openFromElement` e sostituirebbe il foglio appena aperto col popover.
                this.suppressReopen = true;
                setTimeout(() => { this.suppressReopen = false; });
                return;
            }
            // Il tasto destro che ha aperto il menu fa seguire un `auxclick` sull'host: CDK lo conta come «clic fuori» e lo richiuderebbe subito.
            if (e.type === 'auxclick' && this.hostEl.contains(e.target as Node)) return;
            // Il clic sul bottone che ha aperto il menu lo chiude, e il suo `(click)` non deve riaprirlo nello stesso gesto.
            if (this.anchorEl?.contains(e.target as Node)) {
                this.suppressReopen = true;
                setTimeout(() => { this.suppressReopen = false; });
            }
            this.close();
        });
        this.overlayRef.keydownEvents().subscribe((e) => {
            if (e.key === 'Escape') this.close();
        });
    }

    private clearLongPressTimer(): void {
        if (this.longPressTimer !== null) {
            window.clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    private armSuppressNextClick(): void {
        this.suppressNextClick = true;
        if (this.suppressNextClickTimer !== null) {
            window.clearTimeout(this.suppressNextClickTimer);
        }
        this.suppressNextClickTimer = window.setTimeout(
            () => this.clearSuppressNextClick(),
            this.suppressClickWindowMs,
        );
    }

    private clearSuppressNextClick(): void {
        this.suppressNextClick = false;
        if (this.suppressNextClickTimer !== null) {
            window.clearTimeout(this.suppressNextClickTimer);
            this.suppressNextClickTimer = null;
        }
    }

    private clearLongPressState(): void {
        this.clearLongPressTimer();
        this.pointerOrigin = null;
    }

    private close(): void {
        this.clearLongPressState();
        if (this.overlayRef) {
            this.suppressNextContextMenu = false;
            this.clearSuppressNextClick();
            this.overlayRef.dispose(); // completa anche outsidePointerEvents/keydownEvents
            this.overlayRef = null;
            this.anchorEl = null;

            // Ripristina il focus al trigger (tabindex="-1" temporaneo se non nativamente focusabile).
            if (this.triggerEl) {
                const el = this.triggerEl as HTMLElement;
                const addedTabIndex = !el.hasAttribute('tabindex');
                if (addedTabIndex) el.setAttribute('tabindex', '-1');
                el.focus({ preventScroll: true });
                if (addedTabIndex) el.removeAttribute('tabindex');
            }
            this.triggerEl = null;
        }
    }
}
