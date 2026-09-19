import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset condiviso "Carta": segue l'OS, pannello sempre quasi-bianco — il default storico del
 *  template. `demo.design-system.ts` estende questo.
 *
 *  `NotoSerif`: un serif caldo/da lettura, pensato per la carta stampata più che per l'autorità di
 *  un'iscrizione (quello è `LiberationSerif`, su `muro.design-system.ts`) — la differenza fra le
 *  due scelte è la stessa fra un libro e un monumento. Self-hosted: stesso file per il sito E per
 *  l'immagine di anteprima social. Un font diverso sui titoli (es. `Noto` Sans, stessa famiglia
 *  type di `NotoSerif`, disegnata apposta da Google per stare bene insieme) non è un campo di
 *  questo preset: chi lo vuole lo registra in `addonFonts` e scrive la regola CSS su `h1`-`h6`
 *  di progetto (`frontend/README.md` §"Font: `SystemFont` + `addonFonts`"). */
export const cartaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    panelSurface: 'light',
    defaultFont: SystemFont.NotoSerif,
});
