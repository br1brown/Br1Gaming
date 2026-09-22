/** Whitelist di URL sicuri condivisa da `MarkdownPipe` e `MarkdownLitePipe` — stessa logica per
 *  entrambi, un solo posto da aggiornare. Deliberatamente senza import di `marked`: chi importa
 *  solo questo file non si trascina dietro l'intero parser. */

/** Senza questi check un `[x](javascript:alert(1))` produrrebbe un `href` eseguibile.
 *  Consentiamo solo schemi sicuri (e i relativi/anchor); tutto il resto viene neutralizzato. */
export function isSafeLinkUrl(url: string): boolean {
    const u = url.trim();
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u);
    if (scheme) return ['http', 'https', 'mailto', 'tel'].includes(scheme[1].toLowerCase());
    return !u.startsWith('//'); // relativi/anchor/assoluti ok; blocca i protocol-relative
}

/** Come `isSafeLinkUrl`, ma per `src` di immagini: aggiunge `data:image/` (embed comuni),
 *  esclude `mailto`/`tel` (non hanno senso come sorgente immagine). */
export function isSafeImageUrl(url: string): boolean {
    const u = url.trim();
    if (/^data:image\//i.test(u)) return true;
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u);
    if (scheme) return ['http', 'https'].includes(scheme[1].toLowerCase());
    return !u.startsWith('//');
}
