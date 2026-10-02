import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';

import type { Answers, TileStateName, TreasureType } from './gameRules';
import type { LngLat } from './geo';
import { useGame } from './store';
import type { TeamId } from './theme';

const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_URL).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError(0, `Cannot reach the game server at ${API_URL}. Is it running?`);
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* keep status text */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  form: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form }),
};

export function photoUrl(name: string | null | undefined): string | null {
  if (!name) return null;
  if (name.startsWith('http') || name.startsWith('data:') || name.startsWith('blob:')) return name;
  return `${API_URL}/${name.replace(/^\//, '')}`;
}

// ---------- Types ----------

export type TileProps = {
  id: string;
  stream_name: string;
  length_m: number;
  center: LngLat;
  state: TileStateName;
  owner_team: TeamId | null;
  last_check_at: string | null;
  age_days: number | null;
  next_change_days: number | null;
  health: number | null;
  healed: boolean;
  unsafe: boolean;
  treasures: number;
};
export type TileFeature = { type: 'Feature'; id: string; properties: TileProps; geometry: { type: 'LineString'; coordinates: LngLat[] } };
export type TileCollection = { type: 'FeatureCollection'; features: TileFeature[]; generated_at: string };

export type City = { key: string; name: string; center: LngLat; zoom: number; bbox: [number, number, number, number] };

export type HistoryItem = {
  id: string;
  nickname: string;
  avatar: string;
  team: TeamId;
  created_at: string;
  health_score: number;
  status: string;
  action: string | null;
  answers: Answers;
  photo_up: string | null;
  confirmed_by: string | null;
};
export type TileDetail = TileProps & {
  geometry: LngLat[];
  history: HistoryItem[];
  treasure_list: { id: string; type: TreasureType; status: string; photo: string | null }[];
};

export type Player = {
  id: string;
  nickname: string;
  avatar: string;
  team: TeamId;
  points: number;
  streak: number;
  is_bot: boolean;
};

export type Storm = { active: boolean; forced: boolean | null; rain_mm_48h: number | null; source: string; message: string; checked_at: string | null };

// ---------- Hooks ----------

export function useCities() {
  return useQuery({ queryKey: ['cities'], queryFn: () => api.get<City[]>('/cities'), staleTime: Infinity });
}

export function useTiles() {
  const city = useGame((s) => s.city);
  const warp = useGame((s) => s.timeWarpDays);
  return useQuery({
    queryKey: ['tiles', city, warp],
    queryFn: () => api.get<TileCollection>(`/cities/${city}/tiles?time_warp_days=${warp}`),
    refetchInterval: 15_000,
    placeholderData: (prev) => prev,
  });
}

export function useTile(id: string | null) {
  const warp = useGame((s) => s.timeWarpDays);
  return useQuery({
    queryKey: ['tile', id, warp],
    queryFn: () => api.get<TileDetail>(`/tiles/${id}?time_warp_days=${warp}`),
    enabled: !!id,
  });
}

export function usePlayer() {
  const id = useGame((s) => s.player?.id);
  return useQuery({ queryKey: ['player', id], queryFn: () => api.get<Player>(`/players/${id}`), enabled: !!id, refetchInterval: 20_000 });
}

export function useStorm() {
  const city = useGame((s) => s.city);
  return useQuery({ queryKey: ['storm', city], queryFn: () => api.get<Storm>(`/storm?city=${city}`), refetchInterval: 60_000 });
}
