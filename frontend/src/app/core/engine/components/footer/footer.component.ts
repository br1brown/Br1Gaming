import { Component, computed, inject } from '@angular/core';
import { MarkdownLitePipe } from '../../pipes/markdown-lite.pipe';
import { FooterNavComponent } from '../footer-nav/footer-nav.component';
import { FooterLinkRowComponent } from '../footer-link-row/footer-link-row.component';
import { ContestoSito } from '../../../../site';
import { pickLocaleText } from '../../siteBuilder';
import { filterFooterByAuth } from '../../shell-nav';
import { ShellNavService } from '../../services/shell-nav.service';
import { TranslateService } from '../../services/translate.service';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-footer',
    imports: [MarkdownLitePipe, FooterNavComponent, FooterLinkRowComponent],
    templateUrl: './footer.component.html',
    host: { class: 'd-block mt-auto' }
})
export class FooterComponent {
    private readonly translate = inject(TranslateService);
    private readonly auth = inject(AuthService);
    private readonly shellNav = inject(ShellNavService);

    /** Descrizione del sito risolta sulla lingua corrente (reattiva al cambio lingua). */
    readonly description = computed(() => pickLocaleText(ContestoSito.config.description, this.translate.currentLang()));
    /** Riga "small print" (default `© {anno} **{appName}** | {dirittiRiservatiAzienda}`, markdownLite
     *  nel template): vedi `ShellNavResolver.footerCopyright`/`defaultFooterCopyright` per l'override. */
    readonly footerCopyright = this.shellNav.footerCopyright;
    /** Filtra le voci/gruppi `authOnly` in base al login corrente — stesso meccanismo della
     *  navbar (`filterNavByAuth`), qui via `AuthService` (facciata di Dominio) invece del
     *  `TokenService` d'Engine, come già fa `user-nav.component.ts`. */
    readonly footerNavLinks = computed(() => filterFooterByAuth(this.shellNav.footer(), this.auth.isLoggedIn()));
    /** Pagine legali (Privacy/Cookie/TOS/Note Legali/Accessibilità) auto-derivate da `config.legalPages`:
     *  vedi `FooterLinkRowComponent` per il perché di una fascia a sé invece di un'altra colonna.
     *  Vuota se il resolver del footer ha chiamato `f.hideLegalStrip()` — chi piazza le pagine legali
     *  a mano in un gruppo custom (stesso `config.legalPages`, via `addPage`) evita così il doppione. */
    readonly legalFooterLinks = computed(() =>
        this.shellNav.hideLegalStrip() ? [] : ContestoSito.getLegalFooterLinks(this.translate.currentLang()));
}
