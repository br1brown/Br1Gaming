import { afterNextRender, Component, effect, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageBaseComponent } from '../page-base.component';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { FitViewportDirective } from '../../core/engine/directives/fit-viewport.directive';
import { APP_CUSTOM } from '../../core/engine/app-custom';
import { ThemeService } from '../../core/engine/services/theme.service';
import type { Map as MbMap, Marker as MbMarker } from 'mapbox-gl';

const SEARCH_LIMIT = 25;

type RadarStatus = 'init' | 'locating' | 'searching' | 'ready' | 'error';

/**
 * DRAGON RADAR — mappa a schermo pieno in stile radar.
 *
 * Apri la pagina, il radar ti localizza e mostra subito le chiese intorno a te
 * (via Mapbox, categoria church). Tap su una chiesa per vederne il nome. Stop.
 *
 * GPS/mappa sono API del browser: la logica gira solo client (in afterNextRender).
 * La rotta è renderMode 'server' così l'SSR rende la shell e popola il TransferState con
 * `Custom` (da cui leggiamo il token Mapbox) anche al caricamento diretto di /radar.
 */
@Component({
    selector: 'app-radar',
    imports: [RouterLink, TranslatePipe, FitViewportDirective],
    templateUrl: './radar.component.html',
    host: { class: 'd-block' },
})
export class RadarComponent extends PageBaseComponent<void> implements OnDestroy {
    /** Contenitore della mappa Mapbox (ref locale, non id globale: niente collisioni). */
    private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

    readonly status = signal<RadarStatus>('init');
    readonly errorMsg = signal('');

    private readonly theme = inject(ThemeService);
    /** Token Mapbox: vive in `Custom` di global-settings.local.json (gitignored), non nel
     *  codice. L'SSR lo passa al browser via TransferState (vedi APP_CUSTOM). */
    private readonly mapboxToken = (inject(APP_CUSTOM)['MapboxToken'] as string | undefined) ?? '';

    private mapboxgl: typeof import('mapbox-gl').default | null = null;
    private map?: MbMap;
    private watchId: number | null = null;
    private userMarker?: MbMarker;
    private lastPos: [number, number] | null = null;   // ultima posizione nota [lon, lat]
    private appliedTone: 'light' | 'dark' | null = null;   // tono dello stile mappa attualmente applicato

    constructor() {
        super();
        // Stile mappa legato al tema (light/dark). All'init lo imposta initMap; qui reagiamo
        // ai cambi di tema mentre la mappa è viva (i Marker DOM sopravvivono al setStyle).
        effect(() => {
            const tone = this.theme.themeTone();
            const m = this.map;
            if (!m || tone === this.appliedTone) return;
            this.appliedTone = tone;
            m.setStyle(this.styleForTone(tone));
        });
        // afterNextRender gira solo nel browser, mai in SSR: nessun isBrowser check.
        // L'altezza senza-scroll è gestita dalla direttiva appFitViewport sul template.
        afterNextRender(() => void this.start());
    }

    /** Stile Mapbox in base al tono del tema corrente. */
    private styleForTone(tone: 'light' | 'dark'): string {
        return tone === 'dark'
            ? 'mapbox://styles/mapbox/dark-v11'
            : 'mapbox://styles/mapbox/light-v11';
    }

    private async start(): Promise<void> {
        if (!this.mapboxToken) {
            // Token assente (manca Custom.MapboxToken in global-settings.local.json): senza
            // questo guard si arriverebbe a un errore mappa generico, poco diagnosticabile.
            this.fail('radarErrConfig');
            return;
        }
        if (!('geolocation' in navigator)) {
            this.fail('radarErrNoGeo');
            return;
        }
        this.status.set('locating');
        navigator.geolocation.getCurrentPosition(
            pos => void this.onFirstPosition(pos.coords.longitude, pos.coords.latitude),
            () => this.fail('radarErrDenied'),
            { enableHighAccuracy: true, timeout: 20000 },
        );
    }

    private async onFirstPosition(lon: number, lat: number): Promise<void> {
        this.lastPos = [lon, lat];
        await this.initMap(lon, lat);
        if (this.status() === 'error') return;
        this.status.set('searching');
        await this.findChurches(lon, lat);
        if (this.status() === 'error') return;
        this.status.set('ready');
        this.startWatch();
    }

