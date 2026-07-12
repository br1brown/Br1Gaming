import { Directive, computed, inject, input, signal } from '@angular/core';
import { TranslateService } from '../../../core/engine/services/translate.service';
import { NotificationService } from '../../../core/engine/services/notification.service';

/**
 * Base dei componenti azione (copy, share, speech, download, pdf, mail): centralizza input
 * label/showLabel/fullWidth, traduzione della label, stato di loading ed esecuzione protetta del
 * lavoro asincrono (errori + notifica). Il concreto dichiara solo `defaultLabelKey` e cosa fa in
 * `run()`; il consumer non inietta mai il servizio (componenti autonomi).
 */
@Directive({
    host: {
        // inline di default; quando fullWidth, l'host diventa block a tutta
        // larghezza così che il `w-100` sull'elemento interno riempa davvero il padre.
        '[class.d-inline-block]': '!fullWidth()',
        '[class.d-block]': 'fullWidth()',
    },
})
export abstract class BaseActionComponent {
    protected readonly translate = inject(TranslateService);
    protected readonly notify = inject(NotificationService);

    /** Chiave i18n (o stringa letterale) per label e aria-label. */
    readonly label = input<string>();
    /** Mostra la label testuale accanto all'icona. */
    readonly showLabel = input(false);
    /** Occupa tutta la larghezza del contenitore (nessun padre deve bucare il CSS). */
    readonly fullWidth = input(false);

    /** Stato di caricamento per le azioni asincrone. */
    readonly loading = signal(false);

    /** Chiave i18n di default, fornita da ogni componente concreto. */
    protected abstract readonly defaultLabelKey: string;

    /** Label tradotta da mostrare/annunciare. Sovrascrivibile per stati dinamici. */
    readonly displayLabel = computed(() =>
        this.translate.translate(this.label() ?? this.defaultLabelKey)
    );

    /**
     * Esegue il lavoro del componente in modo protetto: gestisce loading, previene la doppia
     * esecuzione e notifica l'errore. Il concreto passa solo la logica (la chiamata al servizio).
     */
    protected async run(work: () => void | Promise<void>): Promise<void> {
        if (this.loading()) return;
        this.loading.set(true);
        try {
            await work();
        } catch {
            this.notify.toast(this.translate.translate('erroreImprevisto'), 'error');
        } finally {
            this.loading.set(false);
        }
    }
}
