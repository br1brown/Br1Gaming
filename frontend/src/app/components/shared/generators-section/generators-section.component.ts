import { Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { CardGridComponent, CardEntry } from '../card-grid/card-grid.component';
import { PageDirective } from '../../../core/engine/directives/page.directive';
import { ApiService } from '../../../core/services/api.service';
import { PageType } from '../../../site';

/**
 * slug del generatore → PageType della sua pagina. Unico punto in cui, dall'elenco che arriva dal
 * backend, si selezionano i generatori "catalogati" (quelli con una pagina propria) e li si collega
 * alla loro rotta. Esportata così che chi rende l'elenco non ripeta la mappa.
 */
export const GENERATOR_PAGE_TYPES: Partial<Record<string, PageType>> = {
    'incel': PageType.GeneratorIncel,
    'startup': PageType.GeneratorStartup,
    'auto': PageType.GeneratorAuto,
    'antiveg': PageType.GeneratorAntiveg,
    'locali': PageType.GeneratorLocali,
    'kebab': PageType.GeneratorKebab,
    'mbeb': PageType.GeneratorMbeb,
    'oroscopo': PageType.GeneratorOroscopo,
};

/**
 * Sezione "Generatori": titolo + griglia di card dei generatori, con la CTA verso i Piaciuti
 * (che ne raccolgono gli output, quindi vivono accanto). È la "lista di generatori" riusabile sia in
 * home sia nella pagina dedicata `/generatori`: recupera da sé l'elenco (resource reattiva, attiva
 * anche in SSR) e fa il mapping slug→card/rotta — chi la ospita non deve passarle i dati.
 */
@Component({
    selector: 'app-generators-section',
    imports: [TranslatePipe, CardGridComponent, PageDirective],
    templateUrl: './generators-section.component.html',
})
export class GeneratorsSectionComponent {
    private readonly api = inject(ApiService);

    /** Classi di colonna passate alla griglia (le sezioni a mezza pagina passano 'col-12'). */
    readonly itemColClass = input('col-12 col-md-6');
    /** Mostra la CTA verso i Piaciuti. Default: true (vivono accanto ai generatori). */
    readonly showPiaciutiCta = input(true);

    /** Per il link interno nel template (CTA verso i Piaciuti). */
    protected readonly PageType = PageType;
    /** Slot per lo scheletro mostrato durante il caricamento. */
    protected readonly skeletonSlots = [0, 1, 2, 3];

    /** Catalogo generatori: la sezione se lo carica da sé (reattivo + SSR). */
    private readonly resource = this.api.generatorsResource();
    /** true finché l'elenco è in caricamento (per non mostrare "vuoto" mentre arriva). */
    readonly loading = this.resource.isLoading;

    /** Solo i generatori con una pagina propria, mappati a card pronte per la griglia. */
    readonly cards = computed<CardEntry[]>(() =>
        (this.resource.value() ?? [])
            .filter(g => g.slug in GENERATOR_PAGE_TYPES)
            .map(g => ({
                title: g.name,
                subtitle: g.description ?? null,
                imageId: `generator.${g.slug}`,
                pageType: GENERATOR_PAGE_TYPES[g.slug]!,
            }))
    );
}
