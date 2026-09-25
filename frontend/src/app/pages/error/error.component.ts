import { Component, PLATFORM_ID, computed, effect, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { isAvailabilityError, RETRY_QUERY_PARAM } from '../../core/engine/pages/content.resolver';
import { TranslateService } from '../../core/engine/services/translate.service';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { PageDirective } from '../../core/engine/directives/page.directive';
import { ContestoSito } from '../../site';
import { injectCurrentUrl } from '../../core/engine/routing';
import { detectLangFromPath } from '../../core/engine/siteBuilder';
import { environment } from '../../../environments/environment';

/** Pagina di errore generica per qualsiasi codice HTTP: un solo componente, chiavi i18n per codice. */
@Component({
    selector: 'app-error',
    imports: [TranslatePipe, PageDirective],
    templateUrl: './error.component.html',
    host: { class: 'd-flex align-items-center justify-content-center', style: 'min-height: 60vh;' }
})
export class ErrorComponent {
    private readonly translate = inject(TranslateService);
    private readonly titleService = inject(Title);
    private readonly router = inject(Router);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    /** URL interno da ritentare, dal query param messo dal resolver (`availabilityErrorPath`): solo un
     *  path del sito (inizia con `/`, non `//`), mai un URL esterno — un link costruito a mano non
     *  deve poter far navigare altrove. Assente se la pagina è stata aperta senza. */
    readonly retryUrl: string | null = (() => {
        const raw = inject(ActivatedRoute).snapshot.queryParamMap.get(RETRY_QUERY_PARAM);
        return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
    })();
    private readonly url = injectCurrentUrl(); // signal reattivo, si aggiorna ad ogni navigazione (routing.ts).

    // Rotta d'errore unica (non per lingua): niente route.data.lang, la lingua si deduce dal primo segmento dell'URL.
    readonly lang = computed(() => detectLangFromPath(this.url(), environment.availableLanguages, environment.defaultLang));

    constructor() {
        // Stesso schema dell'effect in PageBaseComponent (URL → stato lingua), qui costruito a mano
        // perché non c'è quella base comune a disposizione.
        effect(() => {
            const lang = this.lang();
            if (lang && lang !== this.translate.currentLang()) { // guardia: evita fetch ripetuti se la lingua non è cambiata.
                void this.translate.setLanguage(lang);
            }
        });

        // document.title tradotto: stesso schema di PageMetaService.setPageMeta (usato da
        // PageBaseComponent per ogni altra pagina), ridotto al solo titolo — una pagina d'errore è
        // sempre noindex, niente canonical/OG/structured data da aggiornare qui.
        effect(() => {
            this.titleService.setTitle(`${this.errorInfo()} | ${ContestoSito.config.appName}`);
        });
    }

    /** Pagina home dal contesto (slot `homePage`): il pulsante "torna alla home" compare solo se valorizzata. */
    protected readonly homePage = ContestoSito.config.homePage;

    /** Codice errore HTTP, letto dalla route (param o data) tramite input binding. Predefinito: 404.
     *  `offline` → 0, lo status di una risposta mai arrivata. */
    readonly errorCode = input(404, {
        transform: (v: string | number) => {
            if (v === 'offline') return 0;
            const n = Number(v);
            return isNaN(n) ? 404 : n;
        }
    });

    /** Problema di disponibilità (rete, server del sito, backend) con un URL da ritentare: "Riprova"
     *  è l'azione principale. Senza URL (pagina aperta o ricaricata da sé) non c'è niente da ritentare. */
    readonly canRetry = computed(() => isAvailabilityError(this.errorCode()) && this.retryUrl !== null);

    /** Torna all'URL che stava caricando: rilancia il resolver, che a servizio tornato carica la
     *  pagina, altrimenti riporta qui. */
    riprova(): void {
        if (this.retryUrl) void this.router.navigateByUrl(this.retryUrl);
    }

    private getTranslationKeys(code: number): { titleKey: string; descKey: string } {
        let titleKey = `errore${code}Titolo`;
        let descKey = `errore${code}Descrizione`;

        // Questo switch mappa SOLO gli errori di PAGINA (routing, es. navigazione a route protetta).
        // Gli errori di RISORSA (API che fallisce) li mappa base-api.service.ts con chiavi `risorsaXXX`.
        // Separati apposta: "Pagina non trovata" (Router) vs "Risorsa non trovata" (API).
        switch (code) {
            case 0:
                // Stessa causa vista dal codice (status 0), due situazioni diverse per l'utente:
                // senza rete può risolvere lui; con la rete il problema è dall'altra parte.
                if (this.isBrowser && navigator.onLine === false) {
                    titleKey = 'erroreOfflineTitolo';
                    descKey = 'erroreOfflineDescrizione';
                } else {
                    titleKey = 'erroreIrraggiungibileTitolo';
                    descKey = 'erroreIrraggiungibileDescrizione';
                }
                break;
            case 502:
            case 503:
            case 504:
                // Il sito risponde (siamo qui), il backend dietro no: un solo messaggio per l'utente,
                // che non distingue un gateway da un timeout; il codice resta nel titolo e nell'URL.
                titleKey = 'erroreServizioTitolo';
                descKey = 'erroreServizioDescrizione';
                break;
            // 401/403/404: nessun caso, la coppia `errore{codice}Titolo/Descrizione` di default è già
            // quella giusta. Qui vanno solo i codici che NON seguono quello schema.
        }

        return { titleKey, descKey };
    }

    readonly errorInfo = computed(() => {
        const code = this.errorCode();
        const { titleKey } = this.getTranslationKeys(code);
        const info = this.translate.translate(titleKey);
        if (info === titleKey) {
            return this.translate.translate('erroreGenerico') + ' ' + code;
        }
        // Senza rete non c'è un codice HTTP da mostrare: "0" non direbbe niente a nessuno.
        return code === 0 ? info : code + ': ' + info;
    });

    readonly errorMessage = computed(() => {
        const code = this.errorCode();
        const { descKey } = this.getTranslationKeys(code);
        const desc = this.translate.translate(descKey);
        if (desc === descKey) {
            return this.translate.translate('erroreImprevisto');
        }
        return desc;
    });
}
