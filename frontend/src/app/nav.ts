import type { ShellNavResolver } from './core/engine/shell-nav';
import { PageType } from './site';
import { GENERATOR_SLUGS, STORY_SLUGS } from './pages/app.pages';

// Navigazione di header/footer: dato, non struttura del sito (per questo vive qui e non in
// site.ts — vedi ShellNavResolver in core/engine/shell-nav.ts).
export const navResolver: ShellNavResolver = {
    header: (nav) => {
        nav.addGroup('generatori', (g) => {
            // I generatori veri e propri stanno in un sottogruppo annidato, così i Piaciuti
            // (che raccolgono i loro output) vivono accanto a loro senza sembrare un generatore.
            // Un solo PageType per tutti (playground /generatori/:slug): il :slug e l'etichetta
            // (stessa chiave i18n di prima, "generatore-<slug>") li fornisce qui la voce di nav.
            g.addGroup('tuttiIGeneratori', (gg) => {
                GENERATOR_SLUGS.forEach(slug =>
                    gg.addPage(PageType.Generatore, { params: { slug }, label: `generatore-${slug}` }));
            });
            g.addPage(PageType.Piaciuti);
        });
        nav.addGroup('giochi', (g) => {
            // Le storie (avventure a bivi) in un sottogruppo annidato; gli altri giochi restano fuori.
            g.addGroup('storie', (gg) => {
                STORY_SLUGS.forEach(slug =>
                    gg.addPage(PageType.Storia, { params: { slug }, label: `avventura-${slug}` }));
            });
            g.addPage(PageType.GameDuceNonDuce);
            g.addPage(PageType.GameBurocrazia);
            g.addPage(PageType.GameUmarell);
        });
        // Utility: strumenti che non sono giochi (radar chiese + traduttore ITA→ESP).
        nav.addGroup('utility', (g) => {
            g.addPage(PageType.UtilityRadar);
            g.addPage(PageType.UtilityTranslator);
        });
    },

    // Le pagine legali NON si dichiarano qui: `footer.component` le rende da sole, in una fascia
    // dedicata ("small prints") derivata da `legalPages` di site.ts — vedi `FooterLinkRowComponent`.
    // Questo resta per la navigazione libera del progetto.
    footer: (f) => {
        f.addLink('githubDesc', 'https://github.com/br1brown/Br1Gaming');
    },
};
