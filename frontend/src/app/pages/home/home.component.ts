import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { SimulatorsHeroComponent } from './simulators-hero/simulators-hero.component';
import { GeneratorHubComponent } from '../../components/shared/generator-hub/generator-hub.component';
import { TranslatorWidgetComponent } from '../../components/shared/translator-widget/translator-widget.component';
import { RadarWidgetComponent } from '../../components/shared/radar-widget/radar-widget.component';
import { DilemmaSectionComponent } from './dilemma-section/dilemma-section.component';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { SITE_CONFIG } from '../../core/engine/siteBuilder';

/**
 * Home: Bento Grid a blocchi (redesign BR1-UI/BR1-DEV) al posto della vecchia lista Generatori →
 * Storie/Giochi → Utility. I 4 moduli (simulatori, hub generatori, micro-tool, dilemma narrativo)
 * sono componenti indipendenti, ciascuno si carica i propri dati da sé — la home resta solo
 * l'orchestratore del layout. `@defer (hydrate on viewport)` su tutto ciò che non è above-the-fold,
 * come nella versione precedente.
 */
@Component({
    selector: 'app-home',
    imports: [
        TranslatePipe,
        SimulatorsHeroComponent,
        GeneratorHubComponent,
        TranslatorWidgetComponent,
        RadarWidgetComponent,
        DilemmaSectionComponent,
    ],
    templateUrl: './home.component.html',
    styleUrl: './home.component.css',
})
export class HomeComponent extends PageBaseComponent<unknown> {
    /** Nome del sito dalla config (niente stringhe hardcoded nell'hero). */
    protected readonly appName = inject(SITE_CONFIG).appName;
}
