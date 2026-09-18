import { Component, inject } from '@angular/core';
import { AppearanceService } from '../../services/appearance.service';

/**
 * StyleGuideComponent — catalogo visivo SEMPRE presente dei componenti UI di base
 * (colori, tipografia, bottoni, badge, alert, form).
 *
 * Si chiamava "Design System Gallery": rinominato per liberare quel nome per il concetto vero e
 * proprio di design system (`DesignSystemPreset`, `design-system-presets.ts`) — questo componente
 * non ha niente a che fare con quello, è solo una pagina-catalogo dell'estetica corrente.
 *
 * Vive nell'Engine (non nella home Dominio) apposta per un motivo preciso: è l'unico pezzo della
 * demo pensato per un pubblico non-dev (designer, Art Director) che deve restare consultabile
 * anche in un progetto "eject" (`node setup.mjs` → parti pulito), quando il resto della demo viene
 * rimosso. Essendo Engine si aggiorna dal template come qualunque altro componente qui dentro.
 *
 * Stringhe fisse (inglese, non `| translate`) apposta: un catalogo di "com'è fatta la grafica"
 * (nomi di classi Bootstrap, scale tipografiche) non è contenuto che abbia senso mostrare in più
 * lingue — è già la stessa nomenclatura ovunque (Bootstrap stesso non traduce "Primary"/"Danger"),
 * e il pubblico qui (designer/Art Director) legge la stessa unica versione a prescindere dalla
 * lingua del sito.
 *
 * Nessun codice di esempio: a differenza delle sezioni demo della home (che mostrano lo snippet
 * agli sviluppatori loggati), questo componente è puramente visivo — l'Engine non può dipendere
 * da servizi di Dominio come AuthService, e comunque il pubblico primario qui non legge codice.
 */
@Component({
  selector: 'app-style-guide',
  templateUrl: './style-guide.component.html',
})
export class StyleGuideComponent {
  readonly theme = inject(AppearanceService);
}
