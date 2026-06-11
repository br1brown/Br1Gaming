import { afterNextRender, Component, computed, effect, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageBaseComponent } from '../page-base.component';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { FitViewportDirective } from '../../core/engine/directives/fit-viewport.directive';
import { APP_CUSTOM } from '../../core/engine/app-custom';
import { ThemeService } from '../../core/engine/services/theme.service';
import type { Map as MbMap, Marker as MbMarker, GeoJSONSource } from 'mapbox-gl';

const UNLOCK_RADIUS_M = 1000;
const CHURCH_COUNT = 7;
const RANGE_SOURCE = 'radar-range';   // id del source GeoJSON del cerchio-raggio

interface SacredChurch {
    name: string;
    lon: number;
    lat: number;
    distance: number;          // metri dall'utente
    bearing: number;           // gradi (0 = nord) dall'utente alla chiesa
    found: boolean;
    marker: MbMarker;
}

type RadarStatus = 'init' | 'locating' | 'searching' | 'ready' | 'error';

/**
 * DRAGON RADAR — pagina-gioco a schermo pieno (stile scouter).
 *
 * Le "sfere del drago" sono le 7 chiese più vicine, trovate via Mapbox (categoria church).
 * Nascoste finché non ti avvicini entro 1000 m: a quel punto si rivelano sulla mappa
 * (con vibrazione). L'HUD fa da radar e punta verso la chiesa più vicina ancora da trovare.
 *
 * GPS/bussola/mappa sono API del browser: la logica gira solo client (in afterNextRender).
 * La rotta è renderMode 'server' così l'SSR rende la shell e popola il TransferState con
 * `Custom` (da cui leggiamo il token Mapbox) anche al caricamento diretto di /radar.
 */
@Component({
    selector: 'app-radar',
    imports: [DecimalPipe, RouterLink, TranslatePipe, FitViewportDirective],
    templateUrl: './radar.component.html',
    styleUrl: './radar.component.css',
})
export class RadarComponent extends PageBaseComponent<void> implements OnDestroy {
    /** Contenitore della mappa Mapbox (ref locale, non id globale: niente collisioni). */
    private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

    readonly status = signal<RadarStatus>('init');
    readonly errorMsg = signal('');
    readonly churches = signal<SacredChurch[]>([]);
    readonly heading = signal<number | null>(null);
    readonly needsCompassPermission = signal(false);

    readonly foundCount = computed(() => this.churches().filter(c => c.found).length);
    readonly total = computed(() => this.churches().length);
    readonly allFound = computed(() => this.total() > 0 && this.foundCount() === this.total());
    readonly nearestUnfound = computed(() =>
        this.churches().filter(c => !c.found).sort((a, b) => a.distance - b.distance)[0] ?? null);

    /** Angolo della freccia del radar: direzione alla chiesa, relativa a dove guardi (bussola). */
    readonly arrowAngle = computed(() => {
        const target = this.nearestUnfound();
        if (!target) return 0;
        const h = this.heading() ?? 0;
        return ((target.bearing - h) % 360 + 360) % 360;
    });

    private readonly theme = inject(ThemeService);
    /** Token Mapbox: vive in `Custom` di global-settings.local.json (gitignored), non nel
     *  codice. L'SSR lo passa al browser via TransferState (vedi APP_CUSTOM). */
    private readonly mapboxToken = (inject(APP_CUSTOM)['MapboxToken'] as string | undefined) ?? '';

    private mapboxgl: typeof import('mapbox-gl').default | null = null;
    private map?: MbMap;
    private watchId: number | null = null;
    private userMarker?: MbMarker;
    private orientationHandler?: (e: DeviceOrientationEvent) => void;
    private lastPos: [number, number] | null = null;   // ultima posizione nota [lon, lat]
    private appliedTone: 'light' | 'dark' | null = null;   // tono dello stile mappa attualmente applicato

