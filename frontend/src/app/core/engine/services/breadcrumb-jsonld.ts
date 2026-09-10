/** Adapter per la generazione di `BreadcrumbList` JSON-LD dal trail breadcrumb. */

/** Singolo livello del percorso breadcrumb. */
export interface BreadcrumbItem {
    /** Chiave i18n (o testo statico) dell'etichetta — stesso trattamento di `NavLink.label`. */
    label: string;
    /** Path interno Angular (relativo, come `ContestoSito.getPath`), assente se non navigabile. */
    path?: string;
}

/** Adatta un trail breadcrumb per la serializzazione in `BreadcrumbList` JSON-LD. */
export function toJsonLdTrail(trail: readonly BreadcrumbItem[]): BreadcrumbItem[] | null {
    if (trail.length <= 1) return null;
    if (trail[0].path && trail[0].path === trail[trail.length - 1].path) return null;

    const collapsed: BreadcrumbItem[] = [];
    let pendingLabels: string[] = [];
    for (const item of trail) {
        if (item.path) {
            collapsed.push({
                label: pendingLabels.length ? [...pendingLabels, item.label].join(' - ') : item.label,
                path: item.path,
            });
            pendingLabels = [];
        } else {
            pendingLabels.push(item.label);
        }
    }
    if (pendingLabels.length) collapsed.push({ label: pendingLabels.join(' - ') });

    return collapsed.length > 1 ? collapsed : null;
}
