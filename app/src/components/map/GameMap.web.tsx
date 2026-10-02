import 'maplibre-gl/dist/maplibre-gl.css';

import { Asset } from 'expo-asset';
import maplibregl, { type GeoJSONSource, type Map as MLMap, type StyleSpecification } from 'maplibre-gl';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { View } from 'react-native';

import type { TileFeature } from '@/lib/api';
import { Images } from '@/lib/assets';
import { colors, teams } from '@/lib/theme';

import { tileStyle, type GameMapProps } from './types';

const VECTOR_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const RASTER_FALLBACK: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.6, 'raster-brightness-max': 0.95 } },
  ],
};
const STREAM_ATTRIBUTION = 'Streams © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> (ODbL)';

/** Warm, simple "game board" tint over the muted positron base. */
const TINT: [string, string, string][] = [
  ['background', 'background-color', '#EEF2DF'],
  ['water', 'fill-color', '#7FC8EE'],
  ['park', 'fill-color', '#C2E3A4'],
  ['landcover_wood', 'fill-color', '#B5DB98'],
  ['landuse_residential', 'fill-color', '#EAE6D6'],
  ['building', 'fill-color', '#E2DCC8'],
  ['waterway', 'line-color', '#7FC8EE'],
  ['highway_minor', 'line-color', '#FFFDF6'],
  ['highway_path', 'line-color', '#F6F1E2'],
  ['highway_major_casing', 'line-color', '#E6DDC4'],
  ['highway_motorway_casing', 'line-color', '#E6DDC4'],
];
/** Labels and icons that make the map busy: hidden so the game reads clearly. Place names stay. */
const HIDE = /^(airport|label_other|highway-shield|road_shield|highway-name-path|highway-name-minor|waterway_line_label|aeroway)/;

/** Map icons: [name, image module, CSS size in px]. Loaded from the processed image pack. */
const ICONS: [string, unknown, number][] = [
  ['marker-disputed', Images.marker.disputed, 40],
  ['marker-unsafe', Images.marker.unsafe, 36],
  ['marker-fog', Images.marker.fog, 40],
  ['flag-otters', Images.flag.otters, 34],
  ['flag-frogs', Images.flag.frogs, 34],
  ['flag-kingfishers', Images.flag.kingfishers, 34],
  ['healed', Images.effect.sparkle, 26],
  ...(['pipe', 'trash', 'wildlife', 'plant', 'algae'] as const).map((t) => [`treasure-${t}`, Images.treasure[t], 38] as [string, unknown, number]),
];

/** URL of a bundled image. On web, require() gives a URL string or {uri}; on native, a number. */
function assetUri(mod: unknown): string | null {
  try {
    if (typeof mod === 'string') return mod;
    if (mod && typeof mod === 'object' && 'uri' in mod) return String((mod as { uri: string }).uri);
    if (typeof mod === 'number') return Asset.fromModule(mod).uri;
  } catch {
    /* fall through */
  }
  return null;
}

/** Add every icon to the current style. Missing images are skipped (the layer then shows nothing). */
function loadIcons(map: MLMap) {
  for (const [name, mod, css] of ICONS) {
    const uri = assetUri(mod);
    if (!uri || map.hasImage(name)) continue;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: Math.max(1, img.naturalWidth / css) });
    };
    img.src = uri;
  }
}

