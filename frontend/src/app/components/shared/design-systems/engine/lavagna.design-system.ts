import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset condiviso "Lavagna": segue l'OS, ma il pannello contenuti resta sempre scuro — mirror
 *  di `carta.design-system.ts`.
 *
 *  `LiberationMono`: l'unico monospace del catalogo — il gesso su una lavagna è scrittura tecnica,
 *  formule, non prosa da libro (quella è `carta`, in NotoSerif). Stessa famiglia open-source usata
 *  da `muro` per il serif, qui per la sua metà "Mono" — il vero sostituto open di Courier New,
 *  self-hosted: stesso file per il sito E per l'immagine di anteprima social. Un secondo font sui
 *  titoli romperebbe l'allineamento a griglia che è il punto del monospace — anche volendolo, qui
 *  non avrebbe senso. */
export const lavagnaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    panelSurface: 'dark',
    defaultFont: SystemFont.LiberationMono,
});
