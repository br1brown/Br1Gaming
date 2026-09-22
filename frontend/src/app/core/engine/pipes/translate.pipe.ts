import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '../services/translate.service';

/** `{{ 'chiave' | translate }}` / `{{ 'benvenuto' | translate: nomeUtente }}`. `pure: false`: le
 *  traduzioni cambiano quando cambia la lingua, ma la chiave resta la stessa — una pipe pura non
 *  rileverebbe il cambiamento (cambia il dizionario interno, non l'input). */
@Pipe({
    name: 'translate',
    pure: false
})
export class TranslatePipe implements PipeTransform {
    private readonly translateService = inject(TranslateService);

    transform(key: string, ...args: unknown[]): string {
        return this.translateService.translate(key, ...args);
    }
}
