import { Component, inject } from '@angular/core';
import { AppearanceService } from '../../services/appearance.service';

/**
 * Catalogo visivo sempre presente dei componenti UI di base (colori, tipografia, bottoni, badge,
 * alert, form). Vive nell'Engine (non nella home Dominio): sopravvive a un "eject" (`node
 * setup.mjs`) come unico pezzo della demo pensato per un pubblico non-dev che deve restarci
 * consultabile. Stringhe fisse in inglese apposta (non `| translate`): un catalogo di nomi di
 * classi Bootstrap non è contenuto multilingua — stessa nomenclatura ovunque.
 */
@Component({
  selector: 'app-style-guide',
  templateUrl: './style-guide.component.html',
})
export class StyleGuideComponent {
  readonly theme = inject(AppearanceService);
}
