/** `collectFieldErrors`: il nome del campo perde asterisco e due punti dell'etichetta, il messaggio resta com'è scritto. */
import { describe, it, expect } from 'vitest';
import { collectFieldErrors } from '../core/engine/components/error-summary/form-errors';

describe('collectFieldErrors', () => {
    it('etichetta ripulita, messaggio con la sua punteggiatura', () => {
        const root = document.createElement('div');
        root.innerHTML = `
            <label for="num">Numero della carta *:</label>
            <input id="num" aria-invalid="true" aria-describedby="num-err">
            <div id="num-err" class="invalid-feedback">  Inserisci il numero: da 13 a 19 cifre.  </div>`;
        document.body.appendChild(root);
        expect(collectFieldErrors(root)).toEqual([{ id: 'num', label: 'Numero della carta', message: 'Inserisci il numero: da 13 a 19 cifre.' }]);
        root.remove();
    });
});
