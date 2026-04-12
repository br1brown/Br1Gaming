import { inject, Injectable, InjectionToken } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { PageMetaService } from './page-meta.service';
import { TranslateService } from './translate.service';

export interface TitleStrategyConfig {
    appName: string;
    defaultDescription: string;
}

export const TITLE_STRATEGY_CONFIG =
    new InjectionToken<TitleStrategyConfig>('TitleStrategyConfig');

@Injectable()
export class AppTitleStrategy extends TitleStrategy {
    private readonly pageMeta = inject(PageMetaService);
    private readonly translate = inject(TranslateService);
    private readonly config = inject(TITLE_STRATEGY_CONFIG);

    override updateTitle(snapshot: RouterStateSnapshot): void {
        const title = this.formatTitle(snapshot);
        const description =
            this.extractData<string>(snapshot.root, 'pageDescription')
            ?? this.config.defaultDescription;
        this.pageMeta.setTitle(title, description);
    }

    /** Riesegue title + meta senza una navigazione (es. cambio lingua). */
    refresh(snapshot: RouterStateSnapshot): void {
        this.updateTitle(snapshot);
    }

    private formatTitle(snapshot: RouterStateSnapshot): string {
        const titleKey = this.buildTitle(snapshot);
        if (!titleKey) return this.config.appName;

        const pageTitle = this.translate.translate(titleKey).trim();
        if (!pageTitle || pageTitle === this.config.appName) return this.config.appName;

        return `${pageTitle} | ${this.config.appName}`;
    }

    /** Cerca ricorsivamente un dato in route.data nell'albero snapshot. */
    private extractData<T>(route: ActivatedRouteSnapshot, key: string): T | null {
        if (route.data[key] != null) return route.data[key] as T;
        for (const child of route.children) {
            const found = this.extractData<T>(child, key);
            if (found != null) return found;
        }
        return null;
    }
}
