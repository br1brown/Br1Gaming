import { describe, it, expect } from 'vitest';
import { buildSite, type SiteDefinition, type LeafPageInput } from '../core/engine/siteBuilder';
import {
    extendDesignSystem, emptyDesignSystem, validateDesignSystemPreset, superficiConPannello, SMOKE_INTENSITY,
    type DesignSystemPreset,
} from '../core/engine/design-system-presets';
import { SystemFont, isSystemFont, resolveFonts, type CustomFontDef, type FontChoice } from '../core/engine/font-system';

/** Copre `extendDesignSystem`/`validateDesignSystemPreset`/`buildSite()` con fixture sintetiche —
 *  mai un preset condiviso o di progetto: quel contenuto è editabile a piacere da chi usa il
 *  template, non un invariante dell'Engine da proteggere qui. La correttezza di qualunque design
 *  system è già garantita a runtime da `validateDesignSystemPreset` (chiamata da
 *  `extendDesignSystem` a ogni resolve): nessuna rete di sicurezza aggiuntiva serve sopra questo. */

const dummyComponent: LeafPageInput['component'] = () => Promise.resolve({} as never);

function minimalSite(shell: SiteDefinition['shell']): SiteDefinition {
    return {
        homePage: 'app.home' as never,
        loginPage: null,
        legal: { privacy: 'legal.privacy' as never },
        shell,
        pages: () => [
            { path: '', pageType: 'app.home' as never, title: 'Home', component: dummyComponent, layout: { role: 'default' } },
            { path: 'about', pageType: 'app.about' as never, title: 'About', component: dummyComponent, layout: { role: 'default' } },
        ],
    };
}

/** Un sito con una pagina per OGNI ruolo (`PageRole`) — a differenza di `minimalSite` (solo
 *  `'default'`), esercita davvero `resolveRuoloPagina`/`ruoloPagina` per ciascun design system. */
function richSite(shell: SiteDefinition['shell']): SiteDefinition {
    return {
        homePage: 'app.home' as never,
        loginPage: null,
        legal: { privacy: 'legal.privacy' as never },
        shell,
        pages: () => [
            { path: '', pageType: 'app.home' as never, title: 'Home', component: dummyComponent, layout: { role: 'default' } },
            { path: 'chi-siamo', pageType: 'app.about' as never, title: 'About', component: dummyComponent, layout: { role: 'legal' } },
            { path: 'errore', pageType: 'app.errore' as never, title: 'Errore', component: dummyComponent, layout: { role: 'error' } },
            { path: 'immersivo', pageType: 'app.immersivo' as never, title: 'Immersivo', component: dummyComponent, layout: { role: 'naked' } },
        ],
    };
}

describe("Spento dal design system risolto (default compresi) = spento ovunque: un ruolo può solo spegnere", () => {
    it("un ruolo che tenta di riaccendere un campo spento dal design system resta comunque false", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            colori: { superfici: 'distinte' }, // niente pannello: 'distinte' (a differenza di 'foglio') lo blocca a false
            ruoloPagina: { legal: { showPanel: true } }, // tentativo di riaccenderlo
        });
        const site = buildSite(richSite({ designSystem }));
        const legal = site.pages.find(p => p.path === 'chi-siamo');
        expect(legal && 'chrome' in legal ? legal.chrome.showPanel : undefined).toBe(false);
    });

    it("con il campo del design system assente vale il suo default: breadcrumb.show assente (false) vincola anche il ruolo che lo accende", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            ruoloPagina: { error: { showBreadcrumb: true } },
        });
        const site = buildSite(richSite({ designSystem }));
        const errorPage = site.pages.find(p => p.path === 'errore');
        expect(errorPage && 'chrome' in errorPage ? errorPage.chrome.showBreadcrumb : undefined).toBe(false);
    });

    it("un ruolo resta libero di SPEGNERE un campo che il globale lascia acceso (direzione mai bloccata)", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            navbar: { show: true },
            ruoloPagina: { legal: { showNav: false } }, // spegne, non accende: sempre permesso
        });
        const site = buildSite(richSite({ designSystem }));
        const legal = site.pages.find(p => p.path === 'chi-siamo');
        expect(legal && 'chrome' in legal ? legal.chrome.showNav : undefined).toBe(false);
    });

    it("'naked' resta SEMPRE senza nav/footer/pannello/breadcrumb/smoke, qualunque design system", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            navbar: { show: true }, footer: { show: true }, colori: { superfici: 'foglio' },
            breadcrumb: { show: true }, smoke: { enable: true, color: '#ffffff' },
        });
        const site = buildSite(richSite({ designSystem }));
        const naked = site.pages.find(p => p.path === 'immersivo');
        expect(naked && 'chrome' in naked ? naked.chrome : undefined).toEqual(
            expect.objectContaining({ showNav: false, showPanel: false, showFooter: false, showBreadcrumb: false, showSmoke: false })
        );
    });
});

