import { ConsentCategory } from '../../services/cookie/cookie-type';

/** Embed di terze parti, parte pura: un provider valida l'id e costruisce l'indirizzo dell'iframe, `resolveEmbed` lo accetta solo `https:`
 *  e con l'host nella lista `hosts` del provider, altrimenti dà `null`. */

/** Un provider di embed. I quattro di serie sono in {@link EMBED_PROVIDERS}; uno proprio si scrive con {@link defineEmbedProvider}. */
export interface EmbedProvider {
    /** Chiave breve (`youtube`): serve anche a scegliere i colori e l'icona di marca. */
    key: string;
    /** Nome mostrato («YouTube»). */
    label: string;
    /** Glifo Font Awesome della facade. */
    glyph: string;
    /** Categoria di consenso che autorizza il caricamento da solo; di serie `Profiling` (i player di terzi leggono e scrivono cookie). */
    category: ConsentCategory;
    /** Informativa privacy del provider, linkata nell'avviso della facade. */
    privacyUrl: string;
    /** Gli host da cui il provider serve l'iframe: l'unica fonte, per la verifica e per `frame-src`. Solo nomi host esatti, senza schema né percorso. */
    hosts: readonly string[];
    /** Gli id validi. Un id che non lo soddisfa non produce mai un indirizzo. */
    idPattern: RegExp;
    /** L'indirizzo dell'iframe per un id già validato. */
    embedUrl(id: string): string;
    /** L'indirizzo della pagina pubblica del contenuto (il link «Apri su…»). */
    openUrl(id: string): string;
    /** L'id che questo provider riconosce in un indirizzo (pagina pubblica o indirizzo dell'embed), o `null`. */
    parseUrl(url: URL): string | null;
    /** La forma del player: un rapporto (`16 / 9`) o un'altezza fissa in px; `height(id)` per chi cambia con l'id. */
    size: { ratio?: string; height?: number | ((id: string) => number) };
}

/** Dichiara un provider proprio, controllandone la forma subito (un host con schema o percorso, una chiave vuota, un `idPattern` con flag globale che avrebbe uno stato fra una prova e l'altra). */
export function defineEmbedProvider(provider: EmbedProvider): EmbedProvider {
    if (!/^[a-z][a-z0-9-]*$/.test(provider.key)) throw new Error(`[embed] chiave del provider non valida: "${provider.key}".`);
    if (provider.hosts.length === 0) throw new Error(`[embed] il provider "${provider.key}" non dichiara nessun host.`);
    for (const host of provider.hosts) {
        if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(host) || host.includes('..')) throw new Error(`[embed] host non valido in "${provider.key}": "${host}" (solo il nome host, senza schema né percorso).`);
    }
    if (provider.idPattern.global || provider.idPattern.sticky) throw new Error(`[embed] l'idPattern di "${provider.key}" non può avere i flag g o y.`);
    return provider;
}

const hostIs = (url: URL, ...names: string[]): boolean => names.includes(url.hostname.toLowerCase());

const youtube = defineEmbedProvider({
    key: 'youtube', label: 'YouTube', glyph: 'fa-brands fa-youtube', category: ConsentCategory.Profiling,
    privacyUrl: 'https://policies.google.com/privacy',
    // youtube-nocookie.com: lo stesso player senza cookie finché non si preme play; l'host va in `frame-src` (security-headers.override.json).
    hosts: ['www.youtube-nocookie.com'],
    idPattern: /^[A-Za-z0-9_-]{11}$/,
    embedUrl: id => `https://www.youtube-nocookie.com/embed/${id}`,
    openUrl: id => `https://www.youtube.com/watch?v=${id}`,
    parseUrl: url => {
        if (hostIs(url, 'youtu.be')) return url.pathname.split('/')[1] || null;
        if (!hostIs(url, 'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com')) return null;
        const [, kind, id] = url.pathname.split('/');
        if (kind === 'watch') return url.searchParams.get('v');
        return kind === 'embed' || kind === 'shorts' || kind === 'live' ? id || null : null;
    },
    size: { ratio: '16 / 9' },
});

