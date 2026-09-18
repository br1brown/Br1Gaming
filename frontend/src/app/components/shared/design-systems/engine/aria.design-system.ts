import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';

/** Preset condiviso "Aria": tutto segue l'OS, nessun campo forzato — il caso più permissivo
 *  della griglia {forceThemeTone × panelSurface}, equivale a non scegliere nessun design system. */
export const ariaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {});