const CSS = `
@keyframes sr-pulse { 0% { transform: scale(0.6); opacity: 0.8 } 100% { transform: scale(2.6); opacity: 0 } }
@keyframes sr-bob { 0%,100% { transform: translateY(0) scale(1) } 50% { transform: translateY(-4px) scale(1.12) } }
@keyframes sr-float { 0% { transform: translateY(0) scale(0.6); opacity: 0 } 15% { opacity: 1; transform: translateY(-10px) scale(1.15) } 100% { transform: translateY(-90px) scale(1); opacity: 0 } }
@keyframes sr-coin { 0% { transform: translate(0,0) scale(0.4); opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 0 } }
.sr-me { position: relative; width: 22px; height: 22px; }
.sr-me .ring { position: absolute; inset: 0; border-radius: 50%; background: var(--c); animation: sr-pulse 1.8s ease-out infinite; }
.sr-me .pin { position: absolute; left: -9px; bottom: 8px; width: 40px; height: 40px; filter: drop-shadow(0 3px 3px rgba(0,0,0,.4)); }
.sr-me .dot { position: absolute; inset: 3px; border-radius: 50%; background: var(--c); border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.4); }
.sr-float { font: 900 28px Cinzel_900Black, Cinzel, serif; color: #F2C94C; text-shadow: 0 2px 0 #7a5a00, 0 0 12px rgba(242,201,76,.8); animation: sr-float 2.2s ease-out forwards; pointer-events: none; white-space: nowrap; }
.sr-coin { position: absolute; left: 0; top: 0; width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff6c8, #F2C94C 45%, #C9971C); box-shadow: 0 0 6px rgba(242,201,76,.9); animation: sr-coin 1.1s ease-out forwards; }
.maplibregl-ctrl-attrib { font-size: 10px; }
.maplibregl-ctrl-top-right { top: var(--sr-ctrl-top, 0px); }
`;

