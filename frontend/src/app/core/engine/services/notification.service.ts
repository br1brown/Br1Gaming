import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { ThemeService } from './theme.service';
import { TranslateService } from './translate.service';
import type { ProblemDetails } from './base-api.service';

type SwalType = typeof import('sweetalert2').default;

export interface ValidationResult {
    isValid: boolean;
    errors?: string[];
}

/**
 * Esito di un dialogo a tre vie {@link NotificationService.choose}:
 *  - `confirm` → bottone principale (es. "Salva")
 *  - `deny`    → rifiuto esplicito (es. "Non salvare"): scelta diversa dall'annullare
 *  - `cancel`  → annullato (bottone Annulla, ESC o clic fuori): l'utente non decide
 */
export type ConfirmChoice = 'confirm' | 'deny' | 'cancel';


export interface InteractContext {
    popup: HTMLElement;
    $: <T extends HTMLElement = HTMLElement>(selector: string) => T;
    byId: <T extends HTMLElement = HTMLElement>(id: string) => T;
}

export interface InteractConfig<T> {
    title: string;
    html: string | HTMLElement;
    confirmText?: string;
    cancelText?: string;
    showLoaderOnConfirm?: boolean;
    validation?: (ctx: InteractContext) => ValidationResult;
    mapResult?: (ctx: InteractContext) => T;
}

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

