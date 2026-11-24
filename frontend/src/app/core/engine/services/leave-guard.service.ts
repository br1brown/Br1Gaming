import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NotificationService } from './notification.service';
import { TranslateService } from './translate.service';

/** Chi ha qualcosa da non perdere e vuole decidere da sé come chiederlo si annuncia così: `dirty` dice se c'è,
 *  `confirm` chiede all'utente cosa farne (salva / scarta / resta) e risolve `true` quando si può procedere. */
export interface LeaveGuardEntry {
    dirty: () => boolean;
    confirm: () => boolean | Promise<boolean>;
}

/** Una sezione con modifiche non salvate che usa il dialogo dell'Engine; più voci sporche danno un dialogo solo. */
export interface DirtyEntry {
    /** Vero se c'è qualcosa da non perdere. Un `signal` va bene così com'è (`dirty: this.dirty`). */
    dirty: () => boolean;
    /** Salva le modifiche. Se TUTTE le voci sporche lo danno, il dialogo offre «Salva / Non salvare / Annulla»; se anche
     *  una sola non lo dà, offre «Esci senza salvare / Resta qui» (salvare le altre e perdere quella sarebbe ambiguo). */
    save?: () => unknown;
    /** Il nome della sezione, citato nel dialogo («Ci sono modifiche non salvate in "FAQ"»). Già tradotto. */
    label?: string;
    /** Il testo del dialogo al posto di quello di serie (già tradotto): per dire cosa si perde davvero («quello che hai
     *  scritto dopo l'ultimo "Salva bozza" andrà perso»). Con più voci sporche vale il testo della prima che ne ha uno. */
    message?: string;
}

/** Registro delle modifiche non salvate, consultato dal `canDeactivate` di ogni rotta foglia e al `beforeunload`; si cancella col `DestroyRef`.
 *  `registerDirty` usa il dialogo dell'Engine, `register` uno proprio; `confirmDiscard` serve le uscite che non sono navigazioni. */
@Injectable({ providedIn: 'root' })
export class LeaveGuardService {
    private readonly notify = inject(NotificationService);
    private readonly translate = inject(TranslateService);
    private readonly entries = new Set<LeaveGuardEntry>();
    private readonly dirtyEntries = new Set<DirtyEntry>();
    /** Il dialogo aperto adesso e le voci che riguarda (`undefined` = tutta la pagina): solo una richiesta per le stesse voci lo condivide. */
    private asking: { only: readonly DirtyEntry[] | undefined; answer: Promise<boolean> } | null = null;

    constructor() {
        if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
        window.addEventListener('beforeunload', e => {
            if (!this.isDirty()) return;
            e.preventDefault();
            e.returnValue = ''; // testo del prompt: lo decide il browser, non è personalizzabile
        });
    }

    /** Si registra con un dialogo proprio (`confirm`). Per il dialogo dell'Engine usa {@link registerDirty}. */
    register(entry: LeaveGuardEntry, destroyRef: DestroyRef): void {
        this.entries.add(entry);
        destroyRef.onDestroy(() => this.entries.delete(entry));
    }

    /** Si registra col dialogo dell'Engine (vedi {@link DirtyEntry}). La cancellazione alla distruzione del componente è automatica. */
    registerDirty(entry: DirtyEntry, destroyRef: DestroyRef): void {
        this.dirtyEntries.add(entry);
        destroyRef.onDestroy(() => this.dirtyEntries.delete(entry));
    }

    isDirty(): boolean {
        for (const e of this.entries) if (e.dirty()) return true;
        for (const e of this.dirtyEntries) if (e.dirty()) return true;
        return false;
    }

    /** `true` se si può lasciare la pagina: nessuna modifica in sospeso, oppure ogni registrato con qualcosa
     *  in sospeso ha avuto la sua risposta (il `confirm()` proprio, o il dialogo unico delle voci `DirtyEntry`). */
    async canLeave(): Promise<boolean> {
        for (const e of this.entries) {
            if (e.dirty() && !(await e.confirm())) return false;
        }
        return this.confirmDiscard();
    }

    /** Chiede cosa fare delle voci sporche (tutte, o solo `only`) e risolve `true` se si può procedere: niente da salvare, salvato o scartato.
     *  `false` se l'utente resta o un salvataggio fallisce; due chiamate insieme per le stesse voci condividono il dialogo. */
    confirmDiscard(only?: readonly DirtyEntry[]): Promise<boolean> {
        if (this.asking && this.asking.only === only) return this.asking.answer;
        const pending = [...(only ?? this.dirtyEntries)].filter(e => e.dirty());
        if (pending.length === 0) return Promise.resolve(true);

        const asking = { only, answer: this.ask(pending).finally(() => { if (this.asking === asking) this.asking = null; }) };
        this.asking = asking;
        return asking.answer;
    }

    private async ask(pending: DirtyEntry[]): Promise<boolean> {
        const t = (key: string, ...args: unknown[]): string => this.translate.translate(key, ...args);
        const labels = [...new Set(pending.map(e => e.label).filter((l): l is string => !!l))];
        const text = pending.find(e => e.message)?.message
            ?? (labels.length === 0 ? t('modificheNonSalvateTesto')
                : labels.length === 1 ? t('modificheNonSalvateIn', labels[0])
                    : t('modificheNonSalvateInPiu', labels.join(', ')));
        const title = t('modificheNonSalvateTitolo');

        if (pending.every(e => e.save)) {
            const choice = await this.notify.choose(title, text, {
                confirmText: t('modificheSalva'), denyText: t('modificheNonSalvare'), cancelText: t('annullaAzione'), icon: 'warning',
                // Un clic sullo sfondo non chiude: il secondo clic di un doppio clic su un link cade sullo sfondo del dialogo appena aperto
                // (si apre in pochi ms) e lo farebbe sparire. Si esce con «Annulla» o Escape.
                allowOutsideClick: false,
            });
            if (choice === 'cancel') return false;
            if (choice === 'deny') return true;
            // Salva: si esce solo se ogni salvataggio è riuscito e non resta niente di sporco (un errore o una validazione che
            // rifiuta lasciano l'utente dov'è, con la sua pagina).
            const results = await Promise.allSettled(pending.map(e => Promise.resolve().then(() => e.save?.())));
            return results.every(r => r.status === 'fulfilled') && pending.every(e => !e.dirty());
        }

        return this.notify.confirm(title, text, {
            confirmText: t('modificheEsci'), cancelText: t('modificheResta'), icon: 'warning', danger: true, allowOutsideClick: false,
        });
    }
}
