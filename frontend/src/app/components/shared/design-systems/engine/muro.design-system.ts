import { emptyDesignSystem, extendDesignSystem, type DesignSystemFactory } from '../../../../core/engine/design-system-presets';
import { SystemFont } from '../../../../core/engine/font-system';

/**
 * Preset condiviso "muro" (Agnese Subacchi): il brand STESSO è lo sfondo, nessun pannello su
 * nessuna pagina — `superfici: 'fusione'` non ha varianti "flotting" (vedi `DesignSystemPreset`
 * in `design-system-presets.ts`): tinta piena e pannello spento sono la STESSA scelta, non due
 * campi da tenere sincronizzati a mano. Dettaglio: frontend/README.md §"Sfondo a tinta piena".
 * `example.design-system.ts` estende questo con una palette reale.
 *
 * `LiberationSerif`: un muro è monolitico, imposto — la stessa autorità di un'iscrizione incisa
 * nella pietra, non un testo qualunque in un serif qualunque. È il vero sostituto open di Times
 * New Roman (stessa famiglia "Liberation" nata come metrico-compatibile dei font Microsoft core —
 * la stessa ragione per cui la ritrovi anche su `lavagna.design-system.ts`, sulla sua metà Mono),
 * self-hosted: STESSO file per il sito E per l'immagine di anteprima social, mai due font diversi
 * che "capita" siano entrambi presi da famiglie vagamente simili.
 *
 * Un muro è un unico materiale, non due: un secondo font sui titoli spezzerebbe la stessa
 * uniformità che `superfici: 'fusione'` impone al resto della pagina.
 */
export const muroDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    forceThemeTone: 'dark',
    navSurface: 'body',
    superfici: 'fusione',
    defaultFont: SystemFont.LiberationSerif,
});
