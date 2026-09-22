import { Injectable, signal } from '@angular/core';

/** Sorgente unica del `connectionId` della SSE corrente, separata dal
 *  {@link NotificationStreamService}: serve a leggerlo (es. per l'header `X-Connection-Id`) senza
 *  iniettare — e quindi attivare — lo stream. Holder inerte (un signal, nessun side-effect); resta
 *  `null` finché nessuno apre lo stream, e il backend gestisce il connectionId nullo (broadcast). */
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
