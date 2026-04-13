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
export const ContestoSito = buildSite(site => {

	site.setSiteConfiguration({
		appName: 'Br1-Gaming',
		defaultLang: 'it',
		description: 'Br1 e i suoi giochini',
		colorTema: '#cff7cb',
		showHeader: true,
		showFooter: true,
	});

	site.defineSitePages([
		{
			path: '',
			title: 'home',
			enabled: true,
			pageType: PageType.Home,
			showPanel: false,
			description: 'Generatori casuali, avventure interattive e tanto altro da Br1.',
			component: () => import('./pages/home/home.component').then(m => m.HomeComponent),
		},
		{
			path: 'generatori/:slug',
			title: 'generatori',
			enabled: true,
			pageType: PageType.GeneratorDetail,
			showPanel: true,
			description: 'Genera risultati casuali con i generatori di Br1-Gaming.',
			component: () => import('./pages/generator-detail/generator-detail.component').then(m => m.GeneratorDetailComponent),
		},
		{
			path: 'cookie-policy',
			title: 'cookiePolicy',
			enabled: true,
			pageType: PageType.CookiePolicy,
			showPanel: true,
			description: 'Informativa sui cookie di Br1-Gaming.',
			component: () => import('./pages/policy/policy.component').then(m => m.PolicyComponent),
		},
		{
			path: 'avventura/:slug',
			title: 'avventure',
			enabled: true,
			pageType: PageType.StoryPlayer,
			showPanel: true,
			description: 'Gioca a un\'avventura testuale interattiva su Br1-Gaming.',
			component: () => import('./pages/story-player/story-player.component').then(m => m.StoryPlayerComponent),
		},
	]);

	site.configureFooterNavigation(footer => {
		footer.addPage(PageType.CookiePolicy);
	});
});
