import { NgTemplateOutlet } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import {
    ChangeDetectionStrategy, Component, ContentChild, Directive, ElementRef, PLATFORM_ID, PendingTasks, TemplateRef, computed, effect, inject, input, model, signal, untracked,
} from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { scrollToAfterPaint } from '../../scroll';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { LoadingComponent } from '../loading/loading.component';
import { PaginationComponent } from '../pagination/pagination.component';

/** Cosa chiede il componente alla funzione di caricamento: la pagina (da 1) e quanti elementi per pagina. */
export interface PageRequest {
    page: number;
    pageSize: number;
}

/** Cosa deve rispondere la funzione di caricamento: gli elementi di QUELLA pagina e quanti ce ne sono in tutto. */
export interface PageResult<T> {
    items: T[];
    total: number;
}

/** Lo stato della lista, passato ai template di chi la usa (`let-state="state"`). */
export interface PagedState {
    page: number;
    pageSize: number;
    total: number;
    /** Quante pagine ci sono (almeno 1). */
    pages: number;
    loading: boolean;
}

/** Dove sta la paginazione disegnata dal componente (`none` = la disegni tu, con `goTo` del contesto). */
export type PagedPagination = 'bottom' | 'top' | 'both' | 'none';

/**
 * Il template degli elementi: riceve la pagina corrente (`let-items`) e lo stato (`let-state="state"`) e ci scrivi dentro il tuo `@for`
 * e il tuo layout. Il binding riceve la stessa funzione di caricamento data a `app-paged-list`: serve solo a far dedurre il tipo degli elementi.
 */
@Directive({ selector: 'ng-template[appPagedItems]' })
export class PagedItemsDirective<T> {
    /** La stessa funzione `load` della lista: da lei si deduce il tipo di `items` nel template. */
    readonly load = input.required<(request: PageRequest) => Promise<PageResult<T>>>({ alias: 'appPagedItems' });
    readonly template = inject<TemplateRef<PagedItemsContext<T>>>(TemplateRef);

    static ngTemplateContextGuard<T>(_dir: PagedItemsDirective<T>, _ctx: unknown): _ctx is PagedItemsContext<T> { return true; }
}

export interface PagedItemsContext<T> {
    $implicit: T[];
    state: PagedState;
    /** Va a una pagina (da 1): per una paginazione tua, o per «carica altri». */
    goTo: (page: number) => void;
    /** Ricarica la pagina corrente. */
    reload: () => void;
}

