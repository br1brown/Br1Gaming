import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ApplicationRef, DestroyRef, EffectRef, EnvironmentInjector, Injectable, PLATFORM_ID, TemplateRef, Type, createComponent, effect, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { AppearanceService } from './appearance.service';
import { TranslateService } from './translate.service';
import type { ProblemDetails } from './base-api.service';

type SwalType = typeof import('sweetalert2').default;
type ModalType = typeof import('bootstrap/js/src/modal.js').default;

/** Un pulsante del piè di una modale (`ModalOptions.actions`): stessa forma di una voce di menu contestuale (testo, icona, funzione), più cosa fa alla modale. */
export interface ModalAction {
    /** Chiave i18n o testo del pulsante. */
    label: string;
    /** Classi di un glifo Font Awesome (`fa-solid fa-check`), facoltativo. */
    icon?: string;
    /** Eseguita al clic. Può essere asincrona: finché non finisce i pulsanti del piè sono disabilitati (`aria-busy`). Se risolve `false` o lancia, la modale resta aperta anche con `closes`. */
    action?: () => void | boolean | Promise<void | boolean>;
    /** Il pulsante chiude la modale, dopo l'azione e rispettando `canClose`. Default `false`. Senza `action` è un semplice «Annulla»/«Chiudi». */
    closes?: boolean;
    /** Aspetto: `primary` (azione principale), `secondary` (default), `danger`, `link`. */
    variant?: 'primary' | 'secondary' | 'danger' | 'link';
    /** Pulsante disabilitato quando la funzione dà `true`. Si legge in un `effect`: se legge dei signal, il pulsante li segue da solo finché la modale è aperta. */
    disabled?: () => boolean;
}

const MODAL_ACTION_CLASS: Record<NonNullable<ModalAction['variant']>, string> = {
    primary: 'btn-primary', secondary: 'btn-outline-secondary', danger: 'btn-danger', link: 'btn-link',
};

/** Opzioni di {@link NotificationService.modal}. */
export interface ModalOptions {
    /** Elemento a cui ridare il focus alla chiusura (di norma il bottone che ha aperto la modale). */
    returnFocusTo?: HTMLElement | null;
    /** Input iniziali di un componente (`setInput`). */
    inputs?: Record<string, unknown>;
    /** Prima di chiudere (Escape, click fuori, `close()`): `false` tiene la modale aperta. */
    canClose?: () => boolean | Promise<boolean>;
    /** `false`: Escape non chiude (il focus resta comunque intrappolato). Default `true`. */
    escape?: boolean;
    /** Etichetta del dialog per gli screen reader. */
    ariaLabel?: string;
    /** Classi Bootstrap sul `.modal-dialog`: `modal-lg`, `modal-dialog-centered`, `modal-dialog-fit`... */
    dialogClass?: string;
    /** `true`: niente pannello `.modal-content` (il contenuto porta la sua `.card`, o è un'immagine). */
    bare?: boolean;
    /** Titolo della modale (già tradotto): il servizio disegna da sé l'intestazione standard, con la X di chiusura (`.btn-close`, 44 px, «Chiudi»), e dà
     *  al dialogo il titolo come nome (`aria-labelledby`). Il contenuto allora non scrive un suo `.modal-header`. Senza `title` né `closeButton` la modale resta com'era:
     *  l'intestazione, se c'è, è del contenuto. Ignorato con `bare`. */
    title?: string;
    /** Glifo Font Awesome davanti al titolo (`fa-solid fa-pen`), decorativo. Solo con `title`. */
    titleIcon?: string;
    /** Pulsanti del piè, descritti come le voci di un menu contestuale (testo, icona, funzione) più `closes`: il servizio disegna il `.modal-footer` e le funzioni girano quando si preme.
     *  Il contenuto resta il corpo della modale (`.modal-body`), senza piè scritto a mano. Ignorato con `bare`. */
    actions?: readonly ModalAction[];
    /** Con `title` la X c'è sempre (`false` la toglie: una modale che si chiude solo con un'azione sua). Da sola, senza `title`, `true` disegna un'intestazione con la sola X. */
    closeButton?: boolean;
    /** Con intestazione o piè disegnati dal servizio (`title`, `closeButton`, `actions`) il corpo scorre e intestazione e piè restano fermi (`modal-dialog-scrollable`). `false` lascia scorrere l'intera modale. Default `true`. */
    scrollable?: boolean;
    /** Una sola modale per chiave: se ce n'è già una aperta con la stessa `key`, `modal()` restituisce la sua maniglia invece di aprirne un'altra (un doppio clic sul bottone che apre non ne apre due).
     *  Contenuto e opzioni della seconda chiamata si ignorano. */
    key?: string;
    /** Il componente (o servizio) che apre la modale: quando viene distrutto la modale si chiude da sé, senza `canClose` (`afterClosed` dice `'owner'`). Di solito `inject(DestroyRef)`. */
    owner?: DestroyRef;
    /** `'none'`: il focus iniziale lo mette il contenuto, o se ci prova a modale ancora nascosta il suo `[autofocus]`
     *  (default: `[autofocus]`, `.btn-close`, primo focusabile). */
    initialFocus?: 'auto' | 'none';
}

