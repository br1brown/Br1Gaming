import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { MarkdownPipe } from '../../../core/engine/pipes/markdown.pipe';
import { PageDirective } from '../../../core/engine/directives/page.directive';
import { AssetDirective } from '../../../core/engine/directives/asset.directive';
import { ApiService } from '../../../core/services/api.service';
import { GenerateResponse, GeneratorInfo } from '../../../core/dto/generator.dto';
import { PageType } from '../../../site';

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
    imports: [TranslatePipe, MarkdownPipe, PageDirective, AssetDirective],
    templateUrl: './generator-hub.component.html',
    styleUrl: './generator-hub.component.css',
})
export class GeneratorHubComponent {
    private readonly api = inject(ApiService);

    protected readonly skeletonSlots = [0, 1, 2, 3, 4, 5, 6];

    /** Slug la cui immagine del tasto è mancante/rotta: il tasto ripiega sul solo nome, stesso
     *  spirito di ContentCardComponent.onImageError — niente icona generica di fallback: se manca
     *  l'immagine mancava anche la voce nel mapping, la si aggiunge lì, non qui in codice. */
    protected readonly brokenIcons = signal(new Set<string>());

    protected onIconError(slug: string): void {
        this.brokenIcons.update(set => new Set(set).add(slug));
    }

    private readonly resource = this.api.generatorsResource();
    readonly loading = this.resource.isLoading;

    /** Catalogo generatori: un solo PageType per tutti (/generatori/:slug), quindi ogni generatore
     *  del backend ha già una pagina propria — niente più filtro. */
    protected readonly generators = computed<GeneratorInfo[]>(() => this.resource.value() ?? []);

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

    /** Tira la leva: genera per la categoria (ed eventuale variante) correntemente selezionata.
     *  Chiave della variante presa da `variant.key` (es. 'segno' per l'oroscopo), non hardcoded. */
    async spin(): Promise<void> {
        const gen = this.active();
        if (!gen) return;
        const variant = gen.variant;
        const inputs = variant ? { [variant.key]: this.activeVariant() ?? '' } : undefined;
        this.spinning.set(true);
        try {
            this.result.set(await this.api.generate(gen.slug, inputs));
        } catch {
            // L'apiErrorInterceptor ha già notificato l'utente: qui si resta sull'ultimo risultato.
        } finally {
            this.spinning.set(false);
        }
    }

    /** PageType della pagina dedicata alla categoria attiva, per il link "pagina completa" —
     *  costante (un solo PageType per tutti i generatori): il template ci passa lo slug a parte
     *  via `[appPageParams]`. */
    protected readonly generatorPageType = PageType.Generatore;
}
