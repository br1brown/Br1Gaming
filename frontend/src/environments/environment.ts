// FILE GENERATO AUTOMATICAMENTE DA scripts/build/generate-statics.ts
// Non modificare manualmente. Sorgente di verità: global-settings.json (sezioni project / Localization / site)

export interface AppSiteConfig {
    description?: Record<string, string>;
    colorTema?: string;
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
    configFingerprint: "1afaab59ce2f"
};