    constructor() {
        super();
        // Stile mappa legato al tema (light/dark). All'init lo imposta initMap; qui reagiamo
        // ai cambi di tema mentre la mappa è viva: setStyle azzera source/layer, quindi
        // ri-aggiungiamo il cerchio-raggio a stile ricaricato (i Marker DOM restano).
        effect(() => {
            const tone = this.theme.themeTone();
            const m = this.map;
            if (!m || tone === this.appliedTone) return;
            this.appliedTone = tone;
            m.setStyle(this.styleForTone(tone));
            m.once('style.load', () => { const p = this.lastPos; if (p) this.addRangeCircle(p[0], p[1]); });
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
        this.evaluate(lon, lat);
        this.startWatch();
        this.startCompass();
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
            el.className = 'radar-you';
            this.userMarker = new mb.Marker({ element: el }).setLngLat([lon, lat]).addTo(this.map);
            await this.mapLoaded();
            this.addRangeCircle(lon, lat);
        } catch {
            this.fail('radarErrMap');
        }
    }

    /** Risolve quando lo stile della mappa è pronto (serve prima di addSource/addLayer). */
    private mapLoaded(): Promise<void> {
        return new Promise<void>(resolve => {
            if (!this.map || this.map.loaded()) resolve();
            else this.map.once('load', () => resolve());
        });
    }

    /** Cerchio (1000 m) che mostra fin dove "arriva" il radar; segue la tua posizione. */
    private addRangeCircle(lon: number, lat: number): void {
        if (!this.map || this.map.getSource(RANGE_SOURCE)) return;
        this.map.addSource(RANGE_SOURCE, { type: 'geojson', data: rangeCircle(lon, lat, UNLOCK_RADIUS_M) });
        this.map.addLayer({
            id: 'radar-range-fill', type: 'fill', source: RANGE_SOURCE,
            paint: { 'fill-color': '#39ff14', 'fill-opacity': 0.07 },
        });
        this.map.addLayer({
            id: 'radar-range-ring', type: 'line', source: RANGE_SOURCE,
            paint: { 'line-color': '#39ff14', 'line-width': 2, 'line-opacity': 0.85, 'line-dasharray': [3, 2] },
        });
    }

    private updateRangeCircle(lon: number, lat: number): void {
        const src = this.map?.getSource(RANGE_SOURCE) as GeoJSONSource | undefined;
        src?.setData(rangeCircle(lon, lat, UNLOCK_RADIUS_M));
    }

    /** Riporta la camera centrata sul tuo simbolo, come il tasto "posizione" di Maps. */
    recenter(): void {
        if (this.lastPos) this.map?.easeTo({ center: this.lastPos, zoom: 16, duration: 600 });
    }

    private async findChurches(lon: number, lat: number): Promise<void> {
        try {
            const url = `https://api.mapbox.com/search/searchbox/v1/category/church`
                + `?access_token=${this.mapboxToken}&proximity=${lon},${lat}&limit=25&language=it`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('search failed');
            const data = await res.json() as {
                features?: Array<{ properties?: { name?: string }; geometry?: { coordinates?: [number, number] } }>;
            };
            const nearest = (data.features ?? [])
                .filter(f => f.geometry?.coordinates)
                .map(f => {
                    const [clon, clat] = f.geometry!.coordinates!;
                    return { name: f.properties?.name ?? this.translate.t('radarChurchUnnamed'), lon: clon, lat: clat };
                })
                .map(c => ({ ...c, distance: haversine(lat, lon, c.lat, c.lon), bearing: bearing(lat, lon, c.lat, c.lon) }))
                .sort((a, b) => a.distance - b.distance)
                .slice(0, CHURCH_COUNT);

            if (nearest.length === 0) {
                this.fail('radarErrNoChurch');
                return;
            }

            const mb = this.mapboxgl!;
            const withMarkers: SacredChurch[] = nearest.map(c => {
                const el = document.createElement('div');
                el.className = 'church-marker';   // nascosto finché non trovato (vedi CSS)
                el.textContent = '⛪';
                const marker = new mb.Marker({ element: el }).setLngLat([c.lon, c.lat]).addTo(this.map!);
                return { ...c, found: false, marker };
            });
            this.churches.set(withMarkers);
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
                this.updateRangeCircle(lon, lat);
                this.evaluate(lon, lat);
                // Niente auto-centratura: la camera resta dove l'hai messa tu — usa il
                // bottone "centra su di me" per tornare sul tuo simbolo (come su Maps).
            },
            () => { /* posizione momentaneamente persa: teniamo l'ultimo stato */ },
            { enableHighAccuracy: true, maximumAge: 1500 },
        );
    }

