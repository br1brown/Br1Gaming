import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset condiviso "muro": il brand STESSO è lo sfondo, nessun pannello — `superfici: 'fusione'`
 *  spegne il pannello per costruzione, non un secondo campo da sincronizzare a mano. `LiberationSerif`
 *  (self-hosted, stesso file per sito e og:image): un muro è un unico materiale, un secondo font
 *  sui titoli spezzerebbe l'uniformità di `fusione`. */
export const muroDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    forceThemeTone: 'dark',
    navSurface: 'body',
    superfici: 'fusione',
    defaultFont: SystemFont.LiberationSerif,
});