function ensureCss() {
  if (typeof document === 'undefined' || document.getElementById('sr-map-css')) return;
  const el = document.createElement('style');
  el.id = 'sr-map-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

const TILE_LAYERS = ['sym-disputed', 'sym-treasure', 'sym-unsafe', 'sym-flag', 'tile-hit'];

export default function GameMap(props: GameMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const readyRef = useRef(false);
  const propsRef = useRef(props);
  const meRef = useRef<maplibregl.Marker | null>(null);
  // Keep the latest props for map event handlers (they are bound once).
  useLayoutEffect(() => {
    propsRef.current = props;
  });

  // ---- create map once ----
  useEffect(() => {
    ensureCss();
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: VECTOR_STYLE,
      center: props.center,
      zoom: props.zoom,
      attributionControl: { compact: true, customAttribution: STREAM_ATTRIBUTION },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    let usedFallback = false;
    let tilesTimer: ReturnType<typeof setTimeout> | undefined;
    const fallback = (why: string) => {
      if (usedFallback) return;
      usedFallback = true;
      clearTimeout(tilesTimer);
      console.warn(`[map] ${why}: using OpenStreetMap raster tiles`);
      readyRef.current = false;
      map.setStyle(RASTER_FALLBACK);
    };
    const fallbackTimer = setTimeout(() => !readyRef.current && fallback('Vector style did not load in 9 s'), 9000);
    map.on('error', (e) => {
      if (!readyRef.current && String(e?.error?.message ?? '').match(/style|fetch|Failed/i)) fallback('Vector style failed');
    });
    // The style can load while its tiles are very slow (seen with OpenFreeMap). Then switch too.
    map.once('style.load', () => {
      tilesTimer = setTimeout(() => {
        let ok = true;
        try {
          ok = map.isSourceLoaded('openmaptiles'); // the base map source of the OpenFreeMap style
        } catch {
          ok = true; // another style without that source: leave it alone
        }
        if (!ok) fallback('Base map tiles did not arrive in 12 s');
      }, 12000);
    });

    map.on('style.load', () => {
      clearTimeout(fallbackTimer);
      for (const l of map.getStyle().layers ?? []) if (HIDE.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none');
      for (const [layer, prop, value] of TINT) {
        try {
          if (map.getLayer(layer)) map.setPaintProperty(layer, prop as never, value);
        } catch {
          /* layer differs in this style */
        }
      }
      addGameLayers(map);
      loadIcons(map);
      // Start with the attribution collapsed to its (i) button so it does not cover the game buttons.
      map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      readyRef.current = true;
      syncData(map, propsRef.current);
    });

    map.on('click', (e) => {
      const p = propsRef.current;
      const box: [[number, number], [number, number]] = [
        [e.point.x - 8, e.point.y - 8],
        [e.point.x + 8, e.point.y + 8],
      ];
      const cluster = readyRef.current ? map.queryRenderedFeatures(box, { layers: ['treasure-cluster'] })[0] : undefined;
      if (cluster) {
        map.easeTo({ center: (cluster.geometry as GeoJSON.Point).coordinates as [number, number], zoom: map.getZoom() + 2 });
        return;
      }
      const hit = readyRef.current ? map.queryRenderedFeatures(box, { layers: TILE_LAYERS.filter((l) => map.getLayer(l)) }) : [];
      const id = hit[0]?.properties?.id as string | undefined;
      if (id && p.onTilePress) p.onTilePress(id);
      else p.onMapPress?.({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });
    map.on('mousemove', (e) => {
      if (!readyRef.current) return;
      const hit = map.queryRenderedFeatures(
        [
          [e.point.x - 6, e.point.y - 6],
          [e.point.x + 6, e.point.y + 6],
        ],
        { layers: [...TILE_LAYERS, 'treasure-cluster'].filter((l) => map.getLayer(l)) },
      );
      map.getCanvas().style.cursor = hit.length ? 'pointer' : propsRef.current.onMapPress ? 'crosshair' : '';
    });

    // Pulse animation for fading tiles, the claimable highlight and disputes.
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (!readyRef.current || t - last < 50) return;
      last = t;
      const s = (Math.sin(t / 650) + 1) / 2;
      try {
        map.setPaintProperty('tile-fading', 'line-opacity', 0.35 + 0.35 * s);
        map.setPaintProperty('tile-highlight', 'line-opacity', 0.35 + 0.5 * s);
        map.setPaintProperty('tile-disputed', 'line-opacity', 0.55 + 0.45 * s);
        map.setPaintProperty('sym-disputed', 'icon-opacity', 0.65 + 0.35 * s);
      } catch {
        /* style reloading */
      }
    };
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallbackTimer);
      clearTimeout(tilesTimer);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- data ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    syncData(map, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.tiles, props.filter, props.mode, props.myTeam, props.highlightTileId, props.selectedTileId]);

  // ---- my position ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!props.position) {
      meRef.current?.remove();
      meRef.current = null;
      return;
    }
    const ll: [number, number] = [props.position.lon, props.position.lat];
    if (!meRef.current) {
      const el = document.createElement('div');
      el.className = 'sr-me';
      el.style.setProperty('--c', props.myTeam ? teams[props.myTeam].color : colors.water);
      const pin = assetUri(Images.marker.player);
      el.innerHTML = pin ? `<div class="ring"></div><img class="pin" src="${pin}" alt="You are here" />` : '<div class="ring"></div><div class="dot"></div>';
      el.title = 'You are here';
      meRef.current = new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map);
    } else {
      meRef.current.setLngLat(ll);
    }
    if (props.followPosition) {
      const b = map.getBounds();
      const pad = 0.2;
      const w = b.getEast() - b.getWest();
      const h = b.getNorth() - b.getSouth();
      const inside =
        ll[0] > b.getWest() + w * pad && ll[0] < b.getEast() - w * pad && ll[1] > b.getSouth() + h * pad && ll[1] < b.getNorth() - h * pad;
      if (!inside) map.easeTo({ center: ll, duration: 600 });
    }
  }, [props.position, props.myTeam, props.followPosition]);

  // ---- claim "paint" animation ----
  useEffect(() => {
    const map = mapRef.current;
    const flash = props.flash;
    if (!map || !flash || Date.now() - flash.at > 15_000) return;
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      const f = propsRef.current.tiles?.features.find((t) => t.id === flash.tileId);
      if (!f || !readyRef.current) {
        setTimeout(start, 300);
        return;
      }
      const color = teams[flash.team].color;
      (map.getSource('flash') as GeoJSONSource).setData({ type: 'FeatureCollection', features: [f as never] });
      map.easeTo({ center: f.properties.center, zoom: Math.max(map.getZoom(), 16), duration: 700 });
      const t0 = performance.now();
      const step = () => {
        if (cancelled) return;
        const k = Math.min(1, (performance.now() - t0) / 1400);
        const a = Math.max(0.0001, k);
        map.setPaintProperty('flash', 'line-gradient', [
          'interpolate', ['linear'], ['line-progress'],
          0, color, Math.max(0, a - 0.0001), color, a, 'rgba(255,255,255,0.9)', Math.min(1, a + 0.0002), 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0)',
        ] as never);
        if (k < 1) requestAnimationFrame(step);
        else setTimeout(() => !cancelled && (map.getSource('flash') as GeoJSONSource).setData({ type: 'FeatureCollection', features: [] }), 2500);
      };
      requestAnimationFrame(step);
      // Coin burst and floating points.
      const el = document.createElement('div');
      el.style.position = 'relative';
      for (let i = 0; i < 12; i++) {
        const c = document.createElement('div');
        c.className = 'sr-coin';
        const ang = (i / 12) * Math.PI * 2;
        c.style.setProperty('--dx', `${Math.cos(ang) * (50 + Math.random() * 30)}px`);
        c.style.setProperty('--dy', `${Math.sin(ang) * (50 + Math.random() * 30) - 20}px`);
        c.style.animationDelay = `${Math.random() * 0.15}s`;
        el.appendChild(c);
      }
      const txt = document.createElement('div');
      txt.className = 'sr-float';
      txt.textContent = `+${flash.points}`;
      txt.style.position = 'absolute';
      txt.style.left = '-30px';
      txt.style.top = '-30px';
      el.appendChild(txt);
      const marker = new maplibregl.Marker({ element: el }).setLngLat(f.properties.center).addTo(map);
      setTimeout(() => marker.remove(), 2600);
    };
    const timer = setTimeout(start, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [props.flash]);

  return (
    <View style={[{ flex: 1, overflow: 'hidden', backgroundColor: '#E9EFE6' }, props.style]}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, ['--sr-ctrl-top' as string]: `${props.controlsTop ?? 0}px` }} />
    </View>
  );
}

