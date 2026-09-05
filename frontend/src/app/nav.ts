import type { ShellNavResolver } from './core/engine/shell-nav';
import { PageType } from './site';

// Navigazione di header/footer: dato, non struttura del sito (per questo vive qui e non in
// site.ts — vedi ShellNavResolver in core/engine/shell-nav.ts). Provider di default, sincrono
// (nessuna API), con lo stesso builder addPage/addLink/addGroup che userebbe un resolver `async`:
// un menu dipendente da un'API sostituisce questo resolver (provide: SHELL_NAV_RESOLVER in
// app.config.ts) con una callback che aspetta prima di popolarlo.
export const navResolver: ShellNavResolver = {
    // Limiti di profondità e resa per dispositivo: frontend/README.md §"Navigazione Multilivello".
    header: (h) => {
        h.addPage(PageType.CheFaccio);
        // authOnly: mostra il link solo a utenti loggati (la pagina è protetta da requiresAuth).
        h.addPage(PageType.Impostazioni, { authOnly: true });
        h.addGroup('menuPolicy', g => {
            g.addPage(PageType.PrivacyPolicy);
            g.addPage(PageType.CookiePolicy);
            g.addPage(PageType.AccessibilityStatement);
            g.addGroup('menuLegale', sg => {
                sg.addPage(PageType.TermsOfService);
                sg.addPage(PageType.LegalNotice);
            });
        });
        h.addPage(PageType.Social);
    },

    // Le pagine legali sono gestite automaticamente da `footer.component` in una fascia
    // dedicata ("small prints") derivata da `legalPages` di site.ts — vedi `FooterLinkRowComponent`.
    // Usa questa sezione per configurare i link della navigazione libera del progetto.
    footer: (f) => {
        f.addLink('githubDesc', 'https://github.com/br1brown/Br1WebEngine');
    },
};