describe("superfici — 5 valori, ognuno una coppia (vividezza, pannello) già decisa: nessuna combinazione senza senso rappresentabile", () => {
    it("assente (default): vividezza neutra, pannello acceso — identico a 'foglio'", () => {
        const site = buildSite(minimalSite({ designSystem: emptyDesignSystem }));
        expect(site.config.aspetto.colori.vividezza).toBe(0);
        expect(site.config.aspetto.pannello).toBe(true);
    });

    it("'foglio': vividezza neutra, pannello acceso — mai diverge dall'assenza del campo", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, { colori: { superfici: 'foglio' } });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.aspetto.colori.vividezza).toBe(0);
        expect(site.config.aspetto.pannello).toBe(true);
    });

    it("'distinte': vividezza neutra, pannello spento", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, { colori: { superfici: 'distinte' } });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.aspetto.colori.vividezza).toBe(0);
        expect(site.config.aspetto.pannello).toBe(false);
    });

    it("'tenue': vividezza a metà strada, pannello spento", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, { colori: { superfici: 'tenue' } });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.aspetto.colori.vividezza).toBe(0.5);
        expect(site.config.aspetto.pannello).toBe(false);
    });

    it("'tenue-flottante': vividezza a metà strada, pannello acceso", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, { colori: { superfici: 'tenue-flottante' } });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.aspetto.colori.vividezza).toBe(0.5);
        expect(site.config.aspetto.pannello).toBe(true);
    });

    it("'fusione': vividezza piena, pannello spento", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, { colori: { superfici: 'fusione' } });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.aspetto.colori.vividezza).toBe(1);
        expect(site.config.aspetto.pannello).toBe(false);
    });

    it("'fusione' non ha una variante \"flotting\": showPanel resta false anche se un ruolo prova a riaccenderlo (spento dal design system)", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            colori: { superfici: 'fusione' },
            ruoloPagina: { legal: { showPanel: true } }, // tentativo di riaccenderlo, come 'muro'
        });
        const site = buildSite(richSite({ designSystem }));
        expect(site.config.aspetto.pannello).toBe(false);
        const legal = site.pages.find(p => p.path === 'chi-siamo');
        expect(legal && 'chrome' in legal ? legal.chrome.showPanel : undefined).toBe(false);
    });

    it("'tenue-flottante' NON blocca il ruolo: un ruolo può ancora spegnere il pannello (direzione mai bloccata)", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            colori: { superfici: 'tenue-flottante' },
            ruoloPagina: { legal: { showPanel: false } },
        });
        const site = buildSite(richSite({ designSystem }));
        expect(site.config.aspetto.pannello).toBe(true);
        const legal = site.pages.find(p => p.path === 'chi-siamo');
        expect(legal && 'chrome' in legal ? legal.chrome.showPanel : undefined).toBe(false);
    });
});

describe("smoke.intensita — risolve nei numeri grezzi di SMOKE_INTENSITY, mai scritti a mano dal design system", () => {
    it('intensita omessa (enable: true): cade su SMOKE_INTENSITY.pulviscolo', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            smoke: { enable: true, color: '#b5d9ff' },
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.aspetto.smoke).toEqual({
            enable: true, color: '#b5d9ff', opacity: 0.5, ...SMOKE_INTENSITY.pulviscolo,
        });
    });

    it.each(['pulviscolo', 'bruma', 'nebbia'] as const)("intensita: '%s' risolve nei numeri di SMOKE_INTENSITY['%s']", (intensita) => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            smoke: { enable: true, color: '#1f40ff', opacity: 0.4, intensita },
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.aspetto.smoke).toEqual({
            enable: true, color: '#1f40ff', opacity: 0.4, ...SMOKE_INTENSITY[intensita],
        });
    });

    it('smoke assente: effetto disattivato, stessi numeri di pulviscolo sotto (mai NaN/undefined)', () => {
        const site = buildSite(minimalSite({ designSystem: emptyDesignSystem }));
        expect(site.config.aspetto.smoke).toEqual({
            enable: false, color: '#ffffff', opacity: 0.5, ...SMOKE_INTENSITY.pulviscolo,
        });
    });
});

