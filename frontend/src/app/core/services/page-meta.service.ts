import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ContestoSito } from '../../site';
import { AssetService } from './asset.service';

/**
 * PAGE META SERVICE
 * Gestisce l'aggiornamento dinamico del titolo della pagina e dei meta tag.
 * Essenziale per l'indicizzazione (Google) e il social sharing (Facebook, LinkedIn, ecc.).
 */
@Injectable({ providedIn: 'root' })
export class PageMetaService {
    // Servizi Angular per manipolare i tag nel <head>
    private readonly title = inject(Title);
    private readonly meta = inject(Meta);
    private readonly document = inject(DOCUMENT);

    /**
     * Utility statica per navigare l'albero delle rotte di Angular.
     * Trova l'ultima rotta figlia attiva (quella che effettivamente definisce il contenuto della pagina).
     */
    static getLeaf(route: ActivatedRouteSnapshot | RouterStateSnapshot): ActivatedRouteSnapshot {
        let leaf = route instanceof RouterStateSnapshot ? route.root : route;
        while (leaf.firstChild) leaf = leaf.firstChild;
        return leaf;
    }

    /**
     * Applica i metadati alla pagina corrente.
     * @param title - Il titolo della pagina (già formattato, es: "Nome Prodotto | Nome Sito")
     * @param description - La meta-description per i motori di ricerca
     * @param imgId - ID dell'immagine di anteprima (se nullo, usa il logo predefinito)
     */
    setTitle(
        title: string,
        description?: string | null,
        imgId?: string | null,
    ): void {

        // Aggiorna il tag <title> del browser
        this.title.setTitle(title);

        // Aggiorna i tag per i social (Open Graph e Twitter)
        this.meta.updateTag({ name: 'twitter:title', content: title });
        this.meta.updateTag({ property: 'og:title', content: title });

        // Se presente, aggiorna la descrizione ovunque
        if (!!description) {
            this.meta.updateTag({ name: 'description', content: description });
            this.meta.updateTag({ property: 'og:description', content: description });
            this.meta.updateTag({ name: 'twitter:description', content: description });
        }

        // Gestione URL e Origin
        // In SSR, document.URL riflette l'indirizzo richiesto dal client.
        const url = this.document.URL;

        // Calcola l'origine (dominio) in modo sicuro sia per Browser che per SSR
        const origin = this.document.location?.origin || (() => {
            try { return new URL(url).origin; } catch { return ''; }
        })();

        // Cache busting per le immagini tramite versione del sito
        const v = ContestoSito.config.version ? `?v=${ContestoSito.config.version}` : '';

        // Costruzione dell'URL assoluto per l'immagine (richiesto dai crawler social)
        const imageUrl = imgId
            ? `${origin}${AssetService._UrlvirtualPathAsset(imgId)}${v}`
            : `${origin}/icons/icon-512x512.png${v}`;

        // Applicazione dei tag per le anteprime grafiche
        this.meta.updateTag({ property: 'og:url', content: url });
        this.meta.updateTag({ property: 'og:image', content: imageUrl });
        this.meta.updateTag({ name: 'twitter:image', content: imageUrl });

        // Gestione del tag rel="canonical"
        this.updateCanonical(url);
    }

    /**
     * Gestisce il tag canonical per evitare problemi di contenuti duplicati.
     * Se il tag esiste lo aggiorna, altrimenti lo crea e lo appende al <head>.
     */
    private updateCanonical(url: string): void {
        const existing = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (existing) {
            existing.href = url;
            return;
        }
        const link = this.document.createElement('link');
        link.rel = 'canonical';
        link.href = url;
        this.document.head.appendChild(link);
    }
}