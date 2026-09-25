import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { IconComponent, readableForegroundColor } from '../icon/icon.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslateService } from '../../services/translate.service';

/** Presentazionale: unico template del link "a badge" (icona-pastiglia + testo opzionale); nuova
 *  scheda solo per i link web (non mailto/tel). Le famiglie contatti/social passano solo i dati. */
@Component({
    selector: 'app-link-badge',
    standalone: true,
    imports: [IconComponent, TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './link-badge.component.html',
    styleUrl: './link-badge.component.scss',
    host: {
        // Allineati al centro, non alla linea di base: un glifo grande (disco) o un logo immagine
        // non deve spostare il link di qualche pixel rispetto ai vicini.
        class: 'align-middle',
        '[class.d-inline-flex]': '!fullWidth()',
        '[class.d-flex]': 'fullWidth()',
    },
})
export class LinkBadgeComponent {
    private readonly translate = inject(TranslateService);
    readonly href = input.required<string>();
    readonly glyph = input.required<string>();
    readonly color = input<string | null>(null);
    /** Colore del glifo (e del testo nella variante 'button') prescritto dal brand; null = per contrasto. */
    readonly glyphColor = input<string | null>(null);
    /** Composizione del glifo (`IconMode`) e logo a colori al posto del glifo: vedi `IconComponent`. */
    readonly glyphMode = input<'glyph' | 'disc'>('glyph');
    readonly glyphImage = input<string | null>(null);
    /** Stile visivo: 'badge' (icona tonda, testo a fianco) o 'button' (pill button unico) */
    readonly variant = input<'badge' | 'button'>('badge');
    /** Testo visibile accanto all'icona (label oppure contenuto). */
    readonly text = input<string>('');
    /** Se rendere il testo. */
    readonly showText = input(false);
    /** Etichetta descrittiva per title/aria-label (es. "PEC"), distinta dal testo. */
    readonly ariaLabel = input<string>('');
    readonly fullWidth = input(false);
    /** Disposizione di icona e testo. 'row' (default): sempre riga. 'responsive': colonna su mobile, riga su sm+. */
    readonly layout = input<'responsive' | 'row'>('row');

    /** Override opzionale: se presente, sostituisce la navigazione al click. */
    readonly action = input<() => void | Promise<void>>();

    /** Nuova scheda solo per un vero link web: `mailto:`/`tel:` aprono un'app, e con `action` il
     *  click non naviga affatto — dire "si apre in una nuova scheda" sarebbe falso. */
    protected readonly opensNewTab = computed(() => !this.action() && /^https?:/i.test(this.href()));

    /** Nome accessibile quando il testo non è visibile: l'etichetta più l'avviso di nuova scheda,
     *  lo stesso che NavLinkComponent dà ai link esterni. */
    protected readonly accessibleLabel = computed(() => {
        const label = this.ariaLabel();
        return this.opensNewTab() ? `${label} (${this.translate.translate('apreNuovaSchedaNav')})` : label;
    });

    /** Testo della variante 'button' su un colore brand: quello del brand se dichiarato, altrimenti
     *  nero o bianco, il più leggibile. */
    protected readonly buttonTextColor = computed(() => readableForegroundColor(this.color(), this.glyphColor()));

    protected handleClick(event: MouseEvent): void {
        const fn = this.action();
        if (!fn) return; // nessun override: naviga normalmente via href
        event.preventDefault();
        const result = fn();
        if (result instanceof Promise) result.catch(() => { /* gestione a carico del chiamante */ });
    }
}
