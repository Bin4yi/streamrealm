/**
 * "Kingdom UI" design tokens: wood, stone, parchment and gold on deep water teal.
 * Visual style inspired by mobile strategy games; everything is drawn in code.
 */
export const world = { top: '#0E2A33', bottom: '#14404B', vignette: 'rgba(3,12,16,0.55)' } as const;

export const wood = { base: '#8B5A2B', light: '#A8733D', dark: '#5E3A17', outline: '#3B240E', grain: 'rgba(59,36,14,0.28)' } as const;
export const stone = { base: '#6E7B85', light: '#8C99A3', dark: '#47525A', outline: '#262D32' } as const;
export const parchment = { bg: '#F3E3C3', bgDark: '#E8D3A8', text: '#4A2F14', muted: '#6A4C2B', line: '#D4BC8F' } as const;
export const gold = { base: '#F2C94C', light: '#FFE58A', dark: '#B8860B' } as const;

export type ButtonColor = 'green' | 'blue' | 'orange' | 'red' | 'disabled';
/** Each button: light top, base, and the darker "lip" (about 25% darker). */
export const button: Record<ButtonColor, { top: string; base: string; lip: string }> = {
  green: { top: '#8BDB72', base: '#5DBB46', lip: '#458C34' },
  blue: { top: '#6CB9EA', base: '#3A9AD9', lip: '#2B73A3' },
  orange: { top: '#F9BE6A', base: '#F29B30', lip: '#B57424' },
  red: { top: '#F0806E', base: '#E5533D', lip: '#AC3E2E' },
  disabled: { top: '#A9B1B6', base: '#8A949A', lip: '#626A70' },
};

export const ink = { white: '#FFFFFF', stroke: '#1E1208', dim: '#D9E4E7' } as const;
export const radius = { sm: 14, md: 18, lg: 22 } as const;
export const outlineWidth = 3;

export const displayFont = 'LilitaOne_400Regular';
export const bodyFont = 'Nunito_700Bold';
export const bodyFontHeavy = 'Nunito_800ExtraBold';

export const ribbon = {
  red: { base: '#D9443A', dark: '#9E2A22', light: '#F06A5F' },
  blue: { base: '#2F6FC0', dark: '#1D4A86', light: '#4F8EDB' },
  green: { base: '#3E9A3A', dark: '#276A25', light: '#5DBB46' },
} as const;
