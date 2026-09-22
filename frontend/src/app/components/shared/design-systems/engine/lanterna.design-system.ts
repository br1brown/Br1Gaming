import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset condiviso "Lanterna": sito fissato scuro, con un pannello chiaro in risalto — un bagliore
 *  isolato nel buio. `DejaVu` largo e marcato apposta, per reggere il risalto del pannello invece
 *  di sparire nel contrasto — self-hosted, stesso file per sito e og:image. Un font diverso sui
 *  titoli non è un campo di questo preset: chi lo vuole lo registra in `addonFonts`. */
export const lanternaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    forceThemeTone: 'dark',
    panelSurface: 'light',
    defaultFont: SystemFont.DejaVu,
});
