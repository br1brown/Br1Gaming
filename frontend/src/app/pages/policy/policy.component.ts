import { Component, computed } from '@angular/core';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import { PageBaseComponent } from '../page-base.component';

/**
 * Componente riusabile per tutte le pagine legali.
 * Il contenuto arriva da ContentResolverService (auto-applicato da app.routes.ts):
 * serializzato in SSR, aggiornato sul browser ad ogni cambio lingua da PageBaseComponent.
 */
@Component({
    selector: 'app-policy',
    imports: [MarkdownPipe],
    templateUrl: './policy.component.html',
    styleUrl: './policy.component.css'
})
export class PolicyComponent extends PageBaseComponent {
    readonly displayContent = computed(() => this.pageContent() as string ?? '');
}
