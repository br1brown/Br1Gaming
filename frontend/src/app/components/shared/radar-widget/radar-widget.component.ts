import { Component } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { PageDirective } from '../../../core/engine/directives/page.directive';
import { PageType } from '../../../site';

/** Blip statici sul quadrante: puramente decorativi (coordinate fisse, niente layout shift a ogni
 *  render). Il radar VERO — con la tua posizione e le chiese reali — vive nella pagina dedicata:
 *  qui niente `navigator.geolocation`, così la home non spara un prompt permessi non richiesto. */
const BLIPS = [
    { top: '28%', left: '62%', delay: '0s' },
    { top: '58%', left: '32%', delay: '.6s' },
    { top: '40%', left: '40%', delay: '1.1s' },
    { top: '68%', left: '66%', delay: '1.7s' },
];

/**
 * Gadget tattico "Radar Chiese" (BR1-UI §3.C): sonar verde fosforo animato via CSS/SVG, mock finché
 * non si apre la pagina dedicata — lì scatta la geolocalizzazione vera (già implementata in
 * `/radar`, che carica Mapbox lazy). Il micro-tool qui serve solo a comunicare il tono.
 */
@Component({
    selector: 'app-radar-widget',
    standalone: true,
    imports: [TranslatePipe, PageDirective],
    templateUrl: './radar-widget.component.html',
    styleUrl: './radar-widget.component.css',
})
export class RadarWidgetComponent {
    protected readonly PageType = PageType;
    protected readonly blips = BLIPS;
}
