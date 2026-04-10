import { buildSite } from './siteBuilder';

export type {
	SiteConfig,
	SiteConfigInput,
	SitePageInput,
	SmokeSettings,
	SmokeSettingsInput
} from './siteBuilder';

// ═══════════════════════════════════════════════════════════════════════
// ENUM PageType — identita' di ogni pagina
// ═══════════════════════════════════════════════════════════════════════
export enum PageType {
	Home,
	CookiePolicy,
	GeneratorDetail,
	StoryPlayer,
}

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURAZIONE MASTER DEL SITO
// ═══════════════════════════════════════════════════════════════════════
export const ContestoSito = buildSite(siteFondamentaBuilder => {

	siteFondamentaBuilder.setSiteConfiguration(siteConfigurationSectionBuilder =>
		siteConfigurationSectionBuilder.setSiteConfiguration({
			appName: 'Br1-Gaming',
			defaultLang: 'it',
			description: 'Br1 e i suoi giochini',
			colorTema: '#cff7cb',
			showHeader: true,
			showFooter: true,
		}));

	siteFondamentaBuilder.defineSitePages(sitePagesSectionBuilder =>
		sitePagesSectionBuilder.setSitePages([
			{
				path: '',
				title: 'home',
				enabled: true,
				pageType: PageType.Home,
				showPanel: false,
				component: () => import('./pages/home/home.component').then(m => m.HomeComponent),
			},
			{
				path: 'generatori/:slug',
				title: 'generatoreDetail',
				enabled: true,
				pageType: PageType.GeneratorDetail,
				showPanel: true,
				component: () => import('./pages/generator-detail/generator-detail.component').then(m => m.GeneratorDetailComponent),
			},
			{
				path: 'cookie-policy',
				title: 'cookiePolicy',
				enabled: true,
				pageType: PageType.CookiePolicy,
				showPanel: true,
				component: () => import('./pages/policy/policy.component').then(m => m.PolicyComponent),
			},
			{
				path: 'avventura/:slug',
				title: 'avventuraPlayer',
				enabled: true,
				pageType: PageType.StoryPlayer,
				showPanel: true,
				component: () => import('./pages/story-player/story-player.component').then(m => m.StoryPlayerComponent),
			},
		]));

	siteFondamentaBuilder.configureSiteNavigation(siteNavigationSectionsBuilder => {
		siteNavigationSectionsBuilder.configureFooterNavigation(footerNavigationBuilder => {
			footerNavigationBuilder.addPage(PageType.CookiePolicy);
		});
	});
});
