import { describe, it, expect } from 'vitest';
import { buildSite, type SiteDefinition, type LeafPageInput } from '../core/engine/siteBuilder';
import {
    extendDesignSystem, emptyDesignSystem, validateDesignSystemPreset, SMOKE_INTENSITY,
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
        legalPages: [{ pageType: 'legal.cookie' as never, path: 'cookie', titleKey: 't', descriptionKey: 'd', markdownSlug: 'cookie' }],
        cookiePolicy: 'legal.cookie' as never,
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
        legalPages: [{ pageType: 'legal.cookie' as never, path: 'cookie', titleKey: 't', descriptionKey: 'd', markdownSlug: 'cookie' }],
        cookiePolicy: 'legal.cookie' as never,
        shell,
        pages: () => [
            { path: '', pageType: 'app.home' as never, title: 'Home', component: dummyComponent, layout: { role: 'default' } },
            { path: 'chi-siamo', pageType: 'app.about' as never, title: 'About', component: dummyComponent, layout: { role: 'legal' } },
            { path: 'errore', pageType: 'app.errore' as never, title: 'Errore', component: dummyComponent, layout: { role: 'error' } },
            { path: 'immersivo', pageType: 'app.immersivo' as never, title: 'Immersivo', component: dummyComponent, layout: { role: 'naked' } },
        ],
    };
}

describe("Interruttore master su showNav/showFooter/showPanel/showBreadcrumb/pageFade — il globale esplicito 'false' vince sempre sul ruolo", () => {
    it("un ruolo che tenta di riportare a true un campo bloccato dal master resta comunque false", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            superfici: 'distinte', // master su showPanel: 'distinte' (a differenza di 'foglio') lo blocca a false
            ruoloPagina: { legal: { showPanel: true } }, // tentativo di riaccenderlo
        });
        const site = buildSite(richSite({ designSystem }));
        const legal = site.pages.find(p => p.path === 'chi-siamo');
        expect(legal && 'chrome' in legal ? legal.chrome.showPanel : undefined).toBe(false);
    });

    it("senza un master esplicito (campo globale assente, non false), il ruolo resta libero di accenderlo — nessuna regressione", () => {
        // showBreadcrumb globale non toccato: resta undefined, non false — il master non scatta.
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            ruoloPagina: { error: { showBreadcrumb: true } },
        });
        const site = buildSite(richSite({ designSystem }));
        const errorPage = site.pages.find(p => p.path === 'errore');
        expect(errorPage && 'chrome' in errorPage ? errorPage.chrome.showBreadcrumb : undefined).toBe(true);
    });

    it("un ruolo resta libero di SPEGNERE un campo che il globale lascia acceso (direzione mai bloccata)", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            showNav: true,
            ruoloPagina: { legal: { showNav: false } }, // spegne, non accende: sempre permesso
        });
        const site = buildSite(richSite({ designSystem }));
        const legal = site.pages.find(p => p.path === 'chi-siamo');
        expect(legal && 'chrome' in legal ? legal.chrome.showNav : undefined).toBe(false);
    });

    it("'naked' resta SEMPRE senza nav/footer/pannello, qualunque design system", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, { showNav: true, showFooter: true, superfici: 'foglio' });
        const site = buildSite(richSite({ designSystem }));
        const naked = site.pages.find(p => p.path === 'immersivo');
        expect(naked && 'chrome' in naked ? naked.chrome : undefined).toEqual(
            expect.objectContaining({ showNav: false, showPanel: false, showFooter: false })
        );
    });
});

