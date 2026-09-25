import { Component, Signal, computed, input } from '@angular/core';
import { BaseLinkComponent } from '../base/base-link.component';
import { LinkBadgeComponent } from '../link-badge/link-badge.component';
import { ContactUrl } from '../utils/contact-url';

@Component({
    selector: 'app-social-link',
    standalone: true,
    imports: [LinkBadgeComponent],
    templateUrl: './social-link.component.html',
})
export class SocialLinkComponent extends BaseLinkComponent {
    /** Tipo esplicito (opzionale): se omesso, il social viene dedotto dall'URL (regex sui social noti). */
    readonly type = input<string>('');
    readonly value = input.required<string>();

    /** Chiave social: `type` esplicito o, se omesso, dedotta dall'URL — una lista può avere più
     *  profili dello stesso social (es. due pagine LinkedIn) senza collisioni. Vuota = non noto. */
    readonly socialKey: Signal<string> = computed(() => {
        const explicit = this.type().trim().toLowerCase();
        return explicit || detectSocialKey(this.value());
    });

    readonly socialConfig = computed(() => SOCIAL_MAP[this.socialKey()] ?? DEFAULT_SOCIAL_CONFIG);

    readonly glyph: Signal<string> = computed(() => this.socialConfig().icon);
    readonly color: Signal<string | null> = computed(() => this.socialConfig().color);
    override readonly glyphColor: Signal<string | null> = computed(() => this.socialConfig().fg ?? null);
    override readonly glyphMode: Signal<'glyph' | 'disc'> = computed(() => this.socialConfig().mode ?? 'glyph');
    override readonly glyphImage: Signal<string | null> = computed(() => this.socialConfig().image ?? null);
    readonly content: Signal<string> = computed(() => this.value().trim());

    readonly displayLabel: Signal<string> = computed(() =>
        this.label()?.trim() || socialDisplayName(this.socialKey()) || hostnameLabel(this.value())
    );

    /** URL finale: se `value` è già completo (http/mailto/tel) lo usa com'è, altrimenti lo costruisce
     *  dalla chiave social riusando i builder condivisi. */
    readonly href: Signal<string> = computed(() => {
        const raw = this.value().trim();
        if (!raw) return '';
        if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;

        switch (this.socialKey()) {
            case 'whatsapp': return ContactUrl.whatsapp(raw);
            case 'telegram': return ContactUrl.telegram(raw);
            case 'email':
            case 'mail':     return ContactUrl.mail(raw);
            case 'phone':
            case 'tel':      return ContactUrl.phone(raw);
            default: {
                const base = this.socialConfig().urlBase;
                return base ? base + raw.replace(/^@/, '') : raw;
            }
        }
    });
}

function capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/** Nomi con maiuscole "ufficiali" dove il semplice capitalize sbaglia (LinkedIn, non Linkedin). */
const SOCIAL_DISPLAY_NAMES: Record<string, string> = {
    linkedin: 'LinkedIn',
    whatsapp: 'WhatsApp',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    github: 'GitHub',
    soundcloud: 'SoundCloud',
    twitter: 'X', // rebranding: la chiave interna resta 'twitter', l'etichetta segue il nome attuale
    applemusic: 'Apple Music',
    itunes: 'iTunes',
    playstation: 'PlayStation',
    btc: 'Bitcoin',
    chromecast: 'Google Cast',
    deezer: 'Deezer',
};

/** Nome leggibile del social dalla chiave dedotta: casing ufficiale se noto, altrimenti capitalize. */
function socialDisplayName(key: string): string {
    return SOCIAL_DISPLAY_NAMES[key] ?? capitalize(key);
}

/** Etichetta di ripiego per un URL di social non riconosciuto: l'hostname senza `www.`. */
function hostnameLabel(url: string): string {
    try { return new URL(url.trim()).hostname.replace(/^www\./, ''); } catch { return url.trim(); }
}

/** Deduce la chiave social dal dominio dell'URL, pattern ancorati per evitare falsi positivi (es.
 *  `x.com` solo dopo `//` o `.`). Vuota se nessun social combacia → icona generica + hostname. */
