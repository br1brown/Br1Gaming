import { Component, computed, inject } from '@angular/core';
import { MarkdownPipe } from '../../core/engine/pipes/markdown.pipe';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { CookieConsentService, buildPhysicalCookieKey } from '../../core/engine/services/cookie-consent.service';
import { CookieCategory, CookieConfig, EngineCookieKey } from '../../core/engine/services/cookie/cookie-type';
import { COOKIE_MAP, type CookieKey } from '../../core/services/cookie-registry';

@Component({
    selector: 'app-policy',
    imports: [MarkdownPipe],
    templateUrl: './policy.component.html'
})
export class PolicyComponent extends PageBaseComponent<string> {
    private readonly cookieConsent = inject(CookieConsentService);

    readonly CookieCategory = CookieCategory;

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
        const content = this.pageContent() ?? '';
        if (!content) return [];

        const tokens = content.split(/(\{\{(?:cookieCategories|cookieList)\}\})/g);
        const result: ({ type: 'markdown'; content: string } | { type: 'categories' } | { type: 'cookieList' })[] = [];

        for (const token of tokens) {
            if (!token) continue;
            if (token === '{{cookieCategories}}') result.push({ type: 'categories' });
            else if (token === '{{cookieList}}') result.push({ type: 'cookieList' });
            else result.push({ type: 'markdown', content: token });
        }

        return result;
    });
}
