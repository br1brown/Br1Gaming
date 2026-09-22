import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset condiviso "Lavagna": segue l'OS, pannello contenuti sempre scuro — mirror di `carta`.
 *  `LiberationMono`: l'unico monospace del catalogo — scrittura tecnica/formule, non prosa da libro
 *  (quella è `carta`). Self-hosted, stesso file per sito e og:image. Un secondo font sui titoli
 *  romperebbe l'allineamento a griglia che è il punto del monospace. */
export const lavagnaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    panelSurface: 'dark',
    defaultFont: SystemFont.LiberationMono,
});
