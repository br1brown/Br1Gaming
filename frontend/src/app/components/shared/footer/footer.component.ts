import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { FooterNavComponent } from '../../../core/engine/components/footer-nav/footer-nav.component';
import { ContestoSito } from '../../../site';
import { pickLocaleText } from '../../../core/engine/siteBuilder';
import { TranslateService } from '../../../core/engine/services/translate.service';

@Component({
    selector: 'app-footer',
    imports: [TranslatePipe, FooterNavComponent],
    templateUrl: './footer.component.html',
    host: { class: 'd-block mt-auto' }
})
export class FooterComponent {
    private readonly translate = inject(TranslateService);

    readonly appName = ContestoSito.config.appName;
    /** Descrizione del sito risolta sulla lingua corrente (reattiva al cambio lingua). */
    readonly description = computed(() => pickLocaleText(ContestoSito.config.description, this.translate.currentLang()));
    readonly currentYear = new Date().getFullYear();
    readonly footerNavLinks = ContestoSito.linkFooter;
}
