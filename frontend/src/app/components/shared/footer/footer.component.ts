import { Component, computed, inject } from '@angular/core';
import { IdentityService } from '../../../core/engine/services/identity.service';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { LoadingComponent } from '../loading/loading.component';
import { IdentityRenderComponent } from '../identity-render/identity-render.component';
import { FooterNavComponent } from '../../../core/engine/components/footer-nav/footer-nav.component';
import { FooterLinkRowComponent } from '../../../core/engine/components/footer-link-row/footer-link-row.component';
import { ContestoSito } from '../../../site';
import { filterNavByAuth, pickLocaleText } from '../../../core/engine/siteBuilder';
import { TranslateService } from '../../../core/engine/services/translate.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-footer',
    imports: [TranslatePipe, LoadingComponent, IdentityRenderComponent, FooterNavComponent, FooterLinkRowComponent],
    templateUrl: './footer.component.html',
    host: { class: 'd-block mt-auto' }
})
export class FooterComponent {
    private readonly identityService = inject(IdentityService);
    private readonly translate = inject(TranslateService);
    private readonly auth = inject(AuthService);

    // Identità dalla risorsa condivisa dell'engine: un solo fetch per tutta l'app, e regge i siti
    // che non espongono /identity (identity() è null → niente dati né social, sezione nascosta).
    // I social li rende l'app-identity-render col flag showSocial: sono dati d'identità, non del footer.
    readonly identity = this.identityService.identity;
    readonly identityLoading = this.identityService.loading;

    readonly appName = ContestoSito.config.appName;
    /** Descrizione del sito risolta sulla lingua corrente (reattiva al cambio lingua). */
    readonly description = computed(() => pickLocaleText(ContestoSito.config.description, this.translate.currentLang()));
    readonly currentYear = new Date().getFullYear();
    /** Filtra le voci/gruppi `authOnly` in base al login corrente — stesso meccanismo della
     *  navbar (`filterNavByAuth`), qui via `AuthService` (facciata di Dominio) invece del
     *  `TokenService` d'Engine, come già fa `user-nav.component.ts`. */
    readonly footerNavLinks = computed(() => filterNavByAuth(ContestoSito.getLinkFooter(this.translate.currentLang()), this.auth.isLoggedIn()));
    /** Pagine legali (Privacy/Cookie/TOS/Note Legali/Accessibilità) auto-derivate da `config.legalPages`:
     *  vedi `FooterLinkRowComponent` per il perché di una fascia a sé invece di un'altra colonna. */
    readonly legalFooterLinks = computed(() => ContestoSito.getLegalFooterLinks(this.translate.currentLang()));
}
