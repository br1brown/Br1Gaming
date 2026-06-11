import { Directive, ElementRef, inject, OnInit, Renderer2 } from '@angular/core';

/**
 * `appFitViewport` — rende l'elemento "schermo-friendly": riempie lo spazio che resta
 * sotto la navbar fino in fondo al viewport, senza scroll di pagina quando il contenuto
 * ci sta. Se il contenuto è più alto del viewport, l'elemento cresce con lui e la pagina
 * scorre normalmente: niente parti tagliate o irraggiungibili.
 *
 * COME: nessuna misura in JS. app-root è già una colonna flex alta min-100vh col <main>
 * che cresce (flex-grow-1): la direttiva risale dall'elemento fino a quel <main> e rende
 * ogni anello intermedio (host del componente, col, row...) una colonna flex che cresce.
 * Da lì è layout nativo del browser: si riadatta da sé a resize, rotazione, navbar più
 * alta, banner che compaiono — senza listener né osservatori.
 *
 * Gira in ngOnInit, quindi anche in SSR: gli stili inline escono già nell'HTML
 * renderizzato e il primo paint è corretto (niente salti).
 *
 * Nota: gli anelli intermedi diventano colonne flex. L'elemento è pensato per viste a
 * tutto schermo (mappe, giochi, dashboard), da solo nella propria gerarchia di pagina.
 *
 * Uso:
 *   <section appFitViewport>...</section>
 */
@Directive({ selector: '[appFitViewport]' })
export class FitViewportDirective implements OnInit {
    private readonly el = inject(ElementRef) as ElementRef<HTMLElement>;
    private readonly renderer = inject(Renderer2);

    ngOnInit(): void {
        const host = this.el.nativeElement;
        this.renderer.setStyle(host, 'flex', '1 1 auto');
        let node = host.parentElement;
        while (node && node.tagName !== 'BODY') {
            this.renderer.setStyle(node, 'display', 'flex');
            this.renderer.setStyle(node, 'flex-direction', 'column');
            // Il <main> del guscio app cresce già da sé (flex-grow-1): la catena è completa.
            if (node.tagName === 'MAIN' && node.id === 'main-content') break;
            this.renderer.setStyle(node, 'flex', '1 1 auto');
            node = node.parentElement;
        }
    }
}
