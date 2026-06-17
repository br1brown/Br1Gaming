import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { NotificationService } from './notification.service';
import { TranslateService } from './translate.service';
import { SSR_API_PREFIX } from './base-api.service';
import { NotificationConnection } from './notification-connection';

/**
 * Notifica realtime ricevuta dal server via SSE.
 *
 * Volutamente generica: `type` guida il dispatch e `payload` è libero, così le notifiche
 * NON sono solo testuali — possono trasportare qualsiasi struttura (link, immagini, dati di
 * un'entità, avanzamento, azioni…). Il toast di default copre il caso semplice; per il resto
 * si registra un handler per tipo con {@link NotificationStreamService.on}.
 */
export interface StreamNotification<T = unknown> {
    /** Identificativo univoco del messaggio (per dedup/lista). */
    id: string;
    /** Tipo logico: seleziona la reazione lato client. */
    type: string;
    /** Dati applicativi della notifica (forma decisa dal mittente). */
    payload?: T;
    /** Istante di emissione (ISO 8601, UTC). */
    timestamp: string;
}

/**
 * Forma attesa dal toast di default (tipo `"toast"`).
 *
 * Per l'i18n il server manda preferibilmente una **chiave** (`messageKey`) + eventuali parametri,
 * così il testo è tradotto lato client nella lingua corrente; `message` resta per contenuto
 * letterale/dinamico senza chiave.
 */
export interface ToastPayload {
    /** Testo letterale (contenuto dinamico senza chiave di traduzione). */
    message?: string;
    /** Chiave di traduzione (preferita): tradotta lato client nella lingua corrente. */
    messageKey?: string;
    /** Parametri posizionali per l'interpolazione `{0}`, `{1}`… della chiave. */
    messageParams?: unknown[];
    /** Icona del toast / del campanellino. */
    icon?: 'success' | 'error' | 'info' | 'warning';
}

/** Reazione registrata per un tipo di notifica. */
export type NotificationHandler<T = unknown> = (notification: StreamNotification<T>) => void;

/**
 * NOTIFICATION STREAM SERVICE
 *
 * Estende — per composizione — il {@link NotificationService}: si occupa SOLO del trasporto
 * realtime (apre un `EventSource` verso l'endpoint SSE dell'engine) e del dispatch, mentre per
 * mostrare riusa ciò che NotificationService già espone (es. `toast`). Non reimplementa la UI.
 *
 * Caratteristiche:
 *  - **Solo browser**: in SSR non apre nulla (niente connessioni server-side, niente FOUC).
 *  - **Zoneless-safe**: ogni evento in arrivo viene scritto in un `signal`, così la change
 *    detection (signal-based, senza zone.js) se ne accorge.
 *  - **Stato reattivo**: `notifications()` espone la lista ricevuta (per badge / centro notifiche),
 *    oltre all'eventuale toast.
 *  - **Dispatch per tipo**: `on(type, handler)` registra una reazione custom; senza handler per
 *    quel tipo si ricade sul toast di default. È il punto in cui rendi le notifiche "non testuali".
 *
 * Attivazione: il servizio si connette da sé quando viene iniettato in un contesto browser
 * (es. nel costruttore di un componente sempre attivo). Non è auto-iniettato globalmente, così
 * un sito apre lo stream solo se davvero gli serve.
 */
@Injectable({ providedIn: 'root' })
export class NotificationStreamService {
    /** Tetto della lista lato client: in una scheda longeva le notifiche non crescono all'infinito. */
    private static readonly MAX_ITEMS = 50;

    private readonly platformId = inject(PLATFORM_ID);
    private readonly apiPrefix = inject(SSR_API_PREFIX);
    private readonly notify = inject(NotificationService);
    private readonly translate = inject(TranslateService);
    private readonly http = inject(HttpClient);
    // Holder inerte e condiviso: lo popoliamo qui, lo legge il BaseApiService (header X-Connection-Id)
    // senza dover iniettare questo servizio e quindi senza aprire una SSE non richiesta.
    private readonly connection = inject(NotificationConnection);

