import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslateService } from '../../services/translate.service';
import { NotificationStreamService, type StreamNotification } from '../../services/notification-stream.service';

/**
 * Campanellino delle notifiche realtime nella navbar.
 *
 * Mostrato dall'Engine quando `shell.showNotifications` è attivo (opt-in). Iniettare questo
 * componente attiva il {@link NotificationStreamService} (apre lo stream SSE e idrata lo storico
 * dal server). Visualizza un badge con le notifiche non lette e un pannello con lo storico;
 * la storia vive nel servizio (signal + recupero dal server), qui si rende soltanto.
 *
 * Accessibilità: il nome del pulsante include il conteggio non lette, una regione `aria-live`
 * annuncia gli arrivi dal vivo, `Esc` chiude il pannello, le voci sono una lista semantica.
 */
@Component({
    selector: 'app-notification-bell',
    imports: [TranslatePipe],
    templateUrl: './notification-bell.component.html',
    styleUrl: './notification-bell.component.css',
    host: {
        class: 'dropdown notification-bell',
        '[class.show]': 'open()',
        '(document:click)': 'onDocumentClick($event)',
        '(keydown.escape)': 'onEscape()',
    }
})
export class NotificationBellComponent {
    private readonly stream = inject(NotificationStreamService);
    private readonly translate = inject(TranslateService);
    private readonly elRef = inject(ElementRef);

    /** Stato di apertura del pannello. */
    readonly open = signal(false);
    /** Contatore non lette (badge). */
    readonly unread = this.stream.unread;
    /** Testo dell'ultima notifica dal vivo, per la regione aria-live. */
    readonly liveMessage = this.stream.lastLive;
    /** Storico, dal più recente al meno recente (il servizio lo tiene in ordine di arrivo). */
    readonly items = computed(() => [...this.stream.notifications()].reverse());

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

    onEscape(): void {
        this.open.set(false);
    }

    onDocumentClick(event: MouseEvent): void {
        if (!this.elRef.nativeElement.contains(event.target)) this.open.set(false);
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
