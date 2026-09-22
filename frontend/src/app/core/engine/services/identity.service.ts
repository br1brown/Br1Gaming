import { computed, Injectable } from '@angular/core';
import { Identity } from '../dto/identity.dto';
import { BaseApiService } from './base-api.service';

/** Sorgente condivisa dell'identità del sito (`GET /identity`): una sola `httpResource` per tutta
 *  l'app, ri-fetchata al cambio lingua. `identity()` è `null` se il sito non la configura o il
 *  backend è giù — i consumer nascondono da sé le sezioni relative. */
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