describe('DesignSystemPreset — fuzz strutturale via buildSite()', () => {
    type Tono = NonNullable<DesignSystemPreset['tono']>;
    type Superfici = NonNullable<DesignSystemPreset['colori']>['superfici'];
    const FORZA: Tono['forza'][] = [undefined, 'light', 'dark'];
    const PANNELLO: Tono['pannello'][] = [undefined, 'light', 'dark', 'auto'];
    const SUPERFICIE_NAV: NonNullable<DesignSystemPreset['navbar']>['superficie'][] = [undefined, 'brand', 'body'];
    const SUPERFICI: Superfici[] = [
        undefined, 'foglio', 'distinte', 'tenue', 'tenue-flottante', 'fusione',
    ];
    const SMOKE_INTENSITIES: NonNullable<DesignSystemPreset['smoke']>['intensita'][] = ['pulviscolo', 'bruma', 'nebbia'];
    const BOOL3 = [undefined, true, false];
    let n = 0;
    for (const forza of FORZA) {
        for (const pannello of PANNELLO) {
            for (const superficie of SUPERFICIE_NAV) {
                for (const fissa of BOOL3) {
                    n++;
                    if (n % 3 !== 0) continue; // campione, non l'esplosione cartesiana completa
                    const superfici = SUPERFICI[n % SUPERFICI.length];
                    const preset: DesignSystemPreset = {
                        tono: { forza, pannello },
                        navbar: { superficie, fissa, show: n % 5 !== 0 },
                        colori: {
                            superfici,
                            palette: { testColor: '#' + (n * 12345 % 0xffffff).toString(16).padStart(6, '0') },
                        },
                        movimento: n % 2 === 0 ? 'svelto' : 'fermo',
                        breadcrumb: { show: n % 3 === 0 },
                        footer: { show: n % 7 !== 0 },
                        ruoloPagina: {
                            default: { showPanel: n % 6 === 0 },
                            legal: { showPanel: true, showSmoke: false },
                            error: { fitViewport: n % 8 === 0 },
                        },
                        smoke: { enable: n % 2 === 0, color: '#b5d9ff', opacity: 0.5, intensita: SMOKE_INTENSITIES[n % SMOKE_INTENSITIES.length] },
                    };
                    const caseN = n;
                    it(`#${caseN} forza=${forza} pannello=${pannello} superficie=${superficie} fissa=${fissa} sup=${superfici}: risolve senza perdere campi`, () => {
                        expect(() => validateDesignSystemPreset(`fuzz-${caseN}`, preset)).not.toThrow();
                        const site = buildSite(minimalSite({ designSystem: () => preset }));
                        expect(site.config.aspetto.pannello).toBe(superficiConPannello(superfici));
                        expect(site.config.aspetto.smoke.enable).toBe(preset.smoke!.enable);
                        expect(site.config.errorChrome).toEqual({ showPanel: false, ...preset.ruoloPagina!.error });
                    });
                }
            }
        }
    }
});

describe('validateDesignSystemPreset — preset deliberatamente rotti vengono sempre rifiutati', () => {
    it('colore hex non valido', () => {
        expect(() => validateDesignSystemPreset('bad', { colori: { palette: { secondary: 'notahex' } } })).toThrow();
        expect(() => validateDesignSystemPreset('bad', { colori: { sfondo: 'notahex' } })).toThrow();
    });
    it('nome di palette riservato (collide con un token di sistema o con una classe Bootstrap)', () => {
        expect(() => validateDesignSystemPreset('bad', { colori: { palette: { primary: '#ff0000' } } })).toThrow();
        expect(() => validateDesignSystemPreset('bad', { colori: { palette: { success: '#ff0000' } } })).toThrow();
    });
    it('secondary e info nella palette rimpiazzano quelli di Bootstrap, non sono colori nuovi', () => {
        const preset: DesignSystemPreset = { colori: { palette: { secondary: '#00aaff', info: '#33ccff', oro: '#d4af37' } } };
        expect(() => validateDesignSystemPreset('ok', preset)).not.toThrow();
        const site = buildSite(minimalSite({ designSystem: () => preset }));
        expect(site.config.aspetto.colori.palette).toEqual({ secondary: '#00aaff', info: '#33ccff', oro: '#d4af37' });
    });
    it('smoke.opacity fuori range', () => {
        expect(() => validateDesignSystemPreset('bad', {
            smoke: { enable: true, color: '#fff', opacity: 5, intensita: 'bruma' },
        })).toThrow();
    });
    it('smoke.color non valido', () => {
        expect(() => validateDesignSystemPreset('bad', {
            smoke: { enable: true, color: 'notahex', opacity: 0.5 },
        })).toThrow();
    });
});

