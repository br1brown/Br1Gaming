import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset condiviso "Lanterna": sito fissato scuro, con un pannello chiaro in risalto — un bagliore
 *  isolato nel buio (pattern Radix `panelBackground` / Carbon "g100 panel in white page"). Stesso
 *  font di `ombra.design-system.ts` (mirror, vedi lì): `DejaVu` è largo e marcato apposta, per
 *  reggere il risalto del pannello invece di sparire dentro il contrasto. Self-hosted: stesso file
 *  per il sito E per l'immagine di anteprima social. Un font diverso sui titoli (es. `DejaVuSerif`,
 *  stessa famiglia type) non è un campo di questo preset: chi lo vuole lo registra in
 *  `addonFonts` e scrive la regola CSS su `h1`-`h6` di progetto. */
export const lanternaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    forceThemeTone: 'dark',
    panelSurface: 'light',
    defaultFont: SystemFont.DejaVu,
});