function detectSocialKey(url: string): string {
    const u = (url ?? '').trim();
    if (!u) return '';
    for (const { key, re } of SOCIAL_URL_PATTERNS) {
        if (re.test(u)) return key;
    }
    return '';
}

const SOCIAL_URL_PATTERNS: { key: string; re: RegExp }[] = [
    { key: 'facebook',   re: /(?:facebook|fb)\.com|fb\.me/i },
    { key: 'instagram',  re: /instagram\.com|instagr\.am/i },
    { key: 'twitter',    re: /twitter\.com|(?:^|\/|\.)x\.com/i },
    { key: 'linkedin',   re: /linkedin\.com|lnkd\.in/i },
    { key: 'youtube',    re: /youtube\.com|youtu\.be/i },
    { key: 'tiktok',     re: /tiktok\.com/i },
    { key: 'whatsapp',   re: /wa\.me|whatsapp\.com/i },
    { key: 'telegram',   re: /t\.me|telegram\.(?:org|me)/i },
    { key: 'applemusic', re: /music\.apple\.com/i },
    { key: 'tipeee',     re: /tipeee\.com/i },
    { key: 'github',     re: /github\.com/i },
    { key: 'threads',    re: /threads\.net/i },
    { key: 'mastodon',   re: /mastodon\./i },
    { key: 'discord',    re: /discord\.(?:gg|com)/i },
    { key: 'reddit',     re: /reddit\.com/i },
    { key: 'pinterest',  re: /pinterest\./i },
    { key: 'snapchat',   re: /snapchat\.com/i },
    { key: 'twitch',     re: /twitch\.tv/i },
    { key: 'spotify',    re: /spotify\.com/i },
    { key: 'soundcloud', re: /soundcloud\.com/i },
    { key: 'vimeo',      re: /vimeo\.com/i },
    { key: 'dribbble',   re: /dribbble\.com/i },
    { key: 'tumblr',     re: /tumblr\.com/i },
    { key: 'deezer',     re: /deezer\.com/i },
    { key: 'yahoo',      re: /yahoo\.com/i },
    { key: 'airbnb',     re: /airbnb\./i },
    { key: 'audible',    re: /audible\./i },
];

type SocialConfig = {
    icon: string;
    /** Colore di sfondo della pastiglia: il primario del brand (null = default del tema). */
    color: string | null;
    /** Colore del marchio su quello sfondo, come da linee guida del brand. Assente = per contrasto. */
    fg?: string;
    /** `disc`: il glifo Font Awesome è già un disco col marchio ritagliato (vedi `IconMode`). */
    mode?: 'glyph' | 'disc';
    /** Logo a colori al posto del glifo, per i marchi che vietano il monocromatico. */
    image?: string;
    /** Base URL del profilo: se presente, un handle nudo diventa `urlBase + handle`. */
    urlBase?: string;
};

const DEFAULT_SOCIAL_CONFIG: SocialConfig = {
    icon: 'fa-solid fa-link',
    color: null
};

/** Colori ufficiali di una rete riconosciuta (sfondo della pastiglia e marchio sopra), per chi
 *  rende la stessa identità fuori da questo componente (contatti WhatsApp/Telegram): una sola fonte. */
export function brandColors(type: string): { color: string | null; fg: string | null; mode: 'glyph' | 'disc' } {
    const cfg = SOCIAL_MAP[type.trim().toLowerCase()];
    return { color: cfg?.color ?? null, fg: cfg?.fg ?? null, mode: cfg?.mode ?? 'glyph' };
}

/** Icona brand per una rete riconosciuta (`type`/`socialKey`, es. "github"); `undefined` se non nota.
 *  Usata anche fuori da qui per risolvere l'icona di un `ProjectLink`, senza duplicare SOCIAL_MAP. */
export function socialIcon(type: string): string | undefined {
    return SOCIAL_MAP[type.trim().toLowerCase()]?.icon;
}

/** "G" di Google a colori (asset ufficiale dei pulsanti "Accedi con Google"): le linee guida di
 *  Google vietano la G monocromatica e ricolorata, quindi niente glifo Font Awesome. */
const GOOGLE_G = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">'
    + '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>'
    + '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>'
    + '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>'
    + '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>'
    + '</svg>');

