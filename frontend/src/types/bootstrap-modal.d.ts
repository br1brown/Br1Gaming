// bootstrap tipizza solo il bundle: shim minimo per la sola Modal importata dai sorgenti ESM
// (js/src) da notification.service.ts, così da non portarsi dietro Popper e gli altri componenti.
declare module 'bootstrap/js/src/modal.js' {
    export default class Modal {
        constructor(element: Element, options?: { backdrop?: boolean | 'static'; keyboard?: boolean; focus?: boolean });
        show(): void;
        hide(): void;
        dispose(): void;
    }
}
