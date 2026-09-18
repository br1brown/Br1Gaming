import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';

/** Preset condiviso "Lavagna": segue l'OS, ma il pannello contenuti resta sempre scuro — mirror
 *  di `carta.design-system.ts`. */
export const lavagnaDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    panelSurface: 'dark',
});