    private readonly _connected = signal(false);
    private readonly _notifications = signal<readonly StreamNotification[]>([]);
    private readonly _unread = signal(0);
    private readonly _lastLive = signal('');

    /** Id di questa connessione, comunicato dal server. Da allegare alle richieste che avviano un
     *  job per ricevere la notifica mirata di fine elaborazione. `null` finché non connesso. */
    readonly connectionId = this.connection.id;
    /** `true` mentre lo stream è aperto e ha ricevuto l'handshake iniziale. */
    readonly connected = this._connected.asReadonly();
    /** Storico reattivo delle notifiche ricevute in questa sessione (le più recenti in coda). */
    readonly notifications = this._notifications.asReadonly();
    /** Notifiche arrivate dal vivo e non ancora viste (badge del campanellino). Reset con {@link markAllRead}. */
    readonly unread = this._unread.asReadonly();
    /** Testo dell'ultima notifica arrivata dal vivo: usato come regione `aria-live` per gli screen reader. */
    readonly lastLive = this._lastLive.asReadonly();

    private source?: EventSource;
    private readonly handlers = new Map<string, NotificationHandler>();

    constructor() {
        // Connessione lazy: parte solo se iniettato lato browser. In SSR resta inerte.
        if (isPlatformBrowser(this.platformId)) this.connect();
    }

    /** Apre lo stream SSE (idempotente). No-op in SSR o se già connesso. */
    connect(): void {
        if (!isPlatformBrowser(this.platformId) || this.source) return;

        const source = new EventSource(`${this.apiPrefix}/notifications/stream`);
        this.source = source;

        // Handshake: il server invia il connectionId come primo frame.
        source.addEventListener('connection', event => {
            try {
                this.connection.set((JSON.parse((event as MessageEvent).data) as { connectionId: string }).connectionId);
                this._connected.set(true);
            } catch { /* frame malformato: ignora */ }
        });

        // Notifica applicativa.
        source.addEventListener('notification', event => {
            try { this.ingest(JSON.parse((event as MessageEvent).data) as StreamNotification); }
            catch { /* frame malformato: ignora */ }
        });

        // Su un errore transitorio EventSource resta in CONNECTING e ritenta da sé (rimandando
        // Last-Event-ID → il server replaya dallo storico): qui aggiorniamo solo lo stato. Su un
        // errore terminale (handshake fallito, content-type errato, CORS) va in CLOSED e NON
        // ritenta: liberiamo il riferimento e riproviamo noi, così lo stream riparte quando il
        // backend torna su invece di restare morto per tutta la vita della scheda.
        source.onopen = () => {
            this._connected.set(true);
            // Ri-idrata lo storico a ogni (ri)apertura: al primo collegamento popola il campanellino;
            // dopo una riconnessione recupera l'eventuale buco anche quando manca Last-Event-ID
            // (es. caduta subito dopo l'handshake, che è senza id). La dedup per id evita i doppioni.
            this.loadHistory();
        };
        source.onerror = () => {
            this._connected.set(false);
            this.connection.set(null); // connectionId non più valido finché non arriva un nuovo frame `connection`
            if (source.readyState === EventSource.CLOSED) {
                source.close();
                this.source = undefined;
                setTimeout(() => this.connect(), 3000);
            }
        };
    }

    /**
     * Recupera lo storico dal server e lo fonde nello stato (dedup per id). Best-effort:
     * un errore è silenzioso, lo stream dal vivo resta la fonte principale. Lo storico recuperato
     * NON conta come "non letto" (sono notifiche già passate).
     */
    loadHistory(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.http.get<StreamNotification[]>(`${this.apiPrefix}/notifications/history`).subscribe({
            next: history => {
                if (!history?.length) return;
                this._notifications.update(current => {
                    const seen = new Set(current.map(n => n.id));
                    const merged = [...history.filter(n => !seen.has(n.id)), ...current];
                    return this.capped(merged);
                });
            },
            error: () => { /* storico best-effort: nessuna notifica d'errore */ }
        });
    }