function addGameLayers(map: MLMap) {
  const empty = { type: 'FeatureCollection' as const, features: [] };
  map.addSource('tiles', { type: 'geojson', data: empty });
  map.addSource('flash', { type: 'geojson', data: empty, lineMetrics: true });
  const round = { 'line-cap': 'round' as const, 'line-join': 'round' as const };
  const W = (base: number) => ['interpolate', ['linear'], ['zoom'], 12, base * 0.45, 15, base, 18, base * 1.8] as never;

  map.addLayer({ id: 'stream-base', type: 'line', source: 'tiles', layout: round, paint: { 'line-color': colors.water, 'line-width': W(4), 'line-opacity': 0.8 } });
  map.addLayer({
    id: 'tile-highlight', type: 'line', source: 'tiles', layout: round,
    filter: ['==', ['get', 'highlight'], true],
    paint: { 'line-color': colors.gold, 'line-width': W(22), 'line-blur': 4, 'line-opacity': 0.6 },
  });
  map.addLayer({
    id: 'tile-glow', type: 'line', source: 'tiles', layout: round,
    filter: ['all', ['==', ['get', 'state'], 'owned_fresh'], ['==', ['get', 'visible'], true]],
    paint: { 'line-color': ['get', 'color'], 'line-width': W(20), 'line-blur': 7, 'line-opacity': 0.5 },
  });
  map.addLayer({
    id: 'tile-casing', type: 'line', source: 'tiles', layout: round,
    filter: ['all', ['!=', ['get', 'state'], 'fog'], ['==', ['get', 'visible'], true]],
    paint: { 'line-color': '#FFFFFF', 'line-width': W(14), 'line-opacity': 0.95 },
  });
  map.addLayer({
    id: 'tile-fog-cloud', type: 'line', source: 'tiles', layout: round,
    filter: ['all', ['==', ['get', 'state'], 'fog'], ['==', ['get', 'visible'], true]],
    paint: { 'line-color': '#FFFFFF', 'line-width': W(18), 'line-blur': 8, 'line-opacity': 0.75 },
  });
  map.addLayer({
    id: 'tile-fog', type: 'line', source: 'tiles',
    filter: ['==', ['get', 'state'], 'fog'],
    paint: { 'line-color': ['get', 'color'], 'line-width': W(8), 'line-dasharray': [1.2, 0.9], 'line-opacity': ['case', ['get', 'visible'], 0.9, 0.18] },
  });
  map.addLayer({
    id: 'tile-main', type: 'line', source: 'tiles', layout: round,
    filter: ['all', ['in', ['get', 'state'], ['literal', ['owned_fresh', 'neutral']]]],
    paint: { 'line-color': ['get', 'color'], 'line-width': W(9), 'line-opacity': ['case', ['get', 'visible'], 1, 0.15] },
  });
  map.addLayer({
    id: 'tile-fading', type: 'line', source: 'tiles', layout: round,
    filter: ['==', ['get', 'state'], 'owned_fading'],
    paint: { 'line-color': ['get', 'color'], 'line-width': W(9), 'line-opacity': 0.55 },
  });
  map.addLayer({
    id: 'tile-disputed', type: 'line', source: 'tiles', layout: round,
    filter: ['==', ['get', 'state'], 'disputed'],
    paint: { 'line-color': ['get', 'color'], 'line-width': W(10), 'line-opacity': 0.9 },
  });
  map.addLayer({
    id: 'tile-disputed-stripes', type: 'line', source: 'tiles',
    filter: ['==', ['get', 'state'], 'disputed'],
    paint: { 'line-color': '#FFFFFF', 'line-width': W(4), 'line-dasharray': [0.6, 1.2], 'line-opacity': 0.9 },
  });
  // Team pattern so ownership is never shown by colour alone: Otters solid, Frogs dots, Kingfishers dashes.
  map.addLayer({
    id: 'tile-team-frogs', type: 'line', source: 'tiles', layout: { 'line-cap': 'round' },
    filter: ['all', ['==', ['get', 'owner'], 'frogs'], ['in', ['get', 'state'], ['literal', ['owned_fresh', 'owned_fading']]], ['==', ['get', 'visible'], true]],
    paint: { 'line-color': '#FFFFFF', 'line-width': W(3), 'line-dasharray': [0.01, 2.2], 'line-opacity': 0.9 },
  });
  map.addLayer({
    id: 'tile-team-kingfishers', type: 'line', source: 'tiles', layout: { 'line-cap': 'butt' },
    filter: ['all', ['==', ['get', 'owner'], 'kingfishers'], ['in', ['get', 'state'], ['literal', ['owned_fresh', 'owned_fading']]], ['==', ['get', 'visible'], true]],
    paint: { 'line-color': '#FFFFFF', 'line-width': W(2.5), 'line-dasharray': [2, 1.6], 'line-opacity': 0.85 },
  });
  map.addLayer({
    id: 'tile-selected', type: 'line', source: 'tiles', layout: round,
    filter: ['==', ['get', 'selected'], true],
    paint: { 'line-color': '#FFFFFF', 'line-width': W(4), 'line-opacity': 0.95, 'line-gap-width': W(10) },
  });
  map.addLayer({
    id: 'flash', type: 'line', source: 'flash', layout: round,
    paint: { 'line-width': W(14), 'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0)'] as never },
  });
  // ---- symbol markers (images from the image pack) ----
  map.addSource('points', { type: 'geojson', data: empty });
  map.addSource('treasure-pts', { type: 'geojson', data: empty, cluster: true, clusterRadius: 44, clusterMaxZoom: 14 });
  const Z = (a: number, b: number) => ['interpolate', ['linear'], ['zoom'], 12, a, 17, b] as never;
  map.addLayer({
    id: 'sym-fog', type: 'symbol', source: 'points', maxzoom: 14.8,
    filter: ['all', ['==', ['get', 'state'], 'fog'], ['==', ['get', 'show'], true]],
    layout: { 'icon-image': 'marker-fog', 'icon-size': 0.6, 'icon-padding': 24 },
    paint: { 'icon-opacity': 0.85 },
  });
  map.addLayer({
    id: 'sym-flag', type: 'symbol', source: 'points', minzoom: 15,
    filter: ['all', ['in', ['get', 'state'], ['literal', ['owned_fresh', 'owned_fading']]], ['==', ['get', 'show'], true]],
    layout: { 'icon-image': ['concat', 'flag-', ['get', 'owner']], 'icon-anchor': 'bottom-left', 'icon-size': Z(0.6, 1.1), 'icon-padding': 4 },
    paint: { 'icon-opacity': ['case', ['==', ['get', 'state'], 'owned_fading'], 0.6, 1] },
  });
  map.addLayer({
    id: 'sym-healed', type: 'symbol', source: 'points',
    filter: ['all', ['==', ['get', 'healed'], true], ['==', ['get', 'show'], true]],
    layout: { 'icon-image': 'healed', 'icon-size': Z(0.6, 1), 'icon-offset': [24, -24], 'icon-allow-overlap': true },
  });
  map.addLayer({
    id: 'sym-unsafe', type: 'symbol', source: 'points',
    filter: ['==', ['get', 'unsafe'], true],
    layout: { 'icon-image': 'marker-unsafe', 'icon-size': Z(0.6, 1), 'icon-anchor': 'bottom', 'icon-allow-overlap': true },
  });
  map.addLayer({
    id: 'sym-disputed', type: 'symbol', source: 'points',
    filter: ['all', ['==', ['get', 'state'], 'disputed'], ['==', ['get', 'showDispute'], true]],
    layout: { 'icon-image': 'marker-disputed', 'icon-size': Z(0.7, 1.1), 'icon-allow-overlap': true },
  });
  map.addLayer({
    id: 'treasure-cluster', type: 'circle', source: 'treasure-pts', filter: ['has', 'point_count'],
    paint: { 'circle-color': colors.gold, 'circle-radius': 16, 'circle-stroke-width': 3, 'circle-stroke-color': '#1E1208' },
  });
  map.addLayer({
    id: 'treasure-count', type: 'symbol', source: 'treasure-pts', filter: ['has', 'point_count'],
    layout: { 'text-field': ['concat', '💎', ['to-string', ['get', 'point_count']]], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-allow-overlap': true },
    paint: { 'text-color': '#1E1208' },
  });
  map.addLayer({
    id: 'sym-treasure', type: 'symbol', source: 'treasure-pts', filter: ['!', ['has', 'point_count']],
    layout: { 'icon-image': ['concat', 'treasure-', ['get', 'kind']], 'icon-size': Z(0.6, 1.05), 'icon-offset': [-22, -22], 'icon-allow-overlap': true },
  });
  // Wide invisible layer that makes thin lines easy to tap.
  map.addLayer({ id: 'tile-hit', type: 'line', source: 'tiles', paint: { 'line-color': '#000', 'line-width': 22, 'line-opacity': 0.001 } });
}

