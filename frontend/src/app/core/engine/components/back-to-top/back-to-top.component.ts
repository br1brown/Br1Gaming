import { Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ContestoSito } from '../../../../site';
import { BACK_TO_TOP_SOGLIA_PX } from '../../design-system-presets';

/** Bottone "torna su": visibile oltre la soglia di scroll decisa dal design system attivo
 *  (`DesignSystemPreset.fab.tornaSuSoglia`, default `'standard'` = 300px). Aspetto da utility globali
 *  (`.fab` + `.surface-elevated`), si adatta light/dark senza variabili componente. */
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
  private readonly soglia = BACK_TO_TOP_SOGLIA_PX[ContestoSito.config.aspetto.fab.tornaSuSoglia];

  constructor() {
    // Annulla il frame in volo allo smontaggio: evita un set() su componente distrutto.
    inject(DestroyRef).onDestroy(() => {
      if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    });
  }

  onScroll(): void {
    if (!this.isBrowser || this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.isVisible.set(window.scrollY > this.soglia);
      this.rafId = null;
    });
  }

  scrollToTop(): void {
    if (!this.isBrowser) return;
    // prefers-reduced-motion: lo scroll resta immediato invece che animato — stesso check già
    // usato in smoke-effect.component.ts.
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
}
