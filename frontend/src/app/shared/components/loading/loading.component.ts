import { Component, input } from '@angular/core';

@Component({
    selector: 'app-loading',
    template: `
        @if (loading()) {
            <div class="d-flex justify-content-center align-items-center py-4">
                <div class="spinner-border" role="status" aria-hidden="true"></div>
            </div>
        } @else {
            <ng-content />
        }
    `
})
export class LoadingComponent {
    readonly loading = input.required<boolean>();
}
