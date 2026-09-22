/** Costanti della pipeline asset dell'Engine — vivono qui e non in app.config.ts perché consumate
 *  dall'Engine stesso (AssetService, AssetDirective, proxy SSR, image processing): la fonte di
 *  verità deve stare dentro `core/engine/`, non in un file di bootstrap che l'Engine importerebbe
 *  all'insù. */

/** Whitelist fissa delle larghezze consentite per l'ottimizzazione immagini — Engine, non
 *  configurabile per progetto. Condivisa col backend C# (`EngineBlobController.AllowedWebOptSizes`,
 *  stessi valori — non generata automaticamente, va tenuta allineata a mano). */
export const ALLOWED_WIDTHS = [125, 320, 480, 512, 640, 768, 1024, 1080, 1366, 1600, 1920] as const;

/** Prefisso del proxy API: unica fonte di verità per server.ts (proxy Express) e il DI Angular (browser) */
export const API_PREFIX = '/api';

/**
 * Tipo derivato dalla whitelist per l'utilizzo nei parametri dei componenti/servizi.
 */
export type AssetWidth = typeof ALLOWED_WIDTHS[number];
