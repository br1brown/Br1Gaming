import { Injectable, inject, isDevMode } from '@angular/core';
import { ContestoSito, PageType } from '../../../site';
import { applyPathParams, isParentPage, resolveLangPrefix, resolvePagePath, type ParentPage, type SitePage } from '../siteBuilder';
import { TranslateService } from './translate.service';
import { type BreadcrumbItem } from './breadcrumb-jsonld';

export { type BreadcrumbItem, toJsonLdTrail } from './breadcrumb-jsonld';

/** Contesto per la risoluzione del breadcrumb. */
export interface BreadcrumbContext {
    lang: string;
    params: Record<string, string>;
    /** Titolo risolto per la rotta/richiesta corrente. */
    currentTitle?: string;
}

/** Risale l'albero per raccogliere gli antenati del PageType. */
function findAncestors(nodes: readonly SitePage[], type: PageType, trail: ParentPage[] = []): ParentPage[] | null {
    for (const node of nodes) {
        if (isParentPage(node)) {
            const found = findAncestors(node.children, type, [...trail, node]);
            if (found) return found;
        } else if (node.pageType === type) {
            return trail;
        }
    }
    return null;
}

/** Servizio per la generazione del percorso breadcrumb (UI e JSON-LD). */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
    private readonly translate = inject(TranslateService);

    /** Calcola il trail del breadcrumb per il PageType specificato. */
    trailFor(type: PageType, ctx: BreadcrumbContext): BreadcrumbItem[] {
        const override = ContestoSito.config.resolveBreadcrumb?.(type, ctx) ?? null;
        if (override) return override;

        const info = ContestoSito.getPageInfo(type, ctx.lang);
        if (!info || info.isExternal) return [];

        if (type === ContestoSito.config.homePage) {
            return [{
                label: ctx.currentTitle || this.translate.translate(info.title),
                path: applyPathParams(info.path, ctx.params, 'BreadcrumbService.trailFor'),
            }];
        }

        let currentAbsPath = this.rootPath(ctx.lang);
        const trail: BreadcrumbItem[] = [
            { label: this.translate.translate('breadcrumbHome'), path: currentAbsPath },
        ];

        const ancestors: SitePage[] = findAncestors(ContestoSito.pages, type) ?? [];
        
        // Fallback per rotte piatte con slash nel path: funziona solo se esiste un'altra pagina
        // dichiarata esattamente su ogni prefisso — avvisa in dev quando un prefisso resta senza
        // corrispondenza, così un buco nel trail non passa inosservato.
        if (ancestors.length === 0 && info.path) {
            const targetStr = resolvePagePath(info.path, ctx.lang, this.translate.defaultLang);
            if (targetStr && targetStr.includes('/')) {
                const segments = targetStr.split('/');
                let currentPrefix = '';
                for (let i = 0; i < segments.length - 1; i++) {
                    currentPrefix = currentPrefix ? `${currentPrefix}/${segments[i]}` : segments[i];
                    const virtualParent = ContestoSito.pages.find(p => {
                        if (isParentPage(p)) return false;
                        return resolvePagePath(p.path, ctx.lang, this.translate.defaultLang) === currentPrefix;
                    });
                    if (virtualParent) {
                        ancestors.push(virtualParent);
                    } else if (isDevMode()) {
                        console.warn(`[BreadcrumbService] nessuna pagina dichiarata su "${currentPrefix}": il breadcrumb per "${targetStr}" salta questo livello.`);
                    }
                }
            }
        }

        let prependTitle = '';
        const finalAbsPath = applyPathParams(info.path, ctx.params, 'BreadcrumbService.trailFor');
        
        for (const parent of ancestors) {
            let seg = parent.path ? resolvePagePath(parent.path, ctx.lang, this.translate.defaultLang) : '';
            if (seg) seg = applyPathParams(seg, ctx.params, 'BreadcrumbService.trailFor');

            if (seg) {
                currentAbsPath = `${currentAbsPath.replace(/\/$/, '')}/${seg}`;
            }

            // Se non navigabile, collassa il titolo nel segmento successivo
            const isNavigable = !isParentPage(parent) || parent.children?.some(c =>
                (c.path ? resolvePagePath(c.path, ctx.lang, this.translate.defaultLang) : '') === ''
            );
            
            const translatedTitle = this.translate.translate(parent.title);
            const label = prependTitle ? `${prependTitle} - ${translatedTitle}` : translatedTitle;
            
            if (seg && isNavigable) {
                if (currentAbsPath !== finalAbsPath) {
                    trail.push({ label, path: currentAbsPath });
                }
                prependTitle = '';
            } else {
                prependTitle = label;
            }
        }

        const finalTitle = ctx.currentTitle || this.translate.translate(info.title);
        trail.push({
            label: prependTitle ? `${prependTitle} - ${finalTitle}` : finalTitle,
            path: finalAbsPath,
        });
        return trail;
    }

    /** Path della radice per la lingua specificata. */
    private rootPath(lang: string): string {
        const { homePage } = ContestoSito.config;
        const fromHome = homePage ? ContestoSito.getPath(homePage, lang) : null;
        return fromHome ?? (resolveLangPrefix(lang, this.translate.defaultLang) || '/');
    }
}
