// FILE GENERATO AUTOMATICAMENTE DA scripts/generate-statics.ts
// Non modificare manualmente. Sorgente di verità: global-settings.json (sezioni project / Localization / site)

export interface AppSiteConfig {
    description?: Record<string, string>;
    colorTema?: string;
    smoke?: {
        enable?: boolean;
        color?: string;
        opacity?: number;
        maximumVelocity?: number;
        particleRadius?: number;
        density?: number;
    };
}

export interface AppEnvironment {
    appName: string;
    version: string;
    defaultLang: string;
    availableLanguages: string[];
    config: AppSiteConfig;
}

export const environment: AppEnvironment = {
    appName: "Br1Gaming",
    version: "2.5.0",
    defaultLang: 'it',
    availableLanguages: ["it"],
    config: {
            "colorTema": "#add8e6",
            "description": {
                    "it": "Generatori ignoranti, avventure interattive, universo Br1."
            }
    }
};
