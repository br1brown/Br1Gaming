import { Component, ViewEncapsulation, computed, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CookieConsentService } from '../../services/cookie-consent.service';
import { AppearanceService } from '../../services/appearance.service';
import { TranslateService } from '../../services/translate.service';
import { PageMetaService } from '../../services/page-meta.service';
import { ContestoSito } from '../../../../site';
import { MarkdownLitePipe } from '../../pipes/markdown-lite.pipe';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
    selector: 'app-cookie-banner',
    imports: [TranslatePipe, MarkdownLitePipe, NgTemplateOutlet],
    templateUrl: './cookie-banner.component.html',
    styleUrl: './cookie-banner.component.scss',
    encapsulation: ViewEncapsulation.None
})
export class CookieBannerComponent {
    readonly cookieConsent = inject(CookieConsentService);
    readonly theme = inject(AppearanceService);
    private readonly translate = inject(TranslateService);
    private readonly pagemeta = inject(PageMetaService);
    
    readonly isCookiePolicy = computed(() => {
        return ContestoSito.config.cookiePolicy != null && this.pagemeta.currentPageType() === ContestoSito.config.cookiePolicy;
    });

    /** `'discreto'` (default): FAB di riapertura più piccolo/trasparente del `.fab`
     *  standard. `'standard'`: stessa dimensione/opacità di `.fab` (es. `back-to-top`) — il LATO
     *  resta comunque opposto a `back-to-top` in entrambi i casi, apposta: stessa area di
     *  `inset-inline-end` raddoppierebbe la probabilità di sovrapporsi a un controllo di pagina.
     *  `DesignSystemPreset.fab.cookie`. */
    readonly reopenStandard = ContestoSito.config.aspetto.fab.cookie === 'standard';

    /**
     * Modalità pannello: invece del banner fisso in overlay, rende gli stessi controlli di consenso
     * come blocco in-flusso (es. in fondo alla Cookie Policy) sempre visibile — per gestire le
     * preferenze senza riaprire il banner. Default `false` = comportamento banner classico.
     */
    readonly panelMode = input<boolean>(false);

    /** Stato locale dei pending — inizializzati dal consenso già salvato, spenti alla prima apertura:
     *  TechnicalOptional è a consenso come Analytics/Profiling, e uno switch pre-attivato non è
     *  consenso valido (CGUE Planet49, C-673/17). */
    readonly pendingTechnicalOptional = signal(this.cookieConsent.technicalOptionalAccepted());
    readonly pendingAnalytics = signal(this.cookieConsent.analyticsAccepted());
    readonly pendingProfiling = signal(this.cookieConsent.profilingAccepted());

    /** Feedback "preferenze salvate" mostrato nel pannello dopo un salvataggio (nel banner non serve: sparisce). */
    readonly justSaved = signal(false);

    constructor() {
        // In modalità pannello i toggle seguono il consenso salvato anche se cambia altrove (banner fisso).
        // Solo dopo una risposta (prima vale il default: tutto spento); `accepted*` cambia solo al
        // salvataggio, quindi le modifiche in corso non vengono toccate.
        effect(() => {
            if (!this.panelMode() || !this.cookieConsent.responded()) return;
            this.pendingTechnicalOptional.set(this.cookieConsent.technicalOptionalAccepted());
            this.pendingAnalytics.set(this.cookieConsent.analyticsAccepted());
            this.pendingProfiling.set(this.cookieConsent.profilingAccepted());
        });
    }

    /** True se c'è almeno una categoria soggetta a consenso (TechnicalOptional/Analytics/Profiling):
     *  decide se mostrare "Salva scelte". Stessa formula di `CookieConsentService.isNeeded()`: anche un
     *  sito con la sola TechnicalOptional ha il suo Salva, accanto ad Accetta/Rifiuta tutto. */
    readonly hasDetailedCategories = computed(() =>
        this.cookieConsent.isTechnicalOptionalNeeded() || this.cookieConsent.isAnalyticsNeeded() || this.cookieConsent.isProfilingNeeded()
    );

    /** Sempre "tutto/tutti", a prescindere dal numero di categorie attive: un'etichetta che
     *  cambia forma in base al conteggio confonde più di quanto chiarisca. */
    readonly rejectLabel = computed(() => this.translate.translate('rifiutaTuttiBannerCookie'));
    readonly acceptLabel = computed(() => this.translate.translate('accettaTuttiBannerCookie'));

    /** Chiave dell'avviso GPC: nomina solo le categorie che il segnale tiene davvero spente
     *  (`gpcOptedOut`); null se nessuna, e l'avviso non compare. */
    readonly gpcNoticeKey = computed(() => {
        const { analytics, profiling } = this.cookieConsent.gpcOptedOut();
        if (analytics && profiling) return 'gpcRilevatoBannerCookie';
        if (analytics) return 'gpcRilevatoAnalyticsBannerCookie';
        if (profiling) return 'gpcRilevatoProfilazioneBannerCookie';
        return null;
    });

    readonly bannerText = computed(() => {
        // La pagina Cookie Policy è quella valorizzata in `cookiePolicy` (site.ts), non un
        // PageType nominato qui: l'Engine resta agnostico ai nomi.
        const cookiePage = ContestoSito.config.cookiePolicy;
        const path = (cookiePage != null ? ContestoSito.getPath(cookiePage, this.translate.currentLang()) : null) ?? '';
        return this.translate.translate('introBannerCookie', path);
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
