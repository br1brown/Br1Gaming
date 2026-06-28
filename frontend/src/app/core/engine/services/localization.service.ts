import { computed, Injectable } from '@angular/core';
import { SiteLocalization, LanguageOption } from '../dto/localization.dto';
import { BaseApiService } from './base-api.service';

/**
 * LOCALIZATION SERVICE
 *
 * Sorgente condivisa dei primitivi di localizzazione (GET /localization): tag BCP-47 corrente, nomi
 * giorno e lingue supportate coi nomi nativi. Derivano dalle culture .NET del backend (`EngineCultures`),
 * non da config né da mappe hardcoded nel frontend.
 *
 * Stesso pattern di `IdentityService`: un'unica `httpResource` per tutta l'app, risolta in SSR e
 * ri-fetchata al cambio lingua (Accept-Language nell'header). Il footer ne deriva la resa di
 * orari/valuta, il selettore lingua i nomi nativi. Backend giù / non risolta → signal coi fallback
 * (cultura corrente del frontend), così la UI non si rompe.
 */
@Injectable({ providedIn: 'root' })
export class LocalizationService extends BaseApiService {
    private readonly resource = this.api_resource<SiteLocalization>('localization');

    private readonly data = computed<SiteLocalization | null>(() =>
        this.resource.hasValue() ? this.resource.value() ?? null : null);

    /** Tag BCP-47 specifico della lingua corrente (es. "it-IT"), o `null` finché non risolto. */
    readonly current = computed<string | null>(() => this.data()?.current ?? null);

    /** Nomi giorno abbreviati per codice Mo..Su nella lingua corrente; `{}` finché non risolto. */
    readonly dayNames = computed<Record<string, string>>(() => this.data()?.dayNames ?? {});

    /** Lingue supportate coi nomi nativi; `[]` finché non risolto. */
    readonly languages = computed<readonly LanguageOption[]>(() => this.data()?.languages ?? []);

    /** Nome nativo di una lingua dal codice (es. "it" → "Italiano"); fallback al codice in MAIUSCOLO. */
    readonly nameOf = computed<(code: string) => string>(() => {
        const map = new Map(this.languages().map(l => [l.code, l.name]));
        return (code: string) => map.get(code) ?? code.toUpperCase();
    });
}
