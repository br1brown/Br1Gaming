import { Component, computed } from '@angular/core';
import { SocialLinkComponent } from '../../core/engine/components/social-link/social-link.component';
import { EmptyStateComponent } from '../../core/engine/components/empty-state/empty-state.component';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';

@Component({
    selector: 'app-social',
    imports: [SocialLinkComponent, EmptyStateComponent],
    templateUrl: './social.component.html'
})
export class SocialComponent extends PageBaseComponent<Record<string, string>> {
    readonly socialLinks = computed(() =>
        Object.entries(this.pageContent() ?? {}).map(([type, url]) => ({ type, url }))
    );
}
