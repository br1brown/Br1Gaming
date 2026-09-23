import { emptyDesignSystem, extendDesignSystem, NAKED_CHROME, type DesignSystemFactory } from '../../../core/engine/design-system-presets';
import { SystemFont } from '../../../core/engine/font-system';

/**
 * Design system di Br1Gaming: `colori.superfici: 'distinte'` tiene il pannello spento ovunque
 * (era `shell.showPanel: false` globale) salvo il ruolo `storia` che lo riaccende.
 * `font.principale` sostituisce il vecchio `font-config.ts` (`webDefault: 'Georgia'`, stack di
 * sistema, mai garantito): `NotoSerif` è il serif self-hosted più vicino per carattere (caldo/da
 * lettura, non "da iscrizione" come `LiberationSerif`). `colori.palette.secondary` (giallo)
 * migrato da `global-settings.json`'s `site.*` (non più un campo valido lì, vedi
 * global-settings.schema.json).
 *
 * Ruoli:
 * - `home`: niente navbar (la home espone già tutto come sezioni).
 * - `storia`: unica pagina col pannello riacceso, smoke spento.
 * - `giochini`: `fitViewport` per i minigiochi a schermo pieno (duce-non-duce, burocrazia) e per
 *   il radar (stessa esigenza tecnica, nessun ruolo dedicato per un utility).
 * - `cantiere`: naked (niente nav/footer/pannello) + fitViewport — per Umarell, "il vecchio che
 *   guarda i cantieri".
 * - `NoFooter`: SOLO showFooter:false, niente fitViewport — navbar resta, pagina scorre normale
 *   (non full-bleed). Per ora solo Lombroso: fitViewport forzerebbe showFooter:false comunque
 *   (vedi RuoloPagina in siteBuilder.ts — "fitViewport del ruolo (niente footer) > resto del
 *   ruolo"), ma bloccherebbe anche l'altezza al viewport — sbagliato qui, dove il verdetto è
 *   testo combinatorio a lunghezza variabile: meglio una pagina che scorre da sé (vedi
 *   .lombroso-stage/.lombroso-result-fill nel componente) che uno scroll interno da gestire a mano.
 */
export const br1gamingDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    colori: {
        superfici: 'distinte',
        palette: {
            // Colore ufficiale (era in global-settings.json): #fff000, giallo puro. Cambiato qui
            // perché aveva 1.09-1.13:1 di contrasto contro gli sfondi chiari di 'distinte'
            // (colorBaseLt/colorSurfaceLt, quasi bianchi) — praticamente invisibile in tema
            // chiaro, molto sotto la soglia WCAG 1.4.11 (3:1). Scurito in OKLCH a hue/chroma
            // invariati (stesso giallo, non desaturato) fino a superare 3:1 con margine: il
            // cambiamento percettivo qui è più marcato che altrove (da giallo acceso a senape)
            // perché il punto di partenza era estremo.
            secondary: '#9c8b00',
        },
    },
    font: {
        principale: SystemFont.NotoSerif,
    },
    lightboxArrotondato: false,
    smoke: {
        enable: true,
        color: '#add8e6',
        opacity: 0.7,
        intensita: 'nebbia',
    },
    ruoloPagina: {
        home: { showNav: false },
        storia: { showPanel: true, showSmoke: false },
        giochini: { fitViewport: true },
        cantiere: { ...NAKED_CHROME, fitViewport: true },
        NoFooter: { showFooter: false },
    },
});
