import { afterNextRender, Directive, ElementRef, inject, Injector, output, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { TranslateService } from '../../services/translate.service';
import { AuthService } from '../../../services/auth.service';
import { LoginRequest } from '../../../dto/auth.dto';

/** Base dei form di login: campi, validazione, autenticazione ed errore inline. Centralizza la
 *  logica (submit, loading, mappatura errore) così un progetto figlio con un markup diverso
 *  scrive solo il proprio `LoginFormComponent` concreto — stesso pattern di `BaseActionComponent`. */
@Directive()
export abstract class BaseLoginFormComponent {
    protected readonly auth = inject(AuthService);
    protected readonly translate = inject(TranslateService);
    private readonly fb = inject(FormBuilder);
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly injector = inject(Injector);

    /** Emesso dopo un login riuscito; a questo punto il token è già memorizzato. */
    readonly loggedIn = output<void>();

    protected readonly isLoading = signal(false);
    protected readonly errorMessage = signal<string | null>(null);

    protected readonly loginForm = this.fb.group({
        username: ['', [Validators.required]],
        password: ['', [Validators.required, Validators.minLength(8)]],
    });

    protected async onSubmit(): Promise<void> {
        // Lock sul segnale, non solo [disabled] nel template: un doppio invio rapido arriva prima
        // che il bottone si ridisegni disabilitato (stesso principio di BaseActionComponent.run).
        if (this.isLoading()) return;

        // Submit con campi non validi: mostra subito TUTTI gli errori (campi "toccati") e porta il
        // focus sul primo, invece di un click che non fa niente (WCAG 3.3.1, prevenzione errori).
        if (this.loginForm.invalid) {
            this.loginForm.markAllAsTouched();
            this.focusFirstInvalid();
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set(null);

        const { username, password } = this.loginForm.getRawValue();
        const request: LoginRequest = { username: username!, pwd: password! };

        try {
            // auth.login risolve con { valid, error }: l'errore è già tradotto e lo mostriamo inline.
            const result = await this.auth.login(request);
            if (result.valid) {
                this.loggedIn.emit();
            } else {
                this.errorMessage.set(result.error ?? this.translate.translate('loginErroreGenerico'));
            }
        } catch {
            // Errore di rete/imprevisto, non credenziali sbagliate: messaggio diverso.
            this.errorMessage.set(this.translate.translate('erroreImprevisto'));
        } finally {
            this.isLoading.set(false);
        }
    }

    /** Primo campo visibile marcato non valido (dopo il render che applica `.is-invalid`). */
    private focusFirstInvalid(): void {
        afterNextRender(() => {
            const field = this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]:not([type="hidden"]):not(.d-none)');
            field?.focus();
        }, { injector: this.injector });
    }
}
