import { isDevMode, type Type } from '@angular/core';
import type { Identity, OpeningHours } from './dto/identity.dto';
import type { TranslateService } from './services/translate.service';
import type { LocalizationService } from './services/localization.service';
import { hasOpeningHours } from './components/opening-hours/opening-hours.component';
import { PhoneContactComponent } from './components/phone-contact/phone-contact.component';
import { MailContactComponent } from './components/mail-contact/mail-contact.component';
import { PecContactComponent } from './components/pec-contact/pec-contact.component';
import { BadgeTone, formatAddress, formatCurrency, hasText } from './identity-format';
import { FooterField } from './footer-field';

export { FooterField } from './footer-field';

/** Trattamento visivo di un valore testuale: testo semplice, monospace "da codice" (P.IVA, REA...),
 *  o badge (booleani). Un canale di contatto cliccabile (telefono/email/pec) non è un `itemKind`:
 *  è una foglia `kind: 'custom'` che delega a `app-phone-contact`/`app-mail-contact`/
 *  `app-pec-contact` (`contactComponentLeaf`), non un `<a>` reinventato qui con la propria icona/colore. */
export type FooterItemKind = 'text' | 'code' | 'badge';

/** Foglia risolta dentro un gruppo del footer: link/pagina, valore mappato o libero, orari, social esplicito, o un sottogruppo annidato. Discriminata su `kind` per evitare ambiguità fra varianti con campi opzionali condivisi. */
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

/** Chiave i18n della label per ciascun `FooterField`: footer automatico, campi dichiarati a mano in `nav.ts`
 *  e sezione identità delle pagine legali mostrano sempre la stessa etichetta. */
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

/** Contatto cliccabile (telefono/email/pec): foglia `kind: 'custom'` che delega ad `app-phone-contact`/`app-mail-contact`/`app-pec-contact`, non un `<a>` reinventato con propria icona/colore — un `<a class="link-body-emphasis">` scritto a mano aveva già causato un bug di contrasto reale (`--bs-emphasis-color !important` batteva `color: inherit`). */
function contactComponentLeaf(
    component: Type<unknown>,
    value: string | null | undefined,
    label: string,
    inputKey: 'number' | 'config',
    itemClass?: string,
): FooterGroupChild | null {
    if (!hasText(value)) return null;
    const trimmed = value.trim();
    const contactInput = inputKey === 'number' ? trimmed : { to: trimmed };
    return {
        kind: 'custom',
        component,
        inputs: { [inputKey]: contactInput, label, showLabel: true, showValue: true },
        itemClass,
    };
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

/** `LegalRole` (titolare del trattamento / DPO) in zero, una o due foglie: il nome come testo
 *  semplice, l'email come contatto cliccabile (`contactComponentLeaf`, stesso componente di
 *  `FooterField.Email`), stessa etichetta per entrambe. */
function legalRoleLeaves(label: string, role: { nome?: string; email?: string } | undefined, itemClass?: string): FooterGroupChild[] {
    return [
        valueLeaf(label, role?.nome, 'text', itemClass),
        contactComponentLeaf(MailContactComponent, role?.email, label, 'config', itemClass),
    ].filter((leaf): leaf is FooterGroupChild => leaf !== null);
}

/** Valori e contatti dei `FooterField` dati, nell'ordine: un campo non valorizzato non produce voci (es. la
 *  sezione identità in coda alle pagine legali). */
export function resolveFooterFields(
    fields: readonly FooterField[], identity: Identity | null, deps: FooterFieldDeps,
): Extract<FooterGroupChild, { kind: 'value' | 'custom' }>[] {
    if (!identity) return [];
    return fields
        .flatMap(field => resolveFooterField(field, identity, deps))
        .filter((leaf): leaf is Extract<FooterGroupChild, { kind: 'value' | 'custom' }> => leaf.kind === 'value' || leaf.kind === 'custom');
}

/** Risolve un `FooterField` sull'`Identity` in zero, una o due foglie (solo `PartitaIvaCodiceFiscale` può produrne due). Array vuoto = campo non valorizzato, il gruppo che lo contiene lo scarta. */
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
        // Flag "negativo": essere in liquidazione è un campanello → Sì in warning.
        case FooterField.InLiquidazione: return arr(boolLeaf(label, ds?.inLiquidazione, deps.translate, itemClass, { onTrue: 'warning', onFalse: 'secondary' }));
        case FooterField.SedeLegale: return arr(valueLeaf(label, formatAddress(identity.sedeLegale, deps.localization), 'text', itemClass));
        case FooterField.Telefono: return arr(contactComponentLeaf(PhoneContactComponent, identity.contatti?.telefono, label, 'number', itemClass));
        case FooterField.Email: return arr(contactComponentLeaf(MailContactComponent, identity.contatti?.email, label, 'config', itemClass));
        case FooterField.Pec: return arr(contactComponentLeaf(PecContactComponent, identity.contatti?.pec, label, 'config', itemClass));
        case FooterField.RappresentanteLegale: return arr(valueLeaf(label, identity.rappresentanteLegale, 'text', itemClass));
        case FooterField.TitolareDelTrattamento: return legalRoleLeaves(label, identity.titolareDelTrattamento, itemClass);
        case FooterField.ResponsabileProtezioneDati: return legalRoleLeaves(label, identity.responsabileProtezioneDati, itemClass);
        case FooterField.OpeningHours:
            return hasOpeningHours(identity.openingHours) ? [{ kind: 'hours', label, hours: identity.openingHours!, itemClass }] : [];
        default:
            // Esaustività: un nuovo valore di FooterField senza un case qui è un errore di sviluppo,
            // non uno stato raggiungibile in produzione (l'enum è chiuso, definito in questo stesso file).
            if (isDevMode()) console.warn(`[FooterField] Nessuna risoluzione per il valore "${FooterField[field]}".`);
            return [];
    }
}
