import { campionario, extendDesignSystem, NAKED_CHROME, type DesignSystemFactory } from '../../../core/engine/design-system-presets';
import { SystemFont } from '../../../core/engine/font-system';
import { notteDesignSystem } from './engine/notte.design-system';

/** I colori di Br1Gaming, dichiarati una volta e usati per riferimento. `ghiaccio` è il brand e
 *  coincide con `site.colorTema` in global-settings.json (se cambia uno, cambia anche l'altro). */
const c = campionario({
    ghiaccio:   '#38bdf8',   // il brand: accento (link, pulsanti, smoke), non sfondo
    inchiostro: '#0b1320',   // blu notte: da qui nasce la famiglia di superfici
    ocra:       '#e3b505',   // il giallo del logo, schiarito per reggere sul buio
    fosforo:    '#39ff14',   // il verde di radar e lombroso
});

/** Design system di Br1Gaming — «arcade notturno»: parte da `notte` (sito fissato scuro) con sfondo
 *  blu inchiostro e superfici `distinte` (niente pannello salvo il ruolo `storia`), così il brand
 *  azzurro colora gli accenti senza invadere lo sfondo. Noto per leggere, Liberation Mono a
 *  disposizione dello SCSS (`--fontFamily-LiberationMono`) per i tocchi da terminale. */
export const br1gamingDesignSystem: DesignSystemFactory = extendDesignSystem(notteDesignSystem, {
    colori: {
        campioni: c,
        superfici: 'distinte',
        sfondo: c.inchiostro,
        palette: {
            secondary: c.ocra,
            fosforo: c.fosforo,   // → .btn-fosforo, .text-fosforo…
        },
    },
    font: {
        principale: SystemFont.Noto,
        aggiuntivi: [SystemFont.LiberationMono],
    },
    elevazione: { angoli: 'tondi', ombra: 'sospesa' },
    movimento: 'morbido',
    densita: 'ariosa',
    navbar: { superficie: 'body', fissa: true },
    fab: { tornaSuSoglia: 'pronta' },
    lightboxArrotondato: false,
    smoke: {
        enable: true,
        color: c.ghiaccio,
        opacity: 0.7,
        intensita: 'nebbia',
    },
    ruoloPagina: {
        // La home espone già tutto come sezioni.
        home: { showNav: false },
        storia: { showPanel: true, showSmoke: false },
        // Minigiochi a schermo pieno (duce-non-duce, burocrazia) e radar.
        giochini: { fitViewport: true },
        // Umarell.
        cantiere: { ...NAKED_CHROME, fitViewport: true },
        // Lombroso: senza footer ma senza fitViewport, perché il verdetto ha lunghezza variabile e la pagina
        // deve scorrere da sé invece di bloccarsi all'altezza del viewport.
        NoFooter: { showFooter: false },
    },
});
