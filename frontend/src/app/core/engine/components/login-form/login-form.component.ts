import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { BaseLoginFormComponent } from '../base/base-login-form.component';

/** Form di login riusabile (default dell'Engine): campo password (username fisso, nascosto),
 *  validazione, autenticazione ed errore inline. Componente UI puro — non naviga, non conosce le
 *  rotte; al login riuscito emette `loggedIn`, il contenitore decide cosa fare. Un figlio che vuole
 *  un markup diverso estende `BaseLoginFormComponent` col proprio concreto in `components/shared/`. */
@Component({
    selector: 'app-login-form',
    imports: [ReactiveFormsModule, TranslatePipe],
    templateUrl: './login-form.component.html',
})
export class LoginFormComponent extends BaseLoginFormComponent {
    constructor() {
        super();
        // Il campo username di questo default è nascosto (vedi template): la base parte da ''
        // per non imporre 'admin' a chi estende BaseLoginFormComponent con uno username visibile
        // (components/shared/login-form/) — solo QUESTO concreto ne ha bisogno, per il login demo
        // a credenziali fisse.
        this.loginForm.controls.username.setValue('admin');
    }
}
