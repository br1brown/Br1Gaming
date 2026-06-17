import { Injectable, signal } from '@angular/core';

/**
 * Sorgente unica del `connectionId` della SSE corrente, separata dal {@link NotificationStreamService}.
 *
 * Serve a leggere il connectionId (es. dal `BaseApiService` per l'header `X-Connection-Id`) **senza
 * iniettare — e quindi attivare — lo stream**: questo holder è inerte (un signal, nessun side-effect,
 * nessuna connessione). Lo stream lo popola quando si connette e lo azzera quando cade; finché nessuno
 * apre lo stream (es. `shell.showNotifications` false) resta `null` → nessun header → il backend riceve
 * un connectionId nullo e gestisce il caso (broadcast / nessun target).
 */
@Injectable({ providedIn: 'root' })
export class NotificationConnection {
    private readonly _id = signal<string | null>(null);

    /** connectionId della connessione SSE attiva, o `null` se nessuno stream è connesso. */
    readonly id = this._id.asReadonly();

    /** Aggiornato dal {@link NotificationStreamService} all'apertura/chiusura dello stream. */
    set(id: string | null): void {
        this._id.set(id);
    }
}
