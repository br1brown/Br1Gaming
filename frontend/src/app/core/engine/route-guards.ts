import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { ContestoSito } from '../../site';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { NotificationService } from './services/notification.service';
import { TranslateService } from './services/translate.service';

/**
 * GUARD DI SINCRONIZZAZIONE LINGUA — allinea `TranslateService.currentLang()` a `route.data['lang']`
 * PRIMA che qualunque guard o resolver a valle (compreso `authGuard` sotto, e i resolver di dominio
 * che chiamano `ApiService` — vedi `content.resolver.ts`) legga `currentLang()`.
 *
 * Senza questo guard, chi gira nella fase Guard/Resolve trova ancora la lingua di bootstrap (il
 * default): `PageBaseComponent` corregge `currentLang()` solo al montaggio del componente, che
 * avviene DOPO guard e resolver. È la stessa race che `authGuard` gestiva già da sé (vedi il suo
 * `lang` letto da `route.data`, non da `currentLang()`) — qui si chiude una volta per tutte, invece
 * di richiedere ad ogni guard/resolver a valle di reimplementare lo stesso pattern.
 *
 * Applicato SEMPRE (su ogni route, non solo quelle protette) in `routing.ts`: Angular Router
 * completa l'intera fase Guard prima di iniziare la fase Resolve, quindi basta un guard qualsiasi
 * — non serve che sia il primo dell'array — per garantire l'ordine verso i resolver. Fra guard
 * multipli sulla stessa route l'ordine relativo non è garantito, ma `authGuard` è già difensivo
 * (stesso controllo `lang !== currentLang()`), quindi l'eventuale ridondanza resta innocua.
 */
export const languageSyncGuard: CanActivateFn = async (route) => {
    const translate = inject(TranslateService);
    const lang = route.data['lang'] as string | undefined;
    if (lang && lang !== translate.currentLang()) {
        await translate.setLanguage(lang);
    }
    return true;
};

/**
 * GUARD DI AUTENTICAZIONE — protegge le route con `requiresAuth: true`.
 * Se l'utente non è loggato: rediregere al login (se configurato) o mostrare una modale di errore.
 */
export const authGuard: CanActivateFn = async (route) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const notification = inject(NotificationService);
    const translate = inject(TranslateService);

    if (authService.isLoggedIn()) {
        return true; // loggato: nessun blocco, il resto della funzione non gira nemmeno.
    }

    // `route.data['lang']` = lingua della pagina che l'utente stava cercando di raggiungere (es. 'en'
    // per un deep-link a /en/impostazioni). NON `translate.currentLang()`: su un deep-link fresco
    // (nessuna pagina precedente ancora montata) questo guard gira PRIMA che PageBaseComponent abbia
    // sincronizzato lo stato lingua — currentLang() sarebbe ancora quella del bootstrap (sempre la
    // lingua default), quindi porterebbe l'utente a un login nella lingua sbagliata.
    const lang = (route.data['lang'] as string | undefined) ?? environment.defaultLang;

    const redirectPage = ContestoSito.config.loginPage; // PageType della pagina di login, se configurata in site.ts.
    if (redirectPage != null) {
        const path = ContestoSito.getPath(redirectPage, lang); // path del login NELLA lingua della pagina target.
        if (path) {
            return router.createUrlTree([path], {
                // returnPageType: dove tornare dopo il login (letto da LoginComponent.onLoggedIn()).
                // reason: 'auth' fa mostrare a LoginComponent l'avviso inline "richiesto login".
                queryParams: { returnPageType: route.data['pageType'], reason: 'auth' }
            });
        }
    }

    // Nessuna pagina di login configurata: restiamo dove siamo e mostriamo una modale d'errore.
    // Prima carichiamo i cataloghi della lingua giusta se non sono già quelli attivi (altrimenti il
    // messaggio uscirebbe nella lingua sbagliata, stesso motivo di `lang` sopra).
    if (lang !== translate.currentLang()) {
        await translate.setLanguage(lang);
    }
    notification.error(
        translate.translate('errore401Titolo'),
        translate.translate('errore401Descrizione')
    );
    return false; // blocca la navigazione, l'utente resta sulla pagina di partenza.
};
