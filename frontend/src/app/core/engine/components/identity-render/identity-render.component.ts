import { booleanAttribute, Component, computed, inject, input } from '@angular/core';
import { Identity, SocialLink } from '../../dto/identity.dto';
import { TranslateService } from '../../services/translate.service';
import { LocalizationService } from '../../services/localization.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { PhoneContactComponent } from '../phone-contact/phone-contact.component';
import { MailContactComponent, MailContactConfig } from '../mail-contact/mail-contact.component';
import { PecContactComponent } from '../pec-contact/pec-contact.component';
import { SocialLinkComponent } from '../social-link/social-link.component';
import { OpeningHoursComponent, hasOpeningHours } from '../opening-hours/opening-hours.component';
import { BadgeTone, hasText } from '../../identity-format';
import { FooterField, FooterFieldDeps, FooterGroupChild, resolveFooterField } from '../../footer-content';

type IdentityItem =
    | { kind: 'text'; label: string; value: string; itemClass?: string }
    | { kind: 'code'; label: string; value: string; itemClass?: string }
    | { kind: 'bool'; label: string; value: string; tone: BadgeTone; itemClass?: string };

interface IdentitySection {
    titleKey: string;
    items: IdentityItem[];
}

/** Canale di contatto cliccabile, reso come badge dai componenti contatto. */
type ContactChannel =
    | { kind: 'phone'; key: string; label: string; number: string }
    | { kind: 'mail'; key: string; label: string; config: MailContactConfig }
    | { kind: 'pec'; key: string; label: string; config: MailContactConfig };

/** Rende l'Identity del sito (GET /identity) in sezioni a colonne (societari, legali, contatti):
 *  ogni voce solo se valorizzata, label tradotta, markup per tipo. `[showSocial]="true"` aggiunge
 *  le icone social (footer sì, pagine legali no). */
@Component({
    selector: 'app-identity-render',
    standalone: true,
    imports: [TranslatePipe, PhoneContactComponent, MailContactComponent, PecContactComponent, SocialLinkComponent, OpeningHoursComponent],
    templateUrl: './identity-render.component.html',
})
export class IdentityRenderComponent {
    private readonly translate = inject(TranslateService);
    // Primitivi di cultura (locale + nomi giorno) derivati via Intl dal LocalizationService:
    // niente mappe lingua→regione né calcolo dei nomi giorno nel componente.
    private readonly localization = inject(LocalizationService);

    readonly identity = input.required<Identity | null>();
    readonly inColonna = input(false, { transform: booleanAttribute });
    /** Mostra le icone dei social del brand (footer sì, pagine legali no). */
    readonly showSocial = input(false, { transform: booleanAttribute });
    /** Rende gli orari come accordion collassabile (footer, compatto) invece della tabella piena
     *  sempre visibile (pagine legali). Solo la FORMA cambia: gli orari si mostrano in entrambi. */
    readonly hoursAccordion = input(false, { transform: booleanAttribute });

    // Un booleano per blocco (default true): un consumer che vuole mostrarne solo alcuni li mette a false.
    readonly showCompanyDetails = input(true, { transform: booleanAttribute });
    readonly showLegalDetails = input(true, { transform: booleanAttribute });
    readonly showContacts = input(true, { transform: booleanAttribute });
    readonly showOpeningHours = input(true, { transform: booleanAttribute });

    /** Deps di `resolveFooterField`: stessi servizi già iniettati qui, nessun provider in più. */
    private readonly footerDeps: FooterFieldDeps = { translate: this.translate, localization: this.localization };

    readonly sections = computed<IdentitySection[]>(() => {
        const identity = this.identity();
        if (!identity) return [];

        // Numero imprecisato di sezioni-dati dinamiche. La sezione "Contatti" è
        // invece dedicata e renderizzata a parte (testo + badge impilati).
        return this.compactSections([
            ...(this.showCompanyDetails() ? [{ titleKey: 'datiSocietariAzienda', items: this.identifierItems(identity) }] : []),
            ...(this.showLegalDetails() ? [{ titleKey: 'datiLegaliAzienda', items: this.legalItems(identity) }] : []),
        ]);
    });

