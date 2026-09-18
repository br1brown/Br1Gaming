import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';

/** Preset condiviso "Notte": sito fissato scuro, pannello intonato — palette a contrasto fisso,
 *  indipendente da `prefers-color-scheme`. */
export const notteDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    forceThemeTone: 'dark',
});