describe('DesignSystemPreset — siti "mimati" realistici (combinazioni multi-leva)', () => {
    const MIMICKED_SITES: Record<string, DesignSystemPreset> = {
        'saas-dashboard': { tono: { forza: 'dark', pannello: 'dark' }, navbar: { superficie: 'body', fissa: true }, movimento: 'fermo', ruoloPagina: { error: { fitViewport: true } } },
        'editorial-magazine': { tono: { pannello: 'light' }, breadcrumb: { show: true }, ruoloPagina: { legal: { showBreadcrumb: true }, default: { showBreadcrumb: false } } },
        'agency-portfolio-fullbleed': { navbar: { superficie: 'body' }, ruoloPagina: { default: { fitViewport: true, showFooter: false }, legal: { fitViewport: false, showFooter: true } } },
        'institutional-gov': { tono: { forza: 'light' }, breadcrumb: { show: true }, movimento: 'fermo', colori: { palette: { istituzionale: '#004b8d' } } },
        'minimal-single-pager': { navbar: { show: false }, footer: { show: false }, ruoloPagina: { default: { showPanel: false } } },
        'dark-only-app': { tono: { forza: 'dark', pannello: 'auto' }, smoke: { enable: true, color: '#222244', opacity: 0.3, intensita: 'pulviscolo' } },
        'ecommerce-accent-panel': { tono: { forza: 'light', pannello: 'dark' }, navbar: { superficie: 'brand' }, colori: { palette: { sale: '#c0392b', shipping: '#27ae60' } } },
        'kitchen-sink-everything-on': {
            tono: { forza: 'dark', pannello: 'light' }, navbar: { superficie: 'body', fissa: true, show: true },
            movimento: 'fermo', breadcrumb: { show: true }, footer: { show: true },
            ruoloPagina: {
                default: { showPanel: false, fitViewport: false, showSmoke: true, showBreadcrumb: false },
                legal: { showPanel: true, showSmoke: false, showBreadcrumb: true, pageFade: true },
                error: { fitViewport: true, showNav: false, showFooter: false },
            },
            colori: {
                superfici: 'foglio', sfondo: '#101020',
                palette: { secondary: '#00aaff', info: '#33ccff', a: '#111111', b: '#222222', c: '#333333', d: '#444444', e: '#555555' },
            },
            smoke: { enable: true, color: '#ffffff88', opacity: 0.6, intensita: 'nebbia' },
        },
    };

    for (const [name, preset] of Object.entries(MIMICKED_SITES)) {
        it(`${name}: valida e risolve senza NaN/undefined nella config finale`, () => {
            expect(() => validateDesignSystemPreset(name, preset)).not.toThrow();
            const site = buildSite(minimalSite({ designSystem: () => preset }));
            for (const [key, value] of Object.entries(site.config)) {
                if (typeof value === 'number') {
                    expect(Number.isNaN(value), `config.${key} è NaN`).toBe(false);
                }
            }
        });
    }
});

describe('extendDesignSystem — catene di estensione (estendere un\'estensione)', () => {
    it('una catena a due livelli non perde campi dei livelli precedenti', () => {
        const level1 = extendDesignSystem(emptyDesignSystem, { colori: { superfici: 'tenue', palette: { l1: '#abcdef' } } });
        const level2 = extendDesignSystem(level1, { colori: { palette: { l2: '#fedcba' } }, ruoloPagina: { legal: { showSmoke: true } } });
        const resolved = level2();
        expect(resolved.colori?.superfici).toBe('tenue');
        expect(resolved.colori?.palette?.['l1']).toBe('#abcdef');
        expect(resolved.colori?.palette?.['l2']).toBe('#fedcba');
        const site = buildSite(minimalSite({ designSystem: () => resolved }));
        expect(site.config.aspetto.colori.palette['l1']).toBe('#abcdef');
    });
});

