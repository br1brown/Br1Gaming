import { Component, computed, effect, inject, input, PLATFORM_ID, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MarkdownPipe } from '../../core/engine/pipes/markdown.pipe';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { PageDirective } from '../../core/engine/directives/page.directive';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { ContentResolver } from '../../core/engine/pages/content.resolver';
import { ShareEntry, GeneratorInfo, PiaciutiPageContent } from '../../core/dto/generator.dto';
import { ContestoSito, PageType } from '../../site';
import { GENERATOR_SLUG_TO_PAGE_TYPE } from '../app.pages';

// Quante generazioni mostrare per generatore nella panoramica prima del link "Vedi tutte".
const PREVIEW_LIMIT = 6;

interface PiaciutoCard {
    id: string;
    markdown: string;
    /** Punteggio (peso/rarità) della generazione, arrotondato per la visualizzazione. */
    score: number;
    /** Istante in cui è stata messa tra i piaciuti (ISO), per il "tempo fa". */
    createdUtc: string;
}

/** Un blocco dei piaciuti: le generazioni piaciute di uno stesso generatore. */
interface PiaciutoGroup {
    slug: string;
    name: string;
    pageType: PageType | null;
    /** Path del playground del generatore: `${path}/${card.id}` è il link diretto alla singola voce. */
    path: string | null;
    /** Carte mostrate (in panoramica sono troncate a PREVIEW_LIMIT). */
    cards: PiaciutoCard[];
    /** Totale caricato per questo generatore (per il contatore di "Vedi tutte"). */
    total: number;
    /** true se ci sono più generazioni di quelle mostrate (panoramica). */
    hasMore: boolean;
}

/**
 * Raccolta pubblica dei piaciuti, con due modalità distinte dal query param `?gen=<slug>` (bind via
 * withComponentInputBinding):
 *  - panoramica (senza `gen`): una sezione per generatore, in ordine di catalogo, con anteprima
 *    troncata e link "Vedi tutte" verso la modalità filtrata;
 *  - per generatore (`?gen=auto`): la lista completa di quel solo generatore (filtrata server-side).
 * Entrambe indicizzate: risolte in SSR via `piaciutiContentLoader` (app.pages.ts), non più caricate
 * lato client — a differenza della SINGOLA frase condivisa (`/generatori/<slug>/:id`), sempre
 * `noindex` (vedi generatorSharedContentLoader). Il cambio di `?gen=` a pagina già montata ricarica
 * qui, richiamando lo stesso resolver: la resource generica di PageBaseComponent osserva solo
 * pageType/lang/:slug di rotta, non i query param.
 */
@Component({
    selector: 'app-piaciuti',
    imports: [RouterLink, PageDirective, MarkdownPipe, TranslatePipe],
    templateUrl: './piaciuti.component.html',
    styles: [`
        /* position: relative è richiesto da .stretched-link (Bootstrap) sul bottone "Leggi tutto":
           estende l'area cliccabile a tutta la card, non solo al bottone. */
        .piaciuti-card { position: relative; transition: box-shadow .2s ease; cursor: pointer; }
        .piaciuti-card:hover { box-shadow: var(--shadowElevatedHover); }
        /* Anteprima troncata: si vede solo l'inizio della generazione, il resto si apre cliccando
           la card o il bottone "Leggi tutto" (link a <path del generatore>/<id> della voce). */
        .piaciuti-preview {
            position: relative;
            display: -webkit-box;
            -webkit-line-clamp: 4;
            -webkit-box-orient: vertical;
            line-clamp: 4;
            overflow: hidden;
        }
        /* Sfumatura sull'ultima riga: segnala che il testo continua oltre il taglio,
           altrimenti il troncamento sembra un contenuto interrotto per errore. */
        .piaciuti-preview::after {
            content: '';
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: 1.4em;
            background: linear-gradient(to bottom, transparent, var(--bs-card-bg, Canvas));
            pointer-events: none;
        }
    `],
})
export class PiaciutiComponent extends PageBaseComponent<PiaciutiPageContent> {
    private readonly platform = inject(PLATFORM_ID);
    private readonly document = inject(DOCUMENT);
    private readonly contentResolver = inject(ContentResolver);

    /** "Tempo fa" in italiano da un istante ISO (es. "2 ore fa"). */
    ago(iso: string): string {
        const t = new Date(iso).getTime();
        if (isNaN(t)) return '';
        const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
        if (s < 60) return 'adesso';
        const m = Math.floor(s / 60); if (m < 60) return `${m} min fa`;
        const h = Math.floor(m / 60); if (h < 24) return `${h} ${h === 1 ? 'ora' : 'ore'} fa`;
        const d = Math.floor(h / 24); if (d < 30) return `${d} ${d === 1 ? 'giorno' : 'giorni'} fa`;
        const mo = Math.floor(d / 30); if (mo < 12) return `${mo} ${mo === 1 ? 'mese' : 'mesi'} fa`;
        const y = Math.floor(d / 365); return `${y} ${y === 1 ? 'anno' : 'anni'} fa`;
    }

