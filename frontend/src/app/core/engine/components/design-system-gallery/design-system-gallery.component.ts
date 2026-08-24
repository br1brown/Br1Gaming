import { Component, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * DesignSystemGalleryComponent — catalogo visivo SEMPRE presente dei componenti UI di base
 * (colori, tipografia, bottoni, badge, alert, form).
 *
 * Vive nell'Engine (non nella home Dominio) apposta per un motivo preciso: è l'unico pezzo della
 * demo pensato per un pubblico non-dev (designer, Art Director) che deve restare consultabile
 * anche in un progetto "eject" (`node setup.mjs` → parti pulito), quando il resto della demo viene
 * rimosso. Essendo Engine si aggiorna dal template come qualunque altro componente qui dentro, e
 * le sue stringhe vivono in `basic.{lang}.json` (Engine) invece che in `addon.{lang}.json`
 * (Dominio, azzerato dall'eject).
 *
 * Nessun codice di esempio: a differenza delle sezioni demo della home (che mostrano lo snippet
 * agli sviluppatori loggati), questo componente è puramente visivo — l'Engine non può dipendere
 * da servizi di Dominio come AuthService, e comunque il pubblico primario qui non legge codice.
 */
@Component({
  selector: 'app-design-system-gallery',
  imports: [TranslatePipe],
  templateUrl: './design-system-gallery.component.html',
})
export class DesignSystemGalleryComponent {
  readonly theme = inject(ThemeService);
}
