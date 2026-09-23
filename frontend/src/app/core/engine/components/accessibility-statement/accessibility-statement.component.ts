import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import type { ContenutoNonAccessibile } from '../../legal/legal-pages';

/** Stato di conformità della Dichiarazione di accessibilità: senza contenuti non accessibili il testo pieno
 *  (WCAG 2.1 AA, European Accessibility Act), con voci il testo sulle criticità seguito dall'elenco. */
@Component({
    selector: 'app-accessibility-statement',
    imports: [TranslatePipe, MarkdownPipe],
    template: `
        <h2>{{ 'accStatoTitolo' | translate }}</h2>
        @if (nonAccessibili().length === 0) {
            <div [innerHTML]="('accConforme' | translate) | markdown"></div>
        } @else {
            <div [innerHTML]="('accCriticita' | translate) | markdown"></div>
            <ul>
                @for (c of nonAccessibili(); track c.descrizioneKey) {
                    <li>
                        <strong>{{ motivoKey[c.motivo] | translate }}:</strong> {{ c.descrizioneKey | translate }}
                        @if (c.alternativaKey) {
                            <br><span class="text-body-secondary">{{ 'accAlternativa' | translate }}: {{ c.alternativaKey | translate }}</span>
                        }
                    </li>
                }
            </ul>
        }
    `,
})
export class AccessibilityStatementComponent {
    readonly nonAccessibili = input.required<readonly ContenutoNonAccessibile[]>();

    protected readonly motivoKey: Record<ContenutoNonAccessibile['motivo'], string> = {
        'non-conformita': 'accMotivoNonConformita',
        'onere-sproporzionato': 'accMotivoOnere',
        'fuori-ambito': 'accMotivoFuoriAmbito',
    };
}
