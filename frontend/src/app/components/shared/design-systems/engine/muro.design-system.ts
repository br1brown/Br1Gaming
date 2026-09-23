import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset pronto "Muro": sito fissato scuro, il brand STESSO è lo sfondo (`superfici: 'fusione'`,
 *  quindi nessun pannello su nessuna pagina), navbar e footer sulla superficie della pagina. Font
 *  `LiberationSerif`, self-hosted, stesso file per sito e og:image: un muro è un unico materiale, un
 *  secondo font sui titoli ne spezzerebbe l'uniformità. */
export const muroDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    tono: { forza: 'dark' },
    navbar: { superficie: 'body' },
    colori: { superfici: 'fusione' },
    font: { principale: SystemFont.LiberationSerif },
});