const vimeo = defineEmbedProvider({
    key: 'vimeo', label: 'Vimeo', glyph: 'fa-brands fa-vimeo-v', category: ConsentCategory.Profiling,
    privacyUrl: 'https://vimeo.com/privacy',
    hosts: ['player.vimeo.com'],
    // `12345` oppure `12345/hash` (video non in elenco: l'hash è nell'indirizzo pubblico e va nell'embed come `?h=`).
    idPattern: /^\d{1,12}(\/[A-Fa-f0-9]{6,20})?$/,
    // `dnt=1` dopo l'hash (Vimeo vuole l'hash per primo): niente nuovi cookie di tracciamento durante la visione.
    embedUrl: id => { const [num, hash] = id.split('/'); return `https://player.vimeo.com/video/${num}?${hash ? `h=${hash}&` : ''}dnt=1`; },
    openUrl: id => `https://vimeo.com/${id}`,
    parseUrl: url => {
        if (hostIs(url, 'player.vimeo.com')) { const m = /^\/video\/(\d{1,12})/.exec(url.pathname); const h = url.searchParams.get('h'); return m ? (h ? `${m[1]}/${h}` : m[1]) : null; }
        if (!hostIs(url, 'vimeo.com', 'www.vimeo.com')) return null;
        const m = /^\/(\d{1,12})(?:\/([A-Fa-f0-9]{6,20}))?\/?$/.exec(url.pathname);
        return m ? (m[2] ? `${m[1]}/${m[2]}` : m[1]) : null;
    },
    size: { ratio: '16 / 9' },
});

const spotify = defineEmbedProvider({
    key: 'spotify', label: 'Spotify', glyph: 'fa-brands fa-spotify', category: ConsentCategory.Profiling,
    privacyUrl: 'https://www.spotify.com/legal/privacy-policy/',
    hosts: ['open.spotify.com'],
    idPattern: /^(episode|show|track|album|playlist|artist)\/[A-Za-z0-9]{22}$/,
    embedUrl: id => `https://open.spotify.com/embed/${id}`,
    openUrl: id => `https://open.spotify.com/${id}`,
    parseUrl: url => {
        if (!hostIs(url, 'open.spotify.com')) return null;
        const m = /^\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(episode|show|track|album|playlist|artist)\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname);
        return m ? `${m[1]}/${m[2]}` : null;
    },
    // Un brano o un episodio sta in un player compatto; un album, una playlist o una serie vogliono la lista.
    size: { height: id => /^(episode|track)\//.test(id) ? 232 : 352 },
});

const spreaker = defineEmbedProvider({
    key: 'spreaker', label: 'Spreaker', glyph: 'fa-solid fa-podcast', category: ConsentCategory.Profiling,
    privacyUrl: 'https://www.spreaker.com/privacy',
    hosts: ['widget.spreaker.com'],
    // `episode/12345` (quell'episodio) o `show/678` (l'ultimo episodio della serie), come `episode_id` e `show_id` del player.
    idPattern: /^(episode|show)\/\d{1,12}$/,
    embedUrl: id => { const [kind, num] = id.split('/'); return `https://widget.spreaker.com/player?${kind}_id=${num}`; },
    openUrl: id => `https://www.spreaker.com/${id}`,
    parseUrl: url => {
        if (hostIs(url, 'widget.spreaker.com')) {
            const episode = url.searchParams.get('episode_id'); const show = url.searchParams.get('show_id');
            return episode ? `episode/${episode}` : show ? `show/${show}` : null;
        }
        if (!hostIs(url, 'spreaker.com', 'www.spreaker.com')) return null;
        // `/episode/titolo--12345` o `/episode/12345`: l'id è dopo l'ultimo `--` (o l'intero segmento).
        const m = /^\/(episode|show)\/(?:[^/]*--)?(\d{1,12})\/?$/.exec(url.pathname);
        return m ? `${m[1]}/${m[2]}` : null;
    },
    size: { height: 200 },
});

/** I provider di serie. Uno proprio si passa come oggetto in `EmbedSource.provider`: nessun registro globale da mutare. */
export const EMBED_PROVIDERS: Readonly<Record<string, EmbedProvider>> = Object.freeze({ youtube, vimeo, spotify, spreaker });

/** Cosa si mostra (titolo, sottotitolo, copertina, altezza, link) sommato a cosa si incorpora. `title` è obbligatorio: nomina l'iframe per chi usa un lettore di schermo. */
export interface EmbedPresentation {
    /** Il nome del contenuto, già tradotto: titolo della facade e `title` dell'iframe. */
    title: string;
    subtitle?: string;
    /** Id di un asset (`mapping.json`) per la copertina della facade, al posto del glifo del provider. */
    cover?: string;
    /** Altezza in px al posto di quella del provider. */
    height?: number;
    /** Dove porta «Apri su…» al posto della pagina pubblica del provider (solo `https:`). */
    link?: string;
}