    /** Copia negli appunti il link diretto (`<path>/<id>`) della singola voce, senza doverla aprire. */
    async copyLink(path: string | null, id: string): Promise<void> {
        if (!path) return;
        const url = `${this.document.location.origin}${path}/${id}`;
        try {
            await this.document.defaultView?.navigator.clipboard.writeText(url);
            this.notify.toast(this.translate.translate('condivisiLinkCopiato'), 'success');
        } catch {
            this.notify.toast(url, 'info');   // clipboard non disponibile: mostra l'URL
        }
    }

    /** Query param `?gen=<slug>`: se presente, mostra i piaciuti del solo generatore. */
    readonly gen = input<string>();

    /** Path della pagina piaciuti, per i link "Vedi tutte" / "Tutti i generatori". */
    protected readonly piaciutiPath = ContestoSito.getPath(PageType.Piaciuti) ?? '/';

    private readonly entries = signal<ShareEntry[] | null>(null);
    /** Catalogo dei generatori in ordine, per raggruppare e dare i nomi. */
    private readonly generators = signal<GeneratorInfo[]>([]);
    /** Conteggio reale per generatore (slug → totale): la panoramica carica solo un'anteprima,
     *  quindi il numero in "Vedi tutte (N)" viene da qui, non dalle voci caricate. */
    private readonly counts = signal<Record<string, number>>({});

    /** Slug del generatore attualmente filtrato (modalità per-generatore), o null (panoramica). */
    readonly filterSlug = computed(() => this.gen() || null);

    /** Nome del generatore filtrato, per l'intestazione della modalità per-generatore. */
    readonly filterName = computed(() => {
        const slug = this.filterSlug();
        if (!slug) return null;
        return this.generators().find(g => g.slug === slug)?.name ?? slug;
    });

    /** null = ancora in caricamento; [] = caricata ma vuota. */
    readonly groups = computed<PiaciutoGroup[] | null>(() => {
        const list = this.entries();
        if (list === null) return null;
        const filtered = this.filterSlug();

        // Indice slug → carte, poi ordinate per punteggio decrescente (le generazioni "migliori"
        // — più rare/estreme — in cima a ogni generatore).
        const bySlug = new Map<string, PiaciutoCard[]>();
        for (const e of list) {
            const cards = bySlug.get(e.slug) ?? [];
            cards.push({ id: e.id, markdown: e.markdown, score: Math.round(e.score), createdUtc: e.createdUtc });
            bySlug.set(e.slug, cards);
        }
        for (const cards of bySlug.values()) cards.sort((a, b) => b.score - a.score);

        // I generatori da mostrare: solo quello filtrato, oppure tutti (in ordine di catalogo).
        const sources = this.generators().filter(g =>
            bySlug.has(g.slug) && (!filtered || g.slug === filtered));

        const counts = this.counts();
        return sources.map(g => {
            const all = bySlug.get(g.slug)!;
            const pageType = GENERATOR_SLUG_TO_PAGE_TYPE[g.slug] ?? null;
            // In panoramica si tronca all'anteprima; in modalità filtrata si mostra tutto.
            const cards = filtered ? all : all.slice(0, PREVIEW_LIMIT);
            // Totale reale dai conteggi (panoramica); in modalità filtrata sono già tutte caricate.
            const total = filtered ? all.length : (counts[g.slug] ?? all.length);
            return {
                slug: g.slug,
                name: g.name,
                pageType,
                path: pageType !== null ? ContestoSito.getPath(pageType) ?? null : null,
                cards,
                total,
                hasMore: !filtered && total > cards.length,
            };
        });
    });

    constructor() {
        super();
        // Contenuto: SSR + prima idratazione arrivano già risolti da pageContent() (il contentLoader
        // di questa pagina legge ?gen= dal Router — vedi piaciutiContentLoader in app.pages.ts).
        effect(() => {
            const content = this.pageContent();
            if (!content) return;
            this.entries.set(content.shares);
            this.generators.set(content.generators);
            this.counts.set(content.counts);
        });

        // Cambio di `?gen=` a pagina già montata (link "Vedi tutte"/"Tutti i generatori"): la
        // resource generica di PageBaseComponent osserva solo pageType/lang/:slug di rotta, non i
        // query param, quindi non si ri-esegue da sola per questo — richiamiamo qui lo STESSO
        // resolver (nessuna logica di fetch duplicata). Il valore iniziale di `gen` arriva già
        // dall'effect sopra: il primo giro si salta, altrimenti ri-fetcheremmo due volte all'avvio.
        if (isPlatformBrowser(this.platform)) {
            let first = true;
            effect(() => {
                this.filterSlug(); // dipendenza
                if (first) { first = false; return; }
                void this.reload();
            });
        }
    }

    private async reload(): Promise<void> {
        const resolved = await this.contentResolver.loadResolved(this.pageType(), this.lang());
        const content = resolved.content as PiaciutiPageContent | null;
        if (!content) return;
        this.entries.set(content.shares);
        this.generators.set(content.generators);
        this.counts.set(content.counts);
    }
}
