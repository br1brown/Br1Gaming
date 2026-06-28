import { Component, computed, effect, inject, signal } from '@angular/core';
import { MarkdownPipe } from '../../core/engine/pipes/markdown.pipe';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { CookieConsentService, buildPhysicalCookieKey } from '../../core/engine/services/cookie-consent.service';
import { ConsentCategory, CookieConfig, EngineCookieKey, StorageMedium } from '../../core/engine/services/cookie/cookie-type';
import { COOKIE_MAP, type CookieKey } from '../../core/services/cookie-registry';
import { IdentityRenderComponent } from '../../components/shared/identity-render/identity-render.component';
import { IdentityService } from '../../core/engine/services/identity.service';
import type { Identity } from '../../core/engine/dto/identity.dto';

@Component({
    selector: 'app-policy',
    imports: [MarkdownPipe, IdentityRenderComponent],
    templateUrl: './policy.component.html'
})
export class PolicyComponent extends PageBaseComponent<string> {
    private readonly cookieConsent = inject(CookieConsentService);
    private readonly identityService = inject(IdentityService);

    readonly ConsentCategory = ConsentCategory;

    /** Identità per l'IdentityRenderComponent (dalla risorsa condivisa dell'engine). */
    readonly identity = signal<Identity | null>(null);

    readonly cookieCategories = computed(() => {
        const categories: { key: ConsentCategory; name: string; description: string }[] = [];
        if (this.cookieConsent.isTechnicalNeeded()) {
            categories.push({
                key: ConsentCategory.Technical,
                name: this.translate.translate('tecniciCategoriaCookie'),
                description: this.translate.translate('tecniciDescrizioneCategoriaCookie')
            });
        }
        if (this.cookieConsent.isAnalyticsNeeded()) {
            categories.push({
                key: ConsentCategory.Analytics,
                name: this.translate.translate('analyticsCategoriaCookie'),
                description: this.translate.translate('analyticsDescrizioneCategoriaCookie')
            });
        }
        if (this.cookieConsent.isProfilingNeeded()) {
            categories.push({
                key: ConsentCategory.Profiling,
                name: this.translate.translate('profilazioneCategoriaCookie'),
                description: this.translate.translate('profilazioneDescrizioneCategoriaCookie')
            });
        }
        return categories;
    });

    /** Etichetta tradotta della categoria di consenso. */
    private categoryLabel(category: ConsentCategory): string {
        switch (category) {
            case ConsentCategory.Analytics: return this.translate.translate('analyticsCategoriaCookie');
            case ConsentCategory.Profiling: return this.translate.translate('profilazioneCategoriaCookie');
            case ConsentCategory.Technical: return this.translate.translate('tecniciCategoriaCookie');
            default: return '';
        }
    }

    /** Etichetta tradotta del mezzo di archiviazione (cookie / local / session). */
    private mediumLabel(medium: StorageMedium): string {
        switch (medium) {
            case 'local': return this.translate.translate('mezzoLocalStorageListaCookie');
            case 'session': return this.translate.translate('mezzoSessionStorageListaCookie');
            default: return this.translate.translate('mezzoCookieListaCookie');
        }
    }

    readonly cookieList = computed(() => {
        // Mappa UNICA: built-in del motore attivi + voci del progetto. Il mezzo (cookie / local /
        // session) lo decide `config.storage`; il nome fisico è namespaced per i cookie, raw per lo storage.
        const all: Record<string, CookieConfig> = {
            ...this.cookieConsent.activeEngine(),
            ...COOKIE_MAP,
        };

        const list: { name: string; category: ConsentCategory; categoryName: string; description: string; medium: StorageMedium; mediumLabel: string }[] = [];

        for (const [rawKey, config] of Object.entries(all) as [string, CookieConfig][]) {
            const medium = config.storage ?? 'cookie';
            list.push({
                name: medium === 'cookie'
                    ? buildPhysicalCookieKey(rawKey as CookieKey | EngineCookieKey, config) ?? rawKey
                    : rawKey,
                category: config.category,
                categoryName: this.categoryLabel(config.category),
                description: config.descriptionKey ? this.translate.translate(config.descriptionKey) : '',
                medium,
                mediumLabel: this.mediumLabel(medium),
            });
        }
        return list;
    });

    readonly segments = computed(() => {
        const identity = this.identity();
        let content = this.pageContent() ?? '';
        if (!content) return [];

        if (identity) {
            const fields: (keyof Identity)[] = ['ragioneSociale', 'partitaIva', 'codiceFiscale'];
            for (const field of fields) {
                const val = identity[field];
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
        // L'identità arriva dalla risorsa condivisa dell'engine (già fetchata dal footer): qui la
        // si rispecchia nel signal locale, senza un fetch dedicato. Null finché non risolta/assente.
        effect(() => this.identity.set(this.identityService.identity()));
    }


}
