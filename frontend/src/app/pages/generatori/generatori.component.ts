import { Component } from '@angular/core';
import { GeneratorsSectionComponent } from '../../components/shared/generators-section/generators-section.component';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';

/**
 * Pagina dedicata all'elenco dei generatori: rende la stessa "lista di generatori" della home
 * (`app-generators-section`, che si carica da sé i dati) come pagina a sé, all'URL `/generatori`.
 * Predisposta per accogliere in futuro la ricerca; per ora è solo la lista. Estende la base solo
 * per i meta SEO (titolo/descrizione da `site.ts`): il contenuto lo recupera la sezione.
 */
@Component({
    selector: 'app-generatori',
    imports: [GeneratorsSectionComponent],
    templateUrl: './generatori.component.html',
})
export class GeneratoriComponent extends PageBaseComponent<unknown> { }
