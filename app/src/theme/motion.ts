import { useReducedMotion } from 'react-native-reanimated';

import { useGame } from '@/lib/store';

/** Snappy springs with a small overshoot. */
export const spring = {
  press: { damping: 18, stiffness: 600, mass: 0.6 },
  pop: { damping: 11, stiffness: 260 },
  soft: { damping: 16, stiffness: 140 },
} as const;

/** False when the OS or the player asks for reduced motion: no idle loops, rays or shakes. */
export function useMotionOK(): boolean {
  const os = useReducedMotion();
  const pref = useGame((s) => s.reducedMotion);
  return !(os || pref);
}
