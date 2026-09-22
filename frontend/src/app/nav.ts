import type { ShellNavResolver } from './core/engine/shell-nav';
import { FooterField } from './core/engine/footer-content';
import { PageType } from './site';

// Navigazione di header/footer: dato, non struttura del sito (per questo vive qui e non in
// Provider di default, sincrono (nessuna API), con lo stesso builder addPage/addLink/addGroup che userebbe un resolver `async`:
// un menu dipendente da un'API la richiami con api = inject(ApiService);
export const navResolver: ShellNavResolver = {
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

    // Le pagine legali sono gestite automaticamente da `footer.component` in una fascia "small
    // prints" derivata da `legalPages` di site.ts. Ogni `addGroup` qui diventa una colonna (link,
    // campi identità con `addField`, testo con `addText`). Definirlo qui RIMPIAZZA per intero il
    // footer "di serie" (`defaultFooterResolver`): non convivono, o l'uno o l'altro.
    footer: (f, ctx) => {
        f.addGroup('footerProgettoAzienda', g => {
            g.addField(FooterField.RagioneSociale);
            g.addField(FooterField.PartitaIva);
            g.addLink('githubDesc', 'https://github.com/br1brown/Br1WebEngine');
        });

        f.addGroup('socialNav', g => {
            g.addField(FooterField.Email);
            // I social non sono un FooterField: sono una scelta del progetto, non un dato che
            // l'engine può "indovinare" di voler mostrare per intero — qui filtriamo ctx.identity
            // (già risolta dall'engine, nessun fetch in più) sul solo profilo LinkedIn.
            const linkedin = ctx.identity?.social?.find(s => s.url.includes('linkedin.com'));
            if (linkedin) g.addSocialLink(linkedin.url, linkedin.name);
        });
    },
};
