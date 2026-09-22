import { extendDesignSystem, type DesignSystemFactory } from '../../../core/engine/design-system-presets';
import { muroDesignSystem } from './engine/muro.design-system';

/**
 * Demo: un design system di dominio, per ESTENSIONE di un preset condiviso (`muro`) con
 * `extendDesignSystem` — stessa grammatica con cui `muroDesignSystem` stesso è scritto, nessun
 * livello privilegiato. Un figlio parte da qui, importa `exampleDesignSystem` come riferimento e
 * lo passa DIRETTAMENTE a `shell.designSystem` in site.ts (nessun design system ha un nome di
 * registro):
 * ```typescript
 * import { exampleDesignSystem } from './components/shared/design-systems/example.design-system';
 * buildSite({ shell: { designSystem: exampleDesignSystem } });
 * ```
 * Colori sotto = segnaposto. `customPalette` aggiunge coppie `--color<Label>`/`--color<Label>Text`
 * (fill = hex esatto, testo calcolato per restare leggibile) senza sostituire `colorSecondary`/
 * `colorInfo` — fuso col genitore automaticamente.
 */
export const exampleDesignSystem: DesignSystemFactory = extendDesignSystem(muroDesignSystem, {
    customPalette: {
        // `muro` ha `superfici: 'fusione'`: il brand stesso (#5c1a2b) è lo sfondo di pagina, quindi
        // un accento serve chiaro/desaturato abbastanza da restare visibile sopra — un bordeaux più
        // scuro/saturo (es. #b03a5e) ci scomparirebbe (contrasto <3:1, sotto WCAG 1.4.11 per UI).
        bordeaux: '#d17a94',
        oro: '#d4af37',
    },
});
