import { Platform } from 'react-native';

import { useGame } from './store';

/**
 * Tiny self-generated sounds (Web Audio oscillators, no sound files, no licences needed).
 * Web only; on phones this is silent for now. Respects the mute switch in Profile.
 */
type Note = [freq: number, start: number, dur: number, type?: OscillatorType];
const SOUNDS: Record<'click' | 'success' | 'coin' | 'clash', Note[]> = {
  click: [[660, 0, 0.05, 'triangle']],
  success: [
    [523, 0, 0.12],
    [659, 0.1, 0.12],
    [784, 0.2, 0.12],
    [1047, 0.3, 0.3],
  ],
  coin: [
    [988, 0, 0.08, 'square'],
    [1319, 0.07, 0.25, 'square'],
  ],
  clash: [
    [220, 0, 0.15, 'sawtooth'],
    [180, 0.1, 0.25, 'sawtooth'],
  ],
};

let ctx: AudioContext | null = null;

export function play(name: keyof typeof SOUNDS) {
  if (Platform.OS !== 'web' || useGame.getState().muted) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    const now = ctx.currentTime;
    for (const [freq, start, dur, type = 'sine'] of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.12, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    }
  } catch {
    /* audio is optional */
  }
}