    /** Ricalcola distanze/bearing e rivela le chiese entro il raggio. */
    private evaluate(lon: number, lat: number): void {
        const updated = this.churches().map(c => {
            const distance = haversine(lat, lon, c.lat, c.lon);
            const found = c.found || distance <= UNLOCK_RADIUS_M;
            if (found && !c.found) {
                c.marker.getElement().classList.add('found');
                navigator.vibrate?.([60, 40, 140]);
            }
            return { ...c, distance, bearing: bearing(lat, lon, c.lat, c.lon), found };
        });
        this.churches.set(updated);
    }

    private startCompass(): void {
        this.orientationHandler = (e: DeviceOrientationEvent) => {
            const webkit = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
            const h = webkit ?? (e.alpha != null ? 360 - e.alpha : null);
            if (h != null) this.heading.set((h % 360 + 360) % 360);
        };
        const DOE = window.DeviceOrientationEvent as
            (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> }) | undefined;
        if (DOE && typeof DOE.requestPermission === 'function') {
            this.needsCompassPermission.set(true);   // iOS: serve un tap dell'utente
        } else if (DOE) {
            window.addEventListener('deviceorientation', this.orientationHandler, true);
        }
    }

    /** iOS: la bussola richiede un permesso esplicito attivato da un gesto utente. */
    async enableCompass(): Promise<void> {
        const DOE = window.DeviceOrientationEvent as
            typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> };
        try {
            const perm = await DOE.requestPermission!();
            if (perm === 'granted' && this.orientationHandler) {
                window.addEventListener('deviceorientation', this.orientationHandler, true);
                this.needsCompassPermission.set(false);
            }
        } catch { /* permesso negato */ }
    }

    /** `key` è una chiave di traduzione: il template la passa alla pipe `translate`. */
    private fail(key: string): void {
        this.status.set('error');
        this.errorMsg.set(key);
    }

    ngOnDestroy(): void {
        // I listener su window (resize/orientationchange) li rimuove Angular: sono
        // dichiarati nell'host. Qui resta solo ciò che Angular non conosce.
        if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
        if (this.orientationHandler) window.removeEventListener('deviceorientation', this.orientationHandler, true);
        this.map?.remove();
    }
}

/** Distanza in metri tra due coordinate (formula dell'emisenoverso). */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Anello geografico di raggio `radiusM` attorno a [lon,lat] (poligono per il cerchio-raggio). */
function rangeCircle(lon: number, lat: number, radiusM: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> {
    const R = 6371000;
    const toRad = (d: number) => d * Math.PI / 180;
    const toDeg = (r: number) => r * 180 / Math.PI;
    const φ1 = toRad(lat), λ1 = toRad(lon), dR = radiusM / R;
    const ring: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
        const θ = (i / steps) * 2 * Math.PI;
        const φ2 = Math.asin(Math.sin(φ1) * Math.cos(dR) + Math.cos(φ1) * Math.sin(dR) * Math.cos(θ));
        const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(dR) * Math.cos(φ1), Math.cos(dR) - Math.sin(φ1) * Math.sin(φ2));
        ring.push([toDeg(λ2), toDeg(φ2)]);
    }
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} };
}

/** Rotta iniziale (gradi, 0 = nord) dal punto 1 al punto 2. */
function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (d: number) => d * Math.PI / 180;
    const φ1 = toRad(lat1), φ2 = toRad(lat2), Δλ = toRad(lon2 - lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
