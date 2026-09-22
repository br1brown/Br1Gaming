import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';

/** Preset condiviso "Aria": tutto segue l'OS, nessun campo forzato — il caso più permissivo,
 *  equivale a non scegliere nessun design system. Nessun `defaultFont` di proposito: niente
 *  self-hosting, il sito resta sui font dell'OS, coerente con "nessuna scelta imposta" fino in
 *  fondo. */
export const ariaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {});
