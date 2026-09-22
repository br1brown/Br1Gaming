import { Injectable, OnDestroy, PLATFORM_ID, inject, DOCUMENT, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { SwUpdate } from '@angular/service-worker';
import { Subscription, filter, interval } from 'rxjs';
import { ContestoSito } from '../../../site';
import { NotificationService } from './notification.service';
import { TranslateService } from './translate.service';
import { CookieConsentService, isTechnicalOptionalConsentGiven } from './cookie-consent.service';

/** Intervallo di controllo di default: 10 minuti — override via `SiteConfig.versionCheckIntervalMs`. */
const DEFAULT_CHECK_INTERVAL_MS = 10 * 60 * 1000;

/** Monitora gli aggiornamenti dell'app: SwUpdate (PWA/Service Worker attivo) + polling del meta `app-version` in index.html (fallback o `isWebApp:false`). Propone il reload se rileva una nuova versione. */
@Injectable({ providedIn: 'root' })
export class VersionCheckService implements OnDestroy {
    private readonly document = inject(DOCUMENT);
    private readonly translate = inject(TranslateService);
    private readonly notify = inject(NotificationService);
    private readonly swUpdate = inject(SwUpdate);
    private readonly consent = inject(CookieConsentService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    private currentVersion: string | null = null;
    private swSub: Subscription | null = null;
    private updateShown = false;

    /**
     * Inizializza il monitoraggio.
     * Deve essere chiamato nel costruttore di app.component o tramite un initializer.
     */
    init(): void {
        // SSR: un timer periodico creerebbe una macrotask che impedirebbe ad Angular Universal di
        // terminare il rendering (timeout server); il controllo versione ha senso solo nel client.
        if (!this.isBrowser) return;

        // Se la PWA richiede il consenso TechnicalOptional, avvia il check solo se fornito 
        // (il SW non verrebbe registrato altrimenti). Se non richiesto (es. sito non-PWA), 
        // il polling parte subito essendo l'unico meccanismo di aggiornamento.
        if (this.consent.isTechnicalOptionalNeeded() && !isTechnicalOptionalConsentGiven()) return;

        // Recupera la versione attuale iniettata nel meta tag dell'index.html
        this.currentVersion = this.document
            .querySelector('meta[name="app-version"]')
            ?.getAttribute('content') ?? null;

        if (!this.currentVersion) return;

        // Zoneless: l'observable non innesca change detection da solo (check() aggiorna i signal,
        // che la innescano da soli). takeUntilDestroyed pulisce la sottoscrizione da sola, coerente
        // con la subscription SwUpdate qui sotto — nessun timer/cleanup manuale da tracciare.
        interval(ContestoSito.config.versionCheckIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => void this.check());

        // PWA: aggancia SwUpdate. Quando il SW finisce di scaricare una nuova
        // versione, emette VERSION_READY. Il polling sul manifest non funziona
        // dentro la PWA perché il SW serve il manifest dalla cache.
        if (this.swUpdate.isEnabled) {
            this.swSub = this.swUpdate.versionUpdates
                .pipe(filter(e => e.type === 'VERSION_READY'))
                .subscribe(() => void this.showUpdateDialog('sw'));
        }
    }

    /** Polling: confronta la versione servita con quella in memoria. Funziona senza SW (sempre con `isWebApp:false`); con un SW attivo è SwUpdate a prendere il sopravvento. */
    private async check(): Promise<void> {
        if (this.updateShown) return;

        try {
            // index.html è la sorgente di versione sempre presente (a differenza del manifest, 404
            // con isWebApp:false). 'cache: no-store' è CRITICO: forza il browser a chiedere al
            // server l'ultima versione invece di leggere dalla cache locale.
            const response = await fetch('/index.html', { cache: 'no-store' });
            if (!response.ok) return;

            const html = await response.text();
            const latestVersion = /<meta\s+name="app-version"\s+content="([^"]*)"/i.exec(html)?.[1];

            // Se la versione servita è diversa da quella caricata in memoria...
            if (latestVersion && latestVersion !== this.currentVersion) {
                void this.showUpdateDialog('poll');
            }
        } catch {
            // Silenzioso in caso di errori di rete (es. utente offline)
        }
    }

    /** Notifica l'aggiornamento: dialog di default, o `SiteConfig.onVersionUpdateAvailable` se dichiarato. `source: 'sw'` fa attivare da `apply()` la nuova versione prima del reload (altrimenti il SW servirebbe ancora la cache), incapsulato: chi riceve `apply` non deve saperlo. */
    private async showUpdateDialog(source: 'sw' | 'poll'): Promise<void> {
        if (this.updateShown) return;
        this.updateShown = true;

        const apply = (): void => {
            void (async () => {
                if (source === 'sw') {
                    try { await this.swUpdate.activateUpdate(); } catch { /* fallback al reload */ }
                }
                // Hard-reload per portare la nuova versione attiva
                window.location.reload();
            })();
        };

        const override = ContestoSito.config.onVersionUpdateAvailable;
        if (override) {
            // Cattura sia un throw sincrono sia un reject async (override può essere una funzione
            // async): senza il .catch sotto, un reject async passerebbe come unhandled rejection e
            // updateShown resterebbe bloccato a true per sempre.
            try {
                const result: unknown = override(apply);
                if (result instanceof Promise) {
                    result.catch((err: unknown) => {
                        console.error('[VersionCheckService] onVersionUpdateAvailable (async) ha lanciato, ricado sul dialog di default:', err);
                        void this.showDefaultUpdateDialog(apply);
                    });
                }
                return;
            } catch (err) {
                console.error('[VersionCheckService] onVersionUpdateAvailable ha lanciato, ricado sul dialog di default:', err);
            }
        }

        await this.showDefaultUpdateDialog(apply);
    }

    /** Dialog bloccante di default (Rifiuta/Accetta, `allowOutsideClick: false`): estratto a parte
     *  perché va invocato sia dal percorso sincrono di `showUpdateDialog` sia dal `.catch` asincrono
     *  di un `onVersionUpdateAvailable` che ha già superato il `try/catch` sincrono (vedi sopra). */
    private async showDefaultUpdateDialog(apply: () => void): Promise<void> {
        const confirmed = await this.notify.confirm(
            this.translate.translate('nuovaVersioneTitoloStato'),
            this.translate.translate('nuovaVersioneDescrizioneStato'),
            {
                icon: 'info',
                confirmText: this.translate.translate('aggiornaAppAzione'),
                allowOutsideClick: false, // Forza l'interazione per garantire che l'app si aggiorni
            }
        );

        if (confirmed) {
            apply();
        } else {
            // L'utente ha posticipato: chiude la subscription SW per non riproporre
            // il dialog da VERSION_READY nello stesso ciclo. Il polling di index.html
            // continuerà ogni intervallo configurato e mostrerà un nuovo dialog se esce
            // un aggiornamento successivo.
            this.swSub?.unsubscribe();
            this.swSub = null;
            this.updateShown = false;
        }
    }

    /** Pulizia della sottoscrizione SwUpdate alla distruzione (il polling si pulisce da solo via takeUntilDestroyed). */
    ngOnDestroy(): void {
        this.swSub?.unsubscribe();
    }
}