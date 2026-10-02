import { create } from 'zustand';

type Point = { x: number; y: number };
export type ToastMsg = { id: number; text: string; icon?: unknown; fallback?: string };

/** Shared UI effects state: where the coin pill is (CoinFly target) and the toast queue. */
export const useFx = create<{
  coinTarget: Point | null;
  setCoinTarget: (p: Point | null) => void;
  toasts: ToastMsg[];
  toast: (text: string, icon?: unknown, fallback?: string) => void;
  dismiss: (id: number) => void;
}>((set) => ({
  coinTarget: null,
  setCoinTarget: (coinTarget) => set({ coinTarget }),
  toasts: [],
  toast: (text, icon, fallback) => set((s) => ({ toasts: [...s.toasts.slice(-2), { id: Date.now() + Math.random(), text, icon, fallback }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
