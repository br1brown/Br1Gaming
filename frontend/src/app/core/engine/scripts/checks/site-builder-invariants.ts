/** Invarianti di SiteBuilder che un merge o una modifica a site.ts potrebbero rompere senza
 *  accorgersene: `auditPaths` (Pa11y/Lighthouse) deve restare SOLO lingua default (vedi
 *  `isLiveAuditEndpoint` in siteBuilder.ts — altrimenti gli audit live raddoppiano di durata in
 *  silenzio), la sitemap l'opposto, multi-lingua (hreflang) quando il sito ne configura più di
 *  una. Uso: tsx site-builder-invariants.ts (wrapper: scripts/test/site-builder-check.sh). */

// Richiesto per importare site.ts fuori da un bundle Angular: alcuni injectable delle librerie
// Angular (es. PlatformLocation) vanno in JIT senza il compiler già caricato.
import '@angular/compiler';
import { ContestoSito } from '../../../../site';
import { environment } from '../../../../../environments/environment';

const { defaultLang, availableLanguages } = environment;
const otherLangs = availableLanguages.filter(lang => lang !== defaultLang);

let failures = 0;
function fail(message: string): void {
    console.error(`[site-builder-check] ${message}`);
    failures++;
}

// tsx transpila questo script a CJS: niente top-level await, l'import dinamico verso
// security-headers.ts (sotto) richiede una funzione async.
async function main(): Promise<void> {
    const auditPaths = ContestoSito.getAuditPaths();

    for (const path of auditPaths) {
        const firstSegment = path.split('/')[1] ?? '';
        if (otherLangs.includes(firstSegment)) {
            fail(`auditPaths contiene una variante non-default: "${path}" — gli audit live (Pa11y/Lighthouse) devono restare alla sola lingua di default ("${defaultLang}").`);
        }
    }

    if (new Set(auditPaths).size !== auditPaths.length) {
        fail('auditPaths contiene path duplicati.');
    }

    if (otherLangs.length > 0) {
        const langsInSitemap = new Set(ContestoSito.getSitemapEntries().map(entry => entry.lang));
        for (const lang of availableLanguages) {
            if (!langsInSitemap.has(lang)) {
                fail(`la sitemap non ha alcuna entry per la lingua "${lang}" — hreflang incompleto.`);
            }
        }
    }

    // Il controllo di integrità di security-headers.json vive in un solo posto (security-headers.ts,
    // che lo esegue al load del modulo): lo importiamo invece di riderivarlo qui, per non avere due
    // implementazioni indipendenti che possono divergere.
    try {
        await import('../../server/security-headers');
    } catch (err: unknown) {
        fail(`Controllo di integrità di security-headers.json fallito: ${(err as Error).message}`);
    }

    if (failures > 0) {
        console.error(`[site-builder-check] ${failures} invariante/i violata/e`);
        process.exit(1);
    }

    console.log(`[site-builder-check] OK — ${auditPaths.length} auditPaths, sitemap copre ${availableLanguages.length} lingua/e, security-headers hash corretto`);
}

main();