/** Come si è chiusa una modale (`ModalRef.afterClosed`): `action` = un pulsante di `actions` con `closes`; `closed` = `ref.close()` chiamato dal codice (di solito a lavoro finito);
 *  `dismiss` = la X, Escape o un clic fuori (l'utente ha rinunciato); `navigation` = cambio pagina; `owner` = il componente che l'aveva aperta è stato distrutto (`owner`). */
export type ModalCloseReason = 'action' | 'closed' | 'dismiss' | 'navigation' | 'owner';

/** Maniglia di una modale aperta con {@link NotificationService.modal}. */
export interface ModalRef<T = unknown> {
    /** Istanza del componente montato; `null` per un template. */
    readonly instance: T | null;
    /** Chiude rispettando `canClose`; `true` se chiusa davvero. */
    close(): Promise<boolean>;
    /** Risolve alla chiusura, da qualunque via (anche un cambio pagina), dicendo come (`ModalCloseReason`). */
    readonly afterClosed: Promise<ModalCloseReason>;
}

const MODAL_FOCUS_TARGETS = '[autofocus], .btn-close, button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ValidationResult {
    isValid: boolean;
    errors?: string[];
}

/** Esito di {@link NotificationService.choose}: `confirm` = bottone principale, `deny` = rifiuto
 *  esplicito (diverso da annullare), `cancel` = nessuna decisione (Annulla/ESC/clic fuori). */
export type ConfirmChoice = 'confirm' | 'deny' | 'cancel';

/** Dove compare un toast: i nove punti dello schermo, per nome. Tradotti in `notify.toast` nelle posizioni di SweetAlert2 (left/right seguono il verso di scrittura). */
export type ToastPosition =
    | 'top' | 'top-left' | 'top-right'
    | 'center' | 'center-left' | 'center-right'
    | 'bottom' | 'bottom-left' | 'bottom-right';

const TOAST_POSITIONS: Record<ToastPosition, 'top' | 'top-start' | 'top-end' | 'center' | 'center-start' | 'center-end' | 'bottom' | 'bottom-start' | 'bottom-end'> = {
    'top': 'top', 'top-left': 'top-start', 'top-right': 'top-end',
    'center': 'center', 'center-left': 'center-start', 'center-right': 'center-end',
    'bottom': 'bottom', 'bottom-left': 'bottom-start', 'bottom-right': 'bottom-end',
};

export interface ToastOptions {
    /** Dove compare il toast. Default `'top-right'`. */
    position?: ToastPosition;
    /** Durata ms prima dell'auto-dismiss. `null` = persistente (niente timer, mostra il pulsante di chiusura). Default 3000. */
    durationMs?: number | null;
    /** Bottone d'azione nel toast (es. "Ripristina"): se premuto esegue `run()`. Con `keepOpen`, `false` lascia il toast aperto; una stringa aggiorna il messaggio e lo lascia aperto. */
    action?: { text: string; run: () => void | boolean | string | Promise<void | boolean | string>; keepOpen?: boolean };
}

/** Configurazione di {@link NotificationService.promise}: messaggi del ciclo di vita async. */
export interface PromiseToastConfig<T> {
    /** Testo dello spinner bloccante mentre il lavoro è in corso. */
    loading?: string;
    /** Toast di successo a lavoro riuscito (stringa o funzione del risultato). */
    success?: string | ((value: T) => string);
    /** Toast d'errore se il lavoro fallisce. L'eccezione viene comunque rilanciata. */
    error?: string;
}

