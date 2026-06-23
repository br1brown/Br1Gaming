import { Component, computed, effect, inject, signal } from '@angular/core';
import { MarkdownPipe } from '../../core/engine/pipes/markdown.pipe';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { CookieConsentService, buildPhysicalCookieKey } from '../../core/engine/services/cookie-consent.service';
import { CookieCategory, CookieConfig, EngineCookieKey } from '../../core/engine/services/cookie/cookie-type';
import { COOKIE_MAP, type CookieKey } from '../../core/services/cookie-registry';
import { ProfileRenderComponent } from '../../components/shared/profile-render/profile-render.component';
import type { Profile } from '../../core/engine/dto/profile.dto';

@Component({
    selector: 'app-policy',
    imports: [MarkdownPipe, ProfileRenderComponent],
    templateUrl: './policy.component.html'
})
export class PolicyComponent extends PageBaseComponent<string> {
    private readonly cookieConsent = inject(CookieConsentService);

    readonly CookieCategory = CookieCategory;

    /** Profilo originale per il ProfileRenderComponent */
    readonly rawProfile = signal<Profile | null>(null);

    /** Flag per evitare fetch multipli in caso di errore */
    private readonly profileLoaded = signal(false);

    readonly cookieCategories = computed(() => {
        const categories: { key: CookieCategory; name: string; description: string }[] = [];
        if (this.cookieConsent.isTechnicalNeeded()) {
            categories.push({
                key: CookieCategory.Technical,
                name: this.translate.translate('tecniciCategoriaCookie'),
                description: this.translate.translate('tecniciDescrizioneCategoriaCookie')
            });
        }
        if (this.cookieConsent.isAnalyticsNeeded()) {
            categories.push({
                key: CookieCategory.Analytics,
                name: this.translate.translate('analyticsCategoriaCookie'),
                description: this.translate.translate('analyticsDescrizioneCategoriaCookie')
            });
        }
        if (this.cookieConsent.isProfilingNeeded()) {
            categories.push({
                key: CookieCategory.Profiling,
                name: this.translate.translate('profilazioneCategoriaCookie'),
                description: this.translate.translate('profilazioneDescrizioneCategoriaCookie')
            });
        }
        return categories;
    });

    readonly cookieList = computed(() => {
        const allCookies: Record<string, CookieConfig> = {
            ...this.cookieConsent.activeEngineCookies(),
            ...COOKIE_MAP,
        };

        const list: { name: string; category: CookieCategory; categoryName: string; description: string }[] = [];
        
        for (const [rawKey, config] of Object.entries(allCookies) as [string, CookieConfig][]) {
            const desc = config.descriptionKey ? this.translate.translate(config.descriptionKey) : '';
            const fullKey = buildPhysicalCookieKey(rawKey as CookieKey | EngineCookieKey, config) ?? rawKey;
            
            let categoryName = '';
            switch (config.category) {
                case CookieCategory.Analytics: categoryName = this.translate.translate('analyticsCategoriaCookie'); break;
                case CookieCategory.Profiling: categoryName = this.translate.translate('profilazioneCategoriaCookie'); break;
                case CookieCategory.Technical: categoryName = this.translate.translate('tecniciCategoriaCookie'); break;
            }

            list.push({
                name: fullKey,
                category: config.category,
                categoryName,
                description: desc
            });
        }
        return list;
    });

    readonly segments = computed(() => {
        const profile = this.rawProfile();
        let content = this.pageContent() ?? '';
        if (!content) return [];

        if (profile) {
            const fields: (keyof Profile)[] = ['ragioneSociale', 'partitaIva', 'codiceFiscale'];
            for (const field of fields) {
                const val = profile[field];
                if (typeof val === 'string') {
                    content = content.replaceAll(`{{${field}}}`, val);
                }
            }
        }

        const tokens = content.split(/(\{\{(?:cookieCategories|cookieList|companyProfile)\}\})/g);
        const result: ({ type: 'markdown'; content: string } | { type: 'categories' } | { type: 'cookieList' } | { type: 'profile' })[] = [];

        for (const token of tokens) {
            if (!token) continue;
            if (token === '{{cookieCategories}}') result.push({ type: 'categories' });
            else if (token === '{{cookieList}}') result.push({ type: 'cookieList' });
            else if (token === '{{companyProfile}}') result.push({ type: 'profile' });
            else result.push({ type: 'markdown', content: token });
        }

        return result;
    });

    constructor() {
        super();
        effect(() => {
            const content = this.pageContent();
            const needsProfile = content != null && (
                content.includes('{{companyProfile}}') ||
                content.includes('{{ragioneSociale}}') ||
                content.includes('{{partitaIva}}') ||
                content.includes('{{codiceFiscale}}')
            );
            if (needsProfile && !this.profileLoaded()) {
                this.api.getProfile()
                    .then(p => {
                        this.rawProfile.set(p);
                        this.profileLoaded.set(true);
                    })
                    .catch(() => this.profileLoaded.set(true));
            }
        });
    }


}
