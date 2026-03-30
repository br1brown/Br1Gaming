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
    appName: "App",
    version: "1.0.0",
    defaultLang: 'it',
    availableLanguages: ["it","en"],
    config: {
            "colorTema": "#131e55",
            "smoke": {
                    "enable": true,
                    "color": "#b5d9ff",
                    "opacity": 0.7,
                    "maximumVelocity": 120,
                    "particleRadius": 350,
                    "density": 18
            },
            "description": {
                    "it": "Template di base che serve per fare vedere le funzionalità base",
                    "en": "Base template showcasing the core building blocks"
            }
    }
};
