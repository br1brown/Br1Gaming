import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Chi ha qualcosa da non perdere si annuncia così: `dirty` dice se c'è, `confirm` chiede all'utente
 *  cosa farne (salva / scarta / resta) e risolve `true` quando si può procedere. */
export interface LeaveGuardEntry {
    dirty: () => boolean;
    confirm: () => boolean | Promise<boolean>;
}

/**
 * Modifiche non salvate: un registro unico consultato PRIMA di lasciare una pagina, da qualunque
 * via — link della navbar, `[appPage]`, back del browser (tutti passano dal `canDeactivate` che
 * `routing.ts` mette su ogni rotta foglia) e chiusura/refresh della scheda (`beforeunload`).
 * Un editor si registra nel constructor col proprio `DestroyRef`; la cancellazione è automatica.
 * Il servizio non sa nulla della forma dei dati: solo "c'è qualcosa?" e "chiedi cosa farne".
 */
@Injectable({ providedIn: 'root' })
export class LeaveGuardService {
    private readonly entries = new Set<LeaveGuardEntry>();

    constructor() {
        if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
        window.addEventListener('beforeunload', e => {
            if (!this.isDirty()) return;
            e.preventDefault();
            e.returnValue = ''; // testo del prompt: lo decide il browser, non è personalizzabile
        });
    }

    register(entry: LeaveGuardEntry, destroyRef: DestroyRef): void {
        this.entries.add(entry);
        destroyRef.onDestroy(() => this.entries.delete(entry));
    }

    isDirty(): boolean {
        for (const e of this.entries) if (e.dirty()) return true;
        return false;
    }

    /** `true` se si può lasciare la pagina: nessuna modifica in sospeso, oppure ogni registrato
     *  con qualcosa in sospeso ha avuto il suo `confirm()` risolto a `true`. */
    async canLeave(): Promise<boolean> {
        for (const e of this.entries) {
            if (e.dirty() && !(await e.confirm())) return false;
        }
        return true;
    }
}
