import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { AppearanceService } from '../../services/appearance.service';

/** Icona "badge" (glifo dentro una pastiglia): forma ed effetto hover in un unico posto riusabile.
 *  `shape`/`animation` validati contro un set chiuso — valore fuori lista ricade sul default. */

export const ICON_SHAPES = ['circle', 'rounded', 'square'] as const;
export type IconShape = (typeof ICON_SHAPES)[number];
const DEFAULT_SHAPE: IconShape = 'circle';

/** Composizione glifo/pastiglia. `glyph` (default): pastiglia piena, glifo sopra nel colore del
 *  marchio. `disc`: il glifo è già un disco col marchio ritagliato (Telegram, Spotify, GitHub…) —
 *  in `glyph` risulterebbe in negativo (disco bianco, aereo blu). */
export const ICON_MODES = ['glyph', 'disc'] as const;
export type IconMode = (typeof ICON_MODES)[number];

export const ICON_ANIMATIONS = ['lift', 'shake', 'none'] as const;
export type IconAnimation = (typeof ICON_ANIMATIONS)[number];
const DEFAULT_ANIMATION: IconAnimation = 'none';

/** Colore esadecimale (#rgb o #rrggbb): l'unico formato su cui il contrasto si può calcolare. */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Testo leggibile su uno sfondo: il colore di brand se dichiarato, altrimenti nero o bianco (il più
 *  contrastato); `null` senza un hex valido, per lasciare decidere al CSS del tema. Condivisa con
 *  `LinkBadgeComponent` (variante 'button'): stesso calcolo, stessa sorgente. */
export function readableForegroundColor(bg: string | null, fg: string | null): string | null {
    if (fg) return fg;
    return bg && HEX_COLOR.test(bg) ? AppearanceService.getFillTextColor(expandHex(bg)) : null;
}

/** Coerce di una stringa libera verso un valore ammesso, con fallback. */
function coerce<T extends string>(allowed: readonly T[], fallback: T, value: string | null | undefined): T {
    const v = (value ?? '').trim().toLowerCase();
    return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

@Component({
    selector: 'app-icon',
    standalone: true,
    imports: [],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './icon.component.html',
    styleUrl: './icon.component.scss',
    // inline-flex: la pastiglia è un elemento flessibile, non una riga di testo — nessuna linea di
    // base che sposti in basso i glifi più grandi (disco) o le immagini (Google).
    host: { class: 'd-inline-flex' }
})
export class IconComponent {
    /** Classi FontAwesome del glifo, es. "fa-brands fa-facebook" o "fa-solid fa-bell". */
    readonly glyph = input.required<string>();

    /** Colore di sfondo della pastiglia; null => usa il default del tema. */
    readonly color = input<string | null>(null);

    /** Colore del glifo prescritto dal brand (es. bianco per l'aereo di Telegram). Vince sempre:
     *  l'identità di un marchio non si ricalcola. In modalità `disc` è il colore del ritaglio. */
    readonly glyphColor = input<string | null>(null);

    /** Composizione glifo/pastiglia, vedi `IconMode`. */
    readonly mode = input<IconMode, string>('glyph', {
        transform: (v) => coerce(ICON_MODES, 'glyph', v)
    });

    /** Logo ufficiale come immagine (URL o data URI) al posto del glifo: per i marchi che vietano la
     *  versione monocromatica (la "G" di Google è solo a colori). La pastiglia prende `color`. */
    readonly image = input<string | null>(null);

    protected readonly isDisc = computed(() => this.mode() === 'disc');
    protected readonly imageUrl = computed(() => {
        const src = this.image();
        return src ? `url("${src}")` : null;
    });

    /** Glifo effettivo: quello del brand se dichiarato; altrimenti nero o bianco, il più contrastato
     *  sulla pastiglia (ripiego per un colore non censito — un giallo non resta con un glifo bianco
     *  illeggibile). Senza colore esadecimale decide il CSS del tema. */
    protected readonly effectiveGlyphColor = computed(() => readableForegroundColor(this.color(), this.glyphColor()));

    /** Forma/disposizione. Stringa validata contro IconShape (default: circle). */
    readonly shape = input<IconShape, string>(DEFAULT_SHAPE, {
        transform: (v) => coerce(ICON_SHAPES, DEFAULT_SHAPE, v)
    });

    /** Effetto hover. Stringa validata contro IconAnimation (default: none). */
    readonly animation = input<IconAnimation, string>(DEFAULT_ANIMATION, {
        transform: (v) => coerce(ICON_ANIMATIONS, DEFAULT_ANIMATION, v)
    });

    /** Classi calcolate: base + modificatori forma/animazione + glifo. */
    protected readonly classes = computed(() =>
        `icon icon--${this.shape()} icon--anim-${this.animation()} icon--mode-${this.mode()} ${this.glyph()}`
    );
}

/** `#abc` → `#aabbcc`: i calcoli di contrasto lavorano sulla forma lunga. */
function expandHex(hex: string): string {
    return hex.length === 4 ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex;
}
