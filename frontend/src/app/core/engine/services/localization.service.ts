import { computed, inject, Injectable } from '@angular/core';
import { LanguageOption } from '../dto/localization.dto';
import { DAY_ORDER } from '../dto/identity.dto';
import { LocaleFormatter } from './formatter';
import { TranslateService } from './translate.service';

/**
 * LOCALIZATION SERVICE
 *
 * Hub UNICO della cultura: tutto ciò che dipende dal locale e non è testo tradotto. È interamente
 * front-end e derivato da `Intl` (ECMA-402 / CLDR, disponibile in browser e in SSR): tag locale,
 * formattazione (`formatter`: date, numeri, valuta, regioni), nomi giorno abbreviati e nomi nativi
 * delle lingue. NIENTE round-trip al backend: la cultura la fa lo standard di piattaforma, quindi il
 * frontend è autonomo (funziona anche offline, sempre corretto) e disaccoppiato da come il backend
 * gestisce la propria cultura.
 *
 * Divisione dei ruoli: `TranslateService` possiede lo STATO lingua (quale lingua, cambio lingua,
 * elenco `availableLangs` da config); questo servizio ne deriva la CULTURA con `Intl`. Tutto è
 * reattivo: al cambio lingua i signal si ricalcolano da soli, senza fetch.
 */
@Injectable({ providedIn: 'root' })
export class LocalizationService {
    private readonly translate = inject(TranslateService);

    /** Locale corrente per le API di formattazione. È la lingua stessa: `Intl` la accetta come tag
     *  BCP-47 e applica le convenzioni della regione predefinita (it→Italia, en→USA…). Reattivo. */
    readonly locale = computed<string>(() => this.translate.currentLang());

    /** Formattazione culture-aware (date, numeri, valuta, regioni) legata al locale corrente.
     *  Punto UNICO: i componenti fanno `localization.formatter.date(d)` / `.currency(v, 'EUR')`…
     *  senza vedere `Intl`. Cambiare motore qui sotto non tocca i chiamanti. */
    readonly formatter = new LocaleFormatter(() => this.locale());

    /** Nomi giorno abbreviati per `DayName` (Monday..Sunday) nella lingua corrente, derivati da Intl.
     *  Chiavi allineate a `DAY_ORDER` così `dayNames[giorno]` funziona nei consumer (orari footer). */
    readonly dayNames = computed<Record<string, string>>(() => this.weekdayNames('short'));

    /** Come `dayNames` ma in forma estesa ("lunedì"/"Monday"): per liste giorno per esteso (tabella orari). */
    readonly dayNamesLong = computed<Record<string, string>>(() => this.weekdayNames('long'));

    /** Nomi giorno per `DayName` nella lingua corrente, nello stile richiesto. Base: 1 gen 2024 = lunedì. */
    private weekdayNames(style: 'short' | 'long'): Record<string, string> {
        const fmt = new Intl.DateTimeFormat(this.locale(), { weekday: style, timeZone: 'UTC' });
        const monday = Date.UTC(2024, 0, 1);
        const out: Record<string, string> = {};
        DAY_ORDER.forEach((day, i) => { out[day] = fmt.format(new Date(monday + i * 86_400_000)); });
        return out;
    }

    /** Lingue disponibili (codici da `availableLangs`, config) col nome nativo derivato da Intl. */
    readonly languages = computed<readonly LanguageOption[]>(() =>
        this.translate.availableLangs().map(code => ({ code, name: this.nativeName(code) })));

    /** Nome nativo di una lingua dal codice (es. "it" → "Italiano"); fallback al codice in MAIUSCOLO. */
    readonly nameOf = computed<(code: string) => string>(() => {
        const map = new Map(this.languages().map(l => [l.code, l.name]));
        return (code: string) => map.get(code) ?? code.toUpperCase();
    });

    /** Nome nativo di una lingua (nella lingua stessa), con l'iniziale maiuscola. */
    private nativeName(code: string): string {
        try {
            const name = new Intl.DisplayNames([code], { type: 'language' }).of(code);
            return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : code.toUpperCase();
        } catch {
            return code.toUpperCase();
        }
    }
}
