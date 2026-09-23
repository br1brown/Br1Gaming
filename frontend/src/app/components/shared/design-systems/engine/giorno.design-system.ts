import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset pronto "Giorno": sito fissato chiaro, pannello dello stesso tono, font `Roboto` — mirror
 *  di `notte`, stessa lingua visiva in un'altra luce. `Roboto` è neutro e feriale apposta, senza il
 *  risalto di un pannello di tono opposto (quello è `ombra`/`lanterna`). Self-hosted: stesso file per
 *  il sito e per l'immagine di anteprima social. */
export const giornoDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    tono: { forza: 'light' },
    font: { principale: SystemFont.Roboto },
});
