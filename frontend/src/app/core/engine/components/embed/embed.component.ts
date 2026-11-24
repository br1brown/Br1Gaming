import { ChangeDetectionStrategy, Component, DOCUMENT, ElementRef, Injector, PLATFORM_ID, afterNextRender, computed, effect, inject, input, isDevMode, signal, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { AssetDirective } from '../../directives/asset.directive';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { CookieConsentService } from '../../services/cookie-consent.service';
import { IconComponent } from '../icon/icon.component';
import { brandColors } from '../social-link/social-link.component';
import { EMBED_PROVIDERS, resolveEmbed, type EmbedProvider, type EmbedSource } from './embed';

// Un solo ascolto per pagina, non uno per istanza: gli host bloccati dalla CSP si segnalano una volta ciascuno.
const warnedHosts = new Set<string>();
let cspListening = false;

/** Un video, podcast o player di terzi descritto da un `EmbedSource`: prima una facade senza richieste a terzi, il player al clic su «Carica»
 *  o da solo, dopo l'idratazione, con la categoria di consenso del provider accettata. Un oggetto non valido non disegna niente.
 *  L'host del player va in `frame-src`; in sviluppo un host bloccato dalla CSP si segnala in console. */
@Component({
    selector: 'app-embed',
    imports: [AssetDirective, IconComponent, TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'd-block' },
    template: `
        @if (resolved(); as r) {
            <div class="embed rounded-4 overflow-hidden" [style.aspect-ratio]="r.ratio" [style.height.px]="r.height" [attr.data-embed-provider]="r.provider.key">
                @if (loaded()) {
                    <iframe #frame class="w-100 h-100 border-0" [src]="safeSrc()" [title]="source().title" loading="lazy" allowfullscreen
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            referrerpolicy="strict-origin-when-cross-origin"
                            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"></iframe>
                } @else {
                    <div class="embed__facade card h-100 border">
                        <div class="card-body d-flex flex-column flex-sm-row align-items-sm-center gap-3">
                            @if (source().cover) {
                                <img [appAsset]="source().cover!" [appAssetWidth]="125" alt="" aria-hidden="true" class="embed__cover rounded-3 flex-shrink-0">
                            } @else {
                                <app-icon [glyph]="r.provider.glyph" [color]="brand().color" [glyphColor]="brand().fg" shape="rounded" animation="none" />
                            }
                            <div class="flex-grow-1 min-w-0">
                                <p class="fw-semibold mb-0 text-break">{{ source().title }}</p>
                                @if (source().subtitle) { <p class="small text-body-secondary mb-1 text-break">{{ source().subtitle }}</p> }
                                <p class="small text-body-secondary mb-2">{{ 'embedAvviso' | translate: r.provider.label }}
                                    <a [href]="r.provider.privacyUrl" target="_blank" rel="noopener noreferrer">{{ 'embedPrivacy' | translate: r.provider.label }}</a></p>
                                <div class="d-flex flex-wrap align-items-center gap-2">
                                    <button type="button" class="btn btn-primary btn-touch" (click)="load()">
                                        <i class="fa-solid fa-circle-play me-1" aria-hidden="true"></i>{{ 'embedCarica' | translate }}
                                    </button>
                                    <a class="btn btn-link btn-touch" [href]="r.openUrl" target="_blank" rel="noopener noreferrer">{{ 'embedApriSu' | translate: r.provider.label }}</a>
                                </div>
                            </div>
                        </div>
                    </div>
                }
            </div>
        }
    `,
    styles: `
        .embed { min-height: 12rem; background: var(--bs-tertiary-bg); }
        .embed__cover { width: 125px; height: auto; max-width: 40%; }
        .embed__facade { border-radius: inherit; }
    `,
})
export class EmbedComponent {
    private readonly consent = inject(CookieConsentService);
    private readonly sanitizer = inject(DomSanitizer);
    private readonly document = inject(DOCUMENT);
    private readonly injector = inject(Injector);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    /** Cosa incorporare e come presentarlo: vedi {@link EmbedSource}. */
    readonly source = input.required<EmbedSource>();
    /** I provider fra cui cercare un `provider` dato per chiave: di serie i quattro dell'Engine; per un provider proprio nominato da una chiave (arriva da un contenuto) si passa `{ ...EMBED_PROVIDERS, mio }`. */
    readonly providers = input<Readonly<Record<string, EmbedProvider>>>(EMBED_PROVIDERS);

    protected readonly resolved = computed(() => resolveEmbed(this.source(), this.providers()));
    protected readonly brand = computed(() => brandColors(this.resolved()?.provider.key ?? ''));
    protected readonly safeSrc = computed<SafeResourceUrl | null>(() => {
        const r = this.resolved();
        // L'indirizzo è già stato verificato da `resolveEmbed` (https, host del provider, id valido): è l'unico punto in cui si salta il sanitizer.
        return r ? this.sanitizer.bypassSecurityTrustResourceUrl(r.embedUrl) : null;
    });

    private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
    private readonly clicked = signal(false);
    // Il server non conosce il consenso: la prima disegnata (server e idratazione) è sempre la facade, poi si guarda il consenso.
    private readonly hydrated = signal(false);
    private readonly autoloaded = computed(() => {
        const r = this.resolved();
        return this.hydrated() && !!r && this.consent.isCategoryAccepted(r.provider.category);
    });
    protected readonly loaded = computed(() => !!this.resolved() && (this.clicked() || this.autoloaded()));

    constructor() {
        // Solo nel browser: sul server resta `false` (esplicito, senza dipendere da come Angular tratta gli hook di rendering).
        afterNextRender(() => { if (this.isBrowser) this.hydrated.set(true); });
        effect(() => {
            if (isDevMode() && !this.resolved()) {
                console.warn('[app-embed] contenuto non valido: provider sconosciuto, id non valido o host fuori dalla lista del provider. Non si disegna niente.', this.source());
            }
        });
        if (this.isBrowser && isDevMode()) this.listenForCspBlocks();
    }

    /** Il clic su «Carica il player»: da qui il player è caricato per questa visita; il focus passa all'iframe appena c'è. */
    protected load(): void {
        this.clicked.set(true);
        afterNextRender(() => this.frame()?.nativeElement.focus(), { injector: this.injector });
    }

    /** In sviluppo: se la CSP blocca l'host del player, dice quale riga aggiungere a `frame-src` invece di lasciare un riquadro vuoto. */
    private listenForCspBlocks(): void {
        if (cspListening) return;
        cspListening = true;
        this.document.addEventListener('securitypolicyviolation', event => {
            if (!event.violatedDirective.startsWith('frame-src') && !event.violatedDirective.startsWith('child-src')) return;
            let host: string;
            try { host = new URL(event.blockedURI).origin; } catch { return; }
            if (warnedHosts.has(host)) return;
            warnedHosts.add(host);
            console.warn(`[app-embed] la CSP ha bloccato ${host}: aggiungilo a "csp.frame-src" in security-headers.override.json.`);
        });
    }
}
