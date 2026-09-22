import { Injectable, PLATFORM_ID, inject, isDevMode, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

/** Raccoglie le Core Web Vitals reali (LCP, INP, CLS, FCP/TTFB) dei visitatori. Deliberatamente
 *  senza destinazione di default — dove spedirle è una decisione di progetto, non dell'Engine:
 *  `metrics()` è un signal che chi vuole osserva con un `effect()`. */
@Injectable({ providedIn: 'root' })
export class WebVitalsService {
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private started = false;

    private readonly _metrics = signal<readonly Metric[]>([]);
    /** Cronologia delle metriche ricevute finora (si allunga nel tempo, mai troncata: sul totale
     *  di una singola sessione utente sono al più una manciata di valori). */
    readonly metrics = this._metrics.asReadonly();

    /** Avvia la raccolta. No-op su server (le Web Vitals sono per definizione lato browser) e se
     *  chiamato più di una volta (i listener di `web-vitals` non sono pensati per essere riattaccati). */
    init(): void {
        if (!this.isBrowser || this.started) return;
        this.started = true;

        const record = (metric: Metric): void => {
            this._metrics.update(list => [...list, metric]);
            if (isDevMode()) console.debug(`[web-vitals] ${metric.name}`, metric.value, metric.rating);
        };

        onLCP(record);
        onINP(record);
        onCLS(record);
        onFCP(record);
        onTTFB(record);
    }
}
