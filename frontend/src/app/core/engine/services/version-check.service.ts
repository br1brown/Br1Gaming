import { Injectable, OnDestroy, PLATFORM_ID, inject, DOCUMENT } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SwUpdate } from '@angular/service-worker';
import { Subscription, filter } from 'rxjs';
import { NotificationService } from './notification.service';
import { TranslateService } from './translate.service';
import { CookieConsentService, isTechnicalConsentGiven } from './cookie-consent.service';

/** Intervallo di controllo: 10 minuti. */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

/**
 * VERSION CHECK SERVICE
 *
 * Sorgente di verità per la versione corrente: `ContestoSito.config.version`
 * dichiarata in `site.ts`. Il valore viene scritto a build time da
 * `generate-statics.ts`:
 *   - meta tag `app-version` in `index.html` (baseline + sorgente del polling)
 *   - hash di NGSW (usato da SwUpdate per la PWA installata)
 *
 * Quando rileva un aggiornamento (da una delle due fonti) propone il reload
 * all'utente. Entrambe le fonti sono attive in parallelo perché coprono
 * scenari diversi:
 *   - tab senza Service Worker (sempre quando `isWebApp:false`): SwUpdate è
 *     disabilitato → polling di `index.html` e confronto del meta `app-version`
 *   - PWA / tab con SW attivo: il SW intercetta e cache-a `index.html` → il
 *     polling vede la versione cache (stabile) e a decidere è SwUpdate tramite
 *     gli hash in ngsw.json
 *
 * Il polling punta a `index.html` (non al manifest) perché è sempre presente,
 * anche con `isWebApp:false` quando il manifest non viene generato né servito.
 */
@Injectable({ providedIn: 'root' })
export class VersionCheckService implements OnDestroy {
    private readonly document = inject(DOCUMENT);
    private readonly translate = inject(TranslateService);
    private readonly notify = inject(NotificationService);
    private readonly swUpdate = inject(SwUpdate);
    private readonly consent = inject(CookieConsentService);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    private currentVersion: string | null = null;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private swSub: Subscription | null = null;
    private updateShown = false;

    /**
     * Inizializza il monitoraggio.
     * Deve essere chiamato nel costruttore di app.component o tramite un initializer.
     */
    init(): void {
        /**
         * SICUREZZA PER SSR (Server Side Rendering):
         * setInterval crea una macrotask che impedirebbe ad Angular Universal di terminare
         * il rendering della pagina, causando il timeout del server.
         * Inoltre, il controllo versione ha senso solo nel client.
         */
        if (!this.isBrowser) return;

        /**
         * GATE SUL CONSENSO TECNICO:
         * Quando un consenso tecnico SERVE (sito multilingua, PWA, o con cookie tecnici di
         * progetto) il polling parte solo dopo che l'utente lo accetta: senza consenso il
         * Service Worker non è registrato (vedi provideServiceWorker in app.config.ts) e un
         * fetch ricorrente ogni 10 minuti sarebbe spreco di risorse senza un meccanismo di
         * aggiornamento attivo. All'accettazione, al reload successivo, SwUpdate si integra e
         * il controllo versione riparte.
         *
         * MA se il consenso tecnico NON serve affatto (sito mono-lingua, non-PWA, senza cookie
         * tecnici) non c'è alcun banner da accettare: in quel caso il polling è l'UNICO
         * meccanismo di aggiornamento e va attivato comunque. Legge solo il meta `app-version`
         * da index.html via fetch e non scrive cookie, quindi non richiede consenso. Senza
         * questo ramo, su un sito così il controllo versione resterebbe spento per sempre —
         * proprio lo scenario che emerge con `isWebApp:false`.
         */
        if (this.consent.isTechnicalNeeded() && !isTechnicalConsentGiven()) return;

        // Recupera la versione attuale iniettata nel meta tag dell'index.html
        this.currentVersion = this.document
            .querySelector('meta[name="app-version"]')
            ?.getAttribute('content') ?? null;

        if (!this.currentVersion) return;

        // Zoneless: setInterval non innesca change detection (e check() aggiorna i signal,
        // che la innescano da soli). Nessun wrapping NgZone necessario.
        this.intervalId = setInterval(() => void this.check(), CHECK_INTERVAL_MS);

        // PWA: aggancia SwUpdate. Quando il SW finisce di scaricare una nuova
        // versione, emette VERSION_READY. Il polling sul manifest non funziona
        // dentro la PWA perché il SW serve il manifest dalla cache.
        if (this.swUpdate.isEnabled) {
            this.swSub = this.swUpdate.versionUpdates
                .pipe(filter(e => e.type === 'VERSION_READY'))
                .subscribe(() => void this.showUpdateDialog('sw'));
        }
    }

    /**
     * Polling: confronta la versione servita con quella in memoria.
     * Funziona in ogni tab senza SW (sempre quando `isWebApp:false`); con un SW attivo è
     * SwUpdate a prendere il sopravvento (il SW serve `index.html` dalla cache, quindi qui
     * la versione resta stabile finché non interviene SwUpdate).
     */
    private async check(): Promise<void> {
        // Evita di mostrare più dialog contemporaneamente se l'utente non ha ancora risposto
        if (this.updateShown) return;

        try {
            /**
             * Scarica `index.html` e legge il meta `app-version`. È la sorgente di versione
             * sempre presente — a differenza del manifest, che con `isWebApp:false` non viene
             * generato né servito (404). 'cache: no-store' è CRITICO: forza il browser a
             * ignorare la cache locale e chiedere al server l'ultima versione disponibile.
             * Nota: con un SW attivo l'index è servito dalla cache — qui ci affidiamo a SwUpdate.
             */
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

    /**
     * Mostra un popup all'utente informandolo dell'aggiornamento.
     * @param source 'sw' se l'evento arriva da SwUpdate (PWA), 'poll' se dal polling di index.html.
     *               In 'sw' attiva esplicitamente la nuova versione prima del reload,
     *               altrimenti il SW continuerebbe a servire l'app cached.
     */
    private async showUpdateDialog(source: 'sw' | 'poll'): Promise<void> {
        if (this.updateShown) return;
        this.updateShown = true;

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
            if (source === 'sw') {
                try { await this.swUpdate.activateUpdate(); } catch { /* fallback al reload */ }
            }
            // Hard-reload per portare la nuova versione attiva
            window.location.reload();
        } else {
            // L'utente ha posticipato: chiude la subscription SW per non riproporre
            // il dialog da VERSION_READY nello stesso ciclo. Il polling di index.html
            // continuerà ogni CHECK_INTERVAL_MS e mostrerà un nuovo dialog se esce
            // un aggiornamento successivo.
            this.swSub?.unsubscribe();
            this.swSub = null;
            this.updateShown = false;
        }
    }

    /** Pulizia del timer e della sottoscrizione SwUpdate alla distruzione. */
    ngOnDestroy(): void {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
        }
        this.swSub?.unsubscribe();
    }
}