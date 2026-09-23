import type { Request, Response } from 'express';
import { computeLegalFacts } from '../server-env';

/** `/internal/legal-facts`: fatti per la Privacy Policy (installazione, sito coperto, finestra del rate
 *  limiting), gli stessi che l'SSR passa in TransferState a ogni pagina renderizzata dal server. Serve
 *  da scorta al browser sulle pagine senza SSR (`requiresAuth`): se il primo caricamento della sessione
 *  è una di quelle, TransferState non li ha mai avuti, e `PolicyComponent` li chiede qui prima di
 *  ricadere sul testo generico. Nessuna autenticazione, perché `computeLegalFacts` restituisce solo ciò
 *  che l'informativa scrive (vedi `LegalFacts`): chi legge la risposta sa quanto sa chi legge la pagina. */
export function legalFactsHandler(_req: Request, res: Response): void {
    res.set('Cache-Control', 'no-cache');
    res.json(computeLegalFacts());
}
