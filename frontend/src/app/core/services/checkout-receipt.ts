/** Dati già pronti (formattati) di una ricevuta di pagamento. */
export interface ReceiptView {
    lang: string;
    merchant: string;
    labels: { ricevuta: string; numero: string; data: string; totale: string; pagato: string };
    numero: string;
    data: string;
    righe: { label: string; note?: string; icon?: string; importo: string }[];
    iva?: { label: string; importo: string };
    totale: string;
    nota?: string;
}

/** Escape per il testo HTML: ricevute e voci arrivano dall'URL del checkout, quindi niente va nel documento senza passare da qui. */
export function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Documento HTML autonomo della ricevuta (CSS in linea, nessuna risorsa esterna): si scarica come file e si apre ovunque,
 *  anche stampandolo in PDF. È un file locale, fuori dalla CSP della pagina. */
export function buildReceiptHtml(v: ReceiptView): string {
    const e = escapeHtml;
    const righe = v.righe.map(r => `
      <tr>
        <td>${e(r.label)}${r.note ? `<small>${e(r.note)}</small>` : ''}</td>
        <td class="n">${e(r.importo)}</td>
      </tr>`).join('');
    const iva = v.iva ? `
      <tr><td>${e(v.iva.label)}</td><td class="n">${e(v.iva.importo)}</td></tr>` : '';
    return `<!doctype html>
<html lang="${e(v.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(v.labels.ricevuta)} ${e(v.numero)} — ${e(v.merchant)}</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; color: #111; background: #fff; margin: 0; padding: 2rem; }
  main { max-width: 36rem; margin: 0 auto; border: 1px solid #111; padding: 1.5rem; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  h1 { font-size: 1.25rem; margin: 0; }
  h2 { font-size: .9rem; font-weight: 400; margin: 0; color: #444; }
  .pagato { border: 2px solid #111; padding: .1rem .6rem; font-weight: 700; letter-spacing: .08em; transform: rotate(-4deg); }
  dl { display: grid; grid-template-columns: auto 1fr; gap: .1rem 1rem; margin: 1rem 0; color: #444; }
  dt { font-weight: 600; } dd { margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: .4rem 0; border-bottom: 1px solid #ccc; vertical-align: top; }
  td.n { text-align: right; white-space: nowrap; padding-left: 1rem; }
  small { display: block; color: #444; font-size: .85rem; }
  tfoot td { font-weight: 700; font-size: 1.15rem; border-bottom: 0; border-top: 2px solid #111; }
  p.nota { margin: 1rem 0 0; font-style: italic; color: #444; }
</style>
</head>
<body>
<main>
  <header>
    <div><h1>${e(v.merchant)}</h1><h2>${e(v.labels.ricevuta)}</h2></div>
    <span class="pagato">${e(v.labels.pagato)}</span>
  </header>
  <dl>
    <dt>${e(v.labels.numero)}</dt><dd>${e(v.numero)}</dd>
    <dt>${e(v.labels.data)}</dt><dd>${e(v.data)}</dd>
  </dl>
  <table>
    <tbody>${righe}${iva}
    </tbody>
    <tfoot><tr><td>${e(v.labels.totale)}</td><td class="n">${e(v.totale)}</td></tr></tfoot>
  </table>${v.nota ? `
  <p class="nota">${e(v.nota)}</p>` : ''}
</main>
</body>
</html>
`;
}
