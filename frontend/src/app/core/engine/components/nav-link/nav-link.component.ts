import { Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { injectCurrentUrl } from '../../routing';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { NavLink } from '../../shell-nav';

/** Atomo presentazionale per il singolo link di navigazione, con i tre rami: esterno (`<a href
 *  target="_blank" rel="noopener noreferrer">`), rotta corrente (`<span aria-current="page">`, non
 *  cliccabile), interno (`<a [routerLink]>`) — centralizza l'a11y e la marcatura "rotta attiva" così
 *  i contenitori (footer-nav, navbar) si concentrano solo sul proprio layout. `activeCssClass`
 *  (opzionale) si appende a `cssClass` solo quando la rotta corrisponde. */
@Component({
    selector: 'app-nav-link',
    standalone: true,
    imports: [RouterLink, TranslatePipe],
    templateUrl: './nav-link.component.html',
})
export class NavLinkComponent {
    private readonly router = inject(Router);
    private readonly currentUrl = injectCurrentUrl();

    readonly link = input.required<NavLink>();
    readonly cssClass = input<string>('');
    readonly activeCssClass = input<string>('');

    /** Notifica il click su un elemento navigabile (esterno/interno). Lo span attivo non emette. */
    readonly linkClick = output<void>();

    readonly isActive = computed(() => {
        this.currentUrl(); // dipendenza signal: re-eval ad ogni navigazione
        return this.router.isActive(this.link().path, {
            paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored',
        });
    });

    readonly resolvedClass = computed(() => {
        const base = this.cssClass();
        const active = this.activeCssClass();
        return this.isActive() && active ? `${base} ${active}`.trim() : base;
    });

    onClick(): void {
        this.linkClick.emit();
    }
}
