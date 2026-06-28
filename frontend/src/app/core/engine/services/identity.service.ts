import { computed, Injectable } from '@angular/core';
import { Identity } from '../dto/identity.dto';
import { BaseApiService } from './base-api.service';

/**
 * IDENTITY SERVICE
 *
 * Sorgente condivisa dell'identità del sito (GET /identity): dati legali, social del brand e
 * natura dell'entità. Un'unica `httpResource` per tutta l'app — footer, pagine legali e SEO
 * (PageMetaService) leggono da qui, così l'identità si fetcha una sola volta per lingua invece
 * che a ogni consumer. Si rifetcha al cambio lingua (Accept-Language nell'header).
 *
 * In SSR la risorsa è risolta prima della serializzazione: i dati strutturati JSON-LD finiscono
 * già nell'HTML server-rendered. Identità assente (sito che non la configura, o backend giù) →
 * `identity()` è `null` e i consumer nascondono da sé le sezioni relative.
 */
@Injectable({ providedIn: 'root' })
export class IdentityService extends BaseApiService {
    private readonly resource = this.api_resource<Identity>('identity');

    /**
     * Identità corrente, o `null` se non configurata / non ancora caricata / in errore.
     * `hasValue()` è `false` in stato d'errore: leggere `value()` lì lancerebbe, quindi si ricade su null.
     */
    readonly identity = computed<Identity | null>(() =>
        this.resource.hasValue() ? this.resource.value() ?? null : null);

    /** `true` mentre la risorsa è in caricamento (per eventuali placeholder). */
    readonly loading = this.resource.isLoading;
}
