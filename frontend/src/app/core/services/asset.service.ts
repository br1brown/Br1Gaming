import { inject, Injectable, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { type AssetWidth } from '../../app.config';
import { ContestoSito } from '../../site';

/**
 * ASSET SERVICE
 * Gestisce la generazione e la pulizia degli URL per le risorse multimediali.
 * Supporta sia URL virtuali del backend che URL temporanei generati da file (Blob).
 */
@Injectable({ providedIn: 'root' })
export class AssetService implements OnDestroy {
    private readonly sanitizer = inject(DomSanitizer);
    private readonly router = inject(Router);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    // Path virtuale mappato solitamente su un worker o proxy (es. Cloudflare)

    public static _UrlvirtualPathAsset = (id: string, version?: string) => {
        const virtualPath = '/cdn-cgi/asset';
        let vers = ''
        if (!!version) vers = `&v=${version}`;

        return `${virtualPath}?id=${id}${vers}`;
    };

    // Set per tracciare tutti i Blob URL creati ed evitare perdite di memoria
    private readonly blobUrls = new Set<string>();

    private routerSub: Subscription; 
    constructor() {
        /**
         * LOGICA DI PULIZIA AUTOMATICA
         * I "Blob URL" occupano memoria finché non vengono revocati esplicitamente.
         * Sottoscrivendosi agli eventi del router, il servizio libera la RAM 
         * ogni volta che l'utente cambia pagina.
         */
        this.routerSub = this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe(() => this.revokeAll());
    }

    /**
     * Costruisce un URL per una risorsa remota gestita dal server.
     * @param id - Identificativo univoco dell'asset.
     * @param width - Larghezza desiderata (per ottimizzazione on-the-fly).
     * @returns Stringa URL completa di parametri di versione e ridimensionamento.
     */
    getUrl(id: string, width?: AssetWidth): string {

        let url = AssetService._UrlvirtualPathAsset(id, ContestoSito.config.version);

        // Aggiunge la larghezza per il ridimensionamento dinamico lato server (Image Resizing)
        if (width) url += `&w=${width}`;

        return url;
    }

    /** 
     * Crea un URL temporaneo per un oggetto Blob o File.
     * Utile per anteprime di immagini caricate dall'utente o file scaricati via API.
     * 
     * @param blob - Il file binario da visualizzare.
     * @returns Oggetto con URL grezzo e URL sanitizzato per Angular.
     */
    getUrlFromBlob(blob: Blob): { rawUrl: string, angularUrl: SafeUrl } {
        // I Blob URL esistono solo nel browser, non in SSR
        if (!this.isBrowser) {
            return { rawUrl: '', angularUrl: this.sanitizer.bypassSecurityTrustUrl('') };
        }

        // Genera l'URL del tipo blob:http://...
        const rawUrl = URL.createObjectURL(blob);

        // Registra l'URL nel set per la futura eliminazione
        this.blobUrls.add(rawUrl);

        return {
            rawUrl,
            // Sanitizzazione necessaria per permettere ad Angular di inserire l'URL in [src]
            angularUrl: this.sanitizer.bypassSecurityTrustUrl(rawUrl)
        };
    }

    /** 
     * Libera esplicitamente la memoria occupata dai Blob URL.
     * Fondamentale per evitare che il browser crashi in sessioni lunghe con molti media.
     */
    revokeAll(): void {
        this.blobUrls.forEach(url => {
            URL.revokeObjectURL(url); // Rilascia la risorsa nel browser
        });
        this.blobUrls.clear();
    }

    /** Distrugge le sottoscrizioni e pulisce i dati quando il servizio viene rimosso. */
    ngOnDestroy(): void {
        this.revokeAll();
        this.routerSub.unsubscribe();
    }
}