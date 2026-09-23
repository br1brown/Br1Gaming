import { existsSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

/** Contenuto di un `global-settings.local.json` di sviluppo: la stessa forma che scrive `setup.mjs`, coi segreti
 *  generati (API key e `SecretKey` del login). Il file non entra mai in git. */
export function developmentLocalSettings(): string {
    return JSON.stringify({
        $schema: './global-settings.schema.json',
        frontend: { hostname: '', port: 3000 },
        backend: { public: false, publicPort: null },
        Security: {
            ApiConfig: { Keys: [randomBytes(32).toString('base64')] },
            CorsOrigins: [],
            BehindProxy: false,
            Token: { SecretKey: randomBytes(48).toString('base64') },
        },
    }, null, 2) + '\n';
}

/** Scrive `global-settings.local.json` se manca, e dice se lo ha fatto. Solo per la copia di sviluppo del repository
 *  (il chiamante passa il percorso accanto a `global-settings.json` della root): in Docker il `.local` non esiste
 *  per scelta e non va creato. Stesso automatismo lato backend (`LocalSettingsFile` in `Program.cs`): chi parte
 *  per primo lo crea, l'altro lo trova. */
export function ensureLocalSettings(path: string): boolean {
    if (existsSync(path)) return false;
    writeFileSync(path, developmentLocalSettings(), { encoding: 'utf-8', flag: 'wx' });
    return true;
}