/** Colori dalle linee guida ufficiali dei brand (verificate 2026-09-25, fonte accanto a ogni voce),
 *  non calcolati. Voci "legacy" (servizi chiusi) restano per i link vecchi che continuano a esistere. */
const SOCIAL_MAP: Record<string, SocialConfig> = {
    // meta.com/brand/resources/facebook — blu dal 2023 (#1877F2 → #0866FF), "f" bianca
    facebook: { icon: 'fa-brands fa-facebook-f', color: '#0866FF', fg: '#FFFFFF', urlBase: 'https://facebook.com/' },
    // Meta: il colore del brand è il gradiente; su tinta unita il glifo bianco (tinta rappresentativa)
    instagram: { icon: 'fa-brands fa-instagram', color: '#FF0069', fg: '#FFFFFF', urlBase: 'https://instagram.com/' },
    // about.x.com brand toolkit — solo nero o bianco
    twitter: { icon: 'fa-brands fa-x-twitter', color: '#000000', fg: '#FFFFFF', urlBase: 'https://x.com/' },
    // brand.linkedin.com — "in" (non il quadrato) su blu
    linkedin: { icon: 'fa-brands fa-linkedin-in', color: '#0A66C2', fg: '#FFFFFF', urlBase: 'https://linkedin.com/in/' },
    // tumblr.com/logo — navy #001935
    tumblr: { icon: 'fa-brands fa-tumblr', color: '#001935', fg: '#FFFFFF' },
    // business.pinterest.com/brand-guidelines — "P" bianca in un cerchio rosso
    pinterest: { icon: 'fa-brands fa-pinterest-p', color: '#E60023', fg: '#FFFFFF', urlBase: 'https://pinterest.com/' },
    // snap.com/brand-guidelines — fantasma bianco con contorno nero: con un glifo a un colore solo il nero è leggibile
    snapchat: { icon: 'fa-brands fa-snapchat', color: '#FFFC00', fg: '#000000' },
    // TikTok: nero di base, rosso e ciano solo accenti
    tiktok: { icon: 'fa-brands fa-tiktok', color: '#000000', fg: '#FFFFFF', urlBase: 'https://tiktok.com/@' },
    // icona ufficiale dell'app (nessuna pagina di linee guida pubblica)
    quora: { icon: 'fa-brands fa-quora', color: '#B92B27', fg: '#FFFFFF' },
    // legacy: City Guide chiuso (dic. 2024 / apr. 2025); colori dell'emblema "F" del glifo
    foursquare: { icon: 'fa-brands fa-foursquare', color: '#F94877', fg: '#FFFFFF' },
    // brand.youtube — rettangolo rosso con triangolo bianco: pastiglia bianca, marchio rosso
    youtube: { icon: 'fa-brands fa-youtube', color: '#FFFFFF', fg: '#FF0000', urlBase: 'https://youtube.com/@' },
    // brand.twitch.com — Twitch Purple
    twitch: { icon: 'fa-brands fa-twitch', color: '#9146FF', fg: '#FFFFFF' },
    // developer.spotify.com/documentation/design — verde #1ED760, onde nere
    spotify: { icon: 'fa-brands fa-spotify', color: '#1ED760', fg: '#000000', mode: 'disc' },
    // deezer.com — viola dal 2023; icona ufficiale: marchio viola su nero
    deezer: { icon: 'fa-brands fa-deezer', color: '#000000', fg: '#A238FF' },
    // soundcloud.com/company/media-kit — logo primario nero su arancio
    soundcloud: { icon: 'fa-brands fa-soundcloud', color: '#FF5500', fg: '#121212' },
    // Apple Music (iTunes su Mac è stato dismesso): identity guidelines Apple
    applemusic: { icon: 'fa-brands fa-itunes-note', color: '#FA243C', fg: '#FFFFFF' },
    itunes: { icon: 'fa-brands fa-itunes-note', color: '#FA243C', fg: '#FFFFFF' },
    // vimeo.com/press/media-kit — palette 2023 (Black #141A20, Blue #17D5FF): V blu su nero, come l'icona del sito
    vimeo: { icon: 'fa-brands fa-vimeo-v', color: '#141A20', fg: '#17D5FF' },
    // nessuna pagina ufficiale raggiungibile: rosa storico della palla
    dribbble: { icon: 'fa-brands fa-dribbble', color: '#EA4C89', fg: '#FFFFFF' },
    // telegram.org/img/t_logo.svg — aereo sempre bianco su blu
    telegram: { icon: 'fa-brands fa-telegram', color: '#26A5E4', fg: '#FFFFFF', mode: 'disc' },
    // fr.tipeee.com (favicon ufficiale); Font Awesome non ha un'icona Tipeee
    tipeee: { icon: 'fa-solid fa-mug-hot', color: '#D84556', fg: '#FFFFFF' },
    // Meta brand resources — glifo bianco su verde, colori non modificabili
    whatsapp: { icon: 'fa-brands fa-whatsapp', color: '#25D366', fg: '#FFFFFF' },
    // legacy: Skype chiuso il 5 maggio 2025
    skype: { icon: 'fa-brands fa-skype', color: '#00AFF0', fg: '#FFFFFF', mode: 'disc' },
    // partnermarketinghub.withgoogle.com — solo la G a colori, su bianco
    google: { icon: 'fa-brands fa-google', color: '#FFFFFF', image: GOOGLE_G },
    // Google Cast (Chromecast dismesso nel 2024) — logo bianco su #4285F4
    chromecast: { icon: 'fa-brands fa-chromecast', color: '#4285F4', fg: '#FFFFFF' },
    // linee guida Chromebook: logo monocromatico bianco su fondo scuro
    chrome: { icon: 'fa-brands fa-chrome', color: '#202124', fg: '#FFFFFF' },
    // developer.android.com brand guidelines — mai il logo su fondo verde: robot verde su nero
    android: { icon: 'fa-brands fa-android', color: '#000000', fg: '#3DDC84' },
    // apple.com — nero e bianco
    apple: { icon: 'fa-brands fa-apple', color: '#000000', fg: '#FFFFFF' },
    // playstation.com — blu primario attuale (nessuna linea guida pubblica)
    playstation: { icon: 'fa-brands fa-playstation', color: '#0070CC', fg: '#FFFFFF' },
    // linee guida marchio Amazon — il sorriso non va sull'arancio pieno: marchio arancio su Squid Ink
    amazon: { icon: 'fa-brands fa-amazon', color: '#232F3E', fg: '#FF9900' },
    // airbnb.com — Rausch attuale #FF385C, marchio bianco
    airbnb: { icon: 'fa-brands fa-airbnb', color: '#FF385C', fg: '#FFFFFF' },
    // bitcoin.org logo — ₿ bianco su arancio (fa-btc: il simbolo senza cerchio proprio)
    btc: { icon: 'fa-brands fa-btc', color: '#F7931A', fg: '#FFFFFF' },
    // yahoo.com — viola del rinnovo 2026 #7D2EFF
    yahoo: { icon: 'fa-brands fa-yahoo', color: '#7D2EFF', fg: '#FFFFFF' },
    // audible.com — icona ufficiale: marchio arancio su ardesia scura
    audible: { icon: 'fa-brands fa-audible', color: '#212325', fg: '#F7991C' },
    // Meta: Threads solo nero e bianco
    threads: { icon: 'fa-brands fa-threads', color: '#000000', fg: '#FFFFFF', urlBase: 'https://threads.net/@' },
    // discord.com/branding — Blurple, Clyde bianco
    discord: { icon: 'fa-brands fa-discord', color: '#5865F2', fg: '#FFFFFF' },
    // redditinc.com/brand — Snoo bianco su OrangeRed
    reddit: { icon: 'fa-brands fa-reddit-alien', color: '#FF4500', fg: '#FFFFFF', urlBase: 'https://reddit.com/user/' },
    // brand.github.com — Invertocat: disco scuro col gatto ritagliato
    github: { icon: 'fa-brands fa-github', color: '#101411', fg: '#FFFFFF', mode: 'disc', urlBase: 'https://github.com/' },
    // joinmastodon.org/branding — versione bianca sul colore del brand
    mastodon: { icon: 'fa-brands fa-mastodon', color: '#6364FF', fg: '#FFFFFF' },
};
