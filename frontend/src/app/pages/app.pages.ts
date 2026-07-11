import type { SitePageInput } from '../core/engine/siteBuilder';

// Area "app": pagine applicative del progetto. Un file per area (demo: "app"; reali: "shop", "blog"…),
// assemblato in site.ts con uno spread. ID prefissati per area, leggibili in query string/log.
// Riferimento campi: frontend/README.md §"Pagine & rotte" e §"Opzioni Avanzate di site.ts".
export const AppPages = {
    Home: 'app.home',
    Social: 'app.social',
    Login: 'app.login',
    Impostazioni: 'app.impostazioni',
} as const;

/** Dichiarazioni pagina di quest'area, assemblate in site.ts → pages(). */
export const appPagesDecl: SitePageInput[] = [
    {
        path: '',
        title: '',
        pageType: AppPages.Home,
        description: 'homeDesc',
        otherSEO: { ogImage: 'img4k' },
        component: () => import('./home/home.component').then(m => m.HomeComponent),
    },
    {
        path: 'social-feed',
        title: 'socialNav',
        pageType: AppPages.Social,
        description: 'socialDesc',
        component: () => import('./social/social.component').then(m => m.SocialComponent),
        layout: { showPanel: false },
    },
    {
        path: 'login',
        title: 'loginNav',
        pageType: AppPages.Login,
        description: 'loginDesc',
        component: () => import('./login/login.component').then(m => m.LoginComponent),
    },
    {
        path: 'impostazioni',
        title: 'impostazioniNav',
        requiresAuth: true,
        pageType: AppPages.Impostazioni,
        description: 'settingsDesc',
        component: () => import('./social/social.component').then(m => m.SocialComponent),
    },
];
