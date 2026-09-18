import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset condiviso "Giorno": sito fissato chiaro, pannello intonato — mirror di
 *  `notte.design-system.ts`, stesso font: sono la stessa lingua visiva in due luci diverse, non
 *  due caratteri diversi. `Roboto`: neutro e feriale apposta — il paio "giorno per giorno", senza
 *  il risalto di un pannello (quello è `ombra`/`lanterna`). Self-hosted: stesso file per il sito E
 *  per l'immagine di anteprima social. */
export const giornoDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    forceThemeTone: 'light',
    defaultFont: SystemFont.Roboto,
});
