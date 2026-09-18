import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';

/** Preset condiviso "Aria": tutto segue l'OS, nessun campo forzato — il caso più permissivo
 *  della griglia {forceThemeTone × panelSurface}, equivale a non scegliere nessun design system.
 *  Stessa logica per il font: nessun `defaultFont` qui, di proposito — nessun self-hosting, il sito
 *  resta sui font dell'OS (`systemUiFonts()`, `font-system.ts`), coerente con "nessuna scelta
 *  imposta" fino in fondo, non solo su tono/pannello. Ogni altro preset condiviso ne sceglie uno
 *  di `SystemFont` per carattere. */
export const ariaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {});
