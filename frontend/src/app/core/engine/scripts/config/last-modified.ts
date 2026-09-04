/**
 * Data di ultima modifica (YYYY-MM-DD), per `og:updated_time`. Fonte: `project.lastModified` in
 * global-settings.json (`GG/MM/AAAA`, da bumpare a mano). Fallback alla data corrente se assente
 * o non valida. Non usata per `<lastmod>` di sitemap.xml: una data generica identica su ogni
 * pagina non è un segnale che Google verifica, vedi `SitemapEntry.lastmod` in siteBuilder.ts.
 */
export function getLastModifiedDate(project: Record<string, unknown> | undefined): string {
    const raw = project?.['lastModified'];
    if (typeof raw === 'string') {
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
        if (m) {
            const [, dd, mm, yyyy] = m;
            const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
            // Round-trip: scarta date impossibili (es. 30/02) che Date farebbe slittare.
            const valid = !isNaN(d.getTime())
                && d.getUTCMonth() + 1 === Number(mm)
                && d.getUTCDate() === Number(dd);
            if (valid) return `${yyyy}-${mm}-${dd}`;
        }
        console.warn(`[statics] project.lastModified="${raw}" non valido (atteso GG/MM/AAAA) — uso la data odierna`);
    }
    return new Date().toISOString().slice(0, 10);
}
