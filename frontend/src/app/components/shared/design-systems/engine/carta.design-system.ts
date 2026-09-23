import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset pronto "Carta": tono dall'OS, pannello chiaro, font `NotoSerif` — serif caldo da lettura,
 *  per la carta stampata più che per l'autorità di un'iscrizione (quello è `LiberationSerif`, `muro`),
 *  self-hosted, stesso file per sito e og:image. Un font diverso sui titoli non è un campo di questo
 *  preset: chi lo vuole lo registra in `font.aggiuntivi` e scrive la regola CSS su `h1`-`h6` di progetto. */
export const cartaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    tono: { pannello: 'light' },
    font: { principale: SystemFont.NotoSerif },
});
