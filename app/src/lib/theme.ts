import { Platform } from 'react-native';

export const colors = {
  bg: '#0E2A33',
  bgDeep: '#081C23',
  bgRaised: '#14394A',
  card: 'rgba(20, 57, 74, 0.72)',
  cardSolid: '#143A48',
  cardBorder: 'rgba(255, 255, 255, 0.10)',
  text: '#F4F8F6',
  textMuted: '#A9C3C8',
  textDim: '#7898A0',
  gold: '#F2C94C',
  goldDeep: '#C9971C',
  water: '#4FB3E8',
  waterSoft: '#9BD4F0',
  fog: '#8C9AA3',
  neutral: '#C9D1D6',
  disputed: '#C2418E',
  danger: '#EB5757',
  success: '#5FD38D',
  warn: '#F2994A',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type TeamId = 'otters' | 'frogs' | 'kingfishers';

export const teams: Record<TeamId, { name: string; color: string; soft: string; emoji: string; icon: string; motto: string }> = {
  otters: { name: 'Otters', color: '#2F80ED', soft: '#9CC3F7', emoji: '🦦', icon: 'water', motto: 'Swift and playful' },
  frogs: { name: 'Frogs', color: '#27AE60', soft: '#93D9B0', emoji: '🐸', icon: 'leaf', motto: 'Patient and wise' },
  kingfishers: { name: 'Kingfishers', color: '#F2994A', soft: '#F8CDA4', emoji: '🐦', icon: 'flash', motto: 'Sharp eyes, fast wings' },
};
export const teamIds: TeamId[] = ['otters', 'frogs', 'kingfishers'];

export const fonts = {
  title: 'Cinzel_700Bold',
  titleBlack: 'Cinzel_900Black',
  body: 'Nunito_400Regular',
  bodySemi: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyBlack: 'Nunito_800ExtraBold',
} as const;

export const radius = { sm: 10, md: 16, lg: 20, xl: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const shadow = Platform.select({
  web: { boxShadow: '0 8px 24px rgba(0,0,0,0.28)' } as object,
  default: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
});

/** Soft glass card. Blur only works on web; native gets a solid tint. */
export const glass = Platform.select({
  web: { backgroundColor: colors.card, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } as object,
  default: { backgroundColor: colors.cardSolid },
});

export const PHONE_MAX_WIDTH = 480;
