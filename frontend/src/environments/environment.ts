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
    appName: "Br1Gaming",
    version: "2.5.2",
    defaultLang: 'it',
    availableLanguages: ["it"],
    config: {
            "colorTema": "#38bdf8",
            "description": {
                    "it": "Generatori demenziali, avventure interattive, universo Br1."
            }
    },
    features: {"login":false,"publicLogin":false,"mail":false,"errorReporting":false,"forms":false},
    configFingerprint: "c4167022b526",
    legalFiles: {"privacy":["analytics","cookiePolicy","cookiePolicy/off","errorReporting","form","form/off","intro","login","mail","outro","profiling"],"cookie":["intro","tracking"]}
};
