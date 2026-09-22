import { Component } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { PageDirective } from '../../../core/engine/directives/page.directive';
import { PageType } from '../../../site';

/**
 * Gadget "Lombroso Scanner": stesso verde fosforo del radar (BR1-UI §3.C) — e della pagina
 * `/lombroso` stessa (`.lombroso-scan-line`, `#39ff14`), quindi già coerente prima di questo widget,
 * non una scelta nuova. Qui solo un mirino animato, mock finché non si apre la pagina dedicata (lì
 * scatta la fotocamera vera): stesso principio del radar, comunica il tono senza duplicarne la logica.
 */
@Component({
    selector: 'app-lombroso-widget',
    standalone: true,
    imports: [TranslatePipe, PageDirective],
    templateUrl: './lombroso-widget.component.html',
    styleUrl: './lombroso-widget.component.css',
})
export class LombrosoWidgetComponent {
    protected readonly PageType = PageType;
}
