import { Location } from '@angular/common';
import { Directive, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { TranslateService } from '../services/translate.service';
import { isLoginPath, loginUrlFrom } from '../login-return';

/** Su un `<a>`: porta al login con `?returnUrl=` della pagina attuale (letta al clic, parametri compresi), e a login riuscito si torna qui.
 *  Sul login mette `aria-current="page"`; senza `loginPage` in `site.ts` il link è `hidden`. `#l="appLoginLink"` espone `onLoginPage()`
 *  per le classi dello stato attivo. */
@Directive({
    selector: 'a[appLoginLink]',
    exportAs: 'appLoginLink',
    host: {
        '[attr.href]': 'href()',
        '[attr.hidden]': 'href() === null ? "" : null',
        '[attr.aria-current]': 'onLoginPage() ? "page" : null',
        '(click)': 'go($event)',
    },
})
export class LoginLinkDirective {
    private readonly router = inject(Router);
    private readonly location = inject(Location);
    private readonly translate = inject(TranslateService);

    /** L'indirizzo corrente, aggiornato a ogni navigazione. */
    private readonly here = toSignal(
        this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.currentPath())),
        { initialValue: this.currentPath() },
    );
    /** True sulla pagina di login, in qualunque lingua. */
    readonly onLoginPage = computed(() => isLoginPath(this.here(), this.translate.currentLang()));
    /** L'indirizzo per chi apre il link in un'altra scheda o lo copia: il ritorno è la pagina dell'ultima navigazione. */
    protected readonly href = computed(() => {
        const url = loginUrlFrom(this.translate.currentLang(), this.here());
        return url === null ? null : this.location.prepareExternalUrl(url);
    });

    /** Clic normale: naviga col router, col ritorno letto adesso. Con Ctrl/Cmd/Maiusc/Alt o un altro pulsante decide il browser. */
    protected go(event: MouseEvent): void {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const url = loginUrlFrom(this.translate.currentLang(), this.currentPath());
        if (url === null) return;
        event.preventDefault();
        void this.router.navigateByUrl(url);
    }

    private currentPath(): string {
        // `Location.path()` non ha la barra iniziale sulla radice o con la sola query: si rimette.
        const path = this.location.path();
        return path.startsWith('/') ? path : '/' + path;
    }
}
