import { Component } from '@angular/core';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { StyleGuideComponent } from '../../core/engine/components/style-guide/style-guide.component';
import { ContestoSito } from '../../site';

/** Home: solo hero + catalogo stile (style guide). Il resto della demo vive in `CheFaccioComponent`
 *  (`/che-faccio`, `/en/what-i-do`). */
@Component({
    selector: 'app-home',
    imports: [
        TranslatePipe,
        StyleGuideComponent,
    ],
    templateUrl: './home.component.html',
})
export class HomeComponent extends PageBaseComponent<void> {
    readonly appName = ContestoSito.config.appName;

    readonly heroStats = [
        { value: 8,  label: 'heroStatServices' },
        { value: 5,  label: 'heroStatDirectives' },
        { value: 6,  label: 'heroStatComponents' },
        { value: 5,  label: 'heroStatQrTypes' },
    ] as const;
}
