import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset pronto "Lavagna": tono dall'OS, pannello sempre scuro — mirror di `carta`. Font
 *  `LiberationMono`, l'unico monospace del catalogo: scrittura tecnica, non prosa da libro.
 *  Self-hosted, stesso file per sito e og:image. Un secondo font sui titoli romperebbe
 *  l'allineamento a griglia che è il punto del monospace. */
export const lavagnaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    tono: { pannello: 'dark' },
    font: { principale: SystemFont.LiberationMono },
});
