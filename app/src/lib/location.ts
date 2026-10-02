import * as Location from 'expo-location';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { offset } from './geo';
import { useGame } from './store';

const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, 1],
  w: [0, 1],
  ArrowDown: [0, -1],
  s: [0, -1],
  ArrowLeft: [-1, 0],
  a: [-1, 0],
  ArrowRight: [1, 0],
  d: [1, 0],
};

/** Web only: walk with WASD / arrow keys (10 m per press, 40 m with Shift). */
export function useKeyboardWalk(enabled: boolean) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const dir = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      if (!dir) return;
      const { position, realGps, setPosition } = useGame.getState();
      if (!position || realGps) return;
      e.preventDefault();
      const step = e.shiftKey ? 40 : 10;
      setPosition(offset(position, dir[0] * step, dir[1] * step));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

/** Follow the device GPS while "real GPS" is switched on. */
export function useRealGps() {
  const realGps = useGame((s) => s.realGps);
  useEffect(() => {
    if (!realGps) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) {
        useGame.getState().set({ realGps: false });
        return;
      }
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 3 }, (loc) =>
        useGame.getState().setPosition({ lat: loc.coords.latitude, lon: loc.coords.longitude }),
      );
    })().catch(() => useGame.getState().set({ realGps: false }));
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [realGps]);
}
