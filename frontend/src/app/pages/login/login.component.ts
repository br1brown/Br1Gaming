import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { LoginFormComponent } from '../../components/shared/login-form/login-form.component';
import { loginReturnTarget } from '../../core/engine/login-return';

@Component({
    selector: 'app-login',
    imports: [TranslatePipe, LoginFormComponent],
    templateUrl: './login.component.html',
})
/**
 * Pagina di login: contiene `LoginFormComponent` e gestisce il ritorno — dopo il login riapre la
 * pagina richiesta (`returnUrl` o `returnPageType` in querystring, messi dall'authGuard al redirect; `loginReturnTarget`).
 */
export class LoginComponent extends PageBaseComponent<void> {
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    // Avviso informativo (non un errore) mostrato quando l'authGuard ha rediretto qui.
    // `computed()`, non un signal statico: al primo render la lingua può ancora essere quella del
    // bootstrap (l'effect di PageBaseComponent che la allinea da route.data.lang gira dopo, non
    // sincrono nel costruttore) — reattivo, si aggiorna da solo appena i cataloghi sono quelli giusti.
    protected readonly infoMessage = computed(() =>
        this.route.snapshot.queryParamMap.get('reason') === 'auth'
            ? this.translate.translate('loginRichiestoMotivo')
            : null
    );

    /** Login riuscito: torna alla pagina richiesta (`returnUrl`, o `returnPageType` messo dall'authGuard) o alla home. */
    protected async onLoggedIn(): Promise<void> {
        // currentLang() qui è sicuro (a differenza del resolver/guard): scatta dopo un login
        // riuscito, cioè dopo un'interazione utente reale — la lingua è già sincronizzata da un pezzo.
        await this.router.navigateByUrl(loginReturnTarget(this.route.snapshot.queryParamMap, this.translate.currentLang()));
    }
}