    /** Voci testuali della sezione Contatti (nome, sede, rappresentante, cariche legali). Gli orari
     *  sono resi a parte da `app-opening-hours` (componente autonomo), non più una riga di testo qui.
     *  Stessa fonte di `FooterField.TitolareDelTrattamento`/`ResponsabileProtezioneDati`: quel campo
     *  risolve fino a due foglie (nome + email), qui prendiamo solo quella `kind: 'value'` (il nome —
     *  l'email finisce invece in `contacts()`, badge cliccabile, non testo). */
    readonly contactItems = computed<IdentityItem[]>(() => {
        const identity = this.identity();
        if (!identity || !this.showContacts()) return [];
        return [
            ...this.valueItems(FooterField.RagioneSociale, identity),
            ...this.valueItems(FooterField.SedeLegale, identity),
            ...this.valueItems(FooterField.RappresentanteLegale, identity),
            ...this.valueItems(FooterField.TitolareDelTrattamento, identity),
            ...this.valueItems(FooterField.ResponsabileProtezioneDati, identity),
        ];
    });

    /** Orari (via `app-opening-hours`): richiesti da `showOpeningHours` e con dati presenti. */
    readonly showOpeningHoursSection = computed<boolean>(() =>
        this.showOpeningHours() && hasOpeningHours(this.identity()?.openingHours));

    /** Indica se la colonna Contatti (testo + badge, SENZA orari — colonna a sé) ha qualcosa da mostrare. */
    readonly hasContactInfo = computed<boolean>(() => this.contactItems().length > 0 || this.contacts().length > 0);

    /** Indica se c'è qualcosa da mostrare fra contatti e orari, sommati (usato per il gate dell'intera riga). */
    readonly hasContacts = computed<boolean>(() => this.hasContactInfo() || this.showOpeningHoursSection());

    /** Profili social del brand, solo quando `showSocial` è attivo (dato d'identità). L'icona la
     *  deduce `app-social-link` dall'URL; `name` (se c'è) è l'etichetta resa accanto nel footer. */
    readonly socialLinks = computed<SocialLink[]>(() => {
        if (!this.showSocial()) return [];
        const social = this.identity()?.social;
        if (!Array.isArray(social)) return [];
        return social.filter((s): s is SocialLink => !!s && typeof s.url === 'string' && s.url.trim().length > 0);
    });

    /**
     * Identificativi dell'entità (P.IVA, CF, Registro Imprese, REA, SDI). Se CF e P.IVA coincidono,
     * una sola voce "Codice Fiscale / P.IVA" per non ripetere lo stesso dato — stessa dedup di
     * `FooterField.PartitaIvaCodiceFiscale` (`footer-content.ts`), unica fonte per questa decisione.
     */
    private identifierItems(identity: Identity): IdentityItem[] {
        return [
            ...this.valueItems(FooterField.PartitaIvaCodiceFiscale, identity),
            ...this.valueItems(FooterField.RegistroImprese, identity),
            ...this.valueItems(FooterField.NumeroRea, identity),
            ...this.valueItems(FooterField.CodiceSdi, identity),
        ];
    }

    /** Canali di contatto cliccabili (telefono, email, PEC, Titolare/DPO) resi come badge in cima,
     *  fuori dalle colonne — stessi `FooterField`/componenti di `resolveFooterField`, non una
     *  lettura diretta di `identity.contatti` fatta una seconda volta qui. */
    readonly contacts = computed<ContactChannel[]>(() => {
        const identity = this.identity();
        if (!identity || !this.showContacts()) return [];
        return [
            this.contactChannel('phone', FooterField.Telefono, identity),
            this.contactChannel('mail', FooterField.Email, identity),
            this.contactChannel('pec', FooterField.Pec, identity),
            this.contactChannel('mail', FooterField.TitolareDelTrattamento, identity),
            this.contactChannel('mail', FooterField.ResponsabileProtezioneDati, identity),
        ].filter((c): c is ContactChannel => c !== null);
    });

    /**
     * Dati legali/finanziari (capitale sociale, capitale versato, socio unico,
     * liquidazione): mostrati come colonna a sé per trasparenza e accessibilità.
     */
    private legalItems(identity: Identity): IdentityItem[] {
        return [
            ...this.valueItems(FooterField.CapitaleSociale, identity),
            ...this.valueItems(FooterField.CapitaleVersato, identity),
            ...this.valueItems(FooterField.SocioUnico, identity),
            ...this.valueItems(FooterField.InLiquidazione, identity),
        ];
    }

    /** Risolve un `FooterField` e adatta le sue foglie `kind: 'value'` (0, 1 o — solo per
     *  `PartitaIvaCodiceFiscale` — 2) in `IdentityItem`: STESSA decisione "è valorizzato? come si
     *  formatta? come si etichetta?" di `resolveFooterField`, solo tradotta nel tipo locale del
     *  template di questo componente. Le eventuali foglie `kind: 'custom'` (email di Titolare/DPO)
     *  restano fuori: quelle le legge `contactChannel`, non un testo semplice. */
    private valueItems(field: FooterField, identity: Identity): IdentityItem[] {
        return resolveFooterField(field, identity, this.footerDeps)
            .filter((leaf): leaf is Extract<FooterGroupChild, { kind: 'value' }> => leaf.kind === 'value')
            .map(leaf => this.toIdentityItem(leaf));
    }

