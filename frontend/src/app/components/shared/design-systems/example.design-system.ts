import { extendDesignSystem, type DesignSystemFactory } from '../../../core/engine/design-system-presets';
import { muroDesignSystem } from './engine/muro.design-system';

/**
 * Demo: un design system di dominio, per ESTENSIONE di un preset pronto (`muro`) con
 * `extendDesignSystem` — stessa grammatica con cui `muroDesignSystem` stesso è scritto, nessun
 * livello privilegiato. Un figlio parte da qui, importa `exampleDesignSystem` come riferimento e
 * lo passa DIRETTAMENTE a `shell.designSystem` in site.ts (nessun design system ha un nome di
 * registro):
 * ```typescript
 * import { exampleDesignSystem } from './components/shared/design-systems/example.design-system';
 * buildSite({ shell: { designSystem: exampleDesignSystem } });
 * ```
 * Colori sotto = segnaposto. Ogni nome di `colori.palette` (camelCase ASCII) aggiunge `--color<Nome>`/`--color<Nome>Text`
 * e le classi Bootstrap del colore (`.btn-bordeaux`, `.alert-oro`...); `secondary`/`info` rimpiazzerebbero quelli di serie.
 */
export const exampleDesignSystem: DesignSystemFactory = extendDesignSystem(muroDesignSystem, {
    colori: {
        palette: {
            // Con `muro` (superfici 'fusione') il brand è lo sfondo: un accento deve restare chiaro abbastanza da staccarsene.
            bordeaux: '#d17a94',
            oro: '#d4af37',
        },
    },
});
