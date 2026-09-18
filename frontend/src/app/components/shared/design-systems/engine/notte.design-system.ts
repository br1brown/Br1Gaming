import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/** Preset condiviso "Notte": sito fissato scuro, pannello intonato — palette a contrasto fisso,
 *  indipendente da `prefers-color-scheme`. Stesso font di `giorno.design-system.ts` (mirror,
 *  vedi lì): `Roboto` resta neutro e feriale a prescindere dal tono. */
export const notteDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    forceThemeTone: 'dark',
    defaultFont: SystemFont.Roboto,
});
