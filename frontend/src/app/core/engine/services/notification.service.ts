import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ApplicationRef, EnvironmentInjector, Injectable, PLATFORM_ID, TemplateRef, Type, createComponent, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { AppearanceService } from './appearance.service';
import { TranslateService } from './translate.service';
import type { ProblemDetails } from './base-api.service';

type SwalType = typeof import('sweetalert2').default;
type ModalType = typeof import('bootstrap/js/src/modal.js').default;

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
    /** `'none'`: il focus iniziale lo mette il contenuto (default: `[autofocus]`, `.btn-close`, primo focusabile). */
    initialFocus?: 'auto' | 'none';
}

/** Maniglia di una modale aperta con {@link NotificationService.modal}. */
export interface ModalRef<T = unknown> {
    /** Istanza del componente montato; `null` per un template. */
    readonly instance: T | null;
    /** Chiude rispettando `canClose`; `true` se chiusa davvero. */
    close(): Promise<boolean>;
    /** Risolve alla chiusura, da qualunque via (anche un cambio pagina). */
    readonly afterClosed: Promise<void>;
}

const MODAL_FOCUS_TARGETS = '[autofocus], .btn-close, button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ValidationResult {
    isValid: boolean;
    errors?: string[];
}

/** Esito di {@link NotificationService.choose}: `confirm` = bottone principale, `deny` = rifiuto
 *  esplicito (diverso da annullare), `cancel` = nessuna decisione (Annulla/ESC/clic fuori). */
export type ConfirmChoice = 'confirm' | 'deny' | 'cancel';

export interface ToastOptions {
    /** Durata ms prima dell'auto-dismiss. `null` = persistente (niente timer, mostra il pulsante di chiusura). Default 3000. */
    durationMs?: number | null;
    /** Bottone d'azione nel toast (es. "Ripristina"): se premuto esegue `run()`. */
    action?: { text: string; run: () => void };
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

