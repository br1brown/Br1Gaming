import { inject, EnvironmentInjector } from '@angular/core';
import type { ResolveFn, RedirectCommand } from '@angular/router';

/**
 * Avvolge un import dinamico in una ResolveFn lazy-loaded compatibile con Angular DI.
 *
 * Garantisce che:
 * - Angular DI non venga caricato durante script Node.js (generate-statics.ts):
 *   il dynamic import scatta solo quando il router attiva la route.
 * - inject() funzioni correttamente all'interno del resolver importato:
 *   l'EnvironmentInjector viene catturato sincronamente nel contesto di iniezione
 *   Angular, poi ripristinato via runInContext() prima di chiamare il resolver reale.
 *
 * OBBLIGATORIO per qualsiasi resolver dichiarato nel campo `resolve` di LeafPageInput.
 * Un import statico causerebbe un errore JIT a build time; un import dinamico
 * senza questa utility causerebbe NG0203 a runtime.
 *
 * Uso tipico in site.ts:
 *   resolve: {
 *     myData: lazyResolver(() =>
 *       import('./core/services/my.resolver').then(m => m.myResolver(arg))
 *     ),
 *   }
 */
export function lazyResolver<T>(
    loadResolver: () => Promise<ResolveFn<T>>
): ResolveFn<T> {
    return (route, state) => {
        const injector = inject(EnvironmentInjector);
        return loadResolver().then(fn =>
            injector.runInContext(() => fn(route, state) as T | RedirectCommand)
        );
    };
}
