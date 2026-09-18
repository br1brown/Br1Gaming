import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';

/** Preset condiviso "Carta": segue l'OS, pannello sempre quasi-bianco — il default storico del
 *  template. `demo.design-system.ts` estende questo. */
export const cartaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    panelSurface: 'light',
});
