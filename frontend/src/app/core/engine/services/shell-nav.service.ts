import { effect, EnvironmentInjector, inject, Injectable, InjectionToken, PLATFORM_ID, runInInjectionContext, signal, TransferState, makeStateKey } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { PageType } from '../../../site';
import { ContestoSito } from '../../../site';
import {
    createFooterSectionBuilder,
    createNavSectionBuilder,
    defaultFooterResolver,
    resolveFooterItems,
    resolveNavItems,
    validateFooterBreadth,
    validateFooterDepth,
    validateNavDepth,
    type FooterBuildState,
    type FooterEntry,
    type NavLink,
    type RawNavItem,
    type ShellNavResolver,
} from '../shell-nav';
import { TranslateService } from './translate.service';
import { TokenService } from './token.service';
import { IdentityService } from './identity.service';
import { LocalizationService } from './localization.service';
import type { Identity } from '../dto/identity.dto';

/**
 * Sorgente delle voci di navigazione di header/footer per QUESTO sito — un figlio la sovrascrive
 * (`{ provide: SHELL_NAV_RESOLVER, useValue: ... }` in `app.config.ts`) per collegare la
 * navigazione a un'API invece che a una dichiarazione statica. Default: nessuna voce (menu vuoto),
 * innocuo per chi non fornisce nulla — stesso pattern di `LEGAL_FILE_READER`.
 */
export const SHELL_NAV_RESOLVER = new InjectionToken<ShellNavResolver>('SHELL_NAV_RESOLVER', {
    providedIn: 'root',
    factory: () => ({}),
});

const SHELL_NAV_STATE_KEY = makeStateKey<{ header: NavLink[]; footer: FooterEntry[]; brandIcon: string; hideLegalStrip: boolean }>('shellNav');

/**
 * Voci di navigazione di header/footer e icona di brand, condivise da `NavbarComponent`/
 * `FooterComponent` (un solo fetch, non uno a testa). Risolte da `SHELL_NAV_RESOLVER` — dato, non
 * struttura del sito: a differenza di `ContestoSito` (build-time), qui gira a ogni richiesta SSR e
 * può dipendere da un'API (es. menu diverso per utente loggato, icona diversa per pagina).
 *
 * Il primo giro (lingua iniziale) è atteso da un `provideAppInitializer` in `app.config.ts`, PRIMA
 * che qualunque componente si costruisca: `NavbarComponent` legge `header()`/`footer()` anche in
 * un field initializer sincrono (`altroDropdownIndex`), quindi il valore dev'essere già pronto al
 * primo render, non arrivare dopo. Cambio lingua o login/logout (client): ri-risolve in modo
 * reattivo, senza bloccare nulla.
 *
 * Login tracciato apposta: in SSR `TokenService.isLoggedIn()` è sempre `false` (sessione letta
 * solo client-side, vedi `TokenService.restore()`), quindi un resolver che dipende dal login
 * risolve "guest" al primo giro — corretto per l'idratazione, che deve combaciare col DOM
 * server. Il secondo giro, reattivo, arriva da questa stessa dipendenza appena `restoreSession()`
 * (in `app.config.ts`) valorizza lo stato di login sul client.
 */
@Injectable({ providedIn: 'root' })
export class ShellNavService {
    private readonly resolver = inject(SHELL_NAV_RESOLVER);
    private readonly translate = inject(TranslateService);
    private readonly tokenService = inject(TokenService);
    private readonly transferState = inject(TransferState);
    // Solo per decidere se SCRIVERE su TransferState (solo server, vedi resolve()): leggerla non
    // ha questo problema, è già "usa una volta e rimuovi" per costruzione.
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    // Stessa risorsa condivisa di FooterComponent (un solo fetch per tutta l'app): qui serve a
    // passare `ctx.identity` al resolver del footer e a formattare i `FooterField` (`localization`).
    private readonly identityService = inject(IdentityService);
    private readonly localization = inject(LocalizationService);
    // Garantisce un injection context valido dentro il resolver del figlio, chiamato dopo almeno
    // un await (stesso motivo di runInInjectionContext in content.resolver.ts): un eventuale
    // inject() nella sua callback altrimenti fallirebbe con NG0203.
    private readonly injector = inject(EnvironmentInjector);

    private readonly _header = signal<NavLink[]>([]);
    private readonly _footer = signal<FooterEntry[]>([]);
    // Default 'favIcon' se non c'è resolver.brandIcon — stesso default di prima. SE l'icona compare
    // non è più deciso qui: è NavbarComponent.showBrandIcon (RouteChrome/DesignSystemPreset).
    private readonly _brandIcon = signal<string>('favIcon');
    // Default false: la fascia "small print" resta quella di sempre finché il resolver del footer
    // non chiama esplicitamente `f.hideLegalStrip()` — vedi FooterComponent.
    private readonly _hideLegalStrip = signal<boolean>(false);
    readonly header = this._header.asReadonly();
    readonly footer = this._footer.asReadonly();
    readonly brandIcon = this._brandIcon.asReadonly();
    readonly hideLegalStrip = this._hideLegalStrip.asReadonly();

