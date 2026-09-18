import { isDevMode, type Type } from '@angular/core';
import type { Identity, OpeningHours } from './dto/identity.dto';
import type { TranslateService } from './services/translate.service';
import type { LocalizationService } from './services/localization.service';
import { hasOpeningHours } from './components/opening-hours/opening-hours.component';
import { BadgeTone, formatAddress, formatCurrency, hasText } from './identity-format';

/**
 * FOOTER CONTENT
 *
 * L'engine possiede per intero la forma di `Identity` (GET /identity): sa quali campi esistono,
 * come si chiamano nei cataloghi i18n e come si formattano. `FooterField` rende questa conoscenza
 * utilizzabile dal resolver del footer di un progetto (`nav.ts`) senza che il figlio debba
 * conoscere né la chiave di traduzione né la forma esatta di `Identity`: dichiara solo "voglio la
 * P.IVA qui" (`g.addField(FooterField.PartitaIva)`), l'engine pesca il valore, lo formatta e — se
 * il campo non è valorizzato per quel sito — lo fa sparire da solo (nessuna colonna con un'etichetta
 * e niente sotto).
 *
 * Fuori da questo elenco: i social (`addSocialLink`, sempre espliciti — un URL non è "un campo",
 * e filtrare/scegliere quali mostrare è decisione del progetto, non dell'engine) e qualunque
 * contenuto che l'engine non può conoscere a priori (`addText`, chiave/valore libero).
 */
export enum FooterField {
    RagioneSociale,
    PartitaIva,
    CodiceFiscale,
    /** P.IVA e Codice Fiscale, un campo solo: se coincidono (caso comune, ditta individuale) una
     *  riga sola "Codice Fiscale / P.IVA", altrimenti le due righe separate — stessa dedup di
     *  `app-identity-render`. Alternativa ad usare `PartitaIva`/`CodiceFiscale` separati: la scelta
     *  è del progetto, non c'è una combinazione "giusta" a priori. */
    PartitaIvaCodiceFiscale,
    RegistroImprese,
    NumeroRea,
    CodiceSdi,
    CapitaleSociale,
    CapitaleVersato,
    SocioUnico,
    InLiquidazione,
    SedeLegale,
    Telefono,
    Email,
    Pec,
    RappresentanteLegale,
    TitolareDelTrattamento,
    ResponsabileProtezioneDati,
    OpeningHours,
}

/** Trattamento visivo di un valore testuale: testo semplice, monospace "da codice" (P.IVA, REA...),
 *  o badge (oggi usato per i booleani, non più imposto come unico stile disponibile). */
export type FooterItemKind = 'text' | 'code' | 'badge';

/**
 * Foglia risolta dentro un gruppo del footer: un link/pagina vera, un valore mappato da `Identity`
 * (`addField`) o libero (`addText`), gli orari (resi dal componente dedicato) o un social esplicito
 * (`addSocialLink`) — oppure un sottogruppo annidato con lo stesso set di possibilità.
 * Discriminata su `kind`, non su forma strutturale: evita ambiguità fra varianti che altrimenti
 * condividerebbero campi opzionali.
 */
export type FooterGroupChild =
    | { kind: 'link'; label: string; path: string; isExternal: boolean; queryParams?: Record<string, string>; authOnly?: boolean; itemClass?: string }
    | { kind: 'value'; label: string; value: string; itemKind: FooterItemKind; tone?: BadgeTone; itemClass?: string }
    | { kind: 'hours'; label: string; hours: OpeningHours; itemClass?: string }
    | { kind: 'social'; url: string; label?: string; itemClass?: string }
    | { kind: 'custom'; component: Type<unknown>; inputs?: Record<string, unknown>; itemClass?: string; authOnly?: boolean; key?: string }
    | { kind: 'group'; label: string; authOnly?: boolean; itemClass?: string; children: FooterGroupChild[] };

/** Voce di primo livello del footer: solo link/pagina o gruppo — `addField`/`addText`/`addSocialLink`
 *  esistono solo dentro un `addGroup` (vedi `FooterGroupBuilder`), mai sciolti in cima come i gruppi. */
