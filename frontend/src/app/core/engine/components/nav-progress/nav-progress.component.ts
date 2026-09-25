import { Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';

/** Sotto questa durata la navigazione non mostra niente: una barra che lampeggia a ogni click
 *  veloce è rumore, non informazione. */
const MOSTRA_DOPO_MS = 150;
/** Quanto la barra resta piena prima di sparire: il tempo di vederla completarsi. */
const COMPLETA_PER_MS = 250;

/** Barra sottile durante una navigazione: coi resolver la pagina vecchia resta ferma finché la nuova
 *  non è pronta, e senza un segnale un click su un'API lenta pare non fare niente. Decorativa
 *  (`aria-hidden`): agli screen reader parla `aria-busy` su `<main>`. */
@Component({
    selector: 'app-nav-progress',
    templateUrl: './nav-progress.component.html',
    styleUrl: './nav-progress.component.scss',
})
export class NavProgressComponent {
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private readonly destroyRef = inject(DestroyRef);
    private showTimer: ReturnType<typeof setTimeout> | null = null;
    private hideTimer: ReturnType<typeof setTimeout> | null = null;

    /** `'attiva'` = avanza; `'completa'` = piena, sta per sparire; `null` = nascosta. */
    readonly stato = signal<'attiva' | 'completa' | null>(null);

    constructor() {
        if (!this.isBrowser) return;
        const sub = inject(Router).events.subscribe(event => {
            if (event instanceof NavigationStart) this.onStart();
            else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) this.onEnd();
        });
        this.destroyRef.onDestroy(() => {
            sub.unsubscribe();
            this.clearTimers();
            this.setMainBusy(false);
        });
    }

    private onStart(): void {
        this.clearTimers();
        this.setMainBusy(true);
        this.showTimer = setTimeout(() => this.stato.set('attiva'), MOSTRA_DOPO_MS);
    }

    private onEnd(): void {
        this.clearTimers();
        this.setMainBusy(false);
        if (this.stato() !== 'attiva') { this.stato.set(null); return; }   // sotto la soglia: mai comparsa
        this.stato.set('completa');
        this.hideTimer = setTimeout(() => this.stato.set(null), COMPLETA_PER_MS);
    }

    /** `<main>` è della shell: l'attributo lo mette e lo toglie questo componente, come la navbar
     *  scrive `--navOffset` su `<html>`, per non chiedere alla shell un binding in più. */
    private setMainBusy(busy: boolean): void {
        const main = document.getElementById('main-content');
        if (!main) return;
        if (busy) main.setAttribute('aria-busy', 'true');
        else main.removeAttribute('aria-busy');
    }

    private clearTimers(): void {
        if (this.showTimer !== null) clearTimeout(this.showTimer);
        if (this.hideTimer !== null) clearTimeout(this.hideTimer);
        this.showTimer = this.hideTimer = null;
    }
}
