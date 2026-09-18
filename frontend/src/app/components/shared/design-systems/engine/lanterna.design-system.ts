import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';

/** Preset condiviso "Lanterna": sito fissato scuro, con un pannello chiaro in risalto — un bagliore
 *  isolato nel buio (pattern Radix `panelBackground` / Carbon "g100 panel in white page"). */
export const lanternaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    forceThemeTone: 'dark',
    panelSurface: 'light',
});
