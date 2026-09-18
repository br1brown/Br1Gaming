import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';

/** Preset condiviso "Giorno": sito fissato chiaro, pannello intonato — mirror di
 *  `notte.design-system.ts`. */
export const giornoDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    forceThemeTone: 'light',
});
