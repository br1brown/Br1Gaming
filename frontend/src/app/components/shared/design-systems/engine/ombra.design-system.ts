import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';

/** Preset condiviso "Ombra": sito fissato chiaro, con un pannello scuro in risalto — una macchia
 *  scura su una parete chiara, mirror di `lanterna.design-system.ts`. */
export const ombraDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    forceThemeTone: 'light',
    panelSurface: 'dark',
});