    private async initMap(lon: number, lat: number): Promise<void> {
        try {
            const mb = (await import('mapbox-gl')).default;
            this.mapboxgl = mb;
            mb.accessToken = this.mapboxToken;
            const tone = this.theme.themeTone();
            this.appliedTone = tone;
            this.map = new mb.Map({
                container: this.mapContainer().nativeElement,
                style: this.styleForTone(tone),
                center: [lon, lat],
                zoom: 15,
                minZoom: 11,        // niente "tutta Italia": il radar resta a misura di quartiere
                pitch: 50,
                attributionControl: false,
            });
            const el = document.createElement('div');
            // Marker posizione: Bootstrap non ha un "pallino mappa", basta lo stretto
            // necessario perché sia visibile (è DOM creato da Mapbox, non template).
            el.style.cssText = 'width:14px;height:14px;border-radius:50%;background:#39ff14;box-shadow:0 0 8px #39ff14';
            this.userMarker = new mb.Marker({ element: el }).setLngLat([lon, lat]).addTo(this.map);
            await this.mapLoaded();
        } catch {
            this.fail('radarErrMap');
        }
    }

    /** Risolve quando lo stile della mappa è pronto. */
    private mapLoaded(): Promise<void> {
        return new Promise<void>(resolve => {
            if (!this.map || this.map.loaded()) resolve();
            else this.map.once('load', () => resolve());
        });
    }

    /** Riporta la camera centrata sul tuo simbolo, come il tasto "posizione" di Maps. */
    recenter(): void {
        if (this.lastPos) this.map?.easeTo({ center: this.lastPos, zoom: 16, duration: 600 });
    }

    /** Cerca le chiese vicine e le mette subito sulla mappa (tap sul marker = nome). */
    private async findChurches(lon: number, lat: number): Promise<void> {
        try {
            const url = `https://api.mapbox.com/search/searchbox/v1/category/church`
                + `?access_token=${this.mapboxToken}&proximity=${lon},${lat}&limit=${SEARCH_LIMIT}&language=it`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('search failed');
            const data = await res.json() as {
                features?: Array<{ properties?: { name?: string }; geometry?: { coordinates?: [number, number] } }>;
            };
            const churches = (data.features ?? [])
                .filter(f => f.geometry?.coordinates)
                .map(f => ({
                    name: f.properties?.name ?? this.translate.t('radarChurchUnnamed'),
                    lon: f.geometry!.coordinates![0],
                    lat: f.geometry!.coordinates![1],
                }));

            if (churches.length === 0) {
                this.fail('radarErrNoChurch');
                return;
            }

            const mb = this.mapboxgl!;
            for (const c of churches) {
                const el = document.createElement('div');
                el.style.cssText = 'font-size:1.6rem;line-height:1;cursor:pointer';
                el.textContent = '⛪';
                new mb.Marker({ element: el })
                    .setLngLat([c.lon, c.lat])
                    .setPopup(new mb.Popup({ offset: 18, closeButton: false }).setText(c.name))
                    .addTo(this.map!);
            }
        } catch {
            this.fail('radarErrSearch');
        }
    }

    private startWatch(): void {
        this.watchId = navigator.geolocation.watchPosition(
            pos => {
                const { longitude: lon, latitude: lat } = pos.coords;
                this.lastPos = [lon, lat];
                this.userMarker?.setLngLat([lon, lat]);
                // Niente auto-centratura: la camera resta dove l'hai messa tu — usa il
                // bottone "centra su di me" per tornare sul tuo simbolo (come su Maps).
            },
            () => { /* posizione momentaneamente persa: teniamo l'ultimo stato */ },
            { enableHighAccuracy: true, maximumAge: 1500 },
        );
    }

    /** `key` è una chiave di traduzione: il template la passa alla pipe `translate`. */
    private fail(key: string): void {
        this.status.set('error');
        this.errorMsg.set(key);
    }

    ngOnDestroy(): void {
        if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
        this.map?.remove();
    }
}
