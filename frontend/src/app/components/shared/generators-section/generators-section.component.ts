import { Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { CardGridComponent, CardEntry } from '../card-grid/card-grid.component';
import { PageDirective } from '../../../core/engine/directives/page.directive';
import { ApiService } from '../../../core/services/api.service';
import { PageType } from '../../../site';
import { GENERATOR_SLUG_TO_PAGE_TYPE } from '../../../pages/app.pages';

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
            .filter(g => g.slug in GENERATOR_SLUG_TO_PAGE_TYPE)
            .map(g => ({
                title: g.name,
                subtitle: g.description ?? null,
                imageId: `generator.${g.slug}`,
                pageType: GENERATOR_SLUG_TO_PAGE_TYPE[g.slug]! as PageType,
            }))
    );
}