describe("superfici — 5 valori, ognuno una coppia (vividezza, pannello) già decisa: nessuna combinazione senza senso rappresentabile", () => {
    it("assente (default storico): backgroundVividness neutra, pannello acceso — identico a 'foglio'", () => {
        const site = buildSite(minimalSite({ designSystem: emptyDesignSystem }));
        expect(site.config.backgroundVividness).toBe(0);
        expect(site.config.showPanel).toBe(true);
    });

    it("'foglio': backgroundVividness neutra, pannello acceso — mai diverge dall'assenza del campo", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, { superfici: 'foglio' });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.backgroundVividness).toBe(0);
        expect(site.config.showPanel).toBe(true);
    });

    it("'distinte': backgroundVividness neutra, pannello spento", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, { superfici: 'distinte' });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.backgroundVividness).toBe(0);
        expect(site.config.showPanel).toBe(false);
    });

    it("'tenue': backgroundVividness a metà strada, pannello spento", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, { superfici: 'tenue' });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.backgroundVividness).toBe(0.5);
        expect(site.config.showPanel).toBe(false);
    });

    it("'tenue-flotting': backgroundVividness a metà strada, pannello acceso", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, { superfici: 'tenue-flotting' });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.backgroundVividness).toBe(0.5);
        expect(site.config.showPanel).toBe(true);
    });

    it("'fusione': backgroundVividness piena, pannello spento", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, { superfici: 'fusione' });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.backgroundVividness).toBe(1);
        expect(site.config.showPanel).toBe(false);
    });

    it("'fusione' non ha una variante \"flotting\": showPanel resta false anche se un ruolo prova a riaccenderlo (master-lock)", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            superfici: 'fusione',
            ruoloPagina: { legal: { showPanel: true } }, // tentativo di riaccenderlo, come 'muro'
        });
        const site = buildSite(richSite({ designSystem }));
        expect(site.config.showPanel).toBe(false);
        const legal = site.pages.find(p => p.path === 'chi-siamo');
        expect(legal && 'chrome' in legal ? legal.chrome.showPanel : undefined).toBe(false);
    });

    it("'tenue-flotting' NON blocca il ruolo: un ruolo può ancora spegnere il pannello (direzione mai bloccata)", () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            superfici: 'tenue-flotting',
            ruoloPagina: { legal: { showPanel: false } },
        });
        const site = buildSite(richSite({ designSystem }));
        expect(site.config.showPanel).toBe(true);
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
        expect(site.config.smoke).toEqual({
            enable: true, color: '#b5d9ff', opacity: 0.5, ...SMOKE_INTENSITY.pulviscolo,
        });
    });

    it.each(['pulviscolo', 'bruma', 'nebbia'] as const)("intensita: '%s' risolve nei numeri di SMOKE_INTENSITY['%s']", (intensita) => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            smoke: { enable: true, color: '#1f40ff', opacity: 0.4, intensita },
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.smoke).toEqual({
            enable: true, color: '#1f40ff', opacity: 0.4, ...SMOKE_INTENSITY[intensita],
        });
    });

    it('smoke assente: effetto disattivato, stessi numeri di pulviscolo sotto (mai NaN/undefined)', () => {
        const site = buildSite(minimalSite({ designSystem: emptyDesignSystem }));
        expect(site.config.smoke).toEqual({
            enable: false, color: '#ffffff', opacity: 0.5, ...SMOKE_INTENSITY.pulviscolo,
        });
    });
});