describe('PageRole — ruoli custom registrati con la loro chiave in ruoloPagina (nessun registro a parte)', () => {
    function siteConRuoloCustom(designSystem: () => DesignSystemPreset, role = 'synthetic'): SiteDefinition {
        return {
            ...minimalSite({ designSystem }),
            pages: () => [
                // Nessun cast (`as PageRole`) necessario: PageRole accetta qualunque stringa
                // all'IDE (vedi il commento di PageRole in design-system-presets.ts) — il controllo
                // vero arriva da buildSite() (assertRuoloConosciuto, siteBuilder.ts), non dal tipo.
                { path: '', pageType: 'app.home' as never, title: 'Home', component: dummyComponent, layout: { role } },
            ],
        };
    }

    it("un ruolo custom registrato con la sua chiave in ruoloPagina si comporta come dichiarato", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            breadcrumb: { show: true },
            ruoloPagina: { synthetic: { showBreadcrumb: true } },
        });
        const site = buildSite(siteConRuoloCustom(designSystem));
        const home = site.pages.find(p => p.path === '');
        expect(home && 'chrome' in home ? home.chrome.showBreadcrumb : undefined).toBe(true);
    });

    it("un ruolo nuovo, sui campi non mappati, NON eredita il default di 'error'/'legal' (nessuna magia implicita)", () => {
        // showPanel non è mappato per 'synthetic' (solo showBreadcrumb lo è, sopra): deve restare
        // `undefined` qui — non `false` come accadrebbe se 'synthetic' ereditasse per errore
        // ERROR_CHROME_DEFAULT. L'interpretazione di "undefined" (ricadere sul default GLOBALE,
        // qui true) è responsabilità del consumer (AppComponent), non di LeafPage.chrome.
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            ruoloPagina: { synthetic: { showBreadcrumb: true } },
        });
        const site = buildSite(siteConRuoloCustom(designSystem));
        const home = site.pages.find(p => p.path === '');
        expect(home && 'chrome' in home ? home.chrome.showPanel : 'MISSING').toBeUndefined();
        expect(site.config.aspetto.pannello).toBe(true); // il default globale che il consumer applicherebbe
    });

    it("un ruolo custom sopravvive a extendDesignSystem anche se il patch successivo non lo tocca (mergeDesignSystemPreset fonde ogni ruolo del base, non solo default/legal/error)", () => {
        const base = extendDesignSystem(emptyDesignSystem, { ruoloPagina: { synthetic: { showBreadcrumb: true } } });
        const extended = extendDesignSystem(base, { colori: { palette: { accento: '#334455' } } });
        expect(extended().ruoloPagina?.['synthetic']?.showBreadcrumb).toBe(true);
    });

    it("layout.role con un typo (nessuna chiave corrispondente in ruoloPagina) fa fallire buildSite() con un errore leggibile, non un ripiego silenzioso", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            ruoloPagina: { synthetic: { showBreadcrumb: true } },
        });
        const site = siteConRuoloCustom(designSystem, 'sintetico'); // typo apposta: 'synthetic' registrato, non 'sintetico'
        expect(() => buildSite(site)).toThrow(/layout\.role="sintetico"/);
    });

    it("lo stesso ruolo custom impostato a due livelli di extendDesignSystem si fonde campo per campo (il livello più esterno vince sui campi in comune, il resto resta)", () => {
        const base = extendDesignSystem(emptyDesignSystem, {
            ruoloPagina: { synthetic: { showBreadcrumb: true, showNav: true } },
        });
        const extended = extendDesignSystem(base, {
            ruoloPagina: { synthetic: { showNav: false } }, // stesso ruolo: deve fondersi, non sostituire l'intero oggetto
        });
        expect(extended().ruoloPagina?.['synthetic']).toEqual({ showBreadcrumb: true, showNav: false });
    });

    it("ruoloPagina: { vuoto: {} } — spec vuota — registra comunque il ruolo: una pagina con quel ruolo non fa fallire buildSite() ed eredita i default globali", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            ruoloPagina: { vuoto: {} },
        });
        const site = buildSite(siteConRuoloCustom(designSystem, 'vuoto'));
        const home = site.pages.find(p => p.path === '');
        expect(home && 'chrome' in home ? home.chrome.showBreadcrumb : 'MISSING').toBeUndefined();
    });

    it("una catena a due livelli, ENTRAMBI con un ruolo custom diverso in ruoloPagina, conserva i ruoli di entrambi i livelli", () => {
        const livello1 = extendDesignSystem(emptyDesignSystem, {
            ruoloPagina: { primo: { showBreadcrumb: true } },
        });
        const livello2 = extendDesignSystem(livello1, {
            ruoloPagina: { secondo: { showNav: false } },
        });
        const resolved = livello2();
        expect(resolved.ruoloPagina?.['primo']?.showBreadcrumb).toBe(true);
        expect(resolved.ruoloPagina?.['secondo']?.showNav).toBe(false);
    });

    it("default/error/legal in ruoloPagina si comportano come qualunque altro ruolo — error eredita comunque ERROR_CHROME_DEFAULT sotto", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            breadcrumb: { show: true }, // accesi nel design system: i ruoli sotto possono tenerli
            smoke: { enable: true, color: '#ffffff' },
            ruoloPagina: {
                default: { showBreadcrumb: true },
                error: { showBreadcrumb: true }, // non tocca showPanel: deve restare quello di ERROR_CHROME_DEFAULT (false)
                legal: { showSmoke: true }, // non tocca showSmoke di LEGAL_CHROME_DEFAULT... lo sovrascrive apposta
            },
        });
        const site = buildSite(richSite({ designSystem }));
        const errore = site.pages.find(p => p.path === 'errore');
        const legal = site.pages.find(p => p.path === 'chi-siamo');
        expect(errore && 'chrome' in errore ? errore.chrome.showPanel : undefined).toBe(false); // ERROR_CHROME_DEFAULT, non toccato dal patch
        expect(errore && 'chrome' in errore ? errore.chrome.showBreadcrumb : undefined).toBe(true); // impostato dal patch
        expect(legal && 'chrome' in legal ? legal.chrome.showSmoke : undefined).toBe(true); // il patch vince su LEGAL_CHROME_DEFAULT (false)
    });
});

