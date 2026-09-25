import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { SimulatorsHeroComponent } from './simulators-hero/simulators-hero.component';
import { TranslatorWidgetComponent } from '../../components/shared/translator-widget/translator-widget.component';
import { RadarWidgetComponent } from '../../components/shared/radar-widget/radar-widget.component';
import { LombrosoWidgetComponent } from '../../components/shared/lombroso-widget/lombroso-widget.component';
import { DilemmaSectionComponent } from './dilemma-section/dilemma-section.component';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { SITE_CONFIG } from '../../core/engine/siteBuilder';

/**
 * Home: Bento Grid a blocchi (redesign BR1-UI/BR1-DEV). Riga 1: i due simulatori + l'accesso ai
 * Generatori (tre launcher pari peso, dentro SimulatorsHeroComponent). Riga 2: i micro-tool
 * (traduttore, radar chiese, Lombroso Scanner). L'hub Generatori interattivo (jukebox) NON vive
 * più qui: era ridondante con la tile "Generatori" sopra + la pagina /generatori dedicata
 * (GeneratorsSectionComponent), che resta l'unico posto con la vista completa/interattiva.
 * Ogni modulo si carica i propri dati da sé — la home resta solo l'orchestratore del layout.
 * `@defer (hydrate on viewport)` su tutto ciò che non è above-the-fold.
 */
@Component({
    selector: 'app-home',
    imports: [
        TranslatePipe,
        SimulatorsHeroComponent,
        TranslatorWidgetComponent,
        RadarWidgetComponent,
        LombrosoWidgetComponent,
        DilemmaSectionComponent,
    ],
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss',
})
export class HomeComponent extends PageBaseComponent<unknown> {
    /** Nome del sito dalla config (niente stringhe hardcoded nell'hero). */
    protected readonly appName = inject(SITE_CONFIG).appName;
}
