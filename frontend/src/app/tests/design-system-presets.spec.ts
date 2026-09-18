import { describe, it, expect } from 'vitest';
import { buildSite, type SiteDefinition, type LeafPageInput } from '../core/engine/siteBuilder';
import {
    extendDesignSystem, emptyDesignSystem, validateDesignSystemPreset,
    type DesignSystemPreset,
} from '../core/engine/design-system-presets';
import { ServerFont } from '../core/engine/font-system';

/**
 * Copre `extendDesignSystem`/`validateDesignSystemPreset`/`buildSite()` con fixture sintetiche
 * (`emptyDesignSystem`, letterali `DesignSystemPreset`) — mai un preset condiviso o un design
 * system di progetto (`components/shared/design-systems/`): quel contenuto è editabile a
 * piacere da chi usa il template, non un invariante dell'Engine da proteggere con un test qui.
 * La correttezza di QUALUNQUE design system, condiviso o di progetto, è già garantita a runtime
 * da `validateDesignSystemPreset` (chiamata da `extendDesignSystem` a ogni resolve, vedi
 * `design-system-presets.ts`) — nessuna rete di sicurezza aggiuntiva serve al di sopra di questo.
 */

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
            showPanel: false,
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
        const designSystem = extendDesignSystem(emptyDesignSystem, { showNav: true, showFooter: true, showPanel: true });
        const site = buildSite(richSite({ designSystem }));
        const naked = site.pages.find(p => p.path === 'immersivo');
        expect(naked && 'chrome' in naked ? naked.chrome : undefined).toEqual(
            expect.objectContaining({ showNav: false, showPanel: false, showFooter: false })
        );
    });
});

