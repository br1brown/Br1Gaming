import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, inject, resource } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { injectCurrentUrl } from '../../app.routes';
import { ApiService } from '../../core/services/api.service';
import { TranslateService } from '../../core/services/translate.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ContestoSito } from '../../site';
import { NavLink } from '../../siteBuilder';

@Component({
    selector: 'app-footer',
    imports: [RouterLink, TranslatePipe],
    templateUrl: './footer.component.html',
    styleUrl: './footer.component.css'
})
export class FooterComponent {
    protected readonly Math = Math;

    private readonly api = inject(ApiService);
    private readonly router = inject(Router);
    private readonly translate = inject(TranslateService);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly currentUrl = injectCurrentUrl();

    readonly appName = ContestoSito.config.appName;
    readonly description = ContestoSito.config.description;
    readonly currentYear = new Date().getFullYear();
    readonly footerNavLinks = ContestoSito.linkFooter;

    /**
     * Riconosce se l'elemento della DSL è un gruppo (ha dei figli) o un link singolo.
     */
    isGroup(item: NavLink): item is NavLink & { children: NavLink[] } {
        return Array.isArray(item.children) && item.children.length > 0;
    }

    isExternalPath(path: string): boolean {
        return path.startsWith('http://') || path.startsWith('https://');
    }

    isRouteActive(path: string): boolean {
        this.currentUrl(); // signal dependency → re-render on every navigation
        return this.router.isActive(path, { paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' });
    }

}

