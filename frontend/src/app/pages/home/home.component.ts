import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { GeneratorsSectionComponent } from '../../components/shared/generators-section/generators-section.component';
import { StoriesSectionComponent } from '../../components/shared/stories-section/stories-section.component';
import { GamesSectionComponent } from '../../components/shared/games-section/games-section.component';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { SITE_CONFIG } from '../../core/engine/siteBuilder';

@Component({
    selector: 'app-home',
    imports: [TranslatePipe, GeneratorsSectionComponent, StoriesSectionComponent, GamesSectionComponent],
    templateUrl: './home.component.html',
})
export class HomeComponent extends PageBaseComponent<unknown> {
    /** Nome del sito dalla config (niente stringhe hardcoded nell'hero). */
    protected readonly appName = inject(SITE_CONFIG).appName;
    /** Slot per lo scheletro del @placeholder (idratazione incrementale delle sezioni sotto la piega). */
    protected readonly skeletonSlots = [0, 1, 2];
}
