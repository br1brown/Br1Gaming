import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { injectDismiss } from '../../dismiss';
import { TranslateService } from '../../services/translate.service';
import { NotificationStreamService, type StreamNotification } from '../../services/notification-stream.service';
import { ContestoSito } from '../../../../site';

/** Campanellino delle notifiche realtime nella navbar. Iniettarlo attiva
 *  {@link NotificationStreamService} (stream SSE + storico); lo stato vive nel servizio, qui si
 *  rende soltanto. `Esc` e il click fuori chiudono il pannello (`injectDismiss`) e ridanno il focus. */
@Component({
    selector: 'app-notification-bell',
    imports: [TranslatePipe, EmptyStateComponent],
    templateUrl: './notification-bell.component.html',
    styleUrl: './notification-bell.component.scss',
    host: {
        class: 'dropdown notification-bell',
        '[class.show]': 'open()',
    }
})
export class NotificationBellComponent {
    private readonly stream = inject(NotificationStreamService);
    private readonly translate = inject(TranslateService);
    private readonly elRef = inject<ElementRef<HTMLElement>>(ElementRef);

    /** Stato di apertura del pannello. */
    readonly open = signal(false);
    /** Id del pannello, per `aria-controls` sul campanellino. */
    protected readonly panelId = 'notification-bell-panel';

    constructor() {
        injectDismiss({
            open: this.open,
            close: () => this.open.set(false),
            returnFocus: () => this.elRef.nativeElement.querySelector<HTMLElement>('.notification-bell-toggle'),
        });
    }
    /** Contatore non lette (badge). */
    readonly unread = this.stream.unread;
    /** Testo dell'ultima notifica dal vivo, per la regione aria-live. */
    readonly liveMessage = this.stream.lastLive;
    /** Storico, dal più recente al meno recente (il servizio lo tiene in ordine di arrivo). */
    readonly items = computed(() => [...this.stream.notifications()].reverse());

    /** `'numero'` (default): badge con conteggio. `'puntino'`: solo un indicatore, senza
     *  numero — `bellLabel()` sotto resta comunque accessibile in entrambi i casi (il conteggio
     *  non sparisce per chi usa uno screen reader). `DesignSystemPreset.badgeNotifiche`. */
    readonly badgeNumero = ContestoSito.config.aspetto.badgeNotifiche === 'numero';

    /** Nome accessibile del pulsante: include il numero di non lette per gli screen reader. */
    readonly bellLabel = computed(() => {
        const base = this.translate.translate('notificheTitolo');
        const unread = this.unread();
        return unread > 0 ? `${base}, ${this.translate.translate('notificheNonLette', unread)}` : base;
    });

    /** Apre/chiude il pannello; all'apertura segna tutto come letto. */
    toggle(): void {
        this.open.update(v => !v);
        if (this.open()) this.stream.markAllRead();
    }

    /** Icona FontAwesome in base all'eventuale `icon` nel payload del toast. */
    iconFor(notification: StreamNotification): string {
        const icon = (notification.payload as { icon?: string } | undefined)?.icon;
        switch (icon) {
            case 'success': return 'fa-circle-check';
            case 'error':   return 'fa-circle-exclamation';
            case 'warning': return 'fa-triangle-exclamation';
            default:        return 'fa-circle-info';
        }
    }

    /** Testo della notifica: delega al servizio (chiave i18n → testo, con fallback). */
    messageOf(notification: StreamNotification): string {
        return this.stream.resolveText(notification);
    }
}