/** Ogni interazione non "in pagina" passa da qui, senza che il chiamante sappia la libreria: messaggi,
 *  domande e toast (SweetAlert2), modali che ospitano un componente (`modal`, Bootstrap Modal).
 *  `handleApiError()` legge `ProblemDetails` (RFC 9457) dal backend o traduce lo status HTTP via i18n. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
    private translate = inject(TranslateService);
    private theme = inject(AppearanceService);
    private platformId = inject(PLATFORM_ID);
    private readonly document = inject(DOCUMENT);
    private readonly appRef = inject(ApplicationRef);
    private readonly envInjector = inject(EnvironmentInjector);
    private readonly router = inject(Router);
    private swalPromise?: Promise<SwalType>;
    private modalPromise?: Promise<ModalType>;
    private shownOnceKeys = new Set<string>();   // chiavi già mostrate da toastOnce() in questa sessione
    private readonly openModalHosts: HTMLElement[] = [];   // modali Bootstrap aperte, l'ultima in cima
    private readonly modalsByKey = new Map<string, ModalRef<unknown>>();
    private modalSeq = 0;   // id univoci per i titoli delle modali

    private loadSwal(): Promise<SwalType> | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        // Build "senza stile": la variante bare inietta il proprio CSS via <style> senza nonce, che
        // la CSP di questo template scarta in silenzio (modale in fondo alla pagina, mai in overlay).
        // Il CSS base va quindi caricato staticamente via <link> (angular.json), qui solo il JS puro.
        return this.swalPromise ??= import('sweetalert2/dist/sweetalert2.esm.js').then(module => module.default);
    }

    /** SwAl pre-configurato col tema: theme light/dark segue `themeTone` (i colori del popup vengono dal ponte `--swal2-*` → token brand in `_bootstrap-theme.scss`), bottoni Bootstrap (success/outline-secondary/danger, `buttonsStyling: false`). Ricreato ad ogni call per seguire themeTone e la modale aperta (`swalTarget`). */
    private loadThemedSwal(): Promise<SwalType> | null {
        const base = this.loadSwal();
        if (!base) return null;
        const themeVariant = this.theme.themeTone() === 'dark'
            ? 'bootstrap-5-dark'
            : 'bootstrap-5-light';
        return base.then(Swal => Swal.mixin({
            theme: themeVariant,
            target: this.swalTarget(),
            // Dopo un clic il focus da ridare può mancare (resta su <body>): dentro una modale torna a lei, o Escape non la chiude.
            didClose: () => {
                const host = this.openModalHosts.at(-1);
                if (host?.isConnected && !host.contains(this.document.activeElement)) host.focus({ preventScroll: true });
            },
            buttonsStyling: false,
            // Nome della X in italiano (o nella lingua del sito): di serie SweetAlert dice «Close this dialog» in inglese.
            // Stringhe di serie di SweetAlert («OK», «Cancel», «No», «Close this dialog»): inglese a prescindere dalla lingua del sito. Qui nella lingua corrente
            // (il mixin si ricrea a ogni chiamata, quindi segue un cambio lingua); chi passa i propri testi (`confirmText`…) li ha comunque vinti.
            confirmButtonText: this.translate.translate('confermaAzione'),
            denyButtonText: this.translate.translate('noAzione'),
            cancelButtonText: this.translate.translate('annullaAzione'),
            closeButtonAriaLabel: this.translate.translate('chiudiAzione'),
            customClass: {
                confirmButton: 'btn btn-success',
                cancelButton:  'btn btn-outline-secondary ms-2',
                denyButton:    'btn btn-danger ms-2',
            },
        }));
    }

    /** SweetAlert monta dentro la modale Bootstrap in cima, se ce n'è una: su `<body>` il focus trap
     *  della modale (in ascolto su tutto il documento) strapperebbe il focus al popup. */
    private swalTarget(): HTMLElement {
        return this.openModalHosts.at(-1) ?? this.document.body;
    }

    // --- MODALI (Bootstrap) ---

    private loadModal(): Promise<ModalType> | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        // Solo il componente Modal dai sorgenti ESM: il bundle intero porterebbe anche Popper.
        return this.modalPromise ??= import('bootstrap/js/src/modal.js').then(module => module.default);
    }

    /** Modale che ospita un componente o un `<ng-template>`: focus intrappolato, Escape, click fuori,
     *  scroll bloccato e focus di ritorno li dà Bootstrap. Il contenuto può chiamare `confirm`/`toast`:
     *  il popup SweetAlert si apre dentro la modale (`swalTarget`). */
    modal<T>(content: Type<T> | TemplateRef<unknown>, options: ModalOptions = {}): ModalRef<T> {
        const open = options.key != null ? this.modalsByKey.get(options.key) : undefined;
        if (open) return open as ModalRef<T>;
        const host = this.document.createElement('div');
        host.className = 'modal fade';
        host.tabIndex = -1;
        host.setAttribute('role', 'dialog');
        host.setAttribute('aria-modal', 'true');
        if (options.ariaLabel) host.setAttribute('aria-label', options.ariaLabel);
        const dialog = this.document.createElement('div');
        // Un titolo vuoto o di soli spazi vale come nessun titolo: un `h2` vuoto lascerebbe il dialogo senza nome.
        const title = options.title?.trim() || undefined;
        const drawsChrome = !options.bare && (title != null || options.closeButton != null || (options.actions?.length ?? 0) > 0);
        dialog.className = `modal-dialog ${drawsChrome && (options.scrollable ?? true) ? 'modal-dialog-scrollable' : ''} ${options.dialogClass ?? ''}`.replace(/\s+/g, ' ').trim();
        const slot = this.document.createElement('div');
        slot.className = options.bare ? 'modal-content modal-content-bare' : 'modal-content';
        dialog.appendChild(slot);
        host.appendChild(dialog);

        // Intestazione standard (`title` / `closeButton`): titolo e X sono del servizio, così tutte le modali si chiudono allo stesso modo.
        // `close` è definita più sotto: il clic arriva a modale già costruita.
        const wantsX = options.closeButton ?? title != null;
        if (!options.bare && (title != null || wantsX)) {
            const header = this.document.createElement('div');
            header.className = 'modal-header';
            if (title != null) {
                const titleEl = this.document.createElement('h2');
                titleEl.className = 'modal-title h5 mb-0';
                titleEl.id = `modal-title-${++this.modalSeq}`;
                if (options.titleIcon) {
                    const icon = this.document.createElement('i');
                    icon.className = `${options.titleIcon} me-2`;
                    icon.setAttribute('aria-hidden', 'true');
                    titleEl.appendChild(icon);
                }
                titleEl.appendChild(this.document.createTextNode(title));
                header.appendChild(titleEl);
                if (!options.ariaLabel) host.setAttribute('aria-labelledby', titleEl.id);
            }
            if (wantsX) {
                const x = this.document.createElement('button');
                x.type = 'button';
                x.className = 'btn-close';
                x.setAttribute('aria-label', this.translate.translate('chiudiAzione'));
                x.addEventListener('click', () => void closeWith('dismiss'));
                header.appendChild(x);
            }
            slot.appendChild(header);
        }

        let instance: T | null = null;
        let view: { destroy(): void };
        if (content instanceof TemplateRef) {
            const embedded = content.createEmbeddedView(undefined);
            this.appRef.attachView(embedded);
            for (const node of embedded.rootNodes as Node[]) slot.appendChild(node);
            view = embedded;
        } else {
            const ref = createComponent(content, { environmentInjector: this.envInjector });
            for (const [name, value] of Object.entries(options.inputs ?? {})) ref.setInput(name, value);
            this.appRef.attachView(ref.hostView);
            // Con intestazione/piè del servizio il suo `.modal-body` deve essere figlio diretto del pannello per scorrere: l'elemento host non fa da scatola.
            if (drawsChrome) (ref.location.nativeElement as HTMLElement).style.display = 'contents';
            slot.appendChild(ref.location.nativeElement);
            instance = ref.instance;
            view = ref;
        }
        const effectRefs: EffectRef[] = [];
        // Intestazione o piè del servizio e contenuto senza un suo `.modal-body`: il servizio lo avvolge, così il corpo scorre e non viene tagliato.
        if (drawsChrome && !slot.querySelector('.modal-body')) {
            const body = this.document.createElement('div');
            body.className = 'modal-body';
            for (const node of Array.from(slot.childNodes)) if (!(node instanceof HTMLElement && node.classList.contains('modal-header'))) body.appendChild(node);
            slot.appendChild(body);
        }
        // Piè standard (`actions`): pulsanti, uno alla volta in azione; `closes` chiude dopo la funzione.
        if (!options.bare && options.actions?.length) {
            const footer = this.document.createElement('div');
            footer.className = 'modal-footer';
            const buttons: { el: HTMLButtonElement; action: ModalAction; off: boolean }[] = [];
            let busy = false;
            const sync = (b: { el: HTMLButtonElement; action: ModalAction; off: boolean }): void => { b.el.disabled = busy || b.off; };
            const setBusy = (value: boolean): void => {
                busy = value;
                for (const b of buttons) { sync(b); if (value) b.el.setAttribute('aria-busy', 'true'); else b.el.removeAttribute('aria-busy'); }
            };
            for (const action of options.actions) {
                const button = this.document.createElement('button');
                button.type = 'button';
                button.className = `btn btn-touch ${MODAL_ACTION_CLASS[action.variant ?? 'secondary']}`;
                if (action.icon) {
                    const icon = this.document.createElement('i');
                    icon.className = `${action.icon} me-2`;
                    icon.setAttribute('aria-hidden', 'true');
                    button.appendChild(icon);
                }
                button.appendChild(this.document.createTextNode(this.translate.translate(action.label)));
                button.addEventListener('click', () => {
                    if (busy) return;
                    void (async () => {
                        setBusy(true);
                        let keepOpen = false;
                        try {
                            keepOpen = (await action.action?.()) === false;
                        } finally {
                            setBusy(false);
                        }
                        if (action.closes && !keepOpen) void closeWith('action');
                    })();
                });
                const entry = { el: button, action, off: false };
                buttons.push(entry);
                if (action.disabled) {
                    const fn = action.disabled;
                    const ref = effect(() => { entry.off = fn(); sync(entry); }, { injector: this.envInjector });
                    effectRefs.push(ref);
                }
                footer.appendChild(button);
            }
            slot.appendChild(footer);
        }

        this.document.body.appendChild(host);
        this.openModalHosts.push(host);

        let resolveClosed!: (reason: ModalCloseReason) => void;
        const afterClosed = new Promise<ModalCloseReason>(resolve => { resolveClosed = resolve; });
        let reason: ModalCloseReason = 'closed';
        let unregisterOwner: (() => void) | undefined;
        let allowed = false;
        let checking = false;
        let bsModal: InstanceType<ModalType> | null = null;
        let shown = false;

        const teardown = (): void => {
            const index = this.openModalHosts.indexOf(host);
            if (index >= 0) this.openModalHosts.splice(index, 1);
            // Un popup SweetAlert ancora aperto qui dentro (es. cambio pagina) sopravvive alla modale.
            const swalContainer = host.querySelector('.swal2-container');
            if (swalContainer) this.document.body.appendChild(swalContainer);
            for (const ref of effectRefs) ref.destroy();
            view.destroy();
            bsModal?.dispose();
            host.remove();
            options.returnFocusTo?.focus({ preventScroll: true });
            unregisterOwner?.();
            releaseKey();
            resolveClosed(reason);
        };
        // La key si libera appena la chiusura è decisa, non a fine animazione: chi chiude e riapre subito la stessa modale ne ottiene una nuova, non la maniglia che sta sparendo.
        const releaseKey = (): void => { if (options.key != null && this.modalsByKey.get(options.key) === ref) this.modalsByKey.delete(options.key); };
        const closeWith = async (why: ModalCloseReason): Promise<boolean> => {
            if (allowed || checking || !host.isConnected) return false;
            checking = true;
            try {
                if (options.canClose && !(await options.canClose())) return false;
            } finally {
                checking = false;
            }
            reason = why;
            allowed = true;
            releaseKey();
            hide();
            return true;
        };
        const close = (): Promise<boolean> => closeWith('closed');
        // Chiusura imposta (cambio pagina, componente distrutto): senza `canClose`, nessuna domanda.
        const force = (why: ModalCloseReason): void => {
            if (!allowed) reason = why;
            allowed = true;
            releaseKey();
            hide();
        };
        // Durante l'apertura Bootstrap ignora hide(): la modale resterebbe aperta, quindi si chiude appena aperta.
        const hide = (): void => {
            if (!bsModal) teardown();
            else if (shown) bsModal.hide();
            else host.addEventListener('shown.bs.modal', () => bsModal?.hide(), { once: true });
        };

        const ref: ModalRef<T> = { instance, close, afterClosed };
        if (options.key != null) this.modalsByKey.set(options.key, ref as ModalRef<unknown>);
        if (options.owner) {
            try { unregisterOwner = options.owner.onDestroy(() => force('owner')); }
            catch { queueMicrotask(() => force('owner')); }   // l'owner era già distrutto
        }

        const loaded = this.loadModal();
        if (!loaded) {
            teardown();
            return ref;
        }
        void loaded.then(Modal => {
            if (allowed) return;
            bsModal = new Modal(host, { backdrop: true, keyboard: options.escape ?? true, focus: true });
            // Escape, click fuori e hide(): tutto passa da qui, dove decide canClose.
            host.addEventListener('hide.bs.modal', e => { if (!allowed) { e.preventDefault(); void closeWith('dismiss'); } });
            host.addEventListener('hidden.bs.modal', teardown);
            // A fine apertura Bootstrap mette il focus sulla modale: con 'none' torna dove l'ha messo il contenuto.
            let contentFocus: HTMLElement | null = null;
            const trackFocus = (e: FocusEvent): void => { if (e.target instanceof HTMLElement && e.target !== host) contentFocus = e.target; };
            host.addEventListener('focusin', trackFocus);
            host.addEventListener('shown.bs.modal', () => {
                shown = true;
                host.removeEventListener('focusin', trackFocus);
                if (options.initialFocus !== 'none') host.querySelector<HTMLElement>(MODAL_FOCUS_TARGETS)?.focus();
                else (contentFocus?.isConnected ? contentFocus : host.querySelector<HTMLElement>('[autofocus]'))?.focus();
            });
            bsModal.show();
        });
        // Cambio pagina avvenuto: via la modale senza domande. Non a NavigationStart: il guard delle modifiche
        // non salvate può ancora annullarlo, e chiede dentro la modale ancora aperta.
        const nav = this.router.events.subscribe(e => {
            if (!(e instanceof NavigationEnd)) return;
            force('navigation');
        });
        void afterClosed.then(() => nav.unsubscribe());

        return ref;
    }

    // --- FEEDBACK STANDARD ---

    success(message: string, onClose?: () => void): void {
        const swal = this.loadThemedSwal();
        if (swal) {
            void swal.then(Swal =>
                // titleText/text, mai title/html: SweetAlert2 non sanifica, e il messaggio può venire dal backend o da una notifica.
                Swal.fire({ titleText: this.translate.translate('ottimoStato') + '!', text: message, icon: 'success', confirmButtonText: this.translate.translate('chiudiAzione') }).then(() => onClose?.())
            );
        } else if (isPlatformBrowser(this.platformId)) {
            window.alert(message);
            onClose?.();
        }
    }

    error(title: string, message: string): void {
        const swal = this.loadThemedSwal();
        if (swal) {
            void swal.then(Swal => {
                Swal.close();
                void Swal.fire({ titleText: title, text: message, icon: 'error', confirmButtonText: this.translate.translate('chiudiAzione') });
            });
        } else if (isPlatformBrowser(this.platformId)) {
            window.alert(`${title}\n${message}`);
        }
    }

    /** Dialogo a un solo bottone: risolve alla chiusura (bottone/ESC/clic fuori), comodo per un `await` seguito da un'azione. Per esiti specifici usa `success()`/`error()`. */
    async alert(title: string, text = '', opts?: {
        icon?: 'success' | 'error' | 'info' | 'warning' | 'question';
        confirmText?: string;
        allowOutsideClick?: boolean;
    }): Promise<void> {
        const swal = this.loadThemedSwal();
        if (!swal) {
            if (isPlatformBrowser(this.platformId)) window.alert(text ? `${title}\n${text}` : title);
            return;
        }
        const Swal = await swal;
        await Swal.fire({
            titleText: title,
            text: text || undefined,
            icon: opts?.icon,
            confirmButtonText: opts?.confirmText ?? this.translate.translate('chiudiAzione'),
            allowOutsideClick: opts?.allowOutsideClick ?? true,
            // un bottone solo: showCancelButton/showDenyButton restano false (default di Swal.fire)
        });
    }

    // --- LOADING ---

    openLoading(message?: string): void {
        void this.loadThemedSwal()?.then(Swal =>
            Swal.fire({
                titleText: message ?? this.translate.translate('caricamentoStato'),
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            })
        );
    }

    closeLoading(): void {
        void this.loadThemedSwal()?.then(Swal => Swal.close());
    }

    /** Esegue un lavoro asincrono mostrandone il ciclo di vita: spinner bloccante → toast di esito.
     *  Rilancia SEMPRE l'eccezione (il toast d'errore è solo UX), il chiamante decide il resto. In
     *  SSR esegue il lavoro senza UI (loading/toast no-op) e ne ritorna il valore. */
    async promise<T>(work: Promise<T> | (() => Promise<T>), config: PromiseToastConfig<T> = {}): Promise<T> {
        const run = typeof work === 'function' ? work() : work;
        this.openLoading(config.loading);
        try {
            const value = await run;
            this.closeLoading();
            if (config.success != null) {
                const msg = typeof config.success === 'function' ? config.success(value) : config.success;
                this.toast(msg, 'success');
            }
            return value;
        } catch (err) {
            this.closeLoading();
            if (config.error != null) this.toast(config.error, 'error');
            throw err;
        }
    }

    // --- INTERAZIONE ---

    async confirm(title: string, text: string, options?: {
        confirmText?: string;
        cancelText?: string;
        icon?: 'question' | 'info' | 'warning';
        allowOutsideClick?: boolean;
        /** Azione che toglie qualcosa (elimina, esci senza salvare): conferma in rosso e il focus su «Annulla», così un Invio distratto non cancella niente. */
        danger?: boolean;
    }): Promise<boolean> {
        const swal = this.loadThemedSwal();
        if (!swal) return false;

        const Swal = await swal;
        const result = await Swal.fire({
            titleText: title,
            text,
            icon: options?.icon ?? 'question',
            showCancelButton: true,
            ...(options?.danger ? {
                focusCancel: true,
                customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-outline-secondary ms-2', denyButton: 'btn btn-danger ms-2' },
            } : {}),
            confirmButtonText: options?.confirmText ?? this.translate.translate('siAzione'),
            cancelButtonText: options?.cancelText ?? this.translate.translate('annullaAzione'),
            allowOutsideClick: options?.allowOutsideClick ?? true,
        });
        return result.isConfirmed;
    }

    /** Dialogo a TRE vie: conferma / rifiuto esplicito / annulla (es. "modifiche non salvate" →
     *  Salva / Non salvare / Annulla) — distinzione che {@link confirm} booleano non coglie.
     *  Ritorna 'cancel' anche su ESC/clic fuori e in SSR. */
    async choose(title: string, text: string, options?: {
        confirmText?: string;
        denyText?: string;
        cancelText?: string;
        icon?: 'question' | 'info' | 'warning';
        allowOutsideClick?: boolean;
    }): Promise<ConfirmChoice> {
        const swal = this.loadThemedSwal();
        if (!swal) return 'cancel';

        const Swal = await swal;
        const result = await Swal.fire({
            titleText: title,
            text,
            icon: options?.icon ?? 'question',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: options?.confirmText ?? this.translate.translate('siAzione'),
            denyButtonText:    options?.denyText    ?? this.translate.translate('noAzione'),
            cancelButtonText:  options?.cancelText  ?? this.translate.translate('annullaAzione'),
            allowOutsideClick: options?.allowOutsideClick ?? true,
        });
        if (result.isConfirmed) return 'confirm';
        if (result.isDenied) return 'deny';
        return 'cancel';
    }

    async prompt(title: string, inputLabel: string,
        confirmText?: string,
        cancelText?: string,
        defaultValue?: string,
        validator?: (value: string) => ValidationResult
    ): Promise<string | null> {
        const swal = this.loadThemedSwal();
        if (!swal) {
            if (isPlatformBrowser(this.platformId)) {
                return window.prompt(`${title}\n${inputLabel}`, defaultValue ?? '') ?? null;
            }
            return null;
        }

        const Swal = await swal;
        const result = await Swal.fire({
            titleText: title,
            input: 'text',
            inputLabel,
            inputPlaceholder: inputLabel,
            inputValue: defaultValue ?? '',
            showCancelButton: true,
            confirmButtonText: confirmText ?? this.translate.translate('siAzione'),
            cancelButtonText: cancelText ?? this.translate.translate('annullaAzione'),
            inputValidator: (value: string) => {
                if (validator) {
                    const res = validator(value);
                    return !res.isValid ? this.formatErrors(res.errors) : null;
                }
                if (!value) {
                    return this.translate.translate('campoObbligatorioErrore');
                }
                return null;
            }
        });
        return result.isConfirmed ? (result.value as string) : null;
    }

    private formatErrors(errors?: string[], html = false): string {
        if (!errors?.length) return this.translate.translate('fallbackErrore');
        return html ? errors.join('<br>') : errors.join('\n');
    }

    // --- TOAST ---

    toast(message: string, icon: 'success' | 'error' | 'info' | 'warning' = 'success', opts?: ToastOptions): void {
        void this.loadThemedSwal()?.then(Swal => {
            // error/warning → annuncio assertivo (interrompe lo screen reader);
            // success/info → polite (non interrompe).
            const assertive = icon === 'error' || icon === 'warning';
            const timer = opts?.durationMs === undefined ? 3000 : opts.durationMs;   // undefined → 3s; null → persistente
            const persistent = timer == null;
            const action = opts?.action;
            let focusBeforeToast: HTMLElement | null = null;   // da dove è arrivato il focus da tastiera
            const Toast = Swal.mixin({
                toast: true,
                position: TOAST_POSITIONS[opts?.position ?? 'top-right'],
                showConfirmButton: !!action,
                confirmButtonText: action?.text,
                showCloseButton: persistent,                       // persistente → serve comunque un modo per chiuderlo
                timer: persistent ? undefined : timer,
                timerProgressBar: !persistent,
                didOpen: (toast) => {
                    // a11y (WCAG 2.2.1 + 4.1.3): il toast deve essere annunciato dagli
                    // screen reader e il suo timer pausabile sia col mouse sia da tastiera.
                    toast.setAttribute('role', assertive ? 'alert' : 'status');
                    toast.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
                    // tabindex=0 rende il toast raggiungibile e focusabile: senza questo gli
                    // handler focus/blur sotto non scattavano mai → utente keyboard-only non
                    // poteva mettere in pausa l'auto-dismiss.
                    toast.setAttribute('tabindex', '0');
                    if (!persistent) {                              // solo se c'è un timer da mettere in pausa
                        toast.addEventListener('mouseenter', Swal.stopTimer);
                        toast.addEventListener('mouseleave', Swal.resumeTimer);
                        toast.addEventListener('focus', Swal.stopTimer);
                        toast.addEventListener('blur', Swal.resumeTimer);
                    }
                    // Escape chiude il toast quando ha il focus, e solo lui (non la modale che lo contiene).
                    toast.addEventListener('keydown', (e) => {
                        if (e.key !== 'Escape') return;
                        e.stopPropagation();
                        void Swal.close();
                    });
                    toast.addEventListener('focusin', (e) => {
                        const from = e.relatedTarget;
                        if (from instanceof HTMLElement && !toast.contains(from)) focusBeforeToast = from;
                    });
                },
                // Chiuso col focus dentro: il focus torna da dove veniva, non su <body> (fuori da un'eventuale modale).
                willClose: (toast) => {
                    if (toast.contains(this.document.activeElement)) focusBeforeToast?.focus({ preventScroll: true });
                },
            });
            // `keepOpen`: l'azione gira in `preConfirm`, prima che SweetAlert chiuda il toast; `false` lo lascia aperto.
            const preConfirm = action?.keepOpen ? async (): Promise<boolean> => {
                Swal.stopTimer();
                let outcome: unknown = false;
                try { outcome = await action.run(); } catch { /* resta aperto, si può riprovare */ }
                if (outcome !== false && typeof outcome !== 'string') return true;
                if (typeof outcome === 'string') queueMicrotask(() => Swal.update({ titleText: outcome as string }));
                Swal.resumeTimer();
                return false;
            } : undefined;
            void Toast.fire({ icon, titleText: message, preConfirm }).then(result => {
                if (result.isConfirmed && action && !action.keepOpen) action.run();
            });
        });
    }

    /** Come `toast()`, ma mostrato al massimo una volta per sessione per `key` (dedup interna): avvisi di sistema che non devono ripetersi, senza un flag tenuto dal chiamante. */
    toastOnce(key: string, message: string, icon: 'success' | 'error' | 'info' | 'warning' = 'info', opts?: ToastOptions): void {
        if (this.shownOnceKeys.has(key)) return;
        this.shownOnceKeys.add(key);
        this.toast(message, icon, opts);
    }

    // --- VALIDAZIONE ---

    validationErrors(title: string, errors: string[] | Record<string, string[]>): void {
        const items = Array.isArray(errors)
            ? errors
            : Object.values(errors).flat();

        const swal = this.loadThemedSwal();
        if (swal) {
            void swal.then(Swal => {
                const ul = document.createElement('ul');
                ul.className = 'text-start small mb-0 mt-2';
                items.forEach(msg => {
                    const li = document.createElement('li');
                    li.textContent = msg;
                    ul.appendChild(li);
                });
                return Swal.fire({
                    titleText: title,
                    html: ul,
                    icon: 'warning',
                    confirmButtonText: this.translate.translate('chiudiAzione'),
                });
            });
        } else if (isPlatformBrowser(this.platformId)) {
            window.alert(`${title}\n${items.join('\n')}`);
        }
    }

    // --- ERRORI API ---

    handleApiError(
        httpStatus: number, 
        problem: ProblemDetails | null, 
        overrideKeys?: { titleKey?: string, descKey?: string }
    ): void {
        // Gestione standard 400 Bad Request con errori di validazione
        if (httpStatus === 400 && problem?.errors) {
            this.validationErrors(
                this.translate.translate('errore400Titolo'),
                problem.errors
            );
            return;
        }

        // 401 su un'azione (un salvataggio, un invio): «Non autorizzato… per accedere a questa pagina» non c'entra, la sessione è finita. Chi vuole un
        // testo suo passa `overrideKeys`; la pagina negata dal guard ha i suoi (errore401*).
        const keyInfo = overrideKeys?.titleKey ?? (httpStatus === 401 ? 'sessioneScadutaTitolo' : `errore${httpStatus}Titolo`);
        const keyDesc = overrideKeys?.descKey ?? (httpStatus === 401 ? 'sessioneScadutaDescrizione' : `errore${httpStatus}Descrizione`);

        let errorInfo = this.translate.translate(keyInfo);
        let errorMessage = this.translate.translate(keyDesc);

        // Se `translate` restituisce esattamente la chiave in ingresso (es. "errore418Titolo"),
        // significa che non esiste una traduzione definita nei file JSON per quello status code.
        const hasSpecificTitle = errorInfo !== keyInfo;
        const hasSpecificDesc = errorMessage !== keyDesc;

        // Se non abbiamo una descrizione tradotta per questo status, usiamo quella di fallback
        if (!hasSpecificDesc) errorMessage = this.translate.translate('erroreImprevisto');
        
        // Se non abbiamo un titolo tradotto, usiamo "Errore 418"
        // Altrimenti, componiamo il titolo "404: Pagina non trovata"
        if (!hasSpecificTitle) {
            errorInfo = this.translate.translate('erroreGenerico') + ' ' + httpStatus;
        } else if (httpStatus !== 0) {
            errorInfo = httpStatus + ': ' + errorInfo;
        }
        // Status 0 = nessuna risposta: non è un codice HTTP, "0:" davanti al titolo non direbbe niente.

        // Se il backend ha inviato un ProblemDetails valido, lo uniamo ai nostri fallback
        if (problem) {
            // Il dettaglio del backend vince se presente (solitamente è più specifico)
            if (problem.detail) {
                errorMessage = problem.detail;
            }
            
            // Il titolo del backend viene usato solo se non abbiamo una traduzione specifica
            if (problem.title) {
                if (!hasSpecificTitle) {
                    errorInfo = httpStatus + ': ' + problem.title;
                } else {
                    console.info(`[API Info] Ignorato titolo dal backend "${problem.title}" per HTTP ${httpStatus}. Usata traduzione locale.`);
                }
            }
        } else if (httpStatus === 404 || httpStatus === 500) {
            // Se non c'è body valido, i 404/500 hanno spesso bisogno di dire "API irraggiungibile"
            errorMessage = this.translate.translate('apiNonRaggiungibileErrore');
        }

        this.error(errorInfo, errorMessage);
    }
}

