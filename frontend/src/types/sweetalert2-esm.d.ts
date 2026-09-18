// sweetalert2 dichiara i tipi solo per l'entry point principale ('sweetalert2'), non per il
// sottopercorso 'dist/sweetalert2.esm.js' che notification.service.ts importa dinamicamente (per
// evitare l'auto-injection del CSS senza nonce — vedi il commento lì). Sotto la configurazione di
// tsc del build principale (bundler moduleResolution via @angular/build:application) questo si
// risolve senza avviso; sotto @angular/build:unit-test (vitest) il typecheck è più severo su un
// sottopercorso senza dichiarazione propria — questo shim è la soluzione minima, suggerita
// direttamente dal compilatore (TS7016), non un problema introdotto da questo file.
declare module 'sweetalert2/dist/sweetalert2.esm.js' {
    export { default } from 'sweetalert2';
}
