import { afterNextRender, booleanAttribute, Component, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DayName, DAY_ORDER, OpeningHours } from '../../../core/engine/dto/identity.dto';
import { LocalizationService } from '../../../core/engine/services/localization.service';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';

/** Una riga della tabella orari: giorno + fasce del giorno (vuoto = chiuso) + se è oggi. */
interface DayRow {
    day: DayName;
    name: string;
    ranges: string[];
    isToday: boolean;
}

/**
 * OPENING HOURS COMPONENT
 *
 * Rende gli orari (lista di intervalli per-giorno) come tabella "alla Google": una riga per ciascun
 * giorno della settimana, con le fasce del giorno o "Chiuso", e il giorno corrente in grassetto. I
 * dati arrivano già strutturati (OpeningInterval[]): qui si deriva solo la presentazione. I nomi
 * giorno escono nella lingua corrente (LocalizationService, via Intl).
 *
 * Autonomo: si inietta da sé la cultura, il consumer passa solo i dati. Se `label` è valorizzata fa
 * da intestazione. Si nasconde da sé se nessun giorno ha una fascia valida (`hasOpeningHours`). Il
 * giorno "oggi" è risolto solo lato browser (afterNextRender) per non sporcare l'idratazione SSR
 * (il fuso del server può differire da quello del visitatore).
 */
@Component({
    selector: 'app-opening-hours',
    standalone: true,
    imports: [TranslatePipe, NgTemplateOutlet],
    templateUrl: './opening-hours.component.html',
    // Accordion su <details> nativo (il progetto non bundla il JS di Bootstrap): stato via [open], niente
    // .accordion-item/.accordion-button di BS (ridipingerebbero un rettangolo chiaro sul footer navy).
    // th: si toglie grassetto/centrato di default del browser → il peso lo decide la riga (grassetto solo
    // "oggi", per ereditarietà), l'allineamento eredita dalla tabella. Hover col currentColor: theme-safe.
    styles: [`
        th { font-weight: inherit; text-align: inherit; }
        summary { cursor: pointer; list-style: none; }
        summary::-webkit-details-marker { display: none; }
        summary:hover { background-color: color-mix(in srgb, currentColor 8%, transparent); }
        details[open] .oh-caret { transform: rotate(180deg); }
        @media (prefers-reduced-motion: no-preference) { .oh-caret { transition: transform .2s ease; } }
    `],
})
export class OpeningHoursComponent {
    // Primitivi di cultura (nomi giorno) derivati via Intl dal LocalizationService.
    private readonly localization = inject(LocalizationService);

    readonly hours = input<OpeningHours | null | undefined>();
    /** Intestazione (già tradotta) sopra la tabella; vuota = nessuna intestazione. */
    readonly label = input('');
    /** true = accordion collassabile (footer compatto: header con stato Aperto/Chiuso di oggi); false
     *  (default) = tabella settimanale piena, sempre visibile (pagine legali). Solo la forma cambia. */
    readonly accordion = input(false, { transform: booleanAttribute });

    // "Oggi" risolto solo nel browser: su SSR resta null (nessuna riga in grassetto), il client lo
    // imposta dopo l'idratazione → nessun mismatch server/client anche con fusi orari diversi.
    private readonly today = signal<DayName | null>(null);

    constructor() {
        afterNextRender(() => this.today.set(DAY_BY_JS_INDEX[new Date().getDay()]));
    }

    /** True se c'è almeno una fascia valida da mostrare (predice la visibilità per il consumer). */
    readonly open = computed<boolean>(() => hasOpeningHours(this.hours()));

    /** Le 7 righe (Lun→Dom): nome giorno localizzato, fasce valide del giorno (in ordine di
     *  dichiarazione, più fasce = pausa) o vuoto = chiuso, e il flag "oggi". */
    readonly rows = computed<DayRow[]>(() => {
        const list = this.hours() ?? [];
        const dayNames = this.localization.dayNamesLong();
        const today = this.today();

        // Fasce valide raggruppate per giorno → "09:00–18:00", in ordine di dichiarazione.
        const byDay = new Map<DayName, string[]>();
        for (const it of list) {
            if (!it || !DAY_ORDER.includes(it.day) || !isHm(it.opens) || !isHm(it.closes)) continue;
            const range = `${it.opens}–${it.closes}`;
            const ranges = byDay.get(it.day);
            if (ranges) ranges.push(range);
            else byDay.set(it.day, [range]);
        }

        return DAY_ORDER.map(day => ({
            day,
            name: dayNames[day] ?? day,
            ranges: byDay.get(day) ?? [],
            isToday: day === today,
        }));
    });

    /** Riga di oggi (per il riepilogo nell'header dell'accordion), o null finché "oggi" non è risolto (SSR). */
    readonly todayRow = computed<DayRow | null>(() => this.rows().find(r => r.isToday) ?? null);
}

/** Nome `DayOfWeek` per indice di `Date.getDay()` (0=Domenica). Per marcare "oggi" senza mappe locale. */
const DAY_BY_JS_INDEX: readonly DayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Orario "HH:mm" (24h). Difesa contro valori sporchi (sorgente esterna/CMS) prima di renderli. */
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function isHm(value: unknown): value is string {
    return typeof value === 'string' && HM_RE.test(value);
}

/** True se la lista ha almeno una fascia valida → il componente renderà qualcosa. Predice la
 *  visibilità per il consumer (che decide il proprio wrapper) senza rieseguire il raggruppamento. */
export function hasOpeningHours(list: OpeningHours | null | undefined): boolean {
    return Array.isArray(list) && list.some(it => !!it && DAY_ORDER.includes(it.day) && isHm(it.opens) && isHm(it.closes));
}
