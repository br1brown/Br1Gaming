/**
 * Il pacchetto sweetalert2 pubblica i tipi solo per l'entry bare ('sweetalert2', che risolve a
 * dist/sweetalert2.all.js). notification.service.ts importa invece dist/sweetalert2.esm.js (build
 * senza auto-injection del CSS via <style> — vedi il commento lì) per compatibilità con la CSP del
 * template: stessa forma di export, quindi si ri-esportano qui i tipi già presenti nel pacchetto.
 */
declare module 'sweetalert2/dist/sweetalert2.esm.js' {
    const Swal: typeof import('sweetalert2').default;
    export default Swal;
}