describe('Font — font.principale/font.aggiuntivi del design system, risolti in site.config.fonts', () => {
    it('nessun design system attivo: cade sui default di sistema (nessun self-hosting), nessun custom', () => {
        const site = buildSite(minimalSite({}));
        expect(site.config.fonts.serverKey).toBe(SystemFont.Liberation);
        expect(site.config.fonts.fontFaces).toEqual([]);
        expect(site.config.fonts.customFontVars).toEqual([]);
        expect(site.config.customFontsCatalog).toEqual([]);
    });

    it('un design system che dichiara font.principale (SystemFont) lo propaga in site.config.fonts, STESSO font web e server', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            font: {
                principale: SystemFont.NotoSerif,
            },
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.fonts.webStack).toContain('Noto Serif');
        expect(site.config.fonts.serverStack).toContain('Noto Serif');
        expect(site.config.fonts.serverKey).toBe(SystemFont.NotoSerif);
        expect(site.config.fonts.fontFaces).toHaveLength(4); // regular/bold/italic/bold-italic
        expect(site.config.fonts.fontFaces.every(f => f.family === 'Noto Serif' && f.format === 'truetype')).toBe(true);
    });

    it('font.principale uguale alla key di un font.aggiuntivi registrato: dedup, solo 4 @font-face (non 8)', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            font: {
                principale: SystemFont.Roboto,
                aggiuntivi: [SystemFont.Roboto],
            },
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.fonts.fontFaces).toHaveLength(4);
    });

    it('font.principale custom è un CustomFontDef scritto DIRETTAMENTE (non una key che rimanda a font.aggiuntivi) — stesso meccanismo di un SystemFont, non un ramo a parte', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            font: {
                principale: { key: 'marlboro', family: 'Marlboro', faces: [{ file: 'Marlboro.woff2', weight: 400, style: 'normal' }] },
            },
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.fonts.webStack.startsWith('"Marlboro"')).toBe(true);
        expect(site.config.fonts.serverStack.startsWith('"Marlboro"')).toBe(true);
        expect(site.config.fonts.serverKey).toBe('marlboro');
        expect(site.config.fonts.fontFaces).toHaveLength(1);
        expect(site.config.fonts.fontFaces[0]).toMatchObject({ family: 'Marlboro', url: '/cdn-cgi/font/marlboro/0', format: 'woff2' });
        // Nessuna CSS var per il custom scelto come font.principale — non serve, è già --fontFamily. Nessun font.aggiuntivi dichiarato.
        expect(site.config.fonts.customFontVars).toEqual([]);
        // Ma resta nel catalogo grezzo: system-font.ts/custom-font-detect.ts lo trovano per key.
        expect(site.config.customFontsCatalog).toEqual([{ key: 'marlboro', family: 'Marlboro', faces: [{ file: 'Marlboro.woff2', weight: 400, style: 'normal' }] }]);
    });

    it('registrare un font.aggiuntivi senza sceglierlo in font.principale NON lo rende attivo — solo servito/raggiungibile da SCSS (nessun default implicito)', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            font: {
                principale: SystemFont.Roboto,
                aggiuntivi: [{ key: 'accento', family: 'Accento', faces: [{ file: 'Accento.ttf', weight: 400, style: 'normal' }] }],
            },
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.fonts.webStack).toContain('Roboto');
        expect(site.config.fonts.serverKey).toBe(SystemFont.Roboto);
        expect(site.config.fonts.fontFaces.some(f => f.family === 'Accento')).toBe(true);
        expect(site.config.fonts.customFontVars).toEqual([{ key: 'accento', family: 'Accento', cssVar: '--fontFamily-accento' }]);
    });

    it('una voce SystemFont in font.aggiuntivi è servita/raggiungibile da SCSS senza essere il font.principale attivo — family/faces colmate dal catalogo, nessuna ridichiarazione', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            font: {
                principale: SystemFont.Liberation,
                aggiuntivi: [SystemFont.Roboto],
            },
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.fonts.webStack).toContain('Liberation Sans'); // il font attivo resta Liberation
        expect(site.config.fonts.customFontVars).toEqual([{ key: 'Roboto', family: 'Roboto', cssVar: '--fontFamily-Roboto' }]);
        // 4 facce Liberation (attivo) + 4 facce Roboto (add-on) — l'add-on colma family/faces da SYSTEM_FONTS.
        expect(site.config.fonts.fontFaces).toHaveLength(8);
        expect(site.config.fonts.fontFaces.filter(f => f.family === 'Roboto')).toHaveLength(4);
        expect(site.config.customFontsCatalog).toEqual([]); // nessuna voce CustomFontDef: il catalogo grezzo resta vuoto
    });

    it('font.aggiuntivi può mescolare una voce SystemFont e una CustomFontDef nello stesso array', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            font: {
                aggiuntivi: [
                    SystemFont.DejaVuMono,
                    { key: 'brand', family: 'MiaFontBrand', faces: [{ file: 'MiaFontBrand.woff2', weight: 400, style: 'normal' }] },
                ],
            },
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.fonts.customFontVars).toEqual([
            { key: 'DejaVuMono', family: 'DejaVu Sans Mono', cssVar: '--fontFamily-DejaVuMono' },
            { key: 'brand', family: 'MiaFontBrand', cssVar: '--fontFamily-brand' },
        ]);
        expect(site.config.customFontsCatalog).toEqual([
            { key: 'brand', family: 'MiaFontBrand', faces: [{ file: 'MiaFontBrand.woff2', weight: 400, style: 'normal' }] },
        ]);
    });

    it('font.principale custom E un font.aggiuntivi custom con key diverse convivono nel catalogo grezzo', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            font: {
                principale: { key: 'brand', family: 'MiaFontBrand', faces: [{ file: 'MiaFontBrand.woff2', weight: 400, style: 'normal' }] },
                aggiuntivi: [{ key: 'accento', family: 'MiaFontAccento', faces: [{ file: 'MiaFontAccento.woff2', weight: 400, style: 'normal' }] }],
            },
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.customFontsCatalog.map(c => c.key).sort()).toEqual(['accento', 'brand']);
        expect(site.config.fonts.fontFaces).toHaveLength(2); // una faccia per ciascuno
    });

    it('validateDesignSystemPreset rifiuta una voce SystemFont duplicata in font.aggiuntivi, e una collisione fra voce SystemFont e CustomFontDef con la stessa key', () => {
        expect(() => extendDesignSystem(emptyDesignSystem, { font: { aggiuntivi: [SystemFont.Roboto, SystemFont.Roboto] } })())
            .toThrow(/duplicata/);
        expect(() => extendDesignSystem(emptyDesignSystem, { font: { aggiuntivi: [
            SystemFont.Roboto,
            { key: 'Roboto', family: 'X', faces: [{ file: 'x.ttf', weight: 400, style: 'normal' }] },
        ] } })()).toThrow(/coincide con una voce di SystemFont/);
    });

    it('validateDesignSystemPreset rifiuta una key non valida, una collisione con SystemFont, key duplicate — su font.aggiuntivi e su font.principale indipendentemente', () => {
        expect(() => extendDesignSystem(emptyDesignSystem, { font: { aggiuntivi: [{ key: 'ha spazi', family: 'X', faces: [{ file: 'x.ttf', weight: 400, style: 'normal' }] }] } })())
            .toThrow(/non valida/);
        expect(() => extendDesignSystem(emptyDesignSystem, { font: { aggiuntivi: [{ key: 'Roboto', family: 'X', faces: [{ file: 'x.ttf', weight: 400, style: 'normal' }] }] } })())
            .toThrow(/coincide con una voce di SystemFont/);
        expect(() => extendDesignSystem(emptyDesignSystem, { font: { aggiuntivi: [
            { key: 'dup', family: 'X', faces: [{ file: 'x.ttf', weight: 400, style: 'normal' }] },
            { key: 'dup', family: 'Y', faces: [{ file: 'y.ttf', weight: 400, style: 'normal' }] },
        ] } })()).toThrow(/duplicata/);
        expect(() => extendDesignSystem(emptyDesignSystem, { font: { principale: { key: 'ha spazi', family: 'X', faces: [{ file: 'x.ttf', weight: 400, style: 'normal' }] } } })())
            .toThrow(/non valida/);
        expect(() => extendDesignSystem(emptyDesignSystem, { font: { principale: { key: 'Roboto', family: 'X', faces: [{ file: 'x.ttf', weight: 400, style: 'normal' }] } } })())
            .toThrow(/coincide con una voce di SystemFont/);
        expect(() => extendDesignSystem(emptyDesignSystem, { font: { principale: { key: 'brand', family: 'X', faces: [] } } })())
            .toThrow(/nessuna faccia dichiarata/);
    });

    it('la stessa key in font.principale custom e in un font.aggiuntivi custom NON è un errore (campi indipendenti, nessuna verifica incrociata)', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            font: {
                principale: { key: 'brand', family: 'MiaFontBrand', faces: [{ file: 'MiaFontBrand.woff2', weight: 400, style: 'normal' }] },
                aggiuntivi: [{ key: 'brand', family: 'MiaFontBrand', faces: [{ file: 'MiaFontBrand.woff2', weight: 400, style: 'normal' }] }],
            },
        });
        expect(() => designSystem()).not.toThrow();
    });

    it('font e ruoloPagina nello stesso patch convivono (campi indipendenti, nessuna collisione)', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            ruoloPagina: { vetrina: { showBreadcrumb: false } },
            font: { principale: { key: 'marlboro', family: 'Marlboro', faces: [{ file: 'Marlboro.woff2', weight: 400, style: 'normal' }] } },
        });
        const resolved = designSystem();
        expect(resolved.ruoloPagina?.['vetrina']?.showBreadcrumb).toBe(false);
        expect(resolved.font?.principale).toEqual({ key: 'marlboro', family: 'Marlboro', faces: [{ file: 'Marlboro.woff2', weight: 400, style: 'normal' }] });
    });
});

