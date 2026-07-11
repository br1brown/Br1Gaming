import { Component, computed, inject, input } from '@angular/core';
import { TranslateService } from '../../core/engine/services/translate.service';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { PageDirective } from '../../core/engine/directives/page.directive';
import { ContestoSito } from '../../site';

/**
 * Pagina di errore generica per qualsiasi codice HTTP. Il codice arriva come path param
 * (`error/:errorCode`) via input binding. Chiavi i18n `errore{codice}Titolo`/`Descrizione`
 * (fallback `erroreGenerico`/`erroreImprevisto`); un nuovo codice = aggiungi le sue chiavi negli i18n.
 */
@Component({
    selector: 'app-error',
    imports: [TranslatePipe, PageDirective],
    templateUrl: './error.component.html',
    host: { class: 'd-flex align-items-center justify-content-center', style: 'min-height: 60vh;' }
})
export class ErrorComponent {
    private readonly translate = inject(TranslateService);

    /** Pagina home dal contesto (slot `homePage`): il pulsante "torna alla home" compare solo se valorizzata. */
    protected readonly homePage = ContestoSito.config.homePage;

    /** Codice errore HTTP, letto dalla route (param o data) tramite input binding. Predefinito: 404 */
    readonly errorCode = input(404, {
        transform: (v: string | number) => {
            const n = Number(v);
            return isNaN(n) ? 404 : n;
        }
    });

    private getTranslationKeys(code: number): { titleKey: string; descKey: string } {
        let titleKey = `errore${code}Titolo`;
        let descKey = `errore${code}Descrizione`;

        // Questo switch mappa SOLO gli errori di PAGINA (routing, es. navigazione a route protetta).
        // Gli errori di RISORSA (API che fallisce) li mappa base-api.service.ts con chiavi `risorsaXXX`.
        // Separati apposta: "Pagina non trovata" (Router) vs "Risorsa non trovata" (API).
        switch (code) {
            case 401:
                titleKey = 'errore401Titolo';
                descKey = 'errore401Descrizione';
                break;
            case 403:
                titleKey = 'errore403Titolo';
                descKey = 'errore403Descrizione';
                break;
            case 404:
                // Pagina non trovata (routing)
                titleKey = 'errore404Titolo';
                descKey = 'errore404Descrizione';
                break;
            // Aggiungi qui altri override specifici per la pagina se necessario in futuro
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
        return code + ': ' + info;
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
