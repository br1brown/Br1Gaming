// FILE GENERATO AUTOMATICAMENTE DA scripts/build/generate-statics.ts
// Non modificare manualmente. Sorgente di verità: global-settings.json (sezioni project / Localization / site / Features)

export interface AppSiteConfig {
    description?: Record<string, string>;
    colorTema?: string;
}

/** Funzioni opzionali accese in global-settings.json (§ Features). */
export interface AppFeatures {
    /** Login attivo, riservato o pubblico. */
    login: boolean;
    /** Login pubblico: link in navbar e sezione nella Privacy Policy. */
    publicLogin: boolean;
    mail: boolean;
    errorReporting: boolean;
    forms: boolean;
}

export interface AppEnvironment {
    appName: string;
    version: string;
    defaultLang: string;
    availableLanguages: string[];
    config: AppSiteConfig;
    features: AppFeatures;
    /** Impronta della config alla generazione: server.ts la confronta al boot per scoprire un global-settings.json non rigenerato. */
    configFingerprint: string;
    /** File presenti per pagina legale (cartella → nomi senza lingua): il resolver carica solo questi. */
    legalFiles: Record<string, string[]>;
}

export const environment: AppEnvironment = {
    appName: "App",
    version: "1.0.0",
    defaultLang: 'it',
    availableLanguages: ["it","en"],
    config: {
            "colorTema": "#131e55",
            "description": {
                    "it": "Template di base che serve per fare vedere le funzionalità base",
                    "en": "Base template showcasing the core building blocks"
            }
    },
    features: {"login":true,"publicLogin":true,"mail":false,"errorReporting":false,"forms":false},
    configFingerprint: "e0a079a8bf9a",
    legalFiles: {"privacy":["analytics","cookiePolicy","errorReporting","form","intro","login","mail","outro","profiling"],"cookie":["intro","tracking"],"TOS":["intro"],"legal":["intro","outro"],"accessibility":["intro","outro"]}
};
