import { emptyDesignSystem, extendDesignSystem, NAKED_CHROME, type DesignSystemFactory } from '../../../core/engine/design-system-presets';
import { SystemFont } from '../../../core/engine/font-system';

/** Design system di Br1Gaming: superfici `distinte`, quindi niente pannello salvo il ruolo `storia`;
 *  NotoSerif self-hosted come serif da lettura; secondario giallo. */
export const br1gamingDesignSystem: DesignSystemFactory = extendDesignSystem(emptyDesignSystem, {
    colori: {
        superfici: 'distinte',
        palette: {
            secondary: '#9c8b00',
        },
    },
    font: {
        principale: SystemFont.Noto,
    },
    lightboxArrotondato: false,
    smoke: {
        enable: true,
        color: '#add8e6',
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