export type FooterEntry =
    | Extract<FooterGroupChild, { kind: 'link' }>
    | Extract<FooterGroupChild, { kind: 'group' }>;

/** Servizi necessari a risolvere un `FooterField` in un valore mostrabile: iniettati una volta da
 *  chi chiama (`ShellNavService`), non da questo modulo — resta testabile senza contesto Angular. */
export interface FooterFieldDeps {
    translate: TranslateService;
    localization: LocalizationService;
}

/** Chiave i18n della label per ciascun `FooterField` — le stesse chiavi già usate da
 *  `identity-render.component.ts`, cosicché il blocco automatico e i campi dichiarati a mano in
 *  `nav.ts` mostrino sempre la stessa etichetta. */
const FOOTER_FIELD_LABEL_KEYS: Record<FooterField, string> = {
    [FooterField.RagioneSociale]: 'ragioneSocialeAzienda',
    [FooterField.PartitaIva]: 'partitaIvaAzienda',
    [FooterField.CodiceFiscale]: 'codiceFiscaleAzienda',
    // Usata solo quando P.IVA e CF NON coincidono (il ramo "coincidono" usa la chiave composita
    // sotto, per restare un'unica label già tradotta — vedi resolveFooterField).
    [FooterField.PartitaIvaCodiceFiscale]: 'partitaIvaAzienda',
    [FooterField.RegistroImprese]: 'registroImpreseAzienda',
    [FooterField.NumeroRea]: 'numeroReaAzienda',
    [FooterField.CodiceSdi]: 'codiceSdiAzienda',
    [FooterField.CapitaleSociale]: 'capitaleSocialeAzienda',
    [FooterField.CapitaleVersato]: 'capitaleVersatoAzienda',
    [FooterField.SocioUnico]: 'socioUnicoAzienda',
    [FooterField.InLiquidazione]: 'inLiquidazioneAzienda',
    [FooterField.SedeLegale]: 'sedeLegaleAzienda',
    [FooterField.Telefono]: 'telefonoAzienda',
    [FooterField.Email]: 'emailAzienda',
    [FooterField.Pec]: 'pecAzienda',
    [FooterField.RappresentanteLegale]: 'rappresentanteLegaleAzienda',
    [FooterField.TitolareDelTrattamento]: 'titolareDelTrattamentoAzienda',
    [FooterField.ResponsabileProtezioneDati]: 'responsabileProtezioneDatiAzienda',
    [FooterField.OpeningHours]: 'orariContattoAzienda',
};

function valueLeaf(label: string, value: string | null | undefined, itemKind: FooterItemKind, itemClass?: string): FooterGroupChild | null {
    return hasText(value) ? { kind: 'value', label, value: value.trim(), itemKind, itemClass } : null;
}

function boolLeaf(
    label: string,
    value: boolean | null | undefined,
    translate: TranslateService,
    itemClass?: string,
    tones: { onTrue: BadgeTone; onFalse: BadgeTone } = { onTrue: 'success', onFalse: 'secondary' },
): FooterGroupChild | null {
    if (typeof value !== 'boolean') return null;
    return {
        kind: 'value',
        label,
        value: translate.translate(value ? 'siAzione' : 'noAzione'),
        itemKind: 'badge',
        tone: value ? tones.onTrue : tones.onFalse,
        itemClass,
    };
}

/** `null`/`undefined` → array vuoto, un valore → array a un elemento: normalizza il caso comune
 *  (un campo produce zero o una foglia) per lo stesso tipo di ritorno del caso raro (due foglie,
 *  vedi `PartitaIvaCodiceFiscale`). */
function arr(leaf: FooterGroupChild | null): FooterGroupChild[] {
    return leaf ? [leaf] : [];
}

/**
 * Risolve un `FooterField` sull'`Identity` del sito in zero, una o due foglie (solo
 * `PartitaIvaCodiceFiscale` può produrne due — tutti gli altri campi sono a un valore). Array
 * vuoto = campo non valorizzato per questo sito: chi chiama (il gruppo che lo contiene) lo scarta,
 * esattamente come un `addPage` che non risolve — vedi `resolveFooterItems` in `shell-nav.ts`.
 */
