import { inject } from '@angular/core';
import type { ShellNavResolver } from './core/engine/shell-nav';
import { PageType } from './site';
import { ApiService } from './core/services/api.service';
import type { GeneratorInfo } from './core/dto/generator.dto';
import type { StorySummary } from './core/dto/story.dto';

// Navigazione di header/footer: dato, non struttura del sito (per questo vive qui e non in
// site.ts — vedi ShellNavResolver in core/engine/shell-nav.ts).
export const navResolver: ShellNavResolver = {
    // Asincrono: generatori e storie arrivano dal catalogo backend (già ordinato per Info.Order/
    // Order), non da una lista di slug scritta a mano qui — aggiungere un generatore/una storia in
    // backend basta a farlo comparire in nav, senza toccare il frontend. `gen.name`/`story.title`
    // sono già in italiano (prodotto monolingua): passati come label letterale a `addPage`, non
    // come chiave i18n — `TranslateService.translate` ricade sulla chiave stessa se non la trova
    // in addon.it.json, quindi il nome del backend esce identico, senza warning (un solo lang).
    header: async (nav) => {
        const api = inject(ApiService);
        const [generators, stories] = await Promise.all([
            api.getGenerators().catch((): GeneratorInfo[] => []),
            api.getStories().catch((): StorySummary[] => []),
        ]);

        nav.addGroup('generatori', (g) => {
            // I generatori veri e propri stanno in un sottogruppo annidato, così i Piaciuti
            // (che raccolgono i loro output) vivono accanto a loro senza sembrare un generatore.
            // Un solo PageType per tutti (playground /generatori/:slug).
            g.addGroup('tuttiIGeneratori', (gg) => {
                generators.forEach(gen =>
                    gg.addPage(PageType.Generatore, { params: { slug: gen.slug }, label: gen.name }));
            });
            g.addPage(PageType.Piaciuti);
        });
        nav.addGroup('giochi', (g) => {
            // Le storie (avventure a bivi) in un sottogruppo annidato; gli altri giochi restano fuori.
            g.addGroup('storie', (gg) => {
                stories.forEach(story =>
                    gg.addPage(PageType.Storia, { params: { slug: story.slug }, label: story.title }));
            });
            g.addPage(PageType.GameDuceNonDuce);
            g.addPage(PageType.GameBurocrazia);
            g.addPage(PageType.GameUmarell);
            g.addPage(PageType.GameLombroso);
        });
        // Utility: strumenti che non sono giochi (radar chiese + traduttore ITA→ESP).
        nav.addGroup('utility', (g) => {
            g.addPage(PageType.UtilityRadar);
            g.addPage(PageType.UtilityTranslator);
        });
    },

    // Le pagine legali sono gestite automaticamente da `footer.component` in una fascia
    // dedicata ("small prints") derivata da `legal` di site.ts — vedi `FooterLinkRowComponent`.
    // Definire questa proprietà RIMPIAZZA per intero il footer di default dell'Engine
    // (`defaultFooterResolver`, societari/legali/contatti/orari/social): scelta deliberata di
    // tenerlo minimale (solo link GitHub), anche ora che `data/identity.json` esiste.
    footer: (f) => {
        f.addLink('githubDesc', 'https://github.com/br1brown/Br1Gaming');
    },
};
