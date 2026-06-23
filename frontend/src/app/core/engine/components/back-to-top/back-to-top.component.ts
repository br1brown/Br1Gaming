import { Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * BackToTopComponent — Bottone "torna su" che appare durante lo scroll.
 *
 * Il bottone diventa visibile quando l'utente scorre la pagina oltre 300px.
 * Al click, la pagina torna all'inizio con un'animazione fluida (smooth scroll).
 *
 * Aspetto: utility .fab + .surface-elevated dal layer globale — fondo neutro
 * (body-bg), ombra elevata, inner ring theme-aware. Si adatta light/dark senza
 * variabili componente.
 */
@Component({
  selector: 'app-back-to-top',
  imports: [TranslatePipe],
  templateUrl: './back-to-top.component.html',
  styleUrl: './back-to-top.component.scss',
  host: { '(window:scroll)': 'onScroll()' }
})
export class BackToTopComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly isVisible = signal(false);
  private rafId: number | null = null;

  constructor() {
    // Annulla il frame in volo allo smontaggio: evita un set() su componente distrutto.
    inject(DestroyRef).onDestroy(() => {
      if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    });
  }

  onScroll(): void {
    if (!this.isBrowser || this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.isVisible.set(window.scrollY > 300);
      this.rafId = null;
    });
  }

  scrollToTop(): void {
    if (this.isBrowser)
      window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
