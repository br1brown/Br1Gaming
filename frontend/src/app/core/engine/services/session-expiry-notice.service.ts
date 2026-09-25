import { DestroyRef, Injectable, PLATFORM_ID, effect, inject, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { ContestoSito, type PageType } from '../../../site';
import { environment } from '../../../../environments/environment';
import { TokenService } from './token.service';
import { NotificationService } from './notification.service';
import { TranslateService } from './translate.service';

/** Quanto prima della scadenza avvisare. Sotto questa durata di vita residua l'avviso non ha senso
 *  (token brevi di sviluppo, o sessione ripristinata all'ultimo): si passa direttamente alla scadenza. */
const AVVISO_PRIMA_MS = 2 * 60 * 1000;

/** `TokenService` scarta il token scaduto in silenzio: una pagina `requiresAuth` resta con contenuto
 *  vecchio finché l'utente non ci clicca sopra. Qui: un toast prima e uno alla scadenza, con lo
 *  stesso redirect al login del guard. Un logout voluto (token tolto prima) non produce niente. */
@Injectable({ providedIn: 'root' })
export class SessionExpiryNoticeService {
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private readonly token = inject(TokenService);
    private readonly notify = inject(NotificationService);
    private readonly translate = inject(TranslateService);
    private readonly router = inject(Router);
    private avvisoTimer: ReturnType<typeof setTimeout> | null = null;
    /** Ultima scadenza vista: distingue "scaduto" (arrivata) da "logout" (tolto prima). */
    private ultimaScadenza: number | null = null;

    constructor() {
        if (!this.isBrowser) return;
        effect(() => {
            const expiresAt = this.token.expiresAt();
            untracked(() => this.onScadenzaCambiata(expiresAt));
        });
        inject(DestroyRef).onDestroy(() => this.clearTimer());
    }

    private onScadenzaCambiata(expiresAt: number | null): void {
        this.clearTimer();
        if (expiresAt === null) {
            const scaduta = this.ultimaScadenza !== null && Date.now() >= this.ultimaScadenza - 1000;
            this.ultimaScadenza = null;
            if (scaduta) this.onScaduta();
            return;
        }
        this.ultimaScadenza = expiresAt;
        const traQuanto = expiresAt - Date.now() - AVVISO_PRIMA_MS;
        // Vita residua troppo corta per un avviso sensato: niente, si va diretti alla scadenza.
        if (traQuanto < 5000) return;
        this.avvisoTimer = setTimeout(() => {
            if (this.token.expiresAt() !== expiresAt) return;   // sessione cambiata nel frattempo
            this.notify.toast(this.translate.translate('sessioneScadeTraAvviso', Math.round(AVVISO_PRIMA_MS / 60000)), 'warning');
        }, Math.min(traQuanto, 2147483647));
    }

    private onScaduta(): void {
        this.notify.toast(this.translate.translate('sessioneScadutaAvviso'), 'warning');
        // Pagina riservata: lo stesso redirect del guard, così il login riporta qui.
        let route = this.router.routerState.snapshot.root;
        while (route.firstChild) route = route.firstChild;
        const pageType = route.data['pageType'] as PageType | undefined;
        if (pageType == null || !ContestoSito.pages.some(page => page.pageType === pageType && page.requiresAuth)) return;
        const loginPage = ContestoSito.config.loginPage;
        if (loginPage == null) return;
        const lang = (route.data['lang'] as string | undefined) ?? environment.defaultLang;
        const path = ContestoSito.getPath(loginPage, lang);
        if (path) void this.router.navigate([path], { queryParams: { returnPageType: pageType, reason: 'auth' } });
    }

    private clearTimer(): void {
        if (this.avvisoTimer !== null) clearTimeout(this.avvisoTimer);
        this.avvisoTimer = null;
    }
}
