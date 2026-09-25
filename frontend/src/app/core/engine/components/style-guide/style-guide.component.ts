import { Component, inject } from '@angular/core';
import { AppearanceService } from '../../services/appearance.service';
import { BusyIconComponent } from '../busy-icon/busy-icon.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { LoadingComponent } from '../loading/loading.component';

/** Catalogo visivo del design system (colori, scale, controlli, stati). Vive nell'Engine: sopravvive
 *  a un "eject" come pezzo della demo consultabile da un pubblico non-dev. Stringhe fisse in
 *  inglese (non `| translate`): nomi di classi non sono contenuto multilingua. */
@Component({
  selector: 'app-style-guide',
  imports: [BusyIconComponent, EmptyStateComponent, LoadingComponent],
  templateUrl: './style-guide.component.html',
  styleUrl: './style-guide.component.scss',
})
export class StyleGuideComponent {
  readonly theme = inject(AppearanceService);
  protected readonly spaceSteps = [1, 2, 3, 4, 5] as const;
}
