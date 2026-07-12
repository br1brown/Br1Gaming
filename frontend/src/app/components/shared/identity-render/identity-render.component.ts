import { booleanAttribute, Component, computed, inject, input } from '@angular/core';
import { Identity, SocialLink } from '../../../core/engine/dto/identity.dto';
import { TranslateService } from '../../../core/engine/services/translate.service';
import { LocalizationService } from '../../../core/engine/services/localization.service';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { PhoneContactComponent } from '../contact/phone-contact/phone-contact.component';
import { MailContactComponent, MailContactConfig } from '../contact/mail-contact/mail-contact.component';
import { SocialLinkComponent } from '../navigation/social-link/social-link.component';
import { OpeningHoursComponent, hasOpeningHours } from '../opening-hours/opening-hours.component';

/** Tono Bootstrap del badge (suffisso di `text-bg-*`). */
type BadgeTone = 'success' | 'secondary' | 'warning' | 'danger' | 'info' | 'primary';

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
    | { kind: 'mail'; key: string; label: string; config: MailContactConfig };

/**
 * Rende l'Identity del sito (GET /identity) in sezioni a colonne (societari, legali, contatti): ogni
 * voce solo se valorizzata (skip-empty), label tradotta, markup per tipo, più la logica di formato.
 * `[showSocial]="true"` aggiunge le icone social (un solo punto di rendering gateato da un flag:
 * footer sì, pagine legali no).
 */
