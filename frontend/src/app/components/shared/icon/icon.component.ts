import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';

/**
 * Icona "badge" (glifo dentro una pastiglia): forma (tonda/quadrata) ed effetto hover in un unico
 * posto riusabile. Gli input `shape` e `animation` sono validati contro un set chiuso — valore fuori
 * lista → default, così il componente non si rompe mai.
 */

export const ICON_SHAPES = ['circle', 'rounded', 'square'] as const;
export type IconShape = (typeof ICON_SHAPES)[number];
const DEFAULT_SHAPE: IconShape = 'circle';

export const ICON_ANIMATIONS = ['lift', 'shake', 'none'] as const;
export type IconAnimation = (typeof ICON_ANIMATIONS)[number];
const DEFAULT_ANIMATION: IconAnimation = 'none';

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
    host: { class: 'd-inline-block' }
})
export class IconComponent {
    /** Classi FontAwesome del glifo, es. "fa-brands fa-facebook" o "fa-solid fa-bell". */
    readonly glyph = input.required<string>();

    /** Colore di sfondo della pastiglia; null => usa il default del tema. */
    readonly color = input<string | null>(null);

    /** Forma/disposizione. Stringa validata contro IconShape (default: circle). */
    readonly shape = input<IconShape, string>(DEFAULT_SHAPE, {
        transform: (v) => coerce(ICON_SHAPES, DEFAULT_SHAPE, v)
    });

    /** Effetto hover. Stringa validata contro IconAnimation (default: lift). */
    readonly animation = input<IconAnimation, string>(DEFAULT_ANIMATION, {
        transform: (v) => coerce(ICON_ANIMATIONS, DEFAULT_ANIMATION, v)
    });

    /** Classi calcolate: base + modificatori forma/animazione + glifo. */
    protected readonly classes = computed(() =>
        `icon icon--${this.shape()} icon--anim-${this.animation()} ${this.glyph()}`
    );
}
