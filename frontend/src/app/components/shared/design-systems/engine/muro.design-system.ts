import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';

/**
 * Preset condiviso "muro" (Agnese Subacchi): il brand STESSO è lo sfondo, nessun pannello su
 * nessuna pagina — `superfici: 'fusione'` implica da sé `showPanel: false` (vedi `DesignSystemPreset`
 * in `design-system-presets.ts`), non serve dichiararlo separatamente. Dettaglio: frontend/README.md
 * §"Sfondo a tinta piena". `example.design-system.ts` estende questo con una palette reale.
 */
export const muroDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    forceThemeTone: 'dark',
    navSurface: 'body',
    superfici: 'fusione',
});