@Component({
    selector: 'app-identity-render',
    standalone: true,
    imports: [TranslatePipe, PhoneContactComponent, MailContactComponent, SocialLinkComponent, OpeningHoursComponent],
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

    readonly sections = computed<IdentitySection[]>(() => {
        const identity = this.identity();
        if (!identity) return [];

        // Numero imprecisato di sezioni-dati dinamiche. La sezione "Contatti" è
        // invece dedicata e renderizzata a parte (testo + badge impilati).
        return this.compactSections([
            {
                titleKey: 'datiSocietariAzienda',
                items: this.identifierItems(identity),
            },
            {
                titleKey: 'datiLegaliAzienda',
                items: this.legalItems(identity),
            },
        ]);
    });

    /** Voci testuali della sezione Contatti (nome, sede, rappresentante). Gli orari sono resi a parte
     *  da `app-opening-hours` (componente autonomo), non più una riga di testo qui. */
    readonly contactItems = computed<IdentityItem[]>(() => {
        const identity = this.identity();
        if (!identity) return [];
        return this.compactItems([
            this.createTextItem(identity.ragioneSociale, this.label('ragioneSocialeAzienda')),
            this.createTextItem(this.formatAddress(identity), this.label('sedeLegaleAzienda')),
            this.createTextItem(identity.rappresentanteLegale, this.label('rappresentanteLegaleAzienda')),
        ]);
    });

    /** Gli orari (delegati a `app-opening-hours`) hanno almeno una fascia valida da mostrare. */
    readonly showOpeningHours = computed<boolean>(() => hasOpeningHours(this.identity()?.openingHours));

    /** Indica se la colonna Contatti ha qualcosa da mostrare (testo, orari o badge). */
    readonly hasContacts = computed<boolean>(() =>
        this.contactItems().length > 0 || this.showOpeningHours() || this.contacts().length > 0);

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
     * una sola voce "Codice Fiscale / P.IVA" per non ripetere lo stesso dato.
     */
    private identifierItems(identity: Identity): IdentityItem[] {
        const piva = identity.partitaIva?.trim();
        const cf = identity.codiceFiscale?.trim();
        const ds = identity.datiSocietari;

        const idCodes: Array<IdentityItem | null> = this.hasText(piva) && piva === cf
            ? [this.createCodeItem(`${this.label('codiceFiscaleAzienda')} / ${this.label('partitaIvaAzienda')}`, piva)]
            : [
                this.createCodeItem(this.label('partitaIvaAzienda'), identity.partitaIva),
                this.createCodeItem(this.label('codiceFiscaleAzienda'), identity.codiceFiscale),
            ];

        return this.compactItems([
            ...idCodes,
            this.createTextItem(ds?.registroImprese, this.label('registroImpreseAzienda')),
            this.createCodeItem(this.label('numeroReaAzienda'), ds?.numeroRea),
            this.createCodeItem(this.label('codiceSdiAzienda'), ds?.codiceSdi),
        ]);
    }

    /**
     * Canali di contatto cliccabili (telefono, email, PEC) resi come badge in cima, fuori dalle colonne.
     * `label` è la CHIAVE i18n, non il valore: il contatto traduce da sé (pre-tradurre → doppio
     * translate → "key not found").
     */
    readonly contacts = computed<ContactChannel[]>(() => {
        const c = this.identity()?.contatti;
        if (!c) return [];

        const list: ContactChannel[] = [];
        if (this.hasText(c.telefono)) {
            list.push({ kind: 'phone', key: 'telefono', label: 'telefonoAzienda', number: c.telefono.trim() });
        }
        if (this.hasText(c.email)) {
            list.push({ kind: 'mail', key: 'email', label: 'emailAzienda', config: { to: c.email.trim() } });
        }
        if (this.hasText(c.pec)) {
            list.push({ kind: 'mail', key: 'pec', label: 'pecAzienda', config: { to: c.pec.trim() } });
        }
        return list;
    });

    /**
     * Dati legali/finanziari (capitale sociale, capitale versato, socio unico,
     * liquidazione): mostrati come colonna a sé per trasparenza e accessibilità.
     */
    private legalItems(identity: Identity): IdentityItem[] {
        const ds = identity.datiSocietari;
        if (!ds) return [];
        return this.compactItems([
            this.createTextItem(this.formatCurrency(ds.capitaleSociale, identity.currency), this.label('capitaleSocialeAzienda')),
            this.createBoolItem(this.label('capitaleVersatoAzienda'), ds.capitaleInteramenteVersato),
            this.createBoolItem(this.label('socioUnicoAzienda'), ds.isSocioUnico),
            // Flag "negativo": essere in liquidazione è un campanello → Sì in warning.
            this.createBoolItem(this.label('inLiquidazioneAzienda'), ds.inLiquidazione, { onTrue: 'warning', onFalse: 'secondary' }),
        ]);
    }

    private compactItems(items: Array<IdentityItem | null>): IdentityItem[] {
        return items.filter((item): item is IdentityItem => item !== null);
    }

    private compactSections(sections: IdentitySection[]): IdentitySection[] {
        return sections.filter(section => section.items.length > 0);
    }

    private createTextItem(value: string | null | undefined, label = '', itemClass?: string): IdentityItem | null {
        if (!this.hasText(value)) return null;
        return { kind: 'text', label, value: value.trim(), itemClass };
    }

    private createCodeItem(label: string, value: string | null | undefined, itemClass?: string): IdentityItem | null {
        if (!this.hasText(value)) return null;
        return { kind: 'code', label, value: value.trim(), itemClass };
    }

    private label(key: string): string {
        return this.translate.translate(key);
    }

    /**
     * Voce booleana resa come badge. `tones` mappa il valore al tono Bootstrap
     * in modo generico: di default Sì→verde / No→grigio, ma un campo può
     * dichiarare toni diversi (es. un flag negativo: Sì→warning).
     */
    private createBoolItem(
        label: string,
        value: boolean | null | undefined,
        tones: { onTrue: BadgeTone; onFalse: BadgeTone } = { onTrue: 'success', onFalse: 'secondary' },
        itemClass?: string,
    ): IdentityItem | null {
        if (typeof value !== 'boolean') return null;
        return {
            kind: 'bool',
            label,
            value: this.translate.translate(value ? 'siAzione' : 'noAzione'),
            tone: value ? tones.onTrue : tones.onFalse,
            itemClass,
        };
    }

    private formatCurrency(value: number | null | undefined, currency: string | null | undefined): string | null {
        if (typeof value !== 'number' || !Number.isFinite(value)) return null;
        // Valuta = fatto dichiarato dall'identità; il locale (lingua corrente) decide solo il formato.
        // Il codice è già validato ISO 4217 dal backend (presente-ma-invalido → 500 al read), quindi qui
        // si formatta fidandosi; assente → EUR (default dichiarato). Il catch resta solo come difesa
        // (come regionName), non più per assorbire un codice sbagliato in silenzio.
        const code = (currency ?? '').trim().toUpperCase() || 'EUR';
        try {
            return this.localization.formatter.currency(value, code);
        } catch {
            return this.localization.formatter.currency(value, 'EUR');
        }
    }

    private hasText(value: string | null | undefined): value is string {
        return typeof value === 'string' && value.trim().length > 0;
    }

    private formatAddress(identity: Identity): string | null {
        const address = identity.sedeLegale;
        if (!address) return null;

        const streetLine = [address.via, address.civico]
            .filter(this.isNonEmptyString)
            .join(', ');

        const cityLine = [address.cap, address.citta, address.provincia]
            .filter(this.isNonEmptyString)
            .join(' ');

        const parts = [streetLine, cityLine, this.countryName(address.nazione)].filter(this.isNonEmptyString);
        return parts.length > 0 ? parts.join(' - ') : null;
    }

    /**
     * Nome del paese localizzato dal codice ISO 3166-1 alpha-2 (es. "IT"→"Italia") via
     * `Intl.DisplayNames`. Il backend garantisce il codice ISO valido: qui si formatta e basta.
     */
    private countryName(code: string | null | undefined): string | null {
        const c = code?.trim();
        if (!c) return null;
        return this.localization.formatter.regionName(c);
    }

    private isNonEmptyString(value: unknown): value is string {
        return typeof value === 'string' && value.trim().length > 0;
    }
}