    private loadSwal(): Promise<SwalType> | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        // Build "senza stile": la variante bare inietta il proprio CSS via <style> senza nonce, che
        // la CSP di questo template scarta in silenzio (modale in fondo alla pagina, mai in overlay).
        // Il CSS base va quindi caricato staticamente via <link> (angular.json), qui solo il JS puro.
        return this.swalPromise ??= import('sweetalert2/dist/sweetalert2.esm.js').then(module => module.default);
    }

    /** SwAl pre-configurato col tema: theme light/dark segue `themeTone` (i colori del popup vengono dal ponte `--swal2-*` → token brand in `_bootstrap-theme.scss`), bottoni Bootstrap (success/outline-secondary/danger, `buttonsStyling: false`). Ricreato ad ogni call per restare reattivo a cambi di themeTone. */
    private loadThemedSwal(): Promise<SwalType> | null {
        const base = this.loadSwal();
        if (!base) return null;
        const themeVariant = this.theme.themeTone() === 'dark'
            ? 'bootstrap-5-dark'
            : 'bootstrap-5-light';
        return base.then(Swal => Swal.mixin({
            theme: themeVariant,
            buttonsStyling: false,
            customClass: {
                confirmButton: 'btn btn-success',
                cancelButton:  'btn btn-outline-secondary ms-2',
                denyButton:    'btn btn-danger ms-2',
            },
        }));
    }

    // --- MODALI (Bootstrap) ---

    private loadModal(): Promise<ModalType> | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        // Solo il componente Modal dai sorgenti ESM: il bundle intero porterebbe anche Popper.
        return this.modalPromise ??= import('bootstrap/js/src/modal.js').then(module => module.default);
    }

    /** Modale che ospita un componente o un `<ng-template>`: focus intrappolato, Escape, click fuori,
     *  scroll bloccato e focus di ritorno li dà Bootstrap. SweetAlert mostra un solo popup alla volta,
     *  quindi un contenuto che a sua volta chiama `confirm`/`toast` deve stare qui, non lì. */
    modal<T>(content: Type<T> | TemplateRef<unknown>, options: ModalOptions = {}): ModalRef<T> {
        const host = this.document.createElement('div');
        host.className = 'modal fade';
        host.tabIndex = -1;
        host.setAttribute('role', 'dialog');
        host.setAttribute('aria-modal', 'true');
        if (options.ariaLabel) host.setAttribute('aria-label', options.ariaLabel);
        const dialog = this.document.createElement('div');
        dialog.className = `modal-dialog ${options.dialogClass ?? ''}`.trim();
        const slot = this.document.createElement('div');
        slot.className = options.bare ? 'modal-content modal-content-bare' : 'modal-content';
        dialog.appendChild(slot);
        host.appendChild(dialog);

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
            slot.appendChild(ref.location.nativeElement);
            instance = ref.instance;
            view = ref;
        }
        this.document.body.appendChild(host);

        let resolveClosed!: () => void;
        const afterClosed = new Promise<void>(resolve => { resolveClosed = resolve; });
        let allowed = false;
        let checking = false;
        let bsModal: InstanceType<ModalType> | null = null;

        const teardown = (): void => {
            view.destroy();
            bsModal?.dispose();
            host.remove();
            options.returnFocusTo?.focus({ preventScroll: true });
            resolveClosed();
        };
        const close = async (): Promise<boolean> => {
            if (allowed || checking || !host.isConnected) return false;
            checking = true;
            try {
                if (options.canClose && !(await options.canClose())) return false;
            } finally {
                checking = false;
            }
            allowed = true;
            if (bsModal) bsModal.hide(); else teardown();
            return true;
        };

        const loaded = this.loadModal();
        if (!loaded) {
            teardown();
            return { instance, close, afterClosed };
        }
        void loaded.then(Modal => {
            if (allowed) return;
            bsModal = new Modal(host, { backdrop: true, keyboard: options.escape ?? true, focus: true });
            // Escape, click fuori e hide(): tutto passa da qui, dove decide canClose.
            host.addEventListener('hide.bs.modal', e => { if (!allowed) { e.preventDefault(); void close(); } });
            host.addEventListener('hidden.bs.modal', teardown);
            host.addEventListener('shown.bs.modal', () => {
                if (options.initialFocus !== 'none') host.querySelector<HTMLElement>(MODAL_FOCUS_TARGETS)?.focus();
            });
            bsModal.show();
        });
        // Cambio pagina: via la modale senza domande, il suo contenuto sta per sparire comunque.
        const nav = this.router.events.subscribe(e => {
            if (!(e instanceof NavigationStart)) return;
            allowed = true;
            if (bsModal) bsModal.hide(); else teardown();
        });
        void afterClosed.then(() => nav.unsubscribe());

        return { instance, close, afterClosed };
    }

    // --- FEEDBACK STANDARD ---

    success(message: string, onClose?: () => void): void {
        const swal = this.loadThemedSwal();
        if (swal) {
            void swal.then(Swal =>
                // titleText/text, mai title/html: SweetAlert2 non sanifica, e il messaggio può venire dal backend o da una notifica.
                Swal.fire({ titleText: this.translate.translate('ottimoStato') + '!', text: message, icon: 'success' }).then(() => onClose?.())
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
                void Swal.fire({ titleText: title, text: message, icon: 'error' });
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
    }): Promise<boolean> {
        const swal = this.loadThemedSwal();
        if (!swal) return false;

        const Swal = await swal;
        const result = await Swal.fire({
            titleText: title,
            text,
            icon: options?.icon ?? 'question',
            showCancelButton: true,
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
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
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
                    // Escape chiude il toast quando ha il focus.
                    toast.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape') void Swal.close();
                    });
                }
            });
            void Toast.fire({ icon, titleText: message }).then(result => {
                if (result.isConfirmed) action?.run();              // click sul bottone d'azione
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

        const keyInfo = overrideKeys?.titleKey ?? `errore${httpStatus}Titolo`;
        const keyDesc = overrideKeys?.descKey ?? `errore${httpStatus}Descrizione`;

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

