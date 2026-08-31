import { Component, ViewEncapsulation, computed, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CookieConsentService } from '../../services/cookie-consent.service';
import { ThemeService } from '../../services/theme.service';
import { TranslateService } from '../../services/translate.service';
import { PageMetaService } from '../../services/page-meta.service';
import { ContestoSito } from '../../../../site';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
    selector: 'app-cookie-banner',
    imports: [TranslatePipe, MarkdownPipe, NgTemplateOutlet],
    templateUrl: './cookie-banner.component.html',
    styleUrl: './cookie-banner.component.scss',
    encapsulation: ViewEncapsulation.None
})
export class CookieBannerComponent {
    readonly cookieConsent = inject(CookieConsentService);
    readonly theme = inject(ThemeService);
    private readonly translate = inject(TranslateService);
    private readonly pagemeta = inject(PageMetaService);
    
    readonly isCookiePolicy = computed(() => {
        return ContestoSito.config.cookiePolicy != null && this.pagemeta.currentPageType() === ContestoSito.config.cookiePolicy;
    });

    /**
     * Modalità pannello: invece del banner fisso in overlay, rende gli stessi controlli di consenso
     * come blocco in-flusso (es. in fondo alla Cookie Policy) sempre visibile — per gestire le
     * preferenze senza riaprire il banner. Default `false` = comportamento banner classico.
     */
    readonly panelMode = input<boolean>(false);

    /** Stato locale dei pending — inizializzati dal consenso già salvato, o attivi di default alla prima
     *  apertura per TechnicalOptional (`pendingTechnicalOptional`: PWA built-in + eventuali cookie
     *  di progetto nella stessa categoria, vedi CookieConsentService.isTechnicalOptionalNeeded). */
    readonly pendingTechnicalOptional = signal(this.cookieConsent.responded() ? this.cookieConsent.technicalOptionalAccepted() : true);
    readonly pendingAnalytics = signal(this.cookieConsent.analyticsAccepted());
    readonly pendingProfiling = signal(this.cookieConsent.profilingAccepted());

    /** Feedback "preferenze salvate" mostrato nel pannello dopo un salvataggio (nel banner non serve: sparisce). */
    readonly justSaved = signal(false);

    constructor() {
        // In modalità pannello (sempre visibile) i toggle devono riflettere il consenso salvato:
        // se cambia altrove (es. l'utente accetta dal banner fisso), riallineiamo i pending. Solo dopo
        // che l'utente ha risposto — prima vale il default del field init (tecnici on) — e senza
        // interferire con le modifiche in corso: `accepted*` cambia solo al salvataggio, non ai toggle.
        effect(() => {
            if (!this.panelMode() || !this.cookieConsent.responded()) return;
            this.pendingTechnicalOptional.set(this.cookieConsent.technicalOptionalAccepted());
            this.pendingAnalytics.set(this.cookieConsent.analyticsAccepted());
            this.pendingProfiling.set(this.cookieConsent.profilingAccepted());
        });
    }

    /** True quando è attiva almeno una categoria non tecnica: sceglie il testo introduttivo del
     *  banner (toggle e azioni ci sono sempre — il consenso qui copre anche i tecnici). */
    readonly hasDetailedCategories = computed(() =>
        this.cookieConsent.isAnalyticsNeeded() || this.cookieConsent.isProfilingNeeded()
    );

    /** Sempre "tutto/tutti", a prescindere dal numero di categorie attive: un'etichetta che
     *  cambia forma in base al conteggio confonde più di quanto chiarisca. */
    readonly rejectLabel = computed(() => this.translate.translate('rifiutaTuttiBannerCookie'));
    readonly acceptLabel = computed(() => this.translate.translate('accettaTuttiBannerCookie'));

    readonly bannerText = computed(() => {
        // La pagina Cookie Policy è quella valorizzata in `cookiePolicy` (site.ts), non un
        // PageType nominato qui: l'Engine resta agnostico ai nomi.
        const cookiePage = ContestoSito.config.cookiePolicy;
        const path = (cookiePage != null ? ContestoSito.getPath(cookiePage, this.translate.currentLang()) : null) ?? '';
        const key = this.hasDetailedCategories() ? 'introBannerCookie' : 'testoBannerCookie';
        return this.translate.translate(key, path);
    });

    reopen(): void {
        this.pendingTechnicalOptional.set(this.cookieConsent.technicalOptionalAccepted());
        this.pendingAnalytics.set(this.cookieConsent.analyticsAccepted());
        this.pendingProfiling.set(this.cookieConsent.profilingAccepted());
        this.cookieConsent.reopen();
    }

    accept(): void {
        if (this.cookieConsent.isTechnicalOptionalNeeded()) this.pendingTechnicalOptional.set(true);
        if (this.cookieConsent.isAnalyticsNeeded()) this.pendingAnalytics.set(true);
        if (this.cookieConsent.isProfilingNeeded()) this.pendingProfiling.set(true);
        this.saveSelected();
    }

    reject(): void {
        if (this.cookieConsent.isTechnicalOptionalNeeded()) this.pendingTechnicalOptional.set(false);
        if (this.cookieConsent.isAnalyticsNeeded()) this.pendingAnalytics.set(false);
        if (this.cookieConsent.isProfilingNeeded()) this.pendingProfiling.set(false);
        this.saveSelected();
    }

    saveSelected(): void {
        this.cookieConsent.saveSelected(
            this.pendingTechnicalOptional(),
            this.pendingAnalytics(),
            this.pendingProfiling(),
        );
        this.justSaved.set(true);
    }

    /** Aggiorna un pending e azzera il feedback di salvataggio (l'utente sta di nuovo modificando). */
    setPending(category: 'technicalOptional' | 'analytics' | 'profiling', value: boolean): void {
        if (category === 'technicalOptional') this.pendingTechnicalOptional.set(value);
        else if (category === 'analytics') this.pendingAnalytics.set(value);
        else this.pendingProfiling.set(value);
        this.justSaved.set(false);
    }
}
