import type { ImageSourcePropType } from 'react-native';

import { Images } from './assets';

/** Image avatars (emoji = fallback if the image is missing). */
export const AVATARS: Record<string, string> = {
  heron: '🪶',
  duck: '🦆',
  owl: '🦉',
  fox: '🦊',
  salamander: '🦎',
  dragonfly: '🪰',
  trout: '🐟',
  hedgehog: '🦔',
};
export const AVATAR_IDS = Object.keys(AVATARS);
/** Older emoji-only avatar ids, still shown for players created before the image pack. */
const LEGACY: Record<string, string> = { otter: '🦦', frog: '🐸', bird: '🐦', swan: '🦢', butterfly: '🦋', fish: '🐟', turtle: '🐢', beaver: '🦫' };

export function avatarImage(id: string | undefined | null): ImageSourcePropType | null {
  return (id && (Images.avatar as Record<string, ImageSourcePropType | null>)[id]) || null;
}

export function avatarEmoji(id: string | undefined | null): string {
  return (id && (AVATARS[id] ?? LEGACY[id])) || '🙂';
}

/** "just now", "3 hours ago", "5 days ago" */
export function ago(days: number | null | undefined): string {
  if (days == null) return 'never';
  if (days < 0) return 'just now';
  const hours = days * 24;
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'} ago`;
  const d = Math.round(days);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export function daysSince(iso: string, warpDays = 0): number {
  return (Date.now() + warpDays * 86_400_000 - new Date(iso).getTime()) / 86_400_000;
}

export function inDays(days: number | null | undefined): string {
  if (days == null) return '';
  if (days < 1) return `${Math.max(1, Math.round(days * 24))} h`;
  return `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`;
}