describe('DesignSystemPreset — fuzz strutturale via buildSite()', () => {
    const FORCE_TONE: (DesignSystemPreset['forceThemeTone'])[] = [undefined, 'light', 'dark'];
    const PANEL_SURFACE: (DesignSystemPreset['panelSurface'])[] = [undefined, 'light', 'dark', 'auto'];
    const NAV_SURFACE: (DesignSystemPreset['navSurface'])[] = [undefined, 'brand', 'body'];
    const SUPERFICI: (DesignSystemPreset['superfici'])[] = [
        undefined, 'foglio', 'distinte', 'tenue', 'tenue-flotting', 'fusione',
    ];
    const SMOKE_INTENSITIES: NonNullable<DesignSystemPreset['smoke']>['intensita'][] = ['pulviscolo', 'bruma', 'nebbia'];
    const BOOL3 = [undefined, true, false];
    /** Pannello implicito in `superfici` — stessa mappa di `superficiShowsPanel` (siteBuilder.ts),
     *  ridichiarata qui perché privata a quel modulo: nessun caso senza senso da rappresentare. */
    const superficiShowsPanel = (s: DesignSystemPreset['superfici']): boolean =>
        !(s === 'distinte' || s === 'tenue' || s === 'fusione');

    let n = 0;
    for (const forceThemeTone of FORCE_TONE) {
        for (const panelSurface of PANEL_SURFACE) {
            for (const navSurface of NAV_SURFACE) {
                for (const fixedTopHeader of BOOL3) {
                    n++;
                    if (n % 3 !== 0) continue; // campione, non l'esplosione cartesiana completa
                    const superfici = SUPERFICI[n % SUPERFICI.length];
                    const preset: DesignSystemPreset = {
                        forceThemeTone, panelSurface, navSurface, fixedTopHeader, superfici,
                        pageFade: n % 2 === 0,
                        showBreadcrumb: n % 3 === 0,
                        showNav: n % 5 !== 0,
                        showFooter: n % 7 !== 0,
                        ruoloPagina: {
                            default: { showPanel: n % 6 === 0 },
                            legal: { showPanel: true, showSmoke: false },
                            error: { fitViewport: n % 8 === 0 },
                        },
                        customPalette: { testColor: '#' + (n * 12345 % 0xffffff).toString(16).padStart(6, '0') },
                        smoke: { enable: n % 2 === 0, color: '#b5d9ff', opacity: 0.5, intensita: SMOKE_INTENSITIES[n % SMOKE_INTENSITIES.length] },
                    };
                    const caseN = n;
                    it(`#${caseN} fT=${forceThemeTone} pS=${panelSurface} nS=${navSurface} fTH=${fixedTopHeader} sup=${superfici}: risolve senza perdere campi`, () => {
                        expect(() => validateDesignSystemPreset(`fuzz-${caseN}`, preset)).not.toThrow();
                        const site = buildSite(minimalSite({ designSystem: () => preset }));
                        expect(site.config.showPanel).toBe(superficiShowsPanel(superfici));
                        expect(site.config.smoke.enable).toBe(preset.smoke!.enable);
                        expect(site.config.errorChrome).toEqual({ showPanel: false, ...preset.ruoloPagina!.error });
                    });
                }
            }
        }
    }
});