    /** Chiave (lingua + login) dell'ultimo `resolve()` completato: guardia contro il doppio giro
     *  fra la chiamata esplicita del `provideAppInitializer` e il primo scatto automatico
     *  dell'`effect()` sotto, che vedono lo stesso stato iniziale. Un resolver che ignora il login
     *  paga al più un secondo `resolve()` ridondante ma innocuo dopo il login — costo minimo per
     *  la reattività di chi il login lo usa davvero. */
    private lastResolvedKey: string | null = null;

    /** Contatore monotono: ogni `resolve()` cattura il proprio valore e lo confronta prima di
     *  scrivere sui signal. Cambio lingua/login due volte di fretta avvia due `resolve()` in
     *  parallelo — senza questa guardia, la rete potrebbe far arrivare per prima la risposta del
     *  giro PIÙ VECCHIO e sovrascrivere quella corretta del giro nuovo. Puramente locale (nessun
     *  round-trip, nessuno stato lato server): non c'entra con l'invalidazione di token/sessione. */
    private generation = 0;

    constructor() {
        effect(() => {
            const lang = this.translate.currentLang();
            const loggedIn = this.tokenService.isLoggedIn();
            // L'identità arriva da una `httpResource` indipendente (stesso fetch di `FooterComponent`,
            // non ne innesca uno in più): quando passa da "non ancora arrivata" a "arrivata" (o si
            // rifetcha al cambio lingua) il footer va ri-risolto, altrimenti un `addField` resterebbe
            // nascosto per sempre come se il sito non avesse quel dato.
            //
            // Traccia identity() stesso, non loading(): sono quasi la stessa cosa ma non proprio —
            // in idratazione, su un client fresco (nuova istanza del servizio, `lastResolvedKey`
            // riparte da null), loading() può leggere già `false` un tick prima che identity()/
            // hasValue() rifletta il dato vero. Con loading() come chiave, quel resolve() catturava
            // ctx.identity=null e lo fissava lì per sempre: nessun secondo giro, perché loading()
            // non cambia più — bug verificato (footer SSR corretto, footer post-idratazione con
            // i gruppi custom svuotati, mentre il blocco automatico — bound live a identity(), non
            // catturato una tantum — restava giusto). identity() stesso non ha questa finestra:
            // è il valore vero, non un proxy che può disallinearsi da lui.
            const identity = this.identityService.identity();
            const key = `${lang}:${loggedIn}:${identity !== null}`;
            if (key === this.lastResolvedKey) return;
            void this.resolve(lang);
        });
    }

    private readonly getPath = (type: PageType, lang: string): string | null => ContestoSito.getPath(type, lang);
    private readonly getPageInfo = (type: PageType, lang: string) => ContestoSito.getPageInfo(type, lang);

    /** Risolve header e footer per `lang` e aggiorna i signal. Le due sezioni sono indipendenti:
     *  un resolver che fallisce (es. API giù, gruppo annidato oltre il limite) svuota solo la
     *  propria sezione, mai anche l'altra — mai voci pensate per lo stato precedente (es. link
     *  autenticati rimasti visibili dopo un logout il cui resolver è fallito). */
    async resolve(lang: string): Promise<void> {
        // Sincrono, PRIMA di ogni await: garantisce che l'effect() sopra veda già la guardia
        // valorizzata quando Angular lo esegue per la prima volta (schedulazione asincrona,
        // sempre dopo la fine del blocco sincrono corrente). Stessa chiave (lingua+login+identity)
        // letta qui e nell'effect: sincrona anche lei, per lo stesso motivo.
        this.lastResolvedKey = `${lang}:${this.tokenService.isLoggedIn()}:${this.identityService.identity() !== null}`;
        const generation = ++this.generation;

        if (this.transferState.hasKey(SHELL_NAV_STATE_KEY)) {
            const cached = this.transferState.get(SHELL_NAV_STATE_KEY, { header: [], footer: [], brandIcon: 'favIcon', hideLegalStrip: false });
            this.transferState.remove(SHELL_NAV_STATE_KEY);
            this._header.set(cached.header);
            this._footer.set(cached.footer);
            this._brandIcon.set(cached.brandIcon);
            // `?? false`: un transfer-state serializzato da un server con codice più vecchio (finestra di
            // un rolling deploy) potrebbe non avere ancora questo campo — undefined, non false, a runtime
            // (TransferState non valida la forma, solo TS lo farebbe e qui il JSON è già disserializzato).
            this._hideLegalStrip.set(cached.hideLegalStrip ?? false);
            return;
        }

        await Promise.all([
            this.resolveHeaderInto(lang, generation),
            this.resolveFooterInto(lang, generation),
            this.resolveBrandIconInto(lang, generation),
        ]);
        // Un resolve() più recente è partito nel frattempo (cambio lingua/login a raffica): i suoi
        // risultati sono già nei signal, questo giro non ha più nulla di attendibile da trasferire.
        if (generation !== this.generation) return;
        // Solo server: TransferState è un canale "usa una volta" per il passaggio SSR→client,
        // non una cache generica. Scriverci anche da client (bug verificato: succedeva sempre,
        // qui la guardia mancava) arma la trappola per il PROSSIMO resolve() — che la trova già
        // valorizzata e le crede, riusando un risultato client-side potenzialmente calcolato con
        // un'identity ancora incompleta (la corsa fra l'effect() e il resolve() esplicito del
        // provideAppInitializer in app.config.ts, entrambi legittimi, entrambi possono arrivare
        // prima che identityService abbia finito il proprio fetch) invece di ri-risolvere per
        // davvero una volta che l'identità è finalmente arrivata — il footer restava agganciato
        // per sempre a quello scatto sbagliato, mai più ricalcolato.
        if (!this.isBrowser) {
            this.transferState.set(SHELL_NAV_STATE_KEY, { header: this._header(), footer: this._footer(), brandIcon: this._brandIcon(), hideLegalStrip: this._hideLegalStrip() });
        }
    }

