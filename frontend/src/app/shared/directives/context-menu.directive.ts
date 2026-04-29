import {
    ComponentRef,
    Directive,
    HostListener,
    Input,
    OnDestroy,
    PLATFORM_ID,
    ViewContainerRef,
    inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { take } from 'rxjs/operators';
import { ContextMenuOption } from '../components/context-menu/context-menu.models';
import { ContextMenuOverlayComponent } from '../components/context-menu/context-menu-overlay.component';

/**
 * Directive per aggiungere un menu contestuale personalizzato a qualsiasi elemento.
 */
@Directive({
    selector: '[appContextMenu]',
    standalone: true
})
export class ContextMenuDirective implements OnDestroy {
    @Input('appContextMenu') options: ContextMenuOption[] = [];

    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private overlayRef: ComponentRef<ContextMenuOverlayComponent> | null = null;
    private destroyListeners: (() => void)[] = [];
    private longPressTimer: number | null = null;
    private touchOrigin: { x: number; y: number } | null = null;
    private suppressNextContextMenu = false;
    private readonly longPressDelayMs = 450;
    private readonly touchMoveThresholdPx = 12;

    constructor(private vcr: ViewContainerRef) {}

    @HostListener('contextmenu', ['$event'])
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

        this.openMenu(event.clientX, event.clientY, 'popover');
    }

    @HostListener('touchstart', ['$event'])
    onTouchStart(event: TouchEvent): void {
        if (!this.isBrowser || event.touches.length !== 1 || this.options.length === 0) {
            return;
        }

        const touch = event.touches[0];
        this.touchOrigin = { x: touch.clientX, y: touch.clientY };
        this.clearLongPressTimer();
        this.longPressTimer = window.setTimeout(() => {
            if (!this.touchOrigin) {
                return;
            }

            this.suppressNextContextMenu = true;
            this.openMenu(this.touchOrigin.x, this.touchOrigin.y, 'sheet');
        }, this.longPressDelayMs);
    }

    @HostListener('touchmove', ['$event'])
    onTouchMove(event: TouchEvent): void {
        if (!this.touchOrigin || event.touches.length !== 1) {
            this.clearLongPressState();
            return;
        }

        const touch = event.touches[0];
        const movedX = Math.abs(touch.clientX - this.touchOrigin.x);
        const movedY = Math.abs(touch.clientY - this.touchOrigin.y);
        if (movedX > this.touchMoveThresholdPx || movedY > this.touchMoveThresholdPx) {
            this.clearLongPressState();
        }
    }

    @HostListener('touchend')
    onTouchEnd(): void {
        this.clearLongPressState();
    }

    @HostListener('touchcancel')
    onTouchCancel(): void {
        this.clearLongPressState();
    }

    private openMenu(clientX: number, clientY: number, presentation: 'popover' | 'sheet'): void {
        this.close();

        this.overlayRef = this.vcr.createComponent(ContextMenuOverlayComponent);
        this.overlayRef.instance.options = this.options;
        this.overlayRef.instance.presentation = presentation;

        // Sposta l'overlay su document.body per evitare clipping da overflow/positioning
        const el = this.overlayRef.location.nativeElement;
        if (this.isBrowser) {
            document.body.appendChild(el);
        }

        this.overlayRef.instance.adjustPosition(clientX, clientY);

        // Sottoscrivi alla selezione di un'opzione
        this.overlayRef.instance.optionSelected.pipe(take(1)).subscribe((option: ContextMenuOption) => {
            option.action?.();
            this.close();
        });

        // Registra listener per chiusura (click fuori, escape, altro right-click)
        this.addCloseListeners(el);
    }

    private addCloseListeners(overlayEl: HTMLElement): void {
        if (!this.isBrowser) return;

        const onDocClick = (e: MouseEvent) => {
            if (!overlayEl.contains(e.target as Node)) {
                this.close();
            }
        };

        const onDocContext = (e: MouseEvent) => {
            const target = e.target as Node;
            // Se il target è l'elemento host, ci pensa @HostListener('contextmenu') — non interferire
            if ((this.vcr.element.nativeElement as HTMLElement).contains(target)) return;
            if (!overlayEl.contains(target)) {
                this.close();
            }
        };

        const onEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };

        document.addEventListener('click', onDocClick, true);
        document.addEventListener('contextmenu', onDocContext, true);
        document.addEventListener('keydown', onEscape);

        this.destroyListeners.push(
            () => document.removeEventListener('click', onDocClick, true),
            () => document.removeEventListener('contextmenu', onDocContext, true),
            () => document.removeEventListener('keydown', onEscape)
        );
    }

    private clearLongPressTimer(): void {
        if (this.longPressTimer !== null) {
            window.clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    private clearLongPressState(): void {
        this.clearLongPressTimer();
        this.touchOrigin = null;
    }

    private close(): void {
        this.clearLongPressState();
        if (this.overlayRef) {
            if (this.isBrowser) {
                this.overlayRef.location.nativeElement.remove();
            }
            this.overlayRef.destroy();
            this.overlayRef = null;
        }
        this.destroyListeners.forEach(fn => fn());
        this.destroyListeners = [];
    }

    ngOnDestroy(): void {
        this.close();
    }
}