describe('DesignSystemPreset — fuzz strutturale via buildSite()', () => {
    const FORCE_TONE: (DesignSystemPreset['forceThemeTone'])[] = [undefined, 'light', 'dark'];
    const PANEL_SURFACE: (DesignSystemPreset['panelSurface'])[] = [undefined, 'light', 'dark', 'auto'];
    const NAV_SURFACE: (DesignSystemPreset['navSurface'])[] = [undefined, 'brand', 'body'];
    const BOOL3 = [undefined, true, false];

    let n = 0;
    for (const forceThemeTone of FORCE_TONE) {
        for (const panelSurface of PANEL_SURFACE) {
            for (const navSurface of NAV_SURFACE) {
                for (const fixedTopHeader of BOOL3) {
                    n++;
                    if (n % 3 !== 0) continue; // campione, non l'esplosione cartesiana completa
                    const preset: DesignSystemPreset = {
                        forceThemeTone, panelSurface, navSurface, fixedTopHeader,
                        pageFade: n % 2 === 0,
                        showBreadcrumb: n % 3 === 0,
                        showNav: n % 5 !== 0,
                        showFooter: n % 7 !== 0,
                        showPanel: n % 4 !== 0,
                        ruoloPagina: {
                            default: { showPanel: n % 6 === 0 },
                            legal: { showPanel: true, showSmoke: false },
                            error: { fitViewport: n % 8 === 0 },
                        },
                        customPalette: { testColor: '#' + (n * 12345 % 0xffffff).toString(16).padStart(6, '0') },
                        smoke: { enable: n % 2 === 0, color: '#b5d9ff', opacity: 0.5, maximumVelocity: 1, particleRadius: 2, density: 10 },
                    };
                    const caseN = n;
                    it(`#${caseN} fT=${forceThemeTone} pS=${panelSurface} nS=${navSurface} fTH=${fixedTopHeader}: risolve senza perdere campi`, () => {
                        expect(() => validateDesignSystemPreset(`fuzz-${caseN}`, preset)).not.toThrow();
                        const site = buildSite(minimalSite({ designSystem: () => preset }));
                        expect(site.config.showPanel).toBe(preset.showPanel);
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
    it('smoke.opacity fuori range', () => {
        expect(() => validateDesignSystemPreset('bad', {
            smoke: { enable: true, color: '#fff', opacity: 5, maximumVelocity: 1, particleRadius: 1, density: 1 },
        })).toThrow();
    });
    it('smoke.density negativa', () => {
        expect(() => validateDesignSystemPreset('bad', {
            smoke: { enable: true, color: '#fff', opacity: 0.5, maximumVelocity: 1, particleRadius: 1, density: -3 },
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
        'dark-only-app': { forceThemeTone: 'dark', panelSurface: 'auto', smoke: { enable: true, color: '#222244', opacity: 0.3, maximumVelocity: 0.2, particleRadius: 1, density: 5 } },
        'ecommerce-accent-panel': { forceThemeTone: 'light', panelSurface: 'dark', navSurface: 'brand', customPalette: { sale: '#c0392b', shipping: '#27ae60' } },
        'kitchen-sink-everything-on': {
            forceThemeTone: 'dark', panelSurface: 'light', navSurface: 'body', fixedTopHeader: true, pageFade: false, showBreadcrumb: true,
            showNav: true, showFooter: true, showPanel: true,
            ruoloPagina: {
                default: { showPanel: false, fitViewport: false, showSmoke: true, showBreadcrumb: false },
                legal: { showPanel: true, showSmoke: false, showBreadcrumb: true, pageFade: true },
                error: { fitViewport: true, showNav: false, showFooter: false },
            },
            customPalette: { a: '#111111', b: '#222222', c: '#333333', d: '#444444', e: '#555555' },
            colorSecondary: '#00aaff', colorBackground: '#101020', colorText: '#eeeeee', colorInfo: '#33ccff',
            smoke: { enable: true, color: '#ffffff88', opacity: 0.6, maximumVelocity: 2, particleRadius: 3, density: 20 },
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

describe('Font — webFont/serverFont/customFont del design system, risolti in site.config.fonts', () => {
    it('nessun design system attivo: cade sui default di sistema (System/Liberation), nessun custom', () => {
        const site = buildSite(minimalSite({}));
        expect(site.config.fonts.custom).toBeUndefined();
        expect(site.config.fonts.serverKey).toBe(ServerFont.Liberation);
    });

    it('un design system che dichiara webFont/serverFont li propaga in site.config.fonts', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            webFont: 'Georgia',
            serverFont: ServerFont.Roboto,
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.fonts.webStack).toContain('Georgia');
        expect(site.config.fonts.serverKey).toBe(ServerFont.Roboto);
        expect(site.config.fonts.custom).toBeUndefined();
    });

    it('customFont sostituisce ENTRAMBI webStack/serverStack, in testa allo stack — coerente col vecchio comportamento di AppFontConfig.custom', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            customFont: { family: 'Marlboro', file: 'Marlboro.woff2' },
        });
        const site = buildSite(minimalSite({ designSystem }));
        expect(site.config.fonts.webStack.startsWith('"Marlboro"')).toBe(true);
        expect(site.config.fonts.serverStack.startsWith('"Marlboro"')).toBe(true);
        expect(site.config.fonts.serverKey).toBe('Marlboro');
        expect(site.config.fonts.custom).toEqual({ family: 'Marlboro', file: 'Marlboro.woff2' });
    });

    it('font e ruoloPagina nello stesso patch convivono (campi indipendenti, nessuna collisione)', () => {
        const designSystem = extendDesignSystem(emptyDesignSystem, {
            ruoloPagina: { vetrina: { showBreadcrumb: false } },
            customFont: { family: 'Marlboro', file: 'Marlboro.woff2' },
        });
        const resolved = designSystem();
        expect(resolved.ruoloPagina?.['vetrina']?.showBreadcrumb).toBe(false);
        expect(resolved.customFont).toEqual({ family: 'Marlboro', file: 'Marlboro.woff2' });
    });
});
