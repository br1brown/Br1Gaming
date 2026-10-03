import { InjectionToken, makeStateKey } from '@angular/core';

/** Dati salvati nei log per ogni richiesta. */
export type CampoLog = 'ip' | 'dataOra' | 'url' | 'metodo' | 'stato' | 'dimensione' | 'referrer' | 'userAgent';
/** Base di un trasferimento fuori dallo Spazio economico europeo: decisione di adeguatezza (art. 45) o clausole standard (art. 46). */
export type GaranziaTrasferimento = 'adeguatezza' | 'clausole-standard';
/** `accessi`: ogni richiesta; `errori`: solo quelle con errore o avviso; `applicazione`: i log delle applicazioni del sito. */
export type TipoLog = 'accessi' | 'errori' | 'applicazione';

/** Chi ospita o instrada il traffico: nome del fornitore e paese dei server (ISO 3166-1 alpha-2). */
export interface FornitoreInfrastruttura {
    fornitore: string;
    paese?: string;
    /** Obbligatoria se `paese` è fuori dallo Spazio economico europeo. */
    garanzie?: GaranziaTrasferimento;
}

/** Un file di log del server (reverse proxy compreso): cosa salva e per quanto. */
export interface LogServer {
    tipo: TipoLog;
    campi?: readonly CampoLog[];
    /** Giorni al massimo, se una rotazione a tempo li garantisce; assente = log a dimensione limitata, sovrascritti a rotazione. */
    conservazioneGiorni?: number;
    ipAnonimizzato?: boolean;
}

/** Fatti di un server: ogni campo è facoltativo, e se manca la frase non compare. */
export interface ServerInfo {
    hosting?: FornitoreInfrastruttura;
    /** `false`: nessuna CDN davanti al server; come l'assenza, nel testo non compare. */
    cdn?: false | FornitoreInfrastruttura;
    /** Le richieste passano da un reverse proxy del server, che scrive i log. */
    reverseProxy?: boolean;
    log?: readonly LogServer[];
}

/** Fatti dell'installazione, dichiarati nel file indicato da `frontend.hostingInfo`: un file per server, condiviso
 *  dai siti che ci girano. I campi in radice descrivono il server del sito; `backend` il server delle API, se è un altro. */
export interface HostingInfo extends ServerInfo {
    backend?: ServerInfo;
}

/** A cosa serve un servizio esterno, dalla direttiva CSP che lo ammette. */
export type UsoTerzi = 'script' | 'stili' | 'immagini' | 'caratteri' | 'dati' | 'incorporati' | 'media';
export type PermessoDispositivo = 'geolocation' | 'camera' | 'microphone';

const USO_DA_DIRETTIVA: Readonly<Record<string, UsoTerzi>> = {
    'script-src': 'script', 'script-src-elem': 'script', 'style-src': 'stili', 'style-src-elem': 'stili', 'img-src': 'immagini',
    'font-src': 'caratteri', 'connect-src': 'dati', 'frame-src': 'incorporati', 'child-src': 'incorporati', 'media-src': 'media',
};
const PERMESSI: readonly PermessoDispositivo[] = ['geolocation', 'camera', 'microphone'];
/** Sorgente CSP fatta del solo schema (`https:`): ammette qualunque sito con quello schema. Resta tale e quale in `host`, la frase la fa `renderThirdParties`. */
const SOLO_SCHEMA = /^[a-z][a-z0-9+.-]*:$/i;

/** Dai due blocchi di `security-headers.override.json` ai servizi esterni (host e uso) e ai permessi del dispositivo che il sito ha chiesto di
 *  poter usare. Le sorgenti che non escono dal sito (`'self'`, `data:`, `blob:`, nonce, hash, parole chiave) non contano; uno schema nudo
 *  (`https:`) resta com'è e il testo lo rende come «qualsiasi sito». Una direttiva o una feature sconosciuta si ignora: il testo dice solo ciò che sa. */
