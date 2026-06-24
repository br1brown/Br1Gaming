/**
 * Costanti della pipeline asset dell'Engine.
 *
 * Vivono qui (e non in app.config.ts) perché sono consumate dall'Engine stesso
 * — AssetService, AssetDirective, il proxy SSR (server.ts) e l'image processing
 * (cdn-asset) — oltre che dal DI Angular: la fonte di verità deve stare dentro
 * `core/engine/`, non in un file di bootstrap che l'Engine dovrebbe importare all'insù.
 */

/**
 * Whitelist delle larghezze consentite per l'ottimizzazione immagini.
 * Condivisa tra il frontend (AssetService) e il backend (server.ts).
 */
export const ALLOWED_WIDTHS = [125, 320, 480, 512, 640, 768, 1024, 1080, 1366, 1600, 1920] as const;

/** Prefisso del proxy API: unica fonte di verità per server.ts (proxy Express) e il DI Angular (browser) */
export const API_PREFIX = '/api';

/**
 * Tipo derivato dalla whitelist per l'utilizzo nei parametri dei componenti/servizi.
 */
export type AssetWidth = typeof ALLOWED_WIDTHS[number];
