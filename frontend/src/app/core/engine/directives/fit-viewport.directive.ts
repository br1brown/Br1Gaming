import { afterNextRender, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';

/**
 * `appFitViewport` — porta l'altezza dell'elemento a riempire lo spazio che resta sotto di
 * esso fino in fondo al viewport, senza creare scroll verticale di pagina.
 *
 * Pensata per le pagine/viste a tutto schermo (mappe, giochi, dashboard) dove lo scroll
 * spezzerebbe l'esperienza e si vuole che l'interfaccia sia interamente visibile.
 *
 * COME calcola l'altezza — senza numeri magici:
 *   tutto-il-resto = scrollHeight della pagina − altezza di questo elemento
 *                    (navbar, footer, padding del main, banner inline... qualunque cosa ci sia)
 *   altezza = innerHeight − tutto-il-resto   (con un minimo per gli schermi molto bassi)
 * Così "questo elemento + tutto il resto" = esattamente il viewport → nessuno scroll. Si
 * autoregola: footer presente o no, navbar più alta, cambio orientamento — si riadatta da sé.
 *
 * Per misurare "tutto-il-resto" l'elemento viene portato per un istante (sincrono, prima del
 * paint) a un'altezza-sonda di 2×viewport: così la pagina deborda di sicuro e scrollHeight non
 * è clampato all'altezza del viewport — senza sonda, su una pagina che non scrolla, il calcolo
 * restituirebbe l'altezza attuale e l'elemento non si adatterebbe mai.
 *
 * Ricalcola a ogni resize/orientationchange (listener host: Angular li registra/rimuove e non
 * scattano in SSR) e a ogni cambio di struttura del DOM (MutationObserver su body): se la
 * pagina cambia vista dopo il primo render — un @if che mostra il gioco, un banner che
 * compare/scompare — l'altezza si riadatta invece di restare quella misurata all'inizio.
 * `afterNextRender` gira solo nel browser, quindi niente guardia isBrowser.
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
    private readonly destroyRef = inject(DestroyRef);

    constructor() {
        afterNextRender(() => {
            this.fit();
            // Solo childList: i cambi di vista sono aggiunte/rimozioni di nodi; testo che si
            // aggiorna (timer, contatori) e attributi (incluso lo style che scrive fit stessa)
            // non fanno scattare ricalcoli.
            const observer = new MutationObserver(() => this.fit());
            observer.observe(document.body, { childList: true, subtree: true });
            this.destroyRef.onDestroy(() => observer.disconnect());
        });
    }

    protected fit(): void {
        const node = this.el.nativeElement;
        const probe = window.innerHeight * 2;
        node.style.height = `${probe}px`;
        const others = document.documentElement.scrollHeight - node.getBoundingClientRect().height;
        const h = Math.max(this.appFitViewportMin(), Math.round(window.innerHeight - others));
        node.style.height = `${h}px`;
    }
}
