import { Component } from '@angular/core';
import { PageBaseComponent } from '../page-base.component';
import { SiteMapComponent } from '../../components/site-map/site-map.component';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** La pagina «Mappa del sito» che l'Engine aggiunge da sé (WCAG 2.4.5): titolo e `<app-site-map />`. Si spegne con `legal.siteMap: false`. */
@Component({
    selector: 'app-site-map-page',
    imports: [SiteMapComponent, TranslatePipe],
    template: `
        <h1 class="mb-4">{{ 'siteMapMenu' | translate }}</h1>
        <app-site-map />
    `,
})
export class SiteMapPageComponent extends PageBaseComponent<void> { }