    /** Azzera il contatore delle notifiche non lette (es. all'apertura del campanellino). */
    markAllRead(): void {
        this._unread.set(0);
    }

    /** Chiude lo stream e azzera lo stato di connessione. */
    disconnect(): void {
        this.source?.close();
        this.source = undefined;
        this._connected.set(false);
        this.connection.set(null);
    }

    /**
     * Registra la reazione per un tipo di notifica, sovrascrivendo il default (toast).
     * Qui rendi le notifiche "non solo testuali": l'handler può aprire un modale ricco
     * (`notify.interact`), mostrare un'immagine, un link/azione, o pilotare un componente
     * leggendo {@link notifications}.
     */
    on<T = unknown>(type: string, handler: NotificationHandler<T>): void {
        this.handlers.set(type, handler as NotificationHandler);
    }

    /** Rimuove la reazione registrata per un tipo (torna al default). */
    off(type: string): void {
        this.handlers.delete(type);
    }

    /** Svuota lo storico reattivo delle notifiche. */
    clear(): void {
        this._notifications.set([]);
    }

    /**
     * Risolve il testo di una notifica per la visualizzazione: preferisce la chiave di traduzione
     * (`messageKey` + `messageParams`), poi il testo letterale (`message`), infine il tipo come
     * fallback. Riusato dal campanellino così la logica di testo vive in un solo posto.
     */
    resolveText(notification: StreamNotification): string {
        const payload = (notification.payload ?? {}) as Partial<ToastPayload>;
        if (payload.messageKey) return this.translate.translate(payload.messageKey, ...(payload.messageParams ?? []));
        return payload.message ?? notification.type;
    }

    private ingest(notification: StreamNotification): void {
        // Idempotente: un id già presente (replay dopo riconnessione, o overlap con lo storico)
        // non viene riaggiunto né riconteggiato. È la dedup che rende sicuro il recupero SSE.
        if (this._notifications().some(n => n.id === notification.id)) return;

        // Stato reattivo (signal), con tetto sulla lunghezza per non crescere all'infinito.
        this._notifications.update(list => this.capped([...list, notification]));
        this._unread.update(count => count + 1);

        // Testo mostrabile (chiave tradotta o letterale): pilota sia l'annuncio aria-live sia il
        // toast di default. Un payload di solo `type` non ha testo → niente stringa tecnica letta
        // dallo screen reader e niente toast vuoto (resta comunque nello storico del campanellino).
        const text = this.toastText(notification);
        if (text) this._lastLive.set(text);

        // Dispatch per tipo: handler custom se registrato, altrimenti toast di default.
        const handler = this.handlers.get(notification.type);
        if (handler) {
            handler(notification);
            return;
        }
        if (text) {
            const icon = ((notification.payload ?? {}) as Partial<ToastPayload>).icon ?? 'info';
            this.notify.toast(text, icon);
        }
    }

    /** Testo mostrabile del toast: chiave tradotta (`messageKey` + `messageParams`) o testo
     *  letterale (`message`); `undefined` se assenti — un payload di solo `type` non produce testo. */
    private toastText(notification: StreamNotification): string | undefined {
        const payload = (notification.payload ?? {}) as Partial<ToastPayload>;
        return payload.messageKey
            ? this.translate.translate(payload.messageKey, ...(payload.messageParams ?? []))
            : payload.message;
    }

    /** Tiene solo le ultime {@link MAX_ITEMS} notifiche (le più recenti sono in coda). */
    private capped(list: readonly StreamNotification[]): readonly StreamNotification[] {
        return list.length > NotificationStreamService.MAX_ITEMS
            ? list.slice(-NotificationStreamService.MAX_ITEMS)
            : list;
    }
}
