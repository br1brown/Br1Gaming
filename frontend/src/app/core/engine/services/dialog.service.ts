import { Injectable, TemplateRef, Type, ViewContainerRef, inject } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, TemplatePortal } from '@angular/cdk/portal';

export interface DialogOptions {
    /** Elemento a cui ridare il focus alla chiusura: di norma il bottone che ha aperto il dialog. */
    returnFocusTo?: HTMLElement | null;
    /** Per un `TemplateRef`: il `ViewContainerRef` del componente che lo dichiara. */
    viewContainerRef?: ViewContainerRef;
    /** Input iniziali di un componente (`setInput`), es. `{ source, alt }`. */
    inputs?: Record<string, unknown>;
    /** Chiamato prima di chiudere (Escape, backdrop o `close()`): `false` tiene il dialog aperto —
     *  es. modifiche non salvate, con la domanda "Salva / Non salvare / Annulla" dentro. */
    canClose?: () => boolean | Promise<boolean>;
    /** Focus iniziale: `'auto'` (default: `[cdkFocusInitial]`, `[autofocus]`, `.btn-close`, poi il
     *  primo elemento focusabile) oppure `'none'` quando è il contenuto a deciderlo (es. un campo che
     *  compare solo a dati arrivati). */
    initialFocus?: 'auto' | 'none';
}

export interface DialogRef<T = unknown> {
    /** Istanza del componente montato; `null` per un template. */
    readonly instance: T | null;
    readonly overlayRef: OverlayRef;
    /** Chiude rispettando `canClose`; risolve `true` se il dialog si è chiuso davvero. */
    close(): Promise<boolean>;
    /** Risolve alla chiusura, da qualunque via (anche la navigazione, che smonta l'overlay). */
    readonly afterClosed: Promise<void>;
}

const FOCUS_CANDIDATES = '[cdkFocusInitial], [autofocus], .btn-close, button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog modale su CDK Overlay in un solo posto: overlay centrato con backdrop scuro, scroll della
 * pagina bloccato, Escape e click sul backdrop che chiudono, focus di ritorno al trigger, smontaggio
 * alla navigazione. Il contenuto (componente o `<ng-template>`) resta al chiamante: gli basta una
 * `.card` con `role="dialog" aria-modal="true"` e `cdkTrapFocus` (vedi AGENTS.md §"Overlay/modali
 * custom"). Usato da `ImageLightboxService`; per un picker o una modale di progetto è lo stesso
 * `open()` — niente `Overlay.create()` ripetuto a mano.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
    private readonly overlay = inject(Overlay);

    open<T>(content: Type<T> | TemplateRef<unknown>, options: DialogOptions = {}): DialogRef<T> {
        const overlayRef = this.overlay.create({
            positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
            scrollStrategy: this.overlay.scrollStrategies.block(),
            hasBackdrop: true,
            backdropClass: 'cdk-overlay-dark-backdrop',
            disposeOnNavigation: true,
        });

        let instance: T | null = null;
        if (content instanceof TemplateRef) {
            if (!options.viewContainerRef) throw new Error('DialogService.open: un TemplateRef richiede viewContainerRef');
            overlayRef.attach(new TemplatePortal(content, options.viewContainerRef));
        } else {
            const ref = overlayRef.attach(new ComponentPortal(content));
            for (const [name, value] of Object.entries(options.inputs ?? {})) ref.setInput(name, value);
            instance = ref.instance;
        }

        let closing = false;
        let resolveClosed!: () => void;
        const afterClosed = new Promise<void>(resolve => { resolveClosed = resolve; });
        // Un solo punto di uscita, qualunque sia la via: dispose() esplicito o navigazione
        // (disposeOnNavigation). Qui il focus torna al trigger e afterClosed si risolve.
        overlayRef.detachments().subscribe(() => {
            options.returnFocusTo?.focus({ preventScroll: true });
            resolveClosed();
        });

        const close = async (): Promise<boolean> => {
            if (closing || !overlayRef.hasAttached()) return false;
            closing = true;
            try {
                if (options.canClose && !(await options.canClose())) return false;
            } finally {
                closing = false;
            }
            overlayRef.dispose(); // completa anche backdropClick/keydownEvents
            return true;
        };

        overlayRef.backdropClick().subscribe(() => void close());
        overlayRef.keydownEvents().subscribe(e => {
            if (e.key === 'Escape') void close();
        });

        if (options.initialFocus !== 'none') {
            // Dopo il primo paint: il contenuto del portale deve essere nel DOM.
            requestAnimationFrame(() => overlayRef.overlayElement.querySelector<HTMLElement>(FOCUS_CANDIDATES)?.focus());
        }

        return { instance, overlayRef, close, afterClosed };
    }
}