    private toIdentityItem(leaf: Extract<FooterGroupChild, { kind: 'value' }>): IdentityItem {
        const label = this.translate.translate(leaf.label);
        if (leaf.itemKind === 'badge') return { kind: 'bool', label, value: leaf.value, tone: leaf.tone as BadgeTone, itemClass: leaf.itemClass };
        if (leaf.itemKind === 'code') return { kind: 'code', label, value: leaf.value, itemClass: leaf.itemClass };
        return { kind: 'text', label, value: leaf.value, itemClass: leaf.itemClass };
    }

    /** Risolve un `FooterField` e adatta la sua foglia `kind: 'custom'` (`contactComponentLeaf` in
     *  `footer-content.ts`) in `ContactChannel` — `label` resta la CHIAVE i18n non tradotta, come
     *  già negli `inputs` della foglia: il componente contatto traduce da sé. */
    private contactChannel(kind: ContactChannel['kind'], field: FooterField, identity: Identity): ContactChannel | null {
        const leaf = resolveFooterField(field, identity, this.footerDeps)
            .find((l): l is Extract<FooterGroupChild, { kind: 'custom' }> => l.kind === 'custom');
        if (!leaf) return null;
        const inputs = leaf.inputs ?? {};
        const label = inputs['label'] as string;
        const key = FooterField[field];
        if (kind === 'phone') return { kind, key, label, number: inputs['number'] as string };
        return { kind, key, label, config: inputs['config'] as MailContactConfig };
    }

    private compactSections(sections: IdentitySection[]): IdentitySection[] {
        return sections.filter(section => section.items.length > 0);
    }
}

/** Blocchi da considerare in {@link hasIdentityContent} — stessi 4 blocchi + social di `app-identity-render`. */
export interface IdentityContentOptions {
    includeCompanyDetails?: boolean;
    includeLegalDetails?: boolean;
    includeContacts?: boolean;
    includeOpeningHours?: boolean;
    includeSocial?: boolean;
}

/** True se `identity` ha almeno un campo valorizzato nei blocchi richiesti da `options`: evita di
 *  montare `app-identity-render` per un blocco che risulterebbe vuoto. Le opzioni devono rispecchiare
 *  gli `[show*]` passati al componente, altrimenti il gate può risultare vero a vuoto. */
export function hasIdentityContent(identity: Identity | null | undefined, options: IdentityContentOptions = {}): boolean {
    if (!identity) return false;
    const {
        includeCompanyDetails = true,
        includeLegalDetails = true,
        includeContacts = true,
        includeOpeningHours = true,
        includeSocial = false,
    } = options;

    const ds = identity.datiSocietari;
    const hasIdentifiers = includeCompanyDetails && (
        hasText(identity.partitaIva) || hasText(identity.codiceFiscale)
        || hasText(ds?.registroImprese) || hasText(ds?.numeroRea) || hasText(ds?.codiceSdi)
    );

    const hasLegal = includeLegalDetails && ds != null && (
        (typeof ds.capitaleSociale === 'number' && Number.isFinite(ds.capitaleSociale))
        || typeof ds.capitaleInteramenteVersato === 'boolean'
        || typeof ds.isSocioUnico === 'boolean'
        || typeof ds.inLiquidazione === 'boolean'
    );

    const address = identity.sedeLegale;
    const hasAddress = address != null
        && [address.via, address.civico, address.cap, address.citta, address.provincia, address.nazione].some(hasText);
    const hasLegalRoleName = hasText(identity.titolareDelTrattamento?.nome) || hasText(identity.responsabileProtezioneDati?.nome);
    const hasContactBlock = includeContacts
        && (hasText(identity.ragioneSociale) || hasAddress || hasText(identity.rappresentanteLegale) || hasLegalRoleName);

    const c = identity.contatti;
    const hasContactChannels = includeContacts && (
        (c != null && (hasText(c.telefono) || hasText(c.email) || hasText(c.pec)))
        || hasText(identity.titolareDelTrattamento?.email) || hasText(identity.responsabileProtezioneDati?.email)
    );

    const hasHours = includeOpeningHours && hasOpeningHours(identity.openingHours);

    const hasSocial = includeSocial && Array.isArray(identity.social)
        && identity.social.some(s => !!s && hasText(s.url));

    return hasIdentifiers || hasLegal || hasContactBlock || hasContactChannels || hasHours || hasSocial;
}
