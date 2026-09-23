import { extendDesignSystem, type DesignSystemFactory } from '../../../core/engine/design-system-presets';
import { cartaDesignSystem } from './engine/carta.design-system';

/** Il design system di QUESTA demo: estende `cartaDesignSystem` con le scelte che la
 *  distinguono — navbar fissa, breadcrumb sempre visibile, smoke decorativo. */
export const demoDesignSystem: DesignSystemFactory = extendDesignSystem(cartaDesignSystem, {
    navbar: { fissa: true },
    breadcrumb: { show: true },
    smoke: {
        enable: true,
        color: '#b5d9ff',
        opacity: 0.7,
        intensita: 'nebbia',
    },
    // Ruolo CUSTOM 'vetrina' (usato da che-faccio.pages.ts): niente breadcrumb solo lì. Rinominarlo
    // qui senza aggiornare la pagina fa fallire buildSite() al boot con un errore leggibile.
    ruoloPagina: {
        vetrina: { showBreadcrumb: false },
    },
});