export function resolveFooterField(field: FooterField, identity: Identity, deps: FooterFieldDeps, itemClass?: string): FooterGroupChild[] {
    // Chiave i18n grezza, NON tradotta qui: come `NavLink.label`/`addText`, la label passa sempre dal
    // template (`| translate`) — tradurla anche qui produrrebbe un doppio-translate ("key not found")
    // dato che `addField` e `addText` finiscono nella stessa foglia `{ kind: 'value' }`.
    const label = FOOTER_FIELD_LABEL_KEYS[field];
    const ds = identity.datiSocietari;

    switch (field) {
        case FooterField.RagioneSociale: return arr(valueLeaf(label, identity.ragioneSociale, 'text', itemClass));
        case FooterField.PartitaIva: return arr(valueLeaf(label, identity.partitaIva, 'code', itemClass));
        case FooterField.CodiceFiscale: return arr(valueLeaf(label, identity.codiceFiscale, 'code', itemClass));
        case FooterField.PartitaIvaCodiceFiscale: {
            const piva = identity.partitaIva?.trim();
            const cf = identity.codiceFiscale?.trim();
            if (hasText(piva) && piva === cf) {
                return arr(valueLeaf('codiceFiscalePartitaIvaAzienda', piva, 'code', itemClass));
            }
            return [
                valueLeaf(FOOTER_FIELD_LABEL_KEYS[FooterField.PartitaIva], identity.partitaIva, 'code', itemClass),
                valueLeaf(FOOTER_FIELD_LABEL_KEYS[FooterField.CodiceFiscale], identity.codiceFiscale, 'code', itemClass),
            ].filter((leaf): leaf is FooterGroupChild => leaf !== null);
        }
        case FooterField.RegistroImprese: return arr(valueLeaf(label, ds?.registroImprese, 'text', itemClass));
        case FooterField.NumeroRea: return arr(valueLeaf(label, ds?.numeroRea, 'code', itemClass));
        case FooterField.CodiceSdi: return arr(valueLeaf(label, ds?.codiceSdi, 'code', itemClass));
        case FooterField.CapitaleSociale: return arr(valueLeaf(label, formatCurrency(ds?.capitaleSociale, identity.currency, deps.localization), 'text', itemClass));
        case FooterField.CapitaleVersato: return arr(boolLeaf(label, ds?.capitaleInteramenteVersato, deps.translate, itemClass));
        case FooterField.SocioUnico: return arr(boolLeaf(label, ds?.isSocioUnico, deps.translate, itemClass));
        // Flag "negativo": essere in liquidazione è un campanello → Sì in warning (stessa scelta di identity-render).
        case FooterField.InLiquidazione: return arr(boolLeaf(label, ds?.inLiquidazione, deps.translate, itemClass, { onTrue: 'warning', onFalse: 'secondary' }));
        case FooterField.SedeLegale: return arr(valueLeaf(label, formatAddress(identity.sedeLegale, deps.localization), 'text', itemClass));
        case FooterField.Telefono: return arr(valueLeaf(label, identity.contatti?.telefono, 'text', itemClass));
        case FooterField.Email: return arr(valueLeaf(label, identity.contatti?.email, 'text', itemClass));
        case FooterField.Pec: return arr(valueLeaf(label, identity.contatti?.pec, 'text', itemClass));
        case FooterField.RappresentanteLegale: return arr(valueLeaf(label, identity.rappresentanteLegale, 'text', itemClass));
        case FooterField.TitolareDelTrattamento: return arr(valueLeaf(label, identity.titolareDelTrattamento?.nome, 'text', itemClass));
        case FooterField.ResponsabileProtezioneDati: return arr(valueLeaf(label, identity.responsabileProtezioneDati?.nome, 'text', itemClass));
        case FooterField.OpeningHours:
            return hasOpeningHours(identity.openingHours) ? [{ kind: 'hours', label, hours: identity.openingHours!, itemClass }] : [];
        default:
            // Esaustività: un nuovo valore di FooterField senza un case qui è un errore di sviluppo,
            // non uno stato raggiungibile in produzione (l'enum è chiuso, definito in questo stesso file).
            if (isDevMode()) console.warn(`[FooterField] Nessuna risoluzione per il valore "${FooterField[field]}".`);
            return [];
    }
}
