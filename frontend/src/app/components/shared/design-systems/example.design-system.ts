import { extendDesignSystem, type DesignSystemFactory } from '../../../core/engine/design-system-presets';
import { muroDesignSystem } from './engine/muro.design-system';

/**
 * Demo: un design system di dominio, costruito per ESTENSIONE di un preset condiviso (`muro`,
 * `muro.design-system.ts` in questa stessa cartella) con `extendDesignSystem` — un oggetto piatto
 * (patch), non una classe/`override get`, la STESSA grammatica con cui `muroDesignSystem` stesso è
 * scritto: un preset condiviso non è un livello privilegiato, è solo un altro file qui dentro. Un
 * figlio che vuole la propria palette (es. i colori di un cliente specifico) parte da qui, importa
 * `exampleDesignSystem` come riferimento, non lo riscrive, e lo usa in `site.ts` passandolo
 * DIRETTAMENTE a `shell.designSystem` — nessun design system ha un nome di registro, è sempre solo
 * una funzione che il sito importa:
 * ```typescript
 * // site.ts
 * import { exampleDesignSystem } from './components/shared/design-systems/example.design-system';
 * buildSite({ shell: { designSystem: exampleDesignSystem } });
 * ```
 * I colori qui sotto sono segnaposto — sostituiscili con la palette reale del progetto.
 * `customPalette` aggiunge colori con nome proprio (non sostituisce `colorSecondary`/`colorInfo`
 * ecc.: quelli restano i default calcolati dal brand, a meno di scostarli esplicitamente anche
 * loro) — ogni voce diventa una coppia `--color<Label>`/`--color<Label>Text` disponibile in ogni
 * CSS/SCSS del progetto. Il fill (`--color<Label>`) è esattamente l'hex scritto qui sotto, in
 * light e in dark: `customPalette` è un override "duro", come `colorSecondary`/`colorInfo` (vedi
 * README §"Override opzionali") — solo il testo sopra (`--color<Label>Text`) resta calcolato
 * automaticamente per restare leggibile.
 *
 * `extendDesignSystem` fonde `customPalette` col genitore (qui `muro`, che non ne aggiunge
 * nessuno, ma potrebbe) da solo — non serve leggere/fondere quello del genitore a mano, stesso
 * principio di `ruoloPagina`/`smoke` (vedi `mergeDesignSystemPreset`, `design-system-presets.ts`).
 */
export const exampleDesignSystem: DesignSystemFactory = extendDesignSystem(muroDesignSystem, {
    customPalette: {
        // `muro` ha `superfici: 'fusione'` — il brand STESSO (qui #5c1a2b, un
        // bordeaux scuro) diventa lo sfondo di pagina. Un accento troppo simile al brand ci
        // scompare sopra: un bordeaux "da manifesto" più scuro/saturo (es. #b03a5e, il primo
        // tentativo) aveva contrasto ~1.4:1 contro quello sfondo — ben sotto la soglia WCAG
        // 1.4.11 (3:1) per elementi UI. Questi due restano riconoscibili come "bordeaux"/"oro"
        // ma sufficientemente chiari da restare visibili sul fondo.
        bordeaux: '#d17a94',
        oro: '#d4af37',
    },
});
