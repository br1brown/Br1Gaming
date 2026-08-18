import { CanActivateFn, Router } from '@angular/router';
import { inject, REQUEST } from '@angular/core';
import { ContestoSito, PageType } from '../../site';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { NotificationService } from './services/notification.service';
import { TranslateService } from './services/translate.service';
import { CookieConsentService } from './services/cookie-consent.service';

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

// User-agent che riconosciamo come bot/crawler. Include DELIBERATAMENTE anche i motori di ricerca
// (Googlebot, Bingbot...): qui lo scopo è "evita redirect ai bot", non "decidi la lingua del
// contenuto" (quello lo fa già il path, vedi route.data.lang sopra) — Google stesso sconsiglia
// redirect automatici su lingua percepita per i crawler, che scoprono le varianti via `hreflang`,
// non seguendo redirect. Over-matching qui è innocuo: nel peggiore dei casi un bot vede la lingua
// default invece di essere rediretto, comunque contenuto valido — non un errore.
const BOT_UA_PATTERN = /bot|crawler|spider|facebookexternalhit|whatsapp|slackbot|telegram|discordbot|pinterest|redditbot|skypeuripreview|vkshare|preview/i;

/**
 * GUARD DI REDIRECT LINGUA — applicata SOLO alle route non-prefissate (lingua default, vedi
 * routing.ts). Decide se mandare un visitatore reale, alla primissima visita su `/`, verso la
 * variante prefissata della sua lingua preferita (es. `/` → `/en`). Una volta rediretto (o una
 * volta che l'utente ha scelto esplicitamente una lingua), non interviene più: vedi il controllo
 * sul cookie salvato più sotto.
 */
export const langRedirectGuard: CanActivateFn = (route) => {
    // Short-circuit per i siti mono-lingua (tutti i figli oggi, es. Br1Gaming): con una sola lingua
    // non c'è nulla da decidere. Nessuna lettura di cookie/header/UA sotto questa riga — costo zero.
    if (environment.availableLanguages.length <= 1) return true;

    const pageType = route.data['pageType'] as PageType | undefined;
    if (pageType == null) return true; // nodo di raggruppamento (menu), non una pagina vera: niente da rediregere.

    const consent = inject(CookieConsentService);
    // Preferenza lingua già salvata (scelta esplicita passata, o già rediretto prima): non decidiamo
    // più noi, l'utente ha già una lingua "sua". Vedi persistLanguage() in translate.service.ts.
    if (consent.getSavedLanguage()) return true;

    const request = inject(REQUEST, { optional: true }); // presente in SSR, null nel browser (CSR).
    const ua = request?.headers.get('user-agent') ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '') ?? '';
    if (BOT_UA_PATTERN.test(ua)) return true; // bot riconosciuto: mai rediretto, vedi commento sopra BOT_UA_PATTERN.

    // Accept-Language: in SSR dall'header della richiesta, nel browser da navigator.language (CSR puro,
    // caso raro dato che il primo hit passa quasi sempre da SSR). Prendiamo solo la prima preferenza
    // (prima del ',': es. "en-US,en;q=0.9,it;q=0.8" → "en-US").
    const acceptLanguage = request?.headers.get('accept-language')?.split(',')[0]?.trim()
        ?? (typeof navigator !== 'undefined' ? navigator.language : null);
    // "preferred" = la lingua del visitatore, ridotta al sottotag base BCP-47 (es. "en-US" → "en").
    const preferred = TranslateService.normalizeBcp47(acceptLanguage);
    if (!preferred || preferred === environment.defaultLang || !environment.availableLanguages.includes(preferred)) {
        return true; // nessuna preferenza rilevabile, o preferisce già il default, o lingua non supportata: resta qui.
    }

    const router = inject(Router);
    const target = ContestoSito.getPath(pageType, preferred); // stessa pagina, ma nel path della lingua preferita.
    return target ? router.createUrlTree([target]) : true; // redirect se il path esiste, altrimenti nessun cambiamento.
};
