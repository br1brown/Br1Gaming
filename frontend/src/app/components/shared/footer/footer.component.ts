import { Component, computed, inject } from '@angular/core';
import { Profile } from '../../../core/engine/dto/profile.dto';
import { ApiService } from '../../../core/services/api.service';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { SocialLinkComponent } from '../navigation/social-link/social-link.component';
import { LoadingComponent } from '../loading/loading.component';
import { ProfileRenderComponent } from '../profile-render/profile-render.component';
import { FooterNavComponent } from '../../../core/engine/components/footer-nav/footer-nav.component';
import { ContestoSito } from '../../../site';
import { pickLocaleText } from '../../../core/engine/siteBuilder';
import { TranslateService } from '../../../core/engine/services/translate.service';

interface SocialLinkVm {
    type: string;
    value: string;
}

@Component({
    selector: 'app-footer',
    imports: [TranslatePipe, SocialLinkComponent, LoadingComponent, ProfileRenderComponent, FooterNavComponent],
    templateUrl: './footer.component.html',
    host: { class: 'd-block mt-auto' }
})
export class FooterComponent {
    private readonly api = inject(ApiService);
    private readonly translate = inject(TranslateService);

    private readonly profileResource = this.api.getProfileResource();
    // `httpResource.value()` lancia quando la risorsa e' in stato d'errore (es. 404 su un
    // progetto senza endpoint /profile): leggiamo il valore solo quando c'e' davvero,
    // altrimenti null. Cosi' il footer regge anche i siti che non espongono un profilo.
    readonly profile = computed<Profile | null>(() => this.profileResource.hasValue() ? this.profileResource.value() ?? null : null);
    readonly profileLoading = this.profileResource.isLoading;

    readonly appName = ContestoSito.config.appName;
    /** Descrizione del sito risolta sulla lingua corrente (reattiva al cambio lingua). */
    readonly description = computed(() => pickLocaleText(ContestoSito.config.description, this.translate.currentLang()));
    readonly currentYear = new Date().getFullYear();
    readonly footerNavLinks = ContestoSito.linkFooter;

    readonly socialLinks = computed<SocialLinkVm[]>(() => {
        const social = this.profile()?.social;
        if (!social) return [];

        return Object.entries(social)
            .filter((entry): entry is [string, string] => {
                const value = entry[1];
                return typeof value === 'string' && value.trim().length > 0;
            })
            .map(([type, value]) => ({
                type: type.toLowerCase(),
                value
            }));
    });
}
