// FILE GENERATO AUTOMATICAMENTE DA scripts/build/generate-statics.ts
// Non modificare manualmente. Sorgente di verità: global-settings.json (sezioni project / Localization / site)

export interface AppSiteConfig {
    description?: Record<string, string>;
    colorTema?: string;
    colorSecondary?: string;
    colorBackground?: string;
    colorText?: string;
    colorInfo?: string;
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
    /** Impronta di project/Localization/site al momento della generazione (vedi
     *  core/engine/scripts/config/config-fingerprint.ts). server.ts la confronta con quella
     *  ricalcolata al boot per accorgersi se global-settings.json è cambiato da allora
     *  senza rilanciare generate:statics (es. `ng serve` lanciato senza i pre-hook npm). */
    configFingerprint: string;
}

export const environment: AppEnvironment = {
    appName: "Br1Gaming",
    version: "2.5.0",
    defaultLang: 'it',
    availableLanguages: ["it"],
    config: {
            "colorTema": "#add8e6",
            "colorSecondary": "#fff000",
            "smoke": {
                    "enable": true,
                    "color": "#add8e6",
                    "opacity": 0.7,
                    "maximumVelocity": 120,
                    "particleRadius": 350,
                    "density": 18
            },
            "description": {
                    "it": "Generatori ignoranti, avventure interattive, universo Br1."
            }
    },
    configFingerprint: "c33c1ba56058"
};
