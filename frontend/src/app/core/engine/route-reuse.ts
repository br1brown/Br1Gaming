import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

/** Chiave di `route.data` con cui `routing.ts` porta qui il campo `keepOldInstance` della pagina in site.ts. */
export const KEEP_OLD_INSTANCE_DATA_KEY = 'keepOldInstance';

/**
 * Una pagina = una istanza. Di serie Angular riusa il componente quando due URL cadono sulla stessa
 * rotta (`/generatori/a` → `/generatori/b`) e riesegue solo il resolver: lo stato locale della pagina
 * precedente sopravvive. Qui la rotta si riusa solo se anche i parametri di percorso coincidono;
 * i query param non contano (cambiare un filtro non ricrea la pagina).
 */
export class EngineRouteReuseStrategy extends BaseRouteReuseStrategy {
    override shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
        if (!super.shouldReuseRoute(future, curr)) return false;
        if (future.data[KEEP_OLD_INSTANCE_DATA_KEY] === true) return true;
        return sameParams(future.params, curr.params);
    }
}

function sameParams(a: Record<string, string>, b: Record<string, string>): boolean {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(k => a[k] === b[k]);
}
