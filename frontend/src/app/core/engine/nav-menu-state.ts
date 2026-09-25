import { Injectable, signal } from '@angular/core';

/** Stato condiviso fra la navbar e i suoi sottomenu annidati (a qualunque profondità): quando la
 *  navbar chiude tutto (Escape, click fuori, navigazione), ogni `NavSubmenuComponent` richiude il
 *  proprio accordion invece di restare "aperto" per la prossima volta. Fornito da `NavbarComponent`. */
@Injectable()
export class NavMenuState {
    private readonly collapseTick = signal(0);
    /** Cambia a ogni richiesta di chiusura: chi lo legge in un `effect` si richiude. */
    readonly collapseAll = this.collapseTick.asReadonly();

    requestCollapse(): void {
        this.collapseTick.update(n => n + 1);
    }
}