describe('validateDesignSystemPreset — preset deliberatamente rotti vengono sempre rifiutati', () => {
    it('colore hex non valido', () => {
        expect(() => validateDesignSystemPreset('bad', { colorSecondary: 'notahex' })).toThrow();
    });
    it('etichetta customPalette riservata (collide con un token di sistema)', () => {
        expect(() => validateDesignSystemPreset('bad', { customPalette: { primary: '#ff0000' } })).toThrow();
    });
    it("etichetta customPalette \"info\" riservata (collide con --colorInfoText, stessa famiglia di 'infotext')", () => {
        expect(() => validateDesignSystemPreset('bad', { customPalette: { info: '#ff0000' } })).toThrow();
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
        'saas-dashboard': { forceThemeTone: 'dark', panelSurface: 'dark', navSurface: 'body', fixedTopHeader: true, pageFade: false, ruoloPagina: { error: { fitViewport: true } } },
        'editorial-magazine': { panelSurface: 'light', showBreadcrumb: true, ruoloPagina: { legal: { showBreadcrumb: true }, default: { showBreadcrumb: false } } },
        'agency-portfolio-fullbleed': { navSurface: 'body', ruoloPagina: { default: { fitViewport: true, showFooter: false }, legal: { fitViewport: false, showFooter: true } } },
        'institutional-gov': { forceThemeTone: 'light', showBreadcrumb: true, pageFade: false, customPalette: { istituzionale: '#004b8d' } },
        'minimal-single-pager': { showNav: false, showFooter: false, ruoloPagina: { default: { showPanel: false } } },
        'dark-only-app': { forceThemeTone: 'dark', panelSurface: 'auto', smoke: { enable: true, color: '#222244', opacity: 0.3, intensita: 'pulviscolo' } },
        'ecommerce-accent-panel': { forceThemeTone: 'light', panelSurface: 'dark', navSurface: 'brand', customPalette: { sale: '#c0392b', shipping: '#27ae60' } },
        'kitchen-sink-everything-on': {
            forceThemeTone: 'dark', panelSurface: 'light', navSurface: 'body', fixedTopHeader: true, pageFade: false, showBreadcrumb: true,
            showNav: true, showFooter: true, superfici: 'foglio',
            ruoloPagina: {
                default: { showPanel: false, fitViewport: false, showSmoke: true, showBreadcrumb: false },
                legal: { showPanel: true, showSmoke: false, showBreadcrumb: true, pageFade: true },
                error: { fitViewport: true, showNav: false, showFooter: false },
            },
            customPalette: { a: '#111111', b: '#222222', c: '#333333', d: '#444444', e: '#555555' },
            colorSecondary: '#00aaff', colorBackground: '#101020', colorText: '#eeeeee', colorInfo: '#33ccff',
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
        const level1 = extendDesignSystem(emptyDesignSystem, { customPalette: { l1: '#abcdef' } });
        const level2 = extendDesignSystem(level1, { customPalette: { l2: '#fedcba' }, ruoloPagina: { legal: { showSmoke: true } } });
        const resolved = level2();
        expect(resolved.customPalette?.['l1']).toBe('#abcdef');
        expect(resolved.customPalette?.['l2']).toBe('#fedcba');
        const site = buildSite(minimalSite({ designSystem: () => resolved }));
        expect(site.config.customPalette['l1']).toBe('#abcdef');
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
        expect(site.config.showPanel).toBe(true); // il default globale che il consumer applicherebbe
    });

    it("un ruolo custom sopravvive a extendDesignSystem anche se il patch successivo non lo tocca — bug verificato: mergeDesignSystemPreset fondeva ruoloPagina solo su default/legal/error, perdendo in silenzio qualunque altro ruolo del base", () => {
        const base = extendDesignSystem(emptyDesignSystem, { ruoloPagina: { synthetic: { showBreadcrumb: true } } });
        const extended = extendDesignSystem(base, { customPalette: { accento: '#334455' } });
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

describe('Font — defaultFont/addonFonts del design system, risolti in site.config.fonts', () => {
    it('nessun design system attivo: cade sui default di sistema (nessun self-hosting), nessun custom', () => {
        const site = buildSite(minimalSite({}));
        expect(site.config.fonts.serverKey).toBe(SystemFont.Liberation);
        expect(site.config.fonts.fontFaces).toEqual([]);
        expect(site.config.fonts.customFontVars).toEqual([]);
        expect(site.config.customFontsCatalog).toEqual([]);
    });

    it('un design system che dichiara defaultFont (SystemFont) lo propaga in site.config.fonts, STESSO font web e server', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            defaultFont: SystemFont.NotoSerif,
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.fonts.webStack).toContain('Noto Serif');
        expect(site.config.fonts.serverStack).toContain('Noto Serif');
        expect(site.config.fonts.serverKey).toBe(SystemFont.NotoSerif);
        expect(site.config.fonts.fontFaces).toHaveLength(4); // regular/bold/italic/bold-italic
        expect(site.config.fonts.fontFaces.every(f => f.family === 'Noto Serif' && f.format === 'truetype')).toBe(true);
    });

    it('defaultFont uguale alla key di un addonFonts registrato: dedup, solo 4 @font-face (non 8)', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            defaultFont: SystemFont.Roboto,
            addonFonts: [SystemFont.Roboto],
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.fonts.fontFaces).toHaveLength(4);
    });

    it('defaultFont custom è un CustomFontDef scritto DIRETTAMENTE (non una key che rimanda ad addonFonts) — stesso meccanismo di un SystemFont, non un ramo a parte', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            defaultFont: { key: 'marlboro', family: 'Marlboro', faces: [{ file: 'Marlboro.woff2', weight: 400, style: 'normal' }] },
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.fonts.webStack.startsWith('"Marlboro"')).toBe(true);
        expect(site.config.fonts.serverStack.startsWith('"Marlboro"')).toBe(true);
        expect(site.config.fonts.serverKey).toBe('marlboro');
        expect(site.config.fonts.fontFaces).toHaveLength(1);
        expect(site.config.fonts.fontFaces[0]).toMatchObject({ family: 'Marlboro', url: '/cdn-cgi/font/marlboro/0', format: 'woff2' });
        // Nessuna CSS var per il custom scelto come defaultFont — non serve, è già --fontFamily. Nessun addonFonts dichiarato.
        expect(site.config.fonts.customFontVars).toEqual([]);
        // Ma resta nel catalogo grezzo: system-font.ts/custom-font-detect.ts lo trovano per key.
        expect(site.config.customFontsCatalog).toEqual([{ key: 'marlboro', family: 'Marlboro', faces: [{ file: 'Marlboro.woff2', weight: 400, style: 'normal' }] }]);
    });

    it('registrare un addonFonts senza sceglierlo in defaultFont NON lo rende attivo — solo servito/raggiungibile da SCSS (nessun default implicito)', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            defaultFont: SystemFont.Roboto,
            addonFonts: [{ key: 'accento', family: 'Accento', faces: [{ file: 'Accento.ttf', weight: 400, style: 'normal' }] }],
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.fonts.webStack).toContain('Roboto');
        expect(site.config.fonts.serverKey).toBe(SystemFont.Roboto);
        expect(site.config.fonts.fontFaces.some(f => f.family === 'Accento')).toBe(true);
        expect(site.config.fonts.customFontVars).toEqual([{ key: 'accento', family: 'Accento', cssVar: '--fontFamily-accento' }]);
    });

    it('una voce SystemFont in addonFonts è servita/raggiungibile da SCSS senza essere il defaultFont attivo — family/faces colmate dal catalogo, nessuna ridichiarazione', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            defaultFont: SystemFont.Liberation,
            addonFonts: [SystemFont.Roboto],
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.fonts.webStack).toContain('Liberation Sans'); // il font attivo resta Liberation
        expect(site.config.fonts.customFontVars).toEqual([{ key: 'Roboto', family: 'Roboto', cssVar: '--fontFamily-Roboto' }]);
        // 4 facce Liberation (attivo) + 4 facce Roboto (add-on) — l'add-on colma family/faces da SYSTEM_FONTS.
        expect(site.config.fonts.fontFaces).toHaveLength(8);
        expect(site.config.fonts.fontFaces.filter(f => f.family === 'Roboto')).toHaveLength(4);
        expect(site.config.customFontsCatalog).toEqual([]); // nessuna voce CustomFontDef: il catalogo grezzo resta vuoto
    });

    it('addonFonts può mescolare una voce SystemFont e una CustomFontDef nello stesso array', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            addonFonts: [
                SystemFont.DejaVuMono,
                { key: 'brand', family: 'MiaFontBrand', faces: [{ file: 'MiaFontBrand.woff2', weight: 400, style: 'normal' }] },
            ],
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

    it('defaultFont custom E un addonFonts custom con key diverse convivono nel catalogo grezzo', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            defaultFont: { key: 'brand', family: 'MiaFontBrand', faces: [{ file: 'MiaFontBrand.woff2', weight: 400, style: 'normal' }] },
            addonFonts: [{ key: 'accento', family: 'MiaFontAccento', faces: [{ file: 'MiaFontAccento.woff2', weight: 400, style: 'normal' }] }],
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.customFontsCatalog.map(c => c.key).sort()).toEqual(['accento', 'brand']);
        expect(site.config.fonts.fontFaces).toHaveLength(2); // una faccia per ciascuno
    });

    it('validateDesignSystemPreset rifiuta una voce SystemFont duplicata in addonFonts, e una collisione fra voce SystemFont e CustomFontDef con la stessa key', () => {
        expect(() => extendDesignSystem(emptyDesignSystem, { addonFonts: [SystemFont.Roboto, SystemFont.Roboto] })())
            .toThrow(/duplicata/);
        expect(() => extendDesignSystem(emptyDesignSystem, { addonFonts: [
            SystemFont.Roboto,
            { key: 'Roboto', family: 'X', faces: [{ file: 'x.ttf', weight: 400, style: 'normal' }] },
        ] })()).toThrow(/coincide con una voce di SystemFont/);
    });

    it('validateDesignSystemPreset rifiuta una key non valida, una collisione con SystemFont, key duplicate — su addonFonts e su defaultFont indipendentemente', () => {
        expect(() => extendDesignSystem(emptyDesignSystem, { addonFonts: [{ key: 'ha spazi', family: 'X', faces: [{ file: 'x.ttf', weight: 400, style: 'normal' }] }] })())
            .toThrow(/non valida/);
        expect(() => extendDesignSystem(emptyDesignSystem, { addonFonts: [{ key: 'Roboto', family: 'X', faces: [{ file: 'x.ttf', weight: 400, style: 'normal' }] }] })())
            .toThrow(/coincide con una voce di SystemFont/);
        expect(() => extendDesignSystem(emptyDesignSystem, { addonFonts: [
            { key: 'dup', family: 'X', faces: [{ file: 'x.ttf', weight: 400, style: 'normal' }] },
            { key: 'dup', family: 'Y', faces: [{ file: 'y.ttf', weight: 400, style: 'normal' }] },
        ] })()).toThrow(/duplicata/);
        expect(() => extendDesignSystem(emptyDesignSystem, { defaultFont: { key: 'ha spazi', family: 'X', faces: [{ file: 'x.ttf', weight: 400, style: 'normal' }] } })())
            .toThrow(/non valida/);
        expect(() => extendDesignSystem(emptyDesignSystem, { defaultFont: { key: 'Roboto', family: 'X', faces: [{ file: 'x.ttf', weight: 400, style: 'normal' }] } })())
            .toThrow(/coincide con una voce di SystemFont/);
        expect(() => extendDesignSystem(emptyDesignSystem, { defaultFont: { key: 'brand', family: 'X', faces: [] } })())
            .toThrow(/nessuna faccia dichiarata/);
    });

    it('la stessa key in defaultFont custom e in un addonFonts custom NON è un errore (campi indipendenti, nessuna verifica incrociata)', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            defaultFont: { key: 'brand', family: 'MiaFontBrand', faces: [{ file: 'MiaFontBrand.woff2', weight: 400, style: 'normal' }] },
            addonFonts: [{ key: 'brand', family: 'MiaFontBrand', faces: [{ file: 'MiaFontBrand.woff2', weight: 400, style: 'normal' }] }],
        });
        expect(() => designSystem()).not.toThrow();
    });

    it('font e ruoloPagina nello stesso patch convivono (campi indipendenti, nessuna collisione)', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            ruoloPagina: { vetrina: { showBreadcrumb: false } },
            defaultFont: { key: 'marlboro', family: 'Marlboro', faces: [{ file: 'Marlboro.woff2', weight: 400, style: 'normal' }] },
        });
        const resolved = designSystem();
        expect(resolved.ruoloPagina?.['vetrina']?.showBreadcrumb).toBe(false);
        expect(resolved.defaultFont).toEqual({ key: 'marlboro', family: 'Marlboro', faces: [{ file: 'Marlboro.woff2', weight: 400, style: 'normal' }] });
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

    // Combinazioni: defaultFont assente/SystemFont/custom, incrociato con addonFonts di lunghezza e
    // composizione diverse (SystemFont, custom, entrambi, vuoto) — campionate, non il prodotto
    // cartesiano completo, stesso stile del fuzz-test sopra.
    const DEFAULTS: (FontChoice | undefined)[] = [
        undefined, SystemFont.Roboto, SystemFont.DejaVuMono, custom('d1', 1), custom('d2', 3),
    ];
    const ADDON_SETS: FontChoice[][] = [
        [],
        [SystemFont.Noto],
        [custom('a1', 1)],
        [SystemFont.Liberation, custom('a2', 2)],
        [SystemFont.NotoSerif, SystemFont.LiberationMono, custom('a3', 1), custom('a4', 4)],
    ];

    let n = 0;
    for (const defaultFont of DEFAULTS) {
        for (const addonFonts of ADDON_SETS) {
            n++;
            const label = `#${n} defaultFont=${defaultFont == null ? 'assente' : typeof defaultFont === 'string' ? defaultFont : defaultFont.key} addonFonts=[${addonFonts.map(a => typeof a === 'string' ? a : a.key).join(',')}]`;
            it(label, () => {
                const resolved = resolveFonts({ defaultFont, addonFonts });

                // Catalogo custom atteso — stessa regola di assemblaggio di siteBuilder.ts:
                // defaultFont (se custom) + le voci custom di addonFonts, per key.
                const customByKey = new Map<string, CustomFontDef>();
                if (defaultFont != null && typeof defaultFont !== 'string') customByKey.set(defaultFont.key, defaultFont);
                for (const a of addonFonts) if (typeof a !== 'string') customByKey.set(a.key, a);

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

describe('Nuove leve delegate al design system (movimento/elevazione/contentWidth/breadcrumbStile/mutezzaSecondario/hoverIntensity/separazioneSuperfici/footerIdentita/backToTopSoglia/cookieReopenStile/badgeNotifiche/pulsazioneAttiva)', () => {
    it('nessun design system attivo: tutte cadono sul default storico', () => {
        const site = buildSite(minimalSite({}));
        expect(site.config.movimento).toBe('svelto');
        expect(site.config.elevazione).toBe('sospesa');
        expect(site.config.contentWidth).toBe('ampio');
        expect(site.config.breadcrumbStile).toBe('traccia');
        expect(site.config.mutezzaSecondario).toBe('standard');
        expect(site.config.hoverIntensity).toBe('standard');
        expect(site.config.separazioneSuperfici).toBe('classica');
        expect(site.config.footerIdentita).toBe('esteso');
        expect(site.config.backToTopSoglia).toBe('standard');
        expect(site.config.cookieReopenStile).toBe('discreto');
        expect(site.config.badgeNotifiche).toBe('numero');
        expect(site.config.pulsazioneAttiva).toBe('lieve');
    });

    it('un design system che le imposta tutte le vede propagate senza perdite', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            movimento: 'scatto',
            elevazione: 'flottante',
            contentWidth: 'pieno',
            breadcrumbStile: 'freccia',
            mutezzaSecondario: 'satura',
            hoverIntensity: 'decisa',
            separazioneSuperfici: 'marcata',
            footerIdentita: 'essenziale',
            backToTopSoglia: 'tardiva',
            cookieReopenStile: 'standard',
            badgeNotifiche: 'puntino',
            pulsazioneAttiva: 'assente',
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.movimento).toBe('scatto');
        expect(site.config.elevazione).toBe('flottante');
        expect(site.config.contentWidth).toBe('pieno');
        expect(site.config.breadcrumbStile).toBe('freccia');
        expect(site.config.mutezzaSecondario).toBe('satura');
        expect(site.config.hoverIntensity).toBe('decisa');
        expect(site.config.separazioneSuperfici).toBe('marcata');
        expect(site.config.footerIdentita).toBe('essenziale');
        expect(site.config.backToTopSoglia).toBe('tardiva');
        expect(site.config.cookieReopenStile).toBe('standard');
        expect(site.config.badgeNotifiche).toBe('puntino');
        expect(site.config.pulsazioneAttiva).toBe('assente');
    });
});
