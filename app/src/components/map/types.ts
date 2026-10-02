import type { StyleProp, ViewStyle } from 'react-native';

import type { TileCollection, TileFeature } from '@/lib/api';
import type { LngLat, Position } from '@/lib/geo';
import type { ClaimFlash, MapFilter } from '@/lib/store';
import { colors, teams, type TeamId } from '@/lib/theme';

/** game = player view. The other modes are scientist dashboard layers. */
export type MapLayerMode = 'game' | 'freshness' | 'health' | 'disputes' | 'treasures';

export type GameMapProps = {
  tiles: TileCollection | undefined;
  center: LngLat;
  zoom: number;
  position?: Position | null;
  myTeam?: TeamId | null;
  filter?: MapFilter;
  highlightTileId?: string | null;
  selectedTileId?: string | null;
  flash?: ClaimFlash | null;
  mode?: MapLayerMode;
  followPosition?: boolean;
  onTilePress?: (id: string) => void;
  onMapPress?: (pos: Position) => void;
  style?: StyleProp<ViewStyle>;
  /** Web: push the zoom buttons down (px) so they sit below a HUD. */
  controlsTop?: number;
};

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function ramp(stops: [number, string][], v: number): string {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [x0, c0] = stops[i - 1];
      const [x1, c1] = stops[i];
      return mix(c0, c1, (v - x0) / (x1 - x0));
    }
  }
  return stops[stops.length - 1][1];
}

/** Sequential, one hue: dark blue = just checked, pale = old data. */
export const FRESHNESS_STOPS: [number, string][] = [
  [0, '#104281'],
  [7, '#3987e5'],
  [14, '#9ec5f4'],
  [30, '#cde2fb'],
];
/** Diverging red <-> blue with a gray midpoint at 50. */
export const HEALTH_STOPS: [number, string][] = [
  [0, '#b8302f'],
  [25, '#e34948'],
  [50, '#b9b8b3'],
  [75, '#3987e5'],
  [100, '#1c5cab'],
];

/** Colour and visibility of one tile for a given map mode and filter. */
export function tileStyle(f: TileFeature, mode: MapLayerMode, filter: MapFilter, myTeam: TeamId | null | undefined) {
  const p = f.properties;
  let color: string;
  if (mode === 'freshness') color = p.age_days == null ? colors.fog : ramp(FRESHNESS_STOPS, p.age_days);
  else if (mode === 'health') color = p.health == null ? colors.fog : ramp(HEALTH_STOPS, p.health);
  else if (p.state === 'disputed') color = colors.disputed;
  else if (p.state === 'fog') color = colors.fog;
  else if (p.state === 'neutral' || !p.owner_team) color = colors.neutral;
  else color = teams[p.owner_team].color;

  let visible = true;
  if (mode === 'disputes') visible = p.state === 'disputed';
  else if (mode === 'treasures') visible = p.treasures > 0;
  else if (filter === 'mine') visible = !!myTeam && p.owner_team === myTeam;
  else if (filter === 'fog') visible = p.state === 'fog';
  else if (filter === 'disputed') visible = p.state === 'disputed';
  else if (filter === 'treasures') visible = p.treasures > 0;
  return { color, visible };
}
