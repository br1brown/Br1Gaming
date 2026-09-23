import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset pronto "Notte": sito fissato scuro, pannello dello stesso tono, font `Roboto` — mirror di
 *  `giorno`, indipendente da `prefers-color-scheme`. Self-hosted, stesso file per sito e og:image. */
export const notteDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    tono: { forza: 'dark' },
    font: { principale: SystemFont.Roboto },
});
