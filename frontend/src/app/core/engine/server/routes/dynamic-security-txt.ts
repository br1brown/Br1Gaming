import type { Request, Response } from 'express';
import { environment } from '../../../../../environments/environment';
import { serverEnv } from '../server-env';

/**
 * Endpoint `/.well-known/security.txt` (RFC 9116): generato ad ogni richiesta, non al build.
 *
 * `Contact` è un dato di identità (email/telefono del sito, `GET /identity`), non di build: come
 * ogni altro contatto del progetto va modificabile senza un redeploy. `Expires` è calcolato "adesso
 * + 1 anno" ad ogni richiesta, quindi non scade mai finché il sito riceve traffico — nessuna
 * manutenzione, a differenza di un file generato una volta sola al build.
 *
 * Nessun contatto configurato in identità (email/telefono assenti) → 404: un security.txt senza un
 * modo reale di raggiungere qualcuno sarebbe peggio che non pubblicarlo affatto.
 */

interface IdentityContact {
    contatti?: { email?: string; telefono?: string };
}

/** Stesso pattern di `dynamic-sitemap.ts` (fetch diretto al backend, bypassando il proxy `/api/*`
 *  perché questo codice gira già lato server). Nessuna cache: un file di poche righe, chiamato di
 *  rado (crawler di sicurezza, non traffico utente) — non vale la complessità di un TTL. */
async function fetchIdentity(): Promise<IdentityContact | null> {
    const url = `${serverEnv.backend.origin}/identity`;
    try {
        const response = await fetch(url, {
            headers: { 'x-api-key': serverEnv.backend.apiKey },
            signal: AbortSignal.timeout(serverEnv.server.proxyTimeout),
        });
        if (!response.ok) return null;
        return await response.json() as IdentityContact;
    } catch {
        return null;
    }
}

export async function securityTxtHandler(_req: Request, res: Response): Promise<void> {
    const identity = await fetchIdentity();
    const email = identity?.contatti?.email?.trim();
    const telefono = identity?.contatti?.telefono?.trim();

    if (!email && !telefono) {
        res.status(404).end();
        return;
    }

    const baseUrl = serverEnv.site.baseUrl || 'https://example.com';
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    // "ordered by preference" (RFC 9116): la lingua di default va per prima — `availableLanguages`
    // segue l'ordine di SupportedLanguages in global-settings.json, che non garantisce affatto che
    // la default sia la prima della lista (es. SupportedLanguages: ["en","it"] con default "it").
    const preferredLanguages = [
        environment.defaultLang,
        ...environment.availableLanguages.filter(lang => lang !== environment.defaultLang),
    ];
    const lines = [
        '# security.txt — RFC 9116',
        ...(email ? [`Contact: mailto:${email}`] : []),
        ...(telefono ? [`Contact: tel:${telefono.replace(/[^0-9+]/g, '')}`] : []),
        `Expires: ${expires}`,
        `Preferred-Languages: ${preferredLanguages.join(', ')}`,
        `Canonical: ${baseUrl}/.well-known/security.txt`,
    ];

    res.set('Cache-Control', 'no-cache').type('text/plain').send(lines.join('\n') + '\n');
}
