import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Position } from './geo';
import type { TeamId } from './theme';

export type LocalPlayer = { id: string; nickname: string; avatar: string; team: TeamId };
export type MapFilter = 'all' | 'mine' | 'fog' | 'disputed' | 'treasures';

/** Last claim, used by the map to play the "paint" animation once. */
export type ClaimFlash = { tileId: string; team: TeamId; points: number; at: number };

type GameState = {
  hydrated: boolean;
  player: LocalPlayer | null;
  city: string;
  position: Position | null;
  realGps: boolean;
  devPanelEnabled: boolean;
  devPanelOpen: boolean;
  teleportMode: boolean;
  timeWarpDays: number;
  autoTick: boolean;
  muted: boolean;
  reducedMotion: boolean;
  filter: MapFilter;
  selectedTileId: string | null;
  claimFlash: ClaimFlash | null;
  useDemoPhotos: boolean;
  setPlayer: (p: LocalPlayer | null) => void;
  setPosition: (p: Position | null) => void;
  flashClaim: (tileId: string, team: TeamId, points: number) => void;
  set: (patch: Partial<Omit<GameState, 'set' | 'setPlayer' | 'setPosition' | 'flashClaim'>>) => void;
};

export const useGame = create<GameState>()(
  persist(
    (set) => ({
      hydrated: false,
      player: null,
      city: process.env.EXPO_PUBLIC_CITY || 'coimbra',
      position: null,
      realGps: false,
      devPanelEnabled: true,
      devPanelOpen: false,
      teleportMode: true,
      timeWarpDays: 0,
      autoTick: false,
      muted: false,
      reducedMotion: false,
      filter: 'all',
      selectedTileId: null,
      claimFlash: null,
      useDemoPhotos: false,
      setPlayer: (player) => set({ player }),
      setPosition: (position) => set({ position }),
      flashClaim: (tileId, team, points) => set({ claimFlash: { tileId, team, points, at: Date.now() }, selectedTileId: null }),
      set: (patch) => set(patch),
    }),
    {
      name: 'streamrealm-game',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        player: s.player,
        position: s.position,
        realGps: s.realGps,
        devPanelEnabled: s.devPanelEnabled,
        timeWarpDays: s.timeWarpDays,
        muted: s.muted,
        reducedMotion: s.reducedMotion,
        useDemoPhotos: s.useDemoPhotos,
      }),
      onRehydrateStorage: () => () => useGame.setState({ hydrated: true }),
    },
  ),
);
