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

/**
 * Menu contestuale su qualsiasi elemento (`[appContextMenu]`).
 *
 * L'overlay (creazione, posizionamento viewport-aware, dismiss su click-fuori ed Escape)
 * è gestito da **CDK Overlay**. Resta custom solo la UX di apertura: right-click su desktop
 * (popover al cursore) e long-press su touch (bottom-sheet), con soppressione del click
 * sintetico che il browser emette dopo un long-press.
 */
@Directive({
    selector: '[appContextMenu]',
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

    private openMenu(clientX: number, clientY: number, presentation: 'popover' | 'sheet'): void {
        this.close();

        // Elemento a cui restituire il focus alla chiusura (fallback all'host se activeElement è il body).
        const active = this.isBrowser ? document.activeElement : null;
        this.triggerEl = (active && active !== document.body) ? active : this.hostEl;

        // Popover → ancorato al punto del cursore con push nel viewport; sheet → centrato in basso.
        const positionStrategy = presentation === 'sheet'
            ? this.overlay.position().global().centerHorizontally()
                .bottom('max(0.75rem, env(safe-area-inset-bottom, 0px))')
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
                return;
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
