import { afterNextRender, Component, effect, ElementRef, inject, OnDestroy, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageBaseComponent } from '../page-base.component';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { APP_CUSTOM } from '../../core/engine/app-custom';
import { ThemeService } from '../../core/engine/services/theme.service';
import type { Map as MbMap, Marker as MbMarker } from 'mapbox-gl';

const SEARCH_LIMIT = 25;

type RadarStatus = 'init' | 'locating' | 'searching' | 'ready' | 'error';

/**
 * CHIESA RADAR — mappa a schermo pieno in stile radar.
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
    imports: [RouterLink, TranslatePipe],
    templateUrl: './radar.component.html',
    styleUrl: './radar.component.css',
    // None come per cookie-banner: il CSS mira al popup Mapbox, DOM creato dalla
    // libreria fuori dal template → l'encapsulation emulated non lo raggiungerebbe.
    encapsulation: ViewEncapsulation.None,
    // Vista a tutto schermo: la rotta è `layout: { fitViewport: true }` in site.ts. L'altezza
    // piena la danno l'Engine (regola .fit-viewport in base.css sull'host instradato) e il
    // `flex-grow-1` sul root del template. Niente direttiva né classi display sull'host.
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
    /** Poligono del cerchio di portata: centro = posizione della ricerca, raggio = chiesa più lontana. */
    private rangeCircle: GeoJSON.Feature<GeoJSON.Polygon> | null = null;

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
            // setStyle azzera source e layer custom: il cerchio di portata va
            // ri-aggiunto quando il nuovo stile è pronto.
            m.once('style.load', () => this.addRangeCircle());
        });
        // afterNextRender gira solo nel browser, mai in SSR: nessun isBrowser check.
        // L'altezza senza-scroll è gestita dal layout fitViewport (flag in site.ts + .fit-viewport).
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
                features?: Array<{
                    properties?: { name?: string; full_address?: string; place_formatted?: string };
                    geometry?: { coordinates?: [number, number] };
                }>;
            };
            const churches = (data.features ?? [])
                .filter(f => f.geometry?.coordinates)
                .map(f => ({
                    name: f.properties?.name ?? this.translate.t('radarChurchUnnamed'),
                    // Indirizzo per la ricerca Google: full_address è il più completo,
                    // place_formatted (città/provincia) il fallback della Search Box API.
                    address: f.properties?.full_address ?? f.properties?.place_formatted ?? '',
                    lon: f.geometry!.coordinates![0],
                    lat: f.geometry!.coordinates![1],
                }));

            if (churches.length === 0) {
                this.fail('radarErrNoChurch');
                return;
            }

            // Cerchio di portata: la ricerca è "le N più vicine", non ha un raggio fisso —
            // il confine reale del radar è la chiesa più lontana trovata. Senza il cerchio
            // sembrerebbe che oltre non ci sia nulla; così si capisce che il radar si ferma lì.
            const maxDist = Math.max(...churches.map(c => RadarComponent.distanceM(lon, lat, c.lon, c.lat)));
            this.rangeCircle = RadarComponent.circleFeature(lon, lat, maxDist * 1.05);
            this.addRangeCircle();

            const mb = this.mapboxgl!;
            for (const c of churches) {
                const el = document.createElement('div');
                el.style.cssText = 'font-size:1.6rem;line-height:1;cursor:pointer';
                el.textContent = '⛪';
                new mb.Marker({ element: el })
                    .setLngLat([c.lon, c.lat])
                    .setPopup(new mb.Popup({ offset: 18, closeButton: false })
                        .setDOMContent(this.buildPopupContent(c)))
                    .addTo(this.map!);
            }
        } catch {
            this.fail('radarErrSearch');
        }
    }

    /**
     * Contenuto del popup: nome della chiesa, indirizzo in muted, bottone Google Maps.
     * Deep link "Maps URLs" ufficiale (`/maps/search/?api=1`): nessuna API key,
     * su mobile apre direttamente l'app. La query usa nome + indirizzo insieme:
     * il solo indirizzo fa atterrare Maps sul civico generico (suggerimenti e
     * domande invece del luogo); il nome lo aggancia al POI giusto.
     * Senza indirizzo si ripiega sulle coordinate esatte.
     * DOM costruito a mano via textContent — i dati arrivano dall'API Mapbox e
     * setDOMContent (a differenza di setHTML) non rischia injection.
     */
    private buildPopupContent(c: { name: string; address: string; lon: number; lat: number }): HTMLElement {
        const root = document.createElement('div');
        const title = document.createElement('p');
        title.className = 'fw-bold mb-1';
        title.textContent = c.name;
        root.append(title);
        if (c.address) {
            const addr = document.createElement('p');
            addr.className = 'text-secondary small mb-2';
            addr.textContent = c.address;
            root.append(addr);
        }
        const link = document.createElement('a');
        link.className = 'btn btn-primary btn-sm w-100';
        link.target = '_blank';
        link.rel = 'noopener';
        link.href = 'https://www.google.com/maps/search/?api=1&query='
            + encodeURIComponent(c.address ? `${c.name} ${c.address}` : `${c.lat},${c.lon}`);
        link.textContent = this.translate.t('radarGoogleMaps');
        root.append(link);
        return root;
    }

    /**
     * Disegna il cerchio di portata del radar (fill tenue + bordo tratteggiato,
     * stesso verde del marker posizione). Idempotente: se il source esiste già non
     * fa nulla — viene chiamata sia dopo la ricerca sia a ogni cambio di stile.
     */
    private addRangeCircle(): void {
        const m = this.map;
        if (!m || !this.rangeCircle || m.getSource('radar-range')) return;
        m.addSource('radar-range', { type: 'geojson', data: this.rangeCircle });
        m.addLayer({
            id: 'radar-range-fill', type: 'fill', source: 'radar-range',
            paint: { 'fill-color': '#39ff14', 'fill-opacity': 0.05 },
        });
        m.addLayer({
            id: 'radar-range-line', type: 'line', source: 'radar-range',
            paint: { 'line-color': '#39ff14', 'line-opacity': 0.6, 'line-width': 2, 'line-dasharray': [2, 2] },
        });
    }

    /** Distanza haversine in metri tra due punti [lon, lat]. */
    private static distanceM(lon1: number, lat1: number, lon2: number, lat2: number): number {
        const rad = Math.PI / 180;
        const dLat = (lat2 - lat1) * rad;
        const dLon = (lon2 - lon1) * rad;
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
        return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * Poligono GeoJSON circolare di raggio `radiusM` metri attorno a [lon, lat].
     * Approssimazione equirettangolare (64 vertici): più che sufficiente su scala
     * di quartiere, evita di portarsi dietro una libreria turf per un cerchio.
     */
    private static circleFeature(lon: number, lat: number, radiusM: number): GeoJSON.Feature<GeoJSON.Polygon> {
        const dLat = (radiusM / 6371000) * (180 / Math.PI);
        const dLon = dLat / Math.cos(lat * Math.PI / 180);
        const ring: [number, number][] = [];
        for (let i = 0; i <= 64; i++) {
            const t = (i / 64) * 2 * Math.PI;
            ring.push([lon + dLon * Math.cos(t), lat + dLat * Math.sin(t)]);
        }
        return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
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