function syncData(map: MLMap, p: GameMapProps) {
  const src = map.getSource('tiles') as GeoJSONSource | undefined;
  if (!src) return;
  const mode = p.mode ?? 'game';
  const features = (p.tiles?.features ?? []).map((f: TileFeature) => {
    const { color, visible } = tileStyle(f, mode, p.filter ?? 'all', p.myTeam);
    // Dashboard heat modes paint every checked tile with the solid style.
    const state = mode === 'freshness' || mode === 'health' ? (f.properties.state === 'fog' ? 'fog' : 'owned_fresh') : f.properties.state;
    return {
      type: 'Feature' as const,
      geometry: f.geometry,
      properties: {
        id: f.id,
        state,
        owner: mode === 'game' ? f.properties.owner_team ?? '' : '',
        color,
        visible,
        highlight: f.id === p.highlightTileId,
        selected: f.id === p.selectedTileId,
      },
    };
  });
  src.setData({ type: 'FeatureCollection', features });

  const game = mode === 'game';
  const heat = mode === 'freshness' || mode === 'health';
  const pts = (p.tiles?.features ?? []).map((f: TileFeature) => {
    const { visible } = tileStyle(f, mode, p.filter ?? 'all', p.myTeam);
    const pr = f.properties;
    return {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: pr.center },
      properties: {
        id: f.id,
        state: pr.state,
        owner: pr.owner_team ?? '',
        unsafe: pr.unsafe,
        healed: game && pr.healed,
        show: game && visible,
        showDispute: !heat && (visible || mode === 'disputes'),
        kind: pr.treasure_types?.[0] ?? 'trash',
        treasure: pr.treasures > 0 && ((game && visible) || mode === 'treasures'),
      },
    };
  });
  (map.getSource('points') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: pts });
  (map.getSource('treasure-pts') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: pts.filter((f) => f.properties.treasure) });
}