/**
 * Notifiche utente via SweetAlert2.
 * Metodi: success(), error(), alert(), loading(), close(), promise(), confirm(), choose(), prompt(), interact(), toast(), toastOnce(), validationErrors(), handleApiError().
 * handleApiError() legge ProblemDetails (RFC 9457) dal backend o traduce il codice HTTP via i18n.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
    private translate = inject(TranslateService);
    private theme = inject(ThemeService);
    private platformId = inject(PLATFORM_ID);
    private swalPromise?: Promise<SwalType>;
    private shownOnceKeys = new Set<string>();   // chiavi già mostrate da toastOnce() in questa sessione

    private loadSwal(): Promise<SwalType> | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        return this.swalPromise ??= import('sweetalert2').then(module => module.default);
    }

    /**
     * SwAl pre-configurato col tema del template:
     *  - theme 'bootstrap-5-light' o '-dark' a seconda di themeTone, così che il
     *    popup segua sempre lo schema chiaro/scuro corrente (il tema CSS
     *    'sweetalert2/themes/bootstrap-5.css' è caricato da angular.json → "styles");
     *  - confirmButton: btn-success (verde universale, segnale positivo)
     *  - cancelButton:  btn-outline-secondary (neutro adattivo via --colorSecondary)
     *  - denyButton:    btn-danger (rosso per azioni distruttive)
     * `buttonsStyling: false` disabilita lo styling default di Swal così che le
     * classi Bootstrap prevalgano. Il mixin viene ricreato ad ogni call per
     * essere reattivo a cambi di themeTone a runtime.
     */
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

    // --- FEEDBACK STANDARD ---

    success(message: string, onClose?: () => void): void {
        const swal = this.loadThemedSwal();
        if (swal) {
            void swal.then(Swal =>
                Swal.fire(this.translate.translate('ottimoStato') + '!', message, 'success').then(() => onClose?.())
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
                void Swal.fire(title, message, 'error');
            });
        } else if (isPlatformBrowser(this.platformId)) {
            window.alert(`${title}\n${message}`);
        }
    }

    /**
     * Dialogo generico a UN SOLO bottone (niente "Annulla"): titolo + testo + icona opzionale.
     * Risolve quando l'utente chiude (bottone / ESC / clic fuori) → comodo come `await` e poi agisci
     * (es. pausa di gioco: mostra "In pausa" e alla chiusura riprendi). Per esiti specifici usa success()/error().
     */
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
            title,
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
                title: message ?? this.translate.translate('caricamentoStato'),
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            })
        );
    }

    closeLoading(): void {
        void this.loadThemedSwal()?.then(Swal => Swal.close());
    }

    /**
     * Esegue un lavoro asincrono mostrandone il ciclo di vita: spinner bloccante → toast di esito.
     * Toglie il boilerplate `openLoading`/`await`/`closeLoading`/try-catch ripetuto ovunque.
     * Rilancia SEMPRE l'eccezione (il toast d'errore è solo UX): il chiamante decide il resto (es.
     * `handleApiError`). In SSR esegue il lavoro senza UI (loading/toast no-op) e ne ritorna il valore.
     */
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
            title,
            text,
            icon: options?.icon ?? 'question',
            showCancelButton: true,
            confirmButtonText: options?.confirmText ?? this.translate.translate('siAzione'),
            cancelButtonText: options?.cancelText ?? this.translate.translate('annullaAzione'),
            allowOutsideClick: options?.allowOutsideClick ?? true,
        });
        return result.isConfirmed;
    }

    /**
     * Dialogo a TRE vie: conferma / rifiuto esplicito / annulla. Il caso classico delle
     * "modifiche non salvate" → Salva / Non salvare / Annulla, dove "No" (rifiuto) e "Annulla"
     * (ripensamento) sono esiti DIVERSI — distinzione che {@link confirm} (booleano) non coglie.
     * Usa il `denyButton` già stilato dal tema (btn-danger). Default Sì / No / Annulla (i18n).
     * Ritorna 'cancel' anche su ESC / clic fuori e in SSR (nessuna azione presa).
     */
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
            title,
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
            title,
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

    async interact<T = unknown>(config: InteractConfig<T>): Promise<T | null> {
        const swal = this.loadThemedSwal();
        if (!swal) return null;

        const Swal = await swal;

        try {
            const result = await Swal.fire({
                title: config.title,
                html: config.html,
                showCancelButton: true,
                confirmButtonText: config.confirmText ?? this.translate.translate('siAzione'),
                cancelButtonText: config.cancelText ?? this.translate.translate('annullaAzione'),
                showLoaderOnConfirm: config.showLoaderOnConfirm ?? false,
                preConfirm: () => {
                    const popup = Swal.getPopup();
                    if (!popup) {
                        Swal.showValidationMessage(this.translate.translate('fallbackErrore'));
                        return false;
                    }

                    const ctx = this.createContext(popup);

                    if (config.validation) {
                        const res = config.validation(ctx);
                        if (!res.isValid) {
                            Swal.showValidationMessage(this.formatErrors(res.errors, true));
                            return false;
                        }
                    }

                    return config.mapResult ? config.mapResult(ctx) : true;
                }
            });

            return result.isConfirmed ? (result.value as T) : null;
        } catch (err) {
            console.error('[NotificationService] Errore in interact:', err);
            return null;
        }
    }

    private createContext(popup: HTMLElement): InteractContext {
        const cache = new Map<string, HTMLElement>();

        const resolve = <T extends HTMLElement>(selector: string, errorMsg: string): T => {
            if (!cache.has(selector)) {
                const el = popup.querySelector<T>(selector);
                if (!el) throw new Error(errorMsg);
                cache.set(selector, el);
            }
            return cache.get(selector) as T;
        };

        return {
            popup,
            $: <T extends HTMLElement = HTMLElement>(selector: string): T =>
                resolve<T>(selector, `Elemento non trovato: ${selector}`),
            byId: <T extends HTMLElement = HTMLElement>(id: string): T =>
                resolve<T>(`#${id}`, `Elemento con id "${id}" non trovato`),
        };
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
            void Toast.fire({ icon, title: message }).then(result => {
                if (result.isConfirmed) action?.run();              // click sul bottone d'azione
            });
        });
    }

    /**
     * Come toast(), ma mostrato al massimo UNA volta per sessione per ciascun `key` (dedup interna).
     * Per avvisi di sistema / hint che non devono ripetersi (es. "grafica alleggerita", suggerimenti onboarding),
     * senza che il chiamante debba tenersi un flag.
     */
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
                    title,
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
        } else {
            errorInfo = httpStatus + ': ' + errorInfo;
        }

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