describe('Font — proprietà "raggiungibile ⇔ censito": ogni URL di fontFaces risolve a una faccia DICHIARATA, ogni faccia dichiarata compare in fontFaces', () => {
    /** URL `/cdn-cgi/font/:key/:index` → `{key, index}` — stesso pattern di `fontFaceUrl` (font-system.ts). */
    function parseUrl(url: string): { key: string; index: number } {
        const m = /^\/cdn-cgi\/font\/([^/]+)\/(\d+)$/.exec(url);
        if (!m) throw new Error(`URL malformato, non combacia col routing dell'endpoint: ${url}`);
        return { key: decodeURIComponent(m[1]), index: Number(m[2]) };
    }

    const custom = (key: string, faceCount: number): CustomFontDef => ({
        key, family: `Famiglia-${key}`,
        faces: Array.from({ length: faceCount }, (_, i) => ({ file: `${key}-${i}.woff2`, weight: 400, style: 'normal' })),
    });

    // Combinazioni: principale assente/SystemFont/custom, incrociato con aggiuntivi di lunghezza e
    // composizione diverse (SystemFont, custom, entrambi, vuoto) — campionate, non il prodotto
    // cartesiano completo, stesso stile del fuzz-test sopra.
    const PRINCIPALI: (FontChoice | undefined)[] = [
        undefined, SystemFont.Roboto, SystemFont.DejaVuMono, custom('d1', 1), custom('d2', 3),
    ];
    const AGGIUNTIVI: FontChoice[][] = [
        [],
        [SystemFont.Noto],
        [custom('a1', 1)],
        [SystemFont.Liberation, custom('a2', 2)],
        [SystemFont.NotoSerif, SystemFont.LiberationMono, custom('a3', 1), custom('a4', 4)],
    ];

    let n = 0;
    for (const principale of PRINCIPALI) {
        for (const aggiuntivi of AGGIUNTIVI) {
            n++;
            const label = `#${n} principale=${principale == null ? 'assente' : typeof principale === 'string' ? principale : principale.key} aggiuntivi=[${aggiuntivi.map(a => typeof a === 'string' ? a : a.key).join(',')}]`;
            it(label, () => {
                const resolved = resolveFonts({ principale, aggiuntivi });

                // Catalogo custom atteso — stessa regola di assemblaggio di siteBuilder.ts:
                // principale (se custom) + le voci custom di aggiuntivi, per key.
                const customByKey = new Map<string, CustomFontDef>();
                if (principale != null && typeof principale !== 'string') customByKey.set(principale.key, principale);
                for (const a of aggiuntivi) if (typeof a !== 'string') customByKey.set(a.key, a);

                // 1) Ogni URL generato risolve DAVVERO a una faccia dichiarata (SystemFont entro le
                //    sue 4 facce, o una key del catalogo custom entro il suo array faces).
                for (const face of resolved.fontFaces) {
                    const { key, index } = parseUrl(face.url);
                    if (isSystemFont(key)) {
                        expect(index).toBeLessThan(4);
                    } else {
                        const def = customByKey.get(key);
                        expect(def, `key "${key}" nell'URL ${face.url} non è né un SystemFont né nel catalogo custom atteso`).toBeDefined();
                        expect(index).toBeLessThan(def!.faces.length);
                    }
                }

                // 2) Nessun URL duplicato (dedup per scelta, garantito da resolveFonts()).
                const urls = resolved.fontFaces.map(f => f.url);
                expect(new Set(urls).size).toBe(urls.length);

                // 3) Ogni voce di customFontVars corrisponde a una key REALMENTE nel catalogo custom
                //    o del catalogo di sistema (mai una var orfana per una key inventata).
                for (const v of resolved.customFontVars) {
                    expect(isSystemFont(v.key) || customByKey.has(v.key)).toBe(true);
                }
            });
        }
    }
});

