import { afterNextRender, booleanAttribute, Component, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DayName, DAY_ORDER, OpeningHours } from '../../dto/identity.dto';
import { LocalizationService } from '../../services/localization.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { isValidOpeningInterval } from '../../identity-format';

/** Una riga della tabella orari: giorno + fasce del giorno (vuoto = chiuso) + se è oggi. */
interface DayRow {
    day: DayName;
    name: string;
    ranges: string[];
    isToday: boolean;
}

/** Rende gli orari come tabella "alla Google": riga per giorno, oggi in grassetto. "Oggi" risolto
 *  solo lato browser (afterNextRender): il fuso server ≠ visitatore sporcherebbe l'SSR. */
@Component({
    selector: 'app-opening-hours',
    standalone: true,
    imports: [TranslatePipe, NgTemplateOutlet],
    templateUrl: './opening-hours.component.html',
    // Accordion su <details> nativo (niente JS Bootstrap bundlato): mai .accordion-item/-button BS,
    // ridipingerebbero un rettangolo chiaro sul footer navy. th sciolto dai default per farlo ereditare.
    styles: [`
        th { font-weight: inherit; text-align: inherit; }
        summary { cursor: pointer; list-style: none; }
        summary::-webkit-details-marker { display: none; }
        summary:hover { background-color: color-mix(in srgb, currentColor 8%, transparent); }
        details[open] .oh-caret { transform: rotate(180deg); }
        .oh-caret { transition: transform var(--movimentoMicro, 0.15s) ease; }
        @media (prefers-reduced-motion: reduce) { .oh-caret { transition: none; } }
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
            if (!isValidOpeningInterval(it)) continue;
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

/** True se la lista ha almeno una fascia valida → il componente renderà qualcosa. Predice la
 *  visibilità per il consumer (che decide il proprio wrapper) senza rieseguire il raggruppamento. */
export function hasOpeningHours(list: OpeningHours | null | undefined): boolean {
    return Array.isArray(list) && list.some(isValidOpeningInterval);
}
