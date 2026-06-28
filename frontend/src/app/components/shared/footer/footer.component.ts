import { Component, computed, inject } from '@angular/core';
import { IdentityService } from '../../../core/engine/services/identity.service';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { LoadingComponent } from '../loading/loading.component';
import { IdentityRenderComponent } from '../identity-render/identity-render.component';
import { FooterNavComponent } from '../../../core/engine/components/footer-nav/footer-nav.component';
import { ContestoSito } from '../../../site';
import { pickLocaleText } from '../../../core/engine/siteBuilder';
import { TranslateService } from '../../../core/engine/services/translate.service';

@Component({
    selector: 'app-footer',
    imports: [TranslatePipe, LoadingComponent, IdentityRenderComponent, FooterNavComponent],
    templateUrl: './footer.component.html',
    host: { class: 'd-block mt-auto' }
})
export class FooterComponent {
    private readonly identityService = inject(IdentityService);
    private readonly translate = inject(TranslateService);

    // Identità dalla risorsa condivisa dell'engine: un solo fetch per tutta l'app, e regge i siti
    // che non espongono /identity (identity() è null → niente dati né social, sezione nascosta).
    // I social li rende l'app-identity-render col flag showSocial: sono dati d'identità, non del footer.
    readonly identity = this.identityService.identity;
    readonly identityLoading = this.identityService.loading;

    readonly appName = ContestoSito.config.appName;
    /** Descrizione del sito risolta sulla lingua corrente (reattiva al cambio lingua). */
    readonly description = computed(() => pickLocaleText(ContestoSito.config.description, this.translate.currentLang()));
    readonly currentYear = new Date().getFullYear();
    readonly footerNavLinks = ContestoSito.linkFooter;
}