/** Facoltativo: cosa mostrare quando non c'è nessun elemento. Senza, c'è lo stato vuoto di serie. */
@Directive({ selector: 'ng-template[appPagedEmpty]' })
export class PagedEmptyDirective {
    readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/** Facoltativo: cosa mostrare se il caricamento fallisce (`let-retry="retry"` è la funzione che riprova). Senza, c'è un avviso con «Riprova». */
@Directive({ selector: 'ng-template[appPagedError]' })
export class PagedErrorDirective {
    readonly template = inject<TemplateRef<{ retry: () => void }>>(TemplateRef);
}

/**
 * Una lista a pagine in cui il contenuto è tuo e il resto è dell'Engine.
 *
 * Tu dici DOVE prendere i dati (`load`: una funzione che riceve pagina e numero per pagina e risponde con gli elementi e il totale) e QUANTI per pagina;
 * scrivi tu, dentro il tag, come si disegna la pagina (il tuo `@for`, le tue card, la tua tabella). Il componente fa il resto:
 * chiama `load` a ogni cambio di pagina, ignora le risposte arrivate in ritardo, mostra lo spinner dell'Engine (`app-loading`) durante il caricamento, mostra errore e stato vuoto, disegna la paginazione e, cambiando pagina, riporta in cima alla lista
 * solo a dati arrivati e disegnati (prima si resterebbe in fondo).
 *
 * ```html
 * <app-paged-list [load]="carica" [pageSize]="20" [reloadOn]="testo()">
 *   <ng-template [appPagedItems]="carica" let-items let-state="state">
 *     <ul>@for (s of items; track s.id) { <li>{{ s.nome }}</li> }</ul>
 *     <p>{{ state.total }} risultati</p>
 *   </ng-template>
 *   <ng-template appPagedEmpty><p>Niente da mostrare</p></ng-template>
 * </app-paged-list>
 * ```
 * ```typescript
 * protected readonly carica = ({ page, pageSize }: PageRequest) => this.api.cerca(this.testo(), page, pageSize);   // → { items, total }
 * ```
 * `reloadOn` è un valore qualunque (filtri, testo cercato): quando cambia si torna a pagina 1 e si ricarica. `[(page)]` serve solo a chi vuole
 * leggere o scrivere la pagina da fuori (ad esempio per tenerla nell'indirizzo). `reload()` ricarica la pagina corrente (dopo una modifica).
 * Sul server il caricamento è atteso prima di serializzare la pagina.
 */
@Component({
    selector: 'app-paged-list',
    imports: [NgTemplateOutlet, TranslatePipe, EmptyStateComponent, LoadingComponent, PaginationComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="paged-list" tabindex="-1" [attr.aria-busy]="loading()"
             [attr.role]="ariaLabel() ? 'region' : null" [attr.aria-label]="ariaLabel() || null">
            @if (pagination() === 'top' || pagination() === 'both') {
                <div class="mb-3"><app-pagination [page]="page()" [total]="total()" [pageSize]="size()" (pageChange)="goTo($event)" /></div>
            }
            <!-- Durante il caricamento: lo spinner app-loading dell Engine, come ovunque. La lista sparisce e torna a dati arrivati. -->
            <app-loading [loading]="loading()">
                @if (error() && items().length === 0) {
                    @if (errorTemplate; as tpl) {
                        <ng-container [ngTemplateOutlet]="tpl.template" [ngTemplateOutletContext]="{ retry: retry }" />
                    } @else {
                        <div class="alert alert-danger d-flex flex-wrap align-items-center gap-3" role="alert">
                            <span>{{ 'pagedListError' | translate }}</span>
                            <button type="button" class="btn btn-outline-danger btn-touch" (click)="reload()">{{ 'pagedListRetry' | translate }}</button>
                        </div>
                    }
                } @else if (loaded() && total() === 0) {
                    @if (emptyTemplate; as tpl) {
                        <ng-container [ngTemplateOutlet]="tpl.template" />
                    } @else {
                        <app-empty-state />
                    }
                } @else if (itemsTemplate; as tpl) {
                    <ng-container [ngTemplateOutlet]="tpl.template" [ngTemplateOutletContext]="{ $implicit: items(), state: state(), goTo: goToFn, reload: reloadFn }" />
                }
            </app-loading>
            @if (error() && items().length > 0) {
                <div class="alert alert-warning mt-3 d-flex flex-wrap align-items-center gap-3" role="alert">
                    <span>{{ 'pagedListError' | translate }}</span>
                    <button type="button" class="btn btn-outline-secondary btn-touch" (click)="reload()">{{ 'pagedListRetry' | translate }}</button>
                </div>
            }
            @if (pagination() === 'bottom' || pagination() === 'both') {
                <div class="mt-3"><app-pagination [page]="page()" [total]="total()" [pageSize]="size()" (pageChange)="goTo($event)" /></div>
            }
        </div>
    `,
    styles: [`
        .paged-list { outline: none; }
    `],
    host: { class: 'd-block' },
})
export class PagedListComponent<T> {
    /** Dove prendere i dati: riceve `{ page, pageSize }` e risponde `{ items, total }`. La decide chi usa il componente. */
    readonly load = input.required<(request: PageRequest) => Promise<PageResult<T>>>();
    /** Quanti elementi per pagina. */
    readonly pageSize = input(20);
    /** La pagina corrente, da 1. Bidirezionale: opzionale. */
    readonly page = model(1);
    /** Un valore qualunque (filtri, testo): quando cambia si torna a pagina 1 e si ricarica. */
    readonly reloadOn = input<unknown>(null);
    /** Dove sta la paginazione di serie. `'none'` per disegnarla tu (il template riceve `goTo` e `state.pages`). */
    readonly pagination = input<PagedPagination>('bottom');
    /** Al cambio pagina porta in cima alla lista (a dati arrivati). Spegnilo se la lista sta già in cima alla pagina. */
    readonly scrollOnPageChange = input(true);
    /** Etichetta della regione per i lettori di schermo. */
    readonly ariaLabel = input('');

    @ContentChild(PagedItemsDirective) protected itemsTemplate?: PagedItemsDirective<T>;
    @ContentChild(PagedEmptyDirective) protected emptyTemplate?: PagedEmptyDirective;
    @ContentChild(PagedErrorDirective) protected errorTemplate?: PagedErrorDirective;

    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
    private readonly pending = inject(PendingTasks);

    protected readonly items = signal<T[]>([]);
    protected readonly total = signal(0);
    protected readonly loading = signal(false);
    protected readonly error = signal(false);
    /** Almeno un caricamento è andato a buon fine: prima non si può dire «vuota». */
    protected readonly loaded = signal(false);
    /** Gli ingressi si prendono come sono ma non si fidano: un numero per pagina 0, negativo o con la virgola non deve dividere per zero. */
    protected readonly size = computed(() => { const n = Math.floor(Number(this.pageSize())); return Number.isFinite(n) && n >= 1 ? n : 20; });
    protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
    protected readonly state = computed<PagedState>(() => ({ page: this.page(), pageSize: this.size(), total: this.total(), pages: this.pages(), loading: this.loading() }));
    protected readonly goToFn = (page: number): void => this.goTo(page);
    protected readonly reloadFn = (): void => this.reload();

    private token = 0;
    private tick = signal(0);
    private reloadOnSeen = false;
    private lastLoadedPage: number | null = null;
    private lastReloadOn: unknown;

    constructor() {
        // Il valore osservato cambia (non al primo giro): pagina 1 e ricarica. Se si era già a pagina 1 la ricarica passa dal contatore.
        effect(() => {
            const value = this.reloadOn();
            if (!this.reloadOnSeen) { this.reloadOnSeen = true; this.lastReloadOn = value; return; }
            if (Object.is(value, this.lastReloadOn)) return;
            this.lastReloadOn = value;
            untracked(() => {
                if (this.page() !== 1) this.page.set(1);
                else this.tick.update(t => t + 1);
            });
        });

        effect(() => {
            const page = this.page();
            // Una pagina scritta da fuori che non esiste (0, -1, 2,5, NaN): si riparte dalla prima.
            if (!Number.isInteger(page) || page < 1) { untracked(() => this.page.set(1)); return; }
            const pageSize = this.size();
            const load = this.load();
            this.tick();
            untracked(() => void this.fetch(load, { page, pageSize }));
        });
    }

    /** Ricarica la pagina corrente (dopo una modifica che cambia l'elenco). */
    reload(): void { this.tick.update(t => t + 1); }

    protected readonly retry = (): void => this.reload();

    /** Va a una pagina: fuori intervallo (o non intera) si porta al limite più vicino. */
    goTo(page: number): void {
        const n = Math.floor(Number(page));
        if (!Number.isFinite(n)) return;
        this.page.set(Math.min(Math.max(1, n), Math.max(this.pages(), 1)));
    }

    private async fetch(load: (r: PageRequest) => Promise<PageResult<T>>, request: PageRequest): Promise<void> {
        const token = ++this.token;
        this.loading.set(true);
        this.error.set(false);
        const done = this.pending.add();
        try {
            const result = await load(request);
            if (token !== this.token) return;
            // Una risposta storta (niente elenco, un totale che non è un numero) è un errore di chi carica, non un elenco vuoto: si dice, non si finge.
            if (!Array.isArray(result?.items)) throw new Error('paged-list: la risposta di load non ha `items`');
            const total = Number(result.total);
            this.items.set(result.items);
            this.total.set(Number.isFinite(total) && total >= 0 ? Math.floor(total) : result.items.length);
            this.loaded.set(true);
            // Pagina oltre l'ultima (l'elenco si è accorciato): si torna all'ultima che esiste.
            const last = Math.max(1, Math.ceil(this.total() / request.pageSize));
            if (request.page > last) { this.page.set(last); return; }
            const changed = this.lastLoadedPage !== null && this.lastLoadedPage !== request.page;
            this.lastLoadedPage = request.page;
            if (changed && this.browser && this.scrollOnPageChange()) void scrollToAfterPaint(this.host.nativeElement.firstElementChild as HTMLElement | null);
        } catch {
            // La notifica l'ha già mostrata l'interceptor; qui resta l'invito a riprovare, coi dati di prima.
            if (token === this.token) this.error.set(true);
        } finally {
            if (token === this.token) this.loading.set(false);
            done();
        }
    }
}
