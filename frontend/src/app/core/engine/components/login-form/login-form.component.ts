import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldErrorDirective } from '../../directives/field-error.directive';
import { BusyIconComponent } from '../busy-icon/busy-icon.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { BaseLoginFormComponent } from '../base/base-login-form.component';

/** Form di login riusabile (default dell'Engine): campo password (username fisso, nascosto),
 *  validazione ed errore inline. Non naviga: al login riuscito emette `loggedIn`, decide il contenitore. */
@Component({
    selector: 'app-login-form',
    imports: [ReactiveFormsModule, TranslatePipe, FieldErrorDirective, BusyIconComponent],
    templateUrl: './login-form.component.html',
})
export class LoginFormComponent extends BaseLoginFormComponent {
    constructor() {
        super();
        // Solo questo concreto (username nascosto, login demo) forza 'admin'; la base resta '' per
        // chi estende con uno username visibile.
        this.loginForm.controls.username.setValue('admin');
    }
}
