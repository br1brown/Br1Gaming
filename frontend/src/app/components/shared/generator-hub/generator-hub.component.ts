import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { MarkdownPipe } from '../../../core/engine/pipes/markdown.pipe';
import { PageDirective } from '../../../core/engine/directives/page.directive';
import { ApiService } from '../../../core/services/api.service';
import { GenerateResponse, GeneratorInfo } from '../../../core/dto/generator.dto';
import { GENERATOR_PAGE_TYPES } from '../generators-section/generators-section.component';
import { PageType } from '../../../site';

/** slug → chiamata API di generazione. Stesso dispatch di `generator-detail` (lì per PageType, qui
 *  per slug: l'hub sceglie la categoria da un catalogo dati, non da una rotta). `variant` è la chiave
 *  scelta nel selettore inline (es. il segno per l'oroscopo), assente per i generatori normali. */
const GENERATE_FNS: Record<string, (api: ApiService, variant: string | null) => Promise<GenerateResponse>> = {
    incel: api => api.generateIncel(),
    startup: api => api.generateStartup(),
    auto: api => api.generateAuto(),
    antiveg: api => api.generateAntiveg(),
    locali: api => api.generateLocali(),
    kebab: api => api.generateKebab(),
    mbeb: api => api.generateMbeb(),
    oroscopo: (api, variant) => api.generateOroscopo(variant ?? ''),
};

/** slug → icona del selettore (puro accento visivo, un dito per ogni "cassetto" del mobiletto). */
const ICONS: Record<string, string> = {
    incel: 'fa-user-slash',
    startup: 'fa-rocket',
    auto: 'fa-car-side',
    antiveg: 'fa-drumstick-bite',
    locali: 'fa-martini-glass',
    kebab: 'fa-utensils',
    mbeb: 'fa-id-badge',
    oroscopo: 'fa-moon',
};
const DEFAULT_ICON = 'fa-dice';

/**
 * Hub "7 in 1": un unico elemento (selettore categoria + leva) al posto di N card identiche
 * (BR1-UI §3.B / BR1-DEV §2 "Hub Generatori"). Stato tutto locale — nessuna nuova rotta: il
 * catalogo arriva dalla stessa resource reattiva di `generators-section` (SSR-aware), il dispatch
 * di generazione riusa gli stessi metodi `ApiService` dei generatori, la card riusa il verbo
 * "Ancora!" del generatore dedicato ma dentro la home.
 */
@Component({
    selector: 'app-generator-hub',
    standalone: true,
    imports: [TranslatePipe, MarkdownPipe, PageDirective],
    templateUrl: './generator-hub.component.html',
    styleUrl: './generator-hub.component.css',
})
export class GeneratorHubComponent {
    private readonly api = inject(ApiService);

    protected readonly PageType = PageType;
    protected readonly skeletonSlots = [0, 1, 2, 3, 4, 5, 6];

    private readonly resource = this.api.generatorsResource();
    readonly loading = this.resource.isLoading;

    /** Solo i generatori con una pagina propria (stesso filtro di `generators-section`). */
    protected readonly generators = computed<GeneratorInfo[]>(() =>
        (this.resource.value() ?? []).filter(g => g.slug in GENERATOR_PAGE_TYPES));

    /** Categoria scelta nel selettore, o null finché il catalogo non è arrivato / niente è stato toccato. */
    private readonly pickedSlug = signal<string | null>(null);
    /** Categoria attiva: quella scelta, altrimenti la prima del catalogo — sempre "qualcosa di selezionato". */
    readonly activeSlug = computed<string | null>(() => this.pickedSlug() ?? this.generators()[0]?.slug ?? null);
    readonly active = computed<GeneratorInfo | null>(() =>
        this.generators().find(g => g.slug === this.activeSlug()) ?? null);

    /** Variante (es. segno) dentro la categoria attiva. */
    private readonly pickedVariant = signal<string | null>(null);
    readonly activeVariant = computed<string | null>(() =>
        this.pickedVariant() ?? this.active()?.variant?.options?.[0]?.key ?? null);

    readonly result = signal<GenerateResponse | null>(null);
    readonly spinning = signal(false);

    /** Cambia categoria: azzera il risultato (la leva va tirata di nuovo) e la variante scelta. */
    pickCategory(slug: string): void {
        if (slug === this.activeSlug()) return;
        this.pickedSlug.set(slug);
        this.pickedVariant.set(null);
        this.result.set(null);
    }

    pickVariant(key: string): void {
        this.pickedVariant.set(key);
        this.result.set(null);
    }

    /** Tira la leva: genera per la categoria (ed eventuale variante) correntemente selezionata. */
    async spin(): Promise<void> {
        const gen = this.active();
        const fn = gen ? GENERATE_FNS[gen.slug] : null;
        if (!gen || !fn) return;
        this.spinning.set(true);
        try {
            this.result.set(await fn(this.api, this.activeVariant()));
        } catch {
            // L'apiErrorInterceptor ha già notificato l'utente: qui si resta sull'ultimo risultato.
        } finally {
            this.spinning.set(false);
        }
    }

    /** PageType della pagina dedicata alla categoria attiva, per il link "pagina completa". */
    readonly activePageType = computed<PageType | null>(() => {
        const slug = this.activeSlug();
        return slug ? (GENERATOR_PAGE_TYPES[slug] ?? null) : null;
    });

    /** Icona del selettore per uno slug (usata nel template, niente lookup ripetuto lì). */
    protected iconFor(slug: string): string {
        return ICONS[slug] ?? DEFAULT_ICON;
    }
}
