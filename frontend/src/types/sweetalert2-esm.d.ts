// sweetalert2 dichiara i tipi solo per l'entry point principale, non per il sottopercorso
// 'dist/sweetalert2.esm.js' che notification.service.ts importa dinamicamente (per evitare
// l'auto-injection del CSS senza nonce). Il build principale lo risolve senza avviso, ma
// @angular/build:unit-test (vitest) è più severo: questo shim è la soluzione minima, suggerita
// direttamente dal compilatore (TS7016).
declare module 'sweetalert2/dist/sweetalert2.esm.js' {
    export { default } from 'sweetalert2';
}
