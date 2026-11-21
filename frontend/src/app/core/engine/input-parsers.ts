/**
 * Lettura tollerante di numeri scritti a mano in un campo di testo, come li scrive e li incolla la gente.
 * Funzioni pure: `null` = campo vuoto, `NaN` = non è un numero (né si può indovinare). Il controllo dell'intervallo
 * e il messaggio d'errore restano a chi le usa (un validatore del form, un filtro…).
 *
 * Il solo punto in cui la lingua conta è l'ambiguità di un separatore unico seguito da tre cifre («1.200», «1,200»):
 * nella lingua `locale` si legge come migliaia se quel carattere è il suo separatore di migliaia, come decimale altrimenti.
 * Di serie `'it'` (il punto separa le migliaia, la virgola i decimali); `'en'` fa il contrario. Gli altri casi non sono ambigui.
 */

export interface LooseNumberOptions {
    /** La lingua con cui sciogliere l'ambiguità di «1.200» / «1,200». Di serie `'it'`. */
    locale?: string;
    /** Un separatore unico seguito da tre cifre vale come migliaia (di serie sì). Spento per coordinate e misure: «44.512» è un grado e mezzo, non quarantamila. */
    thousands?: boolean;
}

const isEmpty = (v: unknown): boolean => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** Solo testo e numeri si leggono: un oggetto o un array «40» non è un campo di testo. */
const asText = (v: unknown): string | null => typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : null;

/** Il separatore di migliaia e quello dei decimali nella lingua (solo `.` o `,`: gli spazi si tolgono prima di leggere). */
function separators(locale: string): { group: '.' | ','; decimal: '.' | ',' } {
    let decimal: '.' | ',';
    try {
        decimal = new Intl.NumberFormat(locale).formatToParts(1.5).find(p => p.type === 'decimal')?.value === ',' ? ',' : '.';
    } catch {
        decimal = ',';   // lingua non valida: come l'italiano
    }
    return { decimal, group: decimal === ',' ? '.' : ',' };
}

const esc = (c: string): string => '\\' + c;

/** `1.000`, `12.345.678` (o con la virgola): gruppi da tre cifre, il primo da una a tre, senza zero iniziale. */
const groupedInteger = (group: string): RegExp => new RegExp(`^[1-9]\\d{0,2}(?:${esc(group)}\\d{3})+$`);

/**
 * Un intero scritto come lo scrive la gente: «40», «40 letti», «circa 40», «40+», «~40», «1.000». Una cifra sola,
 * eventualmente con parole intorno (staccate da spazi): «4O» (con la lettera O), «30-40», «40/50», «2,5» non sono un numero solo e non si indovinano.
 */
export function parseLooseInteger(text: unknown, options: Pick<LooseNumberOptions, 'locale'> = {}): number | null {
    if (isEmpty(text)) return null;
    const raw = asText(text);
    if (raw === null) return Number.NaN;
    if (groupedInteger(separators(options.locale ?? 'it').group).test(raw)) return Number(raw.replace(/[.,]/g, ''));
    const parts = raw.split(/\s+/);
    const numbers = parts.filter(p => /^[~≈]?\d{1,9}\+?$/.test(p));
    const others = parts.filter(p => !numbers.includes(p));
    if (numbers.length !== 1 || !others.every(p => /^[\p{L}.,:;'’()-]+$/u.test(p))) return Number.NaN;
    return Number(numbers[0].replace(/[~≈+]/g, ''));
}

/**
 * Un numero decimale scritto come lo scrive la gente: «13», «13,50», «13.5», «.5», «6 €», «€6», «6 euro», «1.200», «1.200,50», «1,200.50».
 * Con due separatori diversi l'ultimo è il decimale e l'altro, se è messo bene (gruppi da tre cifre), separa le migliaia.
 */
export function parseLooseDecimal(text: unknown, options: LooseNumberOptions | boolean = {}): number | null {
    if (isEmpty(text)) return null;
    const raw = asText(text);
    if (raw === null) return Number.NaN;
    const opts: LooseNumberOptions = typeof options === 'boolean' ? { thousands: options } : options;   // la vecchia forma: il secondo argomento era `thousands`
    const { group } = separators(opts.locale ?? 'it');
    const thousands = opts.thousands ?? true;

    const t = raw.toLowerCase().replace(/€|(?<!\p{L})(?:euro|eur)(?!\p{L})/gu, '').replace(/[\s°]+/g, '');
    const negative = t.startsWith('-');
    const body = negative ? t.slice(1) : t;
    if (!/^[\d.,]*\d[\d.,]*$/.test(body)) return Number.NaN;

    const dots = (body.match(/\./g) ?? []).length;
    const commas = (body.match(/,/g) ?? []).length;
    let value: string;
    if (dots > 0 && commas > 0) {
        // Il separatore decimale è l'ultimo dei due: l'altro separa le migliaia, e dev'essere messo bene («1.2.000,5» non è un numero).
        const dec = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ',';
        const grp = dec === '.' ? ',' : '.';
        const cut = body.lastIndexOf(dec);
        const intPart = body.slice(0, cut);
        const fraction = body.slice(cut + 1);
        if (!groupedInteger(grp).test(intPart) || !/^\d+$/.test(fraction)) return Number.NaN;
        value = intPart.split(grp).join('') + '.' + fraction;
    } else if (dots + commas > 0) {
        const sep = dots > 0 ? '.' : ',';
        const count = dots + commas;
        if (sep === group && thousands && groupedInteger(sep).test(body)) value = body.split(sep).join('');
        else if (count === 1) value = body.replace(sep, '.');   // un separatore solo: decimale («6.5», «6,5», «.5», «5.»)
        else return Number.NaN;
    } else {
        value = body;
    }
    if (!/^(?:\d+\.?\d*|\.\d+)$/.test(value)) return Number.NaN;
    const n = Number(value);
    return negative ? -n : n;
}

/**
 * Una coordinata scritta come la copia la gente: «44.5», «44,5», «44.5°», «44.5 N», «3.2 W».
 * La lettera finale è la direzione: S e W cambiano il segno, N ed E no. Gradi, primi e secondi («44° 30' N») non si leggono.
 */
export function parseLooseCoordinate(text: unknown): number | null {
    if (isEmpty(text)) return null;
    const raw = asText(text);
    if (raw === null) return Number.NaN;
    const direction = /\s*([nNeEsSwW])$/.exec(raw)?.[1]?.toLowerCase();
    const n = parseLooseDecimal(direction ? raw.replace(/\s*[nNeEsSwW]$/, '') : raw, { thousands: false });
    if (n === null || Number.isNaN(n)) return n;
    if (direction === 's' || direction === 'w') return n > 0 ? -n : Number.NaN;   // «-44.5 S» è contraddittorio
    return n;
}