    private ctx(lang: string): { lang: string; getPath: (type: PageType, lang: string) => string | null; identity: Identity | null } {
        return { lang, getPath: this.getPath, identity: this.identityService.identity() };
    }

    private async resolveHeaderInto(lang: string, generation: number): Promise<void> {
        // Un resolve() più recente potrebbe aver già scritto sul signal mentre questo giro era in
        // volo: un giro vecchio che scrive per ultimo (fine solo per ordine di arrivo in rete, non
        // di partenza) sovrascriverebbe un risultato più fresco con uno stantio.
        const isCurrent = () => generation === this.generation;
        const run = this.resolver.header;
        if (!run) { if (isCurrent()) this._header.set([]); return; }
        try {
            const raw: RawNavItem[] = [];
            await runInInjectionContext(this.injector, () => run(createNavSectionBuilder(raw), this.ctx(lang)));
            const resolved = resolveNavItems(raw, this.getPageInfo, lang);
            validateNavDepth(resolved, 'header');
            if (isCurrent()) this._header.set(resolved);
        } catch (err) {
            console.error('[ShellNavService] Risoluzione header fallita:', err);
            // Svuota, non lascia lo stato precedente: quello poteva appartenere a un login/lingua
            // diversi (vedi doc di resolve()) — mostrare voci sbagliate è peggio di non mostrarne.
            if (isCurrent()) this._header.set([]);
        }
    }

    /** Pipeline dedicata al footer: builder e risoluzione diversi dall'header (`FooterSectionBuilder`
     *  invece di `NavSectionBuilder`, i gruppi accettano anche campi Identity/testo libero/social —
     *  vedi `shell-nav.ts`), quindi non condivide `resolveHeaderInto` oltre alla stessa guardia di
     *  generazione e allo stesso schema try/catch. Un progetto senza `resolver.footer` non ottiene
     *  un footer vuoto: `defaultFooterResolver` (societari/legali/contatti/orari/social, lo storico
     *  `app-identity-render`) copre l'assenza — stesso meccanismo di un resolver di progetto, mai
     *  attivo insieme a uno personalizzato, che lo rimpiazza per intero definendo `footer` in nav.ts. */
    private async resolveFooterInto(lang: string, generation: number): Promise<void> {
        const isCurrent = () => generation === this.generation;
        const run = this.resolver.footer ?? defaultFooterResolver;
        try {
            const state: FooterBuildState = { entries: [], hideLegalStrip: false };
            const ctx = this.ctx(lang);
            await runInInjectionContext(this.injector, () => run(createFooterSectionBuilder(state), ctx));
            const resolved = resolveFooterItems(state.entries, this.getPageInfo, ctx.identity, { translate: this.translate, localization: this.localization }, lang);
            validateFooterDepth(resolved);
            validateFooterBreadth(resolved);
            if (isCurrent()) { this._footer.set(resolved); this._hideLegalStrip.set(state.hideLegalStrip); }
        } catch (err) {
            console.error('[ShellNavService] Risoluzione footer fallita:', err);
            // Un resolver fallito non deve anche nascondere la fascia legale: quella non dipende
            // da lui essendo riuscito, resta quella di sempre finché non viene esplicitamente disattivata.
            if (isCurrent()) { this._footer.set([]); this._hideLegalStrip.set(false); }
        }
    }

    /** Risolve `resolver.brandIcon`, stessa guardia di generazione delle altre due pipeline ma
     *  corpo separato: il tipo di ritorno non è un `NavLink[]`/`FooterEntry[]`. */
    private async resolveBrandIconInto(lang: string, generation: number): Promise<void> {
        const isCurrent = () => generation === this.generation;
        const run = this.resolver.brandIcon;
        if (!run) { if (isCurrent()) this._brandIcon.set('favIcon'); return; }
        try {
            const value = await runInInjectionContext(this.injector, () => run(this.ctx(lang)));
            if (isCurrent()) this._brandIcon.set(value);
        } catch (err) {
            console.error('[ShellNavService] Risoluzione brandIcon fallita:', err);
            // A differenza di header/footer: il fallback sicuro è il default (favIcon), non "nascosta"
            // — nascondere l'icona è comunque un'altra decisione, del design system, non di questo resolver.
            if (isCurrent()) this._brandIcon.set('favIcon');
        }
    }
}
