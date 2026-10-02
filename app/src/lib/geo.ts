import { lineString, point, pointToLineDistance } from '@turf/turf';

export type LngLat = [number, number];
export type Position = { lat: number; lon: number };

export function distanceToLineM(pos: Position, coords: LngLat[]): number {
  return pointToLineDistance(point([pos.lon, pos.lat]), lineString(coords), { units: 'meters' });
}

export type Nearest<T> = { item: T; distance: number } | null;

export function nearest<T extends { geometry: { coordinates: LngLat[] } }>(pos: Position | null, items: T[]): Nearest<T> {
  if (!pos || items.length === 0) return null;
  let best: Nearest<T> = null;
  for (const item of items) {
    const d = distanceToLineM(pos, item.geometry.coordinates);
    if (!best || d < best.distance) best = { item, distance: d };
  }
  return best;
}

/** Move a position by metres east/north. */
export function offset(pos: Position, eastM: number, northM: number): Position {
  const lat = pos.lat + northM / 110_540;
  const lon = pos.lon + eastM / (111_320 * Math.cos((pos.lat * Math.PI) / 180));
  return { lat, lon };
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