/** Un embed: o un indirizzo (`url`, pagina pubblica o embed: il provider si riconosce da sé) o un provider con il suo id, più la presentazione.
 *  Può arrivare tale e quale da un file di contenuti o dal backend. */
export type EmbedSource = EmbedPresentation & ({ url: string } | { provider: string | EmbedProvider; id: string });

/** Un embed verificato: tutto ciò che serve a disegnarlo, e niente che non sia passato dai controlli. */
export interface ResolvedEmbed {
    provider: EmbedProvider;
    id: string;
    /** L'indirizzo dell'iframe: `https:`, host nella lista del provider, costruito da un id valido. */
    embedUrl: string;
    /** Il link «Apri su…». */
    openUrl: string;
    /** L'altezza in px, o `null` se il player ha un rapporto fisso. */
    height: number | null;
    ratio: string | null;
}

/** Un indirizzo `https:` assoluto, o `null`: per il link «Apri su…», che non è un iframe ma non deve mai essere `javascript:`. */
function safeHttps(value: string | undefined): string | null {
    if (!value) return null;
    try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; }
}

/** Il provider e l'id che un indirizzo (pagina pubblica o embed) descrive, fra i provider dati; `null` se nessuno lo riconosce o l'id non è valido. */
export function detectEmbed(url: string, providers: Readonly<Record<string, EmbedProvider>> = EMBED_PROVIDERS): { provider: EmbedProvider; id: string } | null {
    let parsed: URL;
    try { parsed = new URL(url); } catch { return null; }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    for (const provider of Object.values(providers)) {
        const id = provider.parseUrl(parsed);
        if (id && provider.idPattern.test(id)) return { provider, id };
    }
    return null;
}

/** L'embed pronto da disegnare, o `null` se il provider manca, l'id non è valido o l'indirizzo non è `https:` su un host del provider.
 *  Non lancia mai. `providers` sostituisce i quattro di serie. */
export function resolveEmbed(source: EmbedSource, providers: Readonly<Record<string, EmbedProvider>> = EMBED_PROVIDERS): ResolvedEmbed | null {
    // Un contenuto può arrivare da un file o dal backend: `null`, una stringa, un provider senza `idPattern` o una funzione di un provider proprio che lancia
    // non devono mai rompere la pagina. Qualunque cosa vada storta, `null`.
    try {
        return resolve(source, providers);
    } catch {
        return null;
    }
}

function resolve(source: EmbedSource, providers: Readonly<Record<string, EmbedProvider>>): ResolvedEmbed | null {
    if (source === null || typeof source !== 'object') return null;
    let provider: EmbedProvider | undefined;
    let id: string | undefined;
    if ('url' in source) {
        const found = typeof source.url === 'string' ? detectEmbed(source.url, providers) : null;
        provider = found?.provider; id = found?.id;
    } else {
        provider = typeof source.provider === 'string' ? (Object.hasOwn(providers, source.provider) ? providers[source.provider] : undefined) : source.provider;
        id = source.id;
    }
    if (!provider || typeof id !== 'string' || !provider.idPattern.test(id)) return null;

    let embed: URL;
    try { embed = new URL(provider.embedUrl(id)); } catch { return null; }
    // https, host esatto fra quelli del provider, e nient'altro: né credenziali (`utente:pw@host`) né una porta, che la CSP (`frame-src` con il solo host) non ammetterebbe comunque.
    if (embed.protocol !== 'https:' || !provider.hosts.includes(embed.hostname.toLowerCase()) || embed.username !== '' || embed.password !== '' || embed.port !== '') return null;

    const size = provider.size;
    const providerHeight = typeof size.height === 'function' ? size.height(id) : size.height;
    const height = source.height !== undefined && Number.isFinite(source.height) && source.height > 0 ? source.height : providerHeight ?? null;
    return {
        provider, id, embedUrl: embed.href,
        openUrl: safeHttps(source.link) ?? safeHttps(provider.openUrl(id)) ?? embed.href,
        height, ratio: height === null ? size.ratio ?? '16 / 9' : null,
    };
}
