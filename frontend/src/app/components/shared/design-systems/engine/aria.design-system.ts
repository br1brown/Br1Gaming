import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';

/** Preset pronto "Aria": nessun campo, solo i default dell'Engine — tono dall'OS, pannello chiaro,
 *  font di sistema (niente self-hosting). Equivale a non scegliere nessun design system; si estende
 *  con `extendDesignSystem` o si copia in un file di progetto. */
export const ariaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {});
