import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset pronto "Ombra": sito fissato chiaro, pannello scuro in risalto — una macchia scura su una
 *  parete chiara, mirror di `lanterna` con lo stesso font `DejaVu`. */
export const ombraDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    tono: { forza: 'light', pannello: 'dark' },
    font: { principale: SystemFont.DejaVu },
});