describe('Leve delegate al design system (movimento/elevazione/larghezza/breadcrumb/fab/badgeNotifiche)', () => {
    it('nessun design system attivo: tutte cadono sul loro default', () => {
        const site = buildSite(minimalSite({}));
        expect(site.config.aspetto.movimento).toBe('svelto');
        expect(site.config.aspetto.elevazione).toBe('sospesa');
        expect(site.config.aspetto.larghezza).toBe('ampio');
        expect(site.config.aspetto.breadcrumb.stile).toBe('traccia');
        expect(site.config.aspetto.fab.tornaSuSoglia).toBe('standard');
        expect(site.config.aspetto.fab.cookie).toBe('discreto');
        expect(site.config.aspetto.badgeNotifiche).toBe('numero');
        expect(site.config.aspetto.pulsazione).toBe('lieve');
    });

    it('un design system che le imposta tutte le vede propagate senza perdite', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            movimento: 'fermo',
            elevazione: 'flottante',
            larghezza: 'pieno',
            breadcrumb: { stile: 'freccia' },
            fab: { tornaSuSoglia: 'tardiva', cookie: 'standard' },
            badgeNotifiche: 'puntino',
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.aspetto.movimento).toBe('fermo');
        expect(site.config.aspetto.transizioni).toBe(false);
        expect(site.config.aspetto.elevazione).toBe('flottante');
        expect(site.config.aspetto.larghezza).toBe('pieno');
        expect(site.config.aspetto.breadcrumb.stile).toBe('freccia');
        expect(site.config.aspetto.fab.tornaSuSoglia).toBe('tardiva');
        expect(site.config.aspetto.fab.cookie).toBe('standard');
        expect(site.config.aspetto.badgeNotifiche).toBe('puntino');
        expect(site.config.aspetto.pulsazione).toBe('assente');
    });
});
