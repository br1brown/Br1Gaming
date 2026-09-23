import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset pronto "Lanterna": sito fissato scuro, pannello chiaro in risalto — un bagliore isolato nel
 *  buio. Font `DejaVu`, largo e marcato per reggere il contrasto del pannello, self-hosted, stesso file
 *  per sito e og:image. Un font diverso sui titoli non è un campo di questo preset: chi lo vuole lo
 *  registra in `font.aggiuntivi`. */
export const lanternaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    tono: { forza: 'dark', pannello: 'light' },
    font: { principale: SystemFont.DejaVu },
});
