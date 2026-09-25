import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldErrorDirective } from '../../../core/engine/directives/field-error.directive';
import { BusyIconComponent } from '../../../core/engine/components/busy-icon/busy-icon.component';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { BaseLoginFormComponent } from '../../../core/engine/components/base/base-login-form.component';

/** Esempio di Dominio: stesso login dell'Engine (`app-login-form`), ma con username visibile e
 *  digitabile invece che fisso a 'admin' e nascosto. Estende `BaseLoginFormComponent` e dichiara
 *  solo il proprio template: stesso selector dell'originale, sostituirlo è un cambio di import,
 *  non di markup consumer. */
@Component({
    selector: 'app-login-form',
    imports: [ReactiveFormsModule, TranslatePipe, FieldErrorDirective, BusyIconComponent],
    templateUrl: './login-form.component.html',
})
export class LoginFormComponent extends BaseLoginFormComponent {}
