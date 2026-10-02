import 'maplibre-gl/dist/maplibre-gl.css';

import maplibregl, { type GeoJSONSource, type Map as MLMap, type StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import type { TileFeature } from '@/lib/api';
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

/** Soft "nature map" tint over the muted positron base. */
const TINT: [string, string, string][] = [
  ['background', 'background-color', '#E9EFE6'],
  ['water', 'fill-color', '#B9DDEB'],
  ['park', 'fill-color', '#D4E7C9'],
  ['landcover_wood', 'fill-color', '#CBE2BE'],
  ['landuse_residential', 'fill-color', '#E4E8E1'],
  ['building', 'fill-color', '#DADFD6'],
  ['waterway', 'line-color', '#9CCBE0'],
];

const CSS = `
@keyframes sr-pulse { 0% { transform: scale(0.6); opacity: 0.8 } 100% { transform: scale(2.6); opacity: 0 } }
@keyframes sr-bob { 0%,100% { transform: translateY(0) scale(1) } 50% { transform: translateY(-4px) scale(1.12) } }
@keyframes sr-float { 0% { transform: translateY(0) scale(0.6); opacity: 0 } 15% { opacity: 1; transform: translateY(-10px) scale(1.15) } 100% { transform: translateY(-90px) scale(1); opacity: 0 } }
@keyframes sr-coin { 0% { transform: translate(0,0) scale(0.4); opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 0 } }
.sr-me { position: relative; width: 22px; height: 22px; }
.sr-me .ring { position: absolute; inset: 0; border-radius: 50%; background: var(--c); animation: sr-pulse 1.8s ease-out infinite; }
.sr-me .dot { position: absolute; inset: 3px; border-radius: 50%; background: var(--c); border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.4); }
.sr-badge { font-size: 18px; line-height: 1; padding: 4px; border-radius: 12px; background: rgba(14,42,51,.85); border: 2px solid var(--c); box-shadow: 0 2px 6px rgba(0,0,0,.35); cursor: pointer; user-select: none; }
.sr-badge.bob { animation: sr-bob 1.6s ease-in-out infinite; }
.sr-float { font: 900 28px Cinzel_900Black, Cinzel, serif; color: #F2C94C; text-shadow: 0 2px 0 #7a5a00, 0 0 12px rgba(242,201,76,.8); animation: sr-float 2.2s ease-out forwards; pointer-events: none; white-space: nowrap; }
.sr-coin { position: absolute; left: 0; top: 0; width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff6c8, #F2C94C 45%, #C9971C); box-shadow: 0 0 6px rgba(242,201,76,.9); animation: sr-coin 1.1s ease-out forwards; }
.maplibregl-ctrl-attrib { font-size: 10px; }
`;

function ensureCss() {
  if (typeof document === 'undefined' || document.getElementById('sr-map-css')) return;
  const el = document.createElement('style');
  el.id = 'sr-map-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

const TILE_LAYERS = ['tile-hit'];

export default function GameMap(props: GameMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const readyRef = useRef(false);
  const propsRef = useRef(props);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const meRef = useRef<maplibregl.Marker | null>(null);
  propsRef.current = props;

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
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    let usedFallback = false;
    const fallback = () => {
      if (usedFallback || readyRef.current) return;
      usedFallback = true;
      console.warn('[map] Vector style failed, using OSM raster tiles');
      map.setStyle(RASTER_FALLBACK);
    };
    const fallbackTimer = setTimeout(fallback, 9000);
    map.on('error', (e) => {
      if (!readyRef.current && String(e?.error?.message ?? '').match(/style|fetch|Failed/i)) fallback();
    });

    map.on('style.load', () => {
      clearTimeout(fallbackTimer);
      for (const [layer, prop, value] of TINT) {
        try {
          if (map.getLayer(layer)) map.setPaintProperty(layer, prop as never, value);
        } catch {
          /* layer differs in this style */
        }
      }
      addGameLayers(map);
      readyRef.current = true;
      syncData(map, propsRef.current);
      syncMarkers();
    });

    map.on('click', (e) => {
      const p = propsRef.current;
      const box: [[number, number], [number, number]] = [
        [e.point.x - 8, e.point.y - 8],
        [e.point.x + 8, e.point.y + 8],
      ];
      const hit = readyRef.current ? map.queryRenderedFeatures(box, { layers: TILE_LAYERS }) : [];
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
        { layers: TILE_LAYERS },
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
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- data + markers ----
  function syncMarkers() {
    const map = mapRef.current;
    const p = propsRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const mode = p.mode ?? 'game';
    for (const f of p.tiles?.features ?? []) {
      const pr = f.properties;
      const { visible } = tileStyle(f, mode, p.filter ?? 'all', p.myTeam);
      const badges: { text: string; color: string; bob: boolean; title: string }[] = [];
      if (pr.state === 'disputed' && mode !== 'treasures' && mode !== 'health' && mode !== 'freshness')
        badges.push({ text: '⚔️', color: colors.disputed, bob: true, title: 'Disputed: two checks disagree' });
      if (pr.treasures > 0 && (mode === 'game' || mode === 'treasures') && (visible || mode === 'treasures'))
        badges.push({ text: '💎', color: colors.gold, bob: false, title: `${pr.treasures} treasure(s) found here` });
      if (pr.unsafe) badges.push({ text: '⚠️', color: colors.danger, bob: false, title: 'Unsafe tile. Do not check it.' });
      if (pr.healed && mode === 'game') badges.push({ text: '✨', color: colors.success, bob: false, title: 'Healed: a problem here was fixed' });
      if (!badges.length || (!visible && mode === 'game')) continue;
      const el = document.createElement('div');
      el.style.display = 'flex';
      el.style.gap = '3px';
      for (const b of badges) {
        const s = document.createElement('div');
        s.className = `sr-badge${b.bob ? ' bob' : ''}`;
        s.style.setProperty('--c', b.color);
        s.textContent = b.text;
        s.title = b.title;
        el.appendChild(s);
      }
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        propsRef.current.onTilePress?.(pr.id);
      });
      markersRef.current.push(new maplibregl.Marker({ element: el, offset: [0, -16] }).setLngLat(pr.center).addTo(map));
    }
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    syncData(map, props);
    syncMarkers();
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
      el.innerHTML = '<div class="ring"></div><div class="dot"></div>';
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
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
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
    paint: { 'line-color': '#0E2A33', 'line-width': W(12), 'line-opacity': 0.35 },
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
  map.addLayer({
    id: 'tile-selected', type: 'line', source: 'tiles', layout: round,
    filter: ['==', ['get', 'selected'], true],
    paint: { 'line-color': '#FFFFFF', 'line-width': W(4), 'line-opacity': 0.95, 'line-gap-width': W(10) },
  });
  map.addLayer({
    id: 'flash', type: 'line', source: 'flash', layout: round,
    paint: { 'line-width': W(14), 'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0)'] as never },
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
        color,
        visible,
        highlight: f.id === p.highlightTileId,
        selected: f.id === p.selectedTileId,
      },
    };
  });
  src.setData({ type: 'FeatureCollection', features });
}