export function terziDaOverride(csp: Readonly<Record<string, readonly string[]>> | null, permissions: Readonly<Record<string, readonly string[]>> | null): LegalFacts['terzi'] {
    const perHost = new Map<string, Set<UsoTerzi>>();
    for (const [direttiva, sorgenti] of Object.entries(csp ?? {})) {
        const uso = USO_DA_DIRETTIVA[direttiva];
        if (!uso || !Array.isArray(sorgenti)) continue;
        for (const sorgente of sorgenti) {
            if (typeof sorgente !== 'string') continue;
            const s = sorgente.trim();
            if (!s || s.startsWith("'") || s.startsWith('{') || /^(data|blob|filesystem|mediastream):$/i.test(s)) continue;
            const host = SOLO_SCHEMA.test(s) ? s.toLowerCase()
                : s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/[/?#].*$/, '').replace(/:(\d+|\*)$/, '').toLowerCase();
            if (!host || host === 'self') continue;
            (perHost.get(host) ?? perHost.set(host, new Set()).get(host)!).add(uso);
        }
    }
    const permessi = PERMESSI.filter(f => (permissions?.[f] ?? []).some(o => typeof o === 'string' && o.trim() !== '' && o.trim() !== "'none'"));
    return { servizi: [...perHost.entries()].map(([host, usi]) => ({ host, usi: [...usi] })), permessi };
}

/** Fatti che la Privacy Policy ricava da installazione e configurazione, calcolati dall'SSR e passati al browser
 *  (TransferState di ogni pagina, `/internal/legal-facts`): solo ciò che il testo dell'informativa scrive, niente di più.
 *  Un fatto che il testo non usa (limite spento, finestra dei login a login spento, campi dei log applicativi) non
 *  entra qui: sarebbe ricognizione gratuita per chiunque legga la pagina. Per lo stesso motivo posta e segnalazioni
 *  di errore non portano l'host del servizio: l'informativa ne nomina la categoria (fornitore di posta, servizio di
 *  notifica), che le basta, e il nome del fornitore, se il titolare vuole scriverlo, è una chiave `dest*` in `addon`. */
export interface LegalFacts {
    installazione: HostingInfo | null;
    /** Servizi esterni che il sito può contattare e funzioni del dispositivo che può chiedere, come dichiarati in `security-headers.override.json`
     *  (CSP e Permissions-Policy: il browser impedisce tutto il resto, perché il template ammette solo il sito stesso). Vuoto = nessuno.
     *  `host` è un nome host, oppure uno schema nudo (`https:`) quando la direttiva ammette qualunque sito con quello schema. */
    terzi: { servizi: { host: string; usi: UsoTerzi[] }[]; permessi: PermessoDispositivo[] };
    /** Quante copie di sicurezza restano (`Backup.Retention` di global-settings, lo stesso numero che legge `scripts/backup.sh`); `null` se `Backup` non c'è. */
    backup: number | null;
    /** URL del sito coperto dall'informativa (`FRONTEND_BASE_URL` o `frontend.hostname`); null se non noto. */
    sito: string | null;
    /** Per quanti secondi l'IP resta in memoria per il limite di richieste (`Security.ApiConfig.RateLimiting`: la finestra
     *  più lunga fra quella generale e, col login acceso, quella dei login); `null` con il limite spento, e la frase non c'è.
     *  Le soglie non entrano nell'informativa, che non deve dire quanto si può chiedere. */
    limiteRichiesteSecondi: number | null;
}

export const LEGAL_FACTS = new InjectionToken<LegalFacts | null>('LEGAL_FACTS', { providedIn: 'root', factory: () => null });
export const LEGAL_FACTS_STATE_KEY = makeStateKey<LegalFacts | null>('br1_legal_facts');

const CAMPI: readonly CampoLog[] = ['ip', 'dataOra', 'url', 'metodo', 'stato', 'dimensione', 'referrer', 'userAgent'];
const TIPI: readonly TipoLog[] = ['accessi', 'errori', 'applicazione'];
const UE = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']);
const SEE_EXTRA_UE = new Set(['IS', 'LI', 'NO']);
const CHIAVI_SERVER = ['hosting', 'cdn', 'reverseProxy', 'log'];

const isObjetto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Un fornitore `{ fornitore, paese?, garanzie? }`: nome, paese ISO e, fuori dallo Spazio economico europeo, la base del trasferimento. */
function validaFornitore(v: unknown, where: string, fail: (msg: string) => never): void {
    if (!isObjetto(v)) return fail(`${where} deve essere un oggetto { fornitore, paese?, garanzie? }.`);
    for (const k of Object.keys(v)) if (!['fornitore', 'paese', 'garanzie'].includes(k)) fail(`${where}: campo "${k}" sconosciuto (ammessi: fornitore, paese, garanzie).`);
    if (typeof v['fornitore'] !== 'string' || !v['fornitore'].trim()) fail(`${where}.fornitore deve essere il nome del fornitore.`);
    const paese = v['paese'];
    if (paese !== undefined && (typeof paese !== 'string' || !/^[A-Z]{2}$/.test(paese) || new Intl.DisplayNames('en', { type: 'region' }).of(paese) === paese)) {
        fail(`${where}.paese "${String(paese)}" non è un codice paese ISO 3166-1 (es. "FR").`);
    }
    const garanzie = v['garanzie'];
    if (garanzie !== undefined && garanzie !== 'adeguatezza' && garanzie !== 'clausole-standard') {
        fail(`${where}.garanzie "${String(garanzie)}" non valida (adeguatezza | clausole-standard).`);
    }
    if (typeof paese === 'string' && !UE.has(paese) && !SEE_EXTRA_UE.has(paese) && garanzie === undefined) {
        fail(`${where}: server fuori dallo Spazio economico europeo (${paese}) senza "garanzie" per il trasferimento (adeguatezza | clausole-standard).`);
    }
}

/** `Backup` di global-settings.json: `Retention` = quante copie restano (lo stesso numero di `RETENTION` di `scripts/backup.sh`).
 *  Assente = `null`: nessuna frase sui backup. */
export function parseBackupProgetto(raw: unknown): number | null {
    if (raw === undefined || raw === null) return null;
    const fail = (msg: string): never => { throw new Error(`[br1-engine] Backup${msg}`); };
    if (!isObjetto(raw)) return fail(' deve essere un oggetto { Retention }.');
    for (const k of Object.keys(raw)) if (k !== 'Retention') fail(`: campo "${k}" sconosciuto (ammesso: Retention).`);
    const r = raw['Retention'];
    if (!Number.isInteger(r) || (r as number) < 1 || (r as number) > 3650) return fail('.Retention deve essere un intero, da 1 a 3650 (quante copie restano).');
    return r as number;
}

/** Valida il contenuto del file (già parsato) e lo restituisce tipizzato; lancia un errore che nomina il campo. */
export function parseHostingInfo(raw: unknown, source: string): HostingInfo {
    const fail = (msg: string): never => { throw new Error(`[br1-engine] ${source}: ${msg}`); };
    const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
    const onlyKeys = (o: Record<string, unknown>, keys: readonly string[], where: string) => {
        for (const k of Object.keys(o)) if (!keys.includes(k)) fail(`${where}: campo "${k}" sconosciuto (ammessi: ${keys.join(', ')}).`);
    };
    const fornitore = (v: unknown, where: string): void => { validaFornitore(v, where, fail); };
    const server = (o: Record<string, unknown>, prefix: string): void => {
        if (o['hosting'] !== undefined) fornitore(o['hosting'], `${prefix}hosting`);
        if (o['cdn'] !== undefined && o['cdn'] !== false) fornitore(o['cdn'], `${prefix}cdn`);
        if (o['reverseProxy'] !== undefined && typeof o['reverseProxy'] !== 'boolean') fail(`${prefix}reverseProxy deve essere true o false.`);
        const log = o['log'];
        if (log === undefined) return;
        if (!Array.isArray(log)) return fail(`${prefix}log deve essere un array.`);
        const tipi = new Set<unknown>();
        log.forEach((entry: unknown, i: number) => {
            const where = `${prefix}log[${i}]`;
            if (!isObj(entry)) return fail(`${where} deve essere un oggetto { tipo, campi?, conservazioneGiorni?, ipAnonimizzato? }.`);
            onlyKeys(entry, ['tipo', 'campi', 'conservazioneGiorni', 'ipAnonimizzato'], where);
            if (!TIPI.includes(entry['tipo'] as TipoLog)) fail(`${where}.tipo "${String(entry['tipo'])}" non valido (${TIPI.join(' | ')}).`);
            if (tipi.has(entry['tipo'])) fail(`${where}: tipo "${String(entry['tipo'])}" già dichiarato.`);
            tipi.add(entry['tipo']);
            const giorni = entry['conservazioneGiorni'];
            if (giorni !== undefined && (!Number.isInteger(giorni) || (giorni as number) < 1 || (giorni as number) > 3650)) fail(`${where}.conservazioneGiorni deve essere un intero di giorni, da 1 a 3650.`);
            const campi = entry['campi'];
            if (campi !== undefined && (!Array.isArray(campi) || campi.some(c => !CAMPI.includes(c)) || new Set(campi).size !== campi.length)) {
                fail(`${where}.campi: valori ammessi, senza ripetizioni: ${CAMPI.join(', ')}.`);
            }
            if (entry['ipAnonimizzato'] !== undefined && typeof entry['ipAnonimizzato'] !== 'boolean') fail(`${where}.ipAnonimizzato deve essere true o false.`);
        });
    };

    if (!isObj(raw)) return fail('deve contenere un oggetto JSON.');
    onlyKeys(raw, ['$schema', ...CHIAVI_SERVER, 'backend'], 'radice');
    server(raw, '');
    if (raw['backend'] !== undefined) {
        if (!isObj(raw['backend'])) return fail('backend deve essere un oggetto con gli stessi campi della radice (hosting, cdn, reverseProxy, log).');
        onlyKeys(raw['backend'], CHIAVI_SERVER, 'backend');
        server(raw['backend'], 'backend.');
    }
    // Solo i fatti che il testo usa: il risultato viaggia nella pagina (TransferState), e `$schema` o `cdn: false`
    // direbbero nel sorgente ciò che l'informativa non scrive.
    // Dei log applicativi il testo usa solo tipo e conservazione: campi e anonimizzazione dell'IP non escono di qui.
    const logEssenziale = (l: LogServer): LogServer => l.tipo === 'applicazione'
        ? { tipo: l.tipo, ...(l.conservazioneGiorni != null ? { conservazioneGiorni: l.conservazioneGiorni } : {}) }
        : l;
    const essenziale = (s: ServerInfo): ServerInfo => ({
        ...(s.hosting ? { hosting: s.hosting } : {}),
        ...(s.cdn ? { cdn: s.cdn } : {}),
        ...(s.reverseProxy ? { reverseProxy: true } : {}),
        ...(s.log?.length ? { log: s.log.map(logEssenziale) } : {}),
    });
    const info = raw as HostingInfo;
    return {
        ...essenziale(info),
        ...(info.backend ? { backend: essenziale(info.backend) } : {}),
    };
}

type Translate = (key: string, ...args: unknown[]) => string;

/** Log non applicativi (accessi/errori) del sito e del backend: quelli che "Dati di navigazione" e il
 *  riepilogo in cima usano per calcolare cosa salva il server e per quanto. */
function logsEssenziali(info: HostingInfo | null): readonly LogServer[] {
    return [...(info?.log ?? []), ...(info?.backend?.log ?? [])].filter(l => l.tipo !== 'applicazione');
}

/** Conservazione più lunga fra i log dichiarati (solo quelli con una durata: i log a rotazione non
 *  la dichiarano), o `null` senza log con `conservazioneGiorni`. */
function maxConservazioneGiorni(logs: readonly LogServer[]): number | null {
    return logs.reduce<number | null>((max, l) =>
        l.conservazioneGiorni != null && (max == null || l.conservazioneGiorni > max) ? l.conservazioneGiorni : max, null);
}

/** Conservazione più breve fra i log dichiarati con una durata, o `null` senza durate. */
function minConservazioneGiorni(logs: readonly LogServer[]): number | null {
    return logs.reduce<number | null>((min, l) =>
        l.conservazioneGiorni != null && (min == null || l.conservazioneGiorni < min) ? l.conservazioneGiorni : min, null);
}

const unitaFmt = (lang: string, valore: number, unit: 'day' | 'week' | 'second' | 'minute' | 'hour') =>
    new Intl.NumberFormat(lang, { style: 'unit', unit, unitDisplay: 'long' }).format(valore);
const unitaGiorni = (g: number) => g >= 14 && g % 7 === 0 ? { valore: g / 7, unit: 'week' as const } : { valore: g, unit: 'day' as const };
const giorniFmt = (lang: string, g: number) => { const { valore, unit } = unitaGiorni(g); return unitaFmt(lang, valore, unit); };
/** Estremo basso di un intervallo di durate: il solo numero se l'unità è la stessa dell'estremo alto ("da 4 a 10 settimane"). */
const giorniMinFmt = (lang: string, min: number, max: number) =>
    unitaGiorni(min).unit === unitaGiorni(max).unit ? new Intl.NumberFormat(lang).format(unitaGiorni(min).valore) : giorniFmt(lang, min);

/** Paese dei server di un fornitore, come frase (UE, SEE, o fuori con la base del trasferimento); vuota senza paese. */
function luogoFornitore(f: FornitoreInfrastruttura, t: Translate, lang: string): string {
    if (!f.paese) return '';
    const nome = new Intl.DisplayNames(lang, { type: 'region' }).of(f.paese) ?? f.paese;
    if (UE.has(f.paese)) return t('navLuogoUe', nome);
    if (SEE_EXTRA_UE.has(f.paese)) return t('navLuogoSee', nome);
    const frase = t('navLuogoExtra', nome, t(f.garanzie === 'adeguatezza' ? 'navGaranziaAdeguatezza' : 'navGaranziaClausole'));
    return f.garanzie === 'adeguatezza' ? frase : `${frase} ${t('navCopiaClausole')}`;
}

/** Sezione "Copie di sicurezza" della Privacy Policy, in Markdown (un paragrafo), dal fatto che il testo delle parti per funzione non può
 *  sapere: quante copie di backup restano. `null` senza `Backup` in global-settings: nessuna frase. */
export function renderInstallationDetails(facts: LegalFacts | null, t: Translate): string | null {
    if (!facts?.backup) return null;
    return `### ${t('instTitoloBackup')}\n\n${t('instBackup', facts.backup)}`;
}

/** Sezione "Servizi di terze parti" della Privacy Policy, in Markdown, da `LegalFacts.terzi`: quali servizi esterni il sito può contattare e a che
 *  scopo (host e uso), o, se non ce n'è nessuno, che tutto arriva dal sito stesso; e se può chiedere posizione, fotocamera o microfono.
 *  `null` senza fatti (pagina non renderizzata dal server): niente affermazioni che non si possono verificare. */
export function renderThirdParties(facts: LegalFacts | null, t: Translate, lang: string): string | null {
    const terzi = facts?.terzi;
    if (!terzi) return null;
    const lista = (v: string[]) => new Intl.ListFormat(lang, { type: 'conjunction' }).format(v);
    // Uno schema nudo (`https:`) non è un host: la direttiva ammette qualunque sito, e la frase lo dice nella lingua della pagina.
    const nomeHost = (host: string) => SOLO_SCHEMA.test(host) ? t('terziQualsiasiSito', host) : host;
    const servizi = terzi.servizi.map(s => `${nomeHost(s.host)} (${lista(s.usi.map(u => t(`terziUso_${u}`)))})`);
    const permessi = terzi.permessi.map(p => t(`terziPermesso_${p}`));
    return [
        `### ${t('terziTitolo')}`,
        servizi.length ? t('terziPresenti', lista(servizi)) : t('terziAssenti'),
        permessi.length ? t('terziPermessi', lista(permessi)) : t('terziPermessiAssenti'),
    ].join('\n\n');
}

/** Sezione «Hosting e gestione tecnica» delle Note legali, in Markdown: chi ospita il sito (e le API, se altrove) con il paese dei server, dai fatti
 *  dell'installazione; senza fatti, una frase generica. Chiude con a chi segnalare problemi e vulnerabilità. */
export function renderHostingNote(facts: LegalFacts | null, t: Translate, lang: string): string {
    const info = facts?.installazione;
    const frasi = [
        info?.hosting ? t('noteHosting', info.hosting.fornitore) : t('noteHostingGenerico'),
        ...(info?.hosting ? [luogoFornitore(info.hosting, t, lang)] : []),
        ...(info?.backend?.hosting ? [t('noteHostingBackend', info.backend.hosting.fornitore), luogoFornitore(info.backend.hosting, t, lang)] : []),
        t('noteSegnalazioni'),
    ].filter(Boolean);
    return `## ${t('noteHostingTitolo')}\n\n${frasi.join(' ')}`;
}

/** Funzioni accese del sito che portano un destinatario in più (`environment.features` + `COOKIE_MAP`), lette dal chiamante:
 *  posta e segnalazioni come categoria (fornitore di posta, servizio di notifica), mai come host; gli strumenti della Cookie Policy. */
export interface DestinatariOpzioni { posta: boolean; segnalazioni: boolean; strumentiCookie: boolean }

/** `true` solo se i fatti sostengono che i dati restano nello Spazio economico europeo: hosting (e CDN, server delle API) con paese dichiarato dentro lo
 *  SEE, nessun fornitore di posta o segnalazioni (di cui non si conosce il paese), nessun servizio esterno, nessuno strumento di statistica o profilazione. */
function soloSee(facts: LegalFacts | null, opzioni: DestinatariOpzioni): boolean {
    const info = facts?.installazione;
    if (!facts?.terzi) return false; // fatti senza l'elenco dei servizi esterni: niente affermazioni
    const inSee = (f?: FornitoreInfrastruttura | false): boolean => !f || (!!f.paese && (UE.has(f.paese) || SEE_EXTRA_UE.has(f.paese)));
    if (!info?.hosting?.paese || !inSee(info.hosting) || !inSee(info.cdn) || !inSee(info.backend?.hosting) || !inSee(info.backend?.cdn)) return false;
    return !opzioni.posta && !opzioni.segnalazioni && facts.terzi.servizi.length === 0 && !opzioni.strumentiCookie;
}

/** Sezione "Destinatari" della Privacy Policy, in Markdown, scritta dai fatti: chi tratta i dati per conto del titolare è chi il sito
 *  dichiara (hosting, CDN, server delle API, per nome) più, a funzione accesa, il fornitore di posta e il servizio che riceve le segnalazioni
 *  (per categoria) e, con strumenti di statistica o profilazione, i loro fornitori nella Cookie Policy. Senza fatti d'installazione:
 *  "il fornitore che ospita il sito". Mai un fornitore che i fatti non nominano. */
export function renderRecipients(facts: LegalFacts | null, t: Translate, lang: string, opzioni: DestinatariOpzioni): string {
    const info = facts?.installazione;
    const chi = [
        info?.hosting ? t('destHosting', info.hosting.fornitore) : t('destGenerico'),
        ...(info?.cdn ? [t('destCdn', info.cdn.fornitore)] : []),
        ...(info?.backend?.hosting ? [t('destBackendHosting', info.backend.hosting.fornitore)] : []),
        ...(info?.backend?.cdn ? [t('destCdn', info.backend.cdn.fornitore)] : []),
        ...(opzioni.posta ? [t('destPosta')] : []),
        ...(opzioni.segnalazioni ? [t('destSegnalazioni')] : []),
        ...(opzioni.strumentiCookie ? [t('destStrumentiCookie')] : []),
    ];
    const testo = t('destTesto', new Intl.ListFormat(lang, { type: 'conjunction' }).format(chi));
    return `## ${t('destTitolo')}\n\n${soloSee(facts, opzioni) ? `${testo}\n\n${t('destSee')}` : testo}`;
}

/** Riepilogo "in sintesi" della Privacy Policy, in linguaggio semplice: informativa a strati sulla stessa
 *  pagina, prima dell'intro. Usa solo i fatti che `renderNavigationData` spiega per esteso subito dopo
 *  (quali dati in breve, la conservazione dichiarata (intervallo se i log differiscono), se l'IP serve anche al rate limiting):
 *  mai un'affermazione che il resto della pagina non ripeta. Senza fatti d'installazione resta generico. */
export function renderNavigationSummary(facts: LegalFacts | null, t: Translate, lang: string): string {
    const logs = logsEssenziali(facts?.installazione ?? null);
    const maxGiorni = maxConservazioneGiorni(logs);
    const limite = facts?.limiteRichiesteSecondi ?? null;
    const minGiorni = minConservazioneGiorni(logs);
    // Durate diverse fra i log (es. accessi 4 settimane, errori 10): il riepilogo dà l'intervallo, come il dettaglio.
    const conservazione = maxGiorni == null ? t('navSintesiConservazioneGenerica')
        : minGiorni != null && minGiorni !== maxGiorni
            ? t('navSintesiConservazioneIntervallo', giorniMinFmt(lang, minGiorni, maxGiorni), giorniFmt(lang, maxGiorni))
            : t('navSintesiConservazione', giorniFmt(lang, maxGiorni));
    return [
        t('navSintesi', conservazione),
        limite !== null ? t('navSintesiLimite') : '',
        t('navSintesiDettagli'),
    ].filter(Boolean).join(' ');
}

/** Parte della Privacy Policy generata dall'Engine, in Markdown: ambito (il sito coperto) e sezione "Dati
 *  di navigazione", dai fatti di installazione e configurazione e dalle chiavi `nav*` di `basic.*.json`.
 *  Senza fatti d'installazione: elenco dei dati tipico e conservazione per criterio. */
export function renderNavigationData(facts: LegalFacts | null, t: Translate, lang: string): string {
    const info = facts?.installazione ?? null;
    const list = (items: string[]) => new Intl.ListFormat(lang, { type: 'conjunction' }).format(items);
    const secondi = (s: number) => s % 3600 === 0 ? unitaFmt(lang, s / 3600, 'hour') : s % 60 === 0 ? unitaFmt(lang, s / 60, 'minute') : unitaFmt(lang, s, 'second');
    const giorni = (g: number) => giorniFmt(lang, g);
    const luogo = (f: FornitoreInfrastruttura) => luogoFornitore(f, t, lang);
    const chiaveLog: Record<TipoLog, string> = { accessi: 'navLogAccessi', errori: 'navLogErrori', applicazione: 'navLogApplicazione' };
    // Log con la stessa conservazione (stessa durata, o entrambi a rotazione) si nominano insieme, con la
    // frase di durata una volta sola, invece di ripeterla per ogni tipo: una formulazione unitaria, non un
    // elenco di frasi quasi identiche.
    const raggruppaConservazione = (log: readonly LogServer[]): string[] => {
        const gruppi = new Map<string, TipoLog[]>();
        for (const l of log) {
            const chiave = l.conservazioneGiorni != null ? `g${l.conservazioneGiorni}` : 'rotazione';
            (gruppi.get(chiave) ?? gruppi.set(chiave, []).get(chiave)!).push(l.tipo);
        }
        return [...gruppi.entries()].map(([chiave, tipi]) => {
            const durata = chiave === 'rotazione' ? t('navLogRotazione') : t('navLogDurata', giorni(Number(chiave.slice(1))));
            return `${list(tipi.map(tp => t(chiaveLog[tp])))} ${durata}`;
        });
    };
    /** Conservazione, hosting e CDN di un server, come paragrafi: ogni fornitore con la frase sul paese dei suoi server. */
    const voci = (s: ServerInfo, criterio: boolean, backend = false): string[] => [
        ...(s.log?.length
            ? [t(backend ? 'navConservazioneBackend' : 'navConservazione', list(raggruppaConservazione(s.log)))]
            : criterio ? [t('navConservazioneCriterio')] : []),
        ...[
            s.hosting ? [t(backend ? 'navHostingBackend' : 'navHosting', s.hosting.fornitore), luogo(s.hosting)] : [],
            s.cdn ? [t(backend ? 'navCdnBackend' : 'navCdn', s.cdn.fornitore), luogo(s.cdn)] : [],
        ].map(frasi => frasi.filter(Boolean).join(' ')).filter(Boolean),
    ];

    // Dati salvati: quelli dichiarati dai log del sito, o l'elenco tipico del Garante.
    const logs = logsEssenziali(info);
    const dichiarati = new Set(logs.flatMap(l => l.campi ?? []));
    // "IP reso anonimo" solo se lo è in ogni log che l'IP lo salva (senza `campi` = elenco generico, IP compreso).
    const conIp = logs.filter(l => !l.campi || l.campi.includes('ip'));
    const anonimo = conIp.length > 0 && conIp.every(l => l.ipAnonimizzato);
    // "IP registrato per intero" solo se il file lo dichiara (`ipAnonimizzato: false`) in ogni log che lo salva: l'assenza del campo non è un'affermazione.
    const intero = !anonimo && conIp.length > 0 && conIp.every(l => l.ipAnonimizzato === false);
    const campo = (c: CampoLog) => t(c === 'ip' && anonimo ? 'navCampoIpAnonimo' : c === 'ip' && intero ? 'navCampoIpIntero' : `navCampo${c[0].toUpperCase()}${c.slice(1)}`);
    const dati = dichiarati.size > 0
        ? list(CAMPI.filter(c => dichiarati.has(c)).map(campo))
        : list([...(['ip', 'url', 'dataOra', 'metodo', 'dimensione', 'stato'] as CampoLog[]).map(campo), t('navCampiAltri')]);
    // Un log che salva meno dell'unione (es. gli errori solo IP, orario, URL e referrer) lo dice: altrimenti l'elenco sembra valere per ogni log.
    const soloQuesti = [...new Map(logs
        .filter((l): l is LogServer & { campi: readonly CampoLog[] } => !!l.campi && l.campi.length > 0 && l.campi.length < dichiarati.size && (l.tipo === 'accessi' || l.tipo === 'errori'))
        .map(l => [`${l.tipo}:${l.campi.join()}`, t(l.tipo === 'errori' ? 'navCampiSoloErrori' : 'navCampiSoloAccessi', list(CAMPI.filter(c => l.campi.includes(c)).map(campo)))])).values()];

    const limite = facts?.limiteRichiesteSecondi ?? null;
    // Perché, chi li registra, per quanto l'IP resta in memoria per il limite di richieste.
    const finalita = [
        t('navFinalita'),
        info?.reverseProxy ? t('navReverseProxy') : '',
        limite !== null ? t('navLimite', secondi(limite)) : '',
    ].filter(Boolean).join(' ');

    const backend = info?.backend;
    // Un URL del sito malformato (senza schema) toglie solo la frase sull'ambito, non la pagina.
    const host = (() => { try { return facts?.sito ? new URL(facts.sito).host : null; } catch { return null; } })();

    const parti = [
        ...(host ? [t('navAmbito', `[${host}](${facts!.sito})`)] : []),
        `## ${t('navSezione')}`,
        `### ${t('navTitolo')}`,
        [t('navAcquisizione'), t('navCategoria', dati), ...soloQuesti].join(' '),
        finalita,
        t('navBaseGiuridica'),
        ...voci(info ?? {}, true),
        ...(backend ? [
            [t('navBackend'), backend.reverseProxy ? t('navBackendReverseProxy') : ''].filter(Boolean).join(' '),
            ...voci(backend, false, true),
        ] : []),
    ];
    return parti.join('\n\n');
}
