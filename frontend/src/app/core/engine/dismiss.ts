import { DestroyRef, DOCUMENT, ElementRef, PLATFORM_ID, Signal, effect, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Opzioni di `injectDismiss`. */
export interface DismissOptions {
    /** Stato di apertura del pannello: mentre è `true` il pannello è in cima alla pila e ascolta. */
    open: Signal<boolean>;
    /** Chiude il pannello (Escape o click fuori). */
    close: () => void;
    /** Dove riportare il focus quando si chiude con Escape (di solito il bottone che l'ha aperto):
     *  letto al momento della chiusura, prima di `close()`. Il click fuori non sposta il focus. */
    returnFocus?: () => HTMLElement | null | undefined;
    /** Chiude al click fuori dall'host del componente. Default `true`. */
    outsideClick?: boolean;
}

interface Layer {
    close: () => void;
    returnFocus?: () => HTMLElement | null | undefined;
}

const stacks = new WeakMap<Document, Layer[]>();

/** Escape chiude solo il pannello più recente della pila (nested: prima il dropdown, poi il menu che
 *  lo contiene) e ridà il focus al trigger; clic fuori chiude. Non riguarda CDK Overlay, che ha un
 *  dispatcher proprio. Da chiamare in un injection context. */
export function injectDismiss(options: DismissOptions): void {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const doc = inject(DOCUMENT);
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    const stack = stackFor(doc);
    const layer: Layer = { close: options.close, returnFocus: options.returnFocus };

    const remove = (): void => {
        const i = stack.indexOf(layer);
        if (i !== -1) stack.splice(i, 1);
    };

    effect(() => {
        if (options.open()) {
            if (!stack.includes(layer)) stack.push(layer);
        } else {
            remove();
        }
    });

    if (options.outsideClick !== false) {
        const onClick = (event: MouseEvent): void => {
            if (options.open() && !host.contains(event.target as Node)) options.close();
        };
        doc.addEventListener('click', onClick);
        destroyRef.onDestroy(() => doc.removeEventListener('click', onClick));
    }
    destroyRef.onDestroy(remove);
}

function stackFor(doc: Document): Layer[] {
    let stack = stacks.get(doc);
    if (!stack) {
        const layers: Layer[] = [];
        stack = layers;
        stacks.set(doc, layers);
        // Un solo listener per documento: decide la pila, non l'ordine di registrazione dei componenti.
        doc.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            const top = layers.at(-1);
            if (!top) return;
            const target = top.returnFocus?.();
            top.close();
            if (target) returnFocusTo(target);
        });
    }
    return stack;
}

/** Il focus torna al trigger senza scroll automatico: un `focus()` semplice su un elemento sticky
 *  nella fascia coperta da `scroll-padding-top` lo farebbe scorrere per "scoprirlo". Solo se il
 *  trigger è davvero fuori schermo lo si riporta in vista (WCAG 2.4.7). */
function returnFocusTo(target: HTMLElement): void {
    target.focus({ preventScroll: true });
    requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const view = target.ownerDocument.defaultView;
        if (view && (rect.bottom <= 0 || rect.top >= view.innerHeight)) target.scrollIntoView({ block: 'nearest' });
    });
}
