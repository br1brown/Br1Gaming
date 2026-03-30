import { afterNextRender, Directive, ElementRef, inject, input } from '@angular/core';

/**
 * `appFitViewport` — porta l'altezza dell'elemento a riempire lo spazio che resta sotto di
 * esso fino in fondo al viewport, senza creare scroll verticale di pagina.
 *
 * Pensata per le pagine/viste a tutto schermo (mappe, giochi, dashboard) dove lo scroll
 * spezzerebbe l'esperienza e si vuole che l'interfaccia sia interamente visibile.
 *
 * COME calcola l'altezza — senza numeri magici:
 *   tutto-il-resto = scrollHeight della pagina − altezza attuale di questo elemento
 *                    (navbar, footer, padding del main, banner inline... qualunque cosa ci sia)
 *   altezza = innerHeight − tutto-il-resto   (con un minimo per gli schermi molto bassi)
 * Così "questo elemento + tutto il resto" = esattamente il viewport → nessuno scroll. Si
 * autoregola: footer presente o no, navbar più alta, cambio orientamento — si riadatta da sé.
 *
 * Ricalcola a ogni resize/orientationchange (listener host: Angular li registra/rimuove e non
 * scattano in SSR). `afterNextRender` gira solo nel browser, quindi niente guardia isBrowser.
 *
 * Uso:
 *   <section appFitViewport>...</section>
 *   <section appFitViewport [appFitViewportMin]="400">...</section>
 */
@Directive({
    selector: '[appFitViewport]',
    host: {
        '(window:resize)': 'fit()',
        '(window:orientationchange)': 'fit()',
    },
})
export class FitViewportDirective {
    /** Altezza minima in px: sotto questa soglia non si scende (schermi molto bassi → si accetta lo scroll). */
    readonly appFitViewportMin = input(320);

    private readonly el = inject(ElementRef) as ElementRef<HTMLElement>;

    constructor() {
        afterNextRender(() => this.fit());
    }

    protected fit(): void {
        const node = this.el.nativeElement;
        const others = document.documentElement.scrollHeight - node.getBoundingClientRect().height;
        const h = Math.max(this.appFitViewportMin(), Math.round(window.innerHeight - others));
        node.style.height = `${h}px`;
    }
}
