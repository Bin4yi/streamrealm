import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors, teams } from '@/lib/theme';

const SIZE = 240;

/** A winding stream cut into coloured team pieces, with a flag. */
export function ConquerArt() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 240 240">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1E5566" />
          <Stop offset="1" stopColor="#0E2A33" />
        </LinearGradient>
      </Defs>
      <Circle cx="120" cy="120" r="112" fill="url(#sky)" />
      <Ellipse cx="120" cy="196" rx="96" ry="22" fill="#174A3A" />
      <Path d="M30 70 C 90 60, 60 120, 120 120 S 170 180, 215 170" stroke={colors.waterSoft} strokeWidth="22" fill="none" strokeLinecap="round" opacity={0.35} />
      <Path d="M30 70 C 55 66, 66 80, 70 96" stroke={teams.otters.color} strokeWidth="10" fill="none" strokeLinecap="round" />
      <Path d="M74 106 C 84 120, 100 121, 120 120" stroke={teams.frogs.color} strokeWidth="10" fill="none" strokeLinecap="round" />
      <Path d="M130 122 C 150 128, 160 150, 172 162" stroke={colors.fog} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray="6 6" />
      <Path d="M182 168 C 195 172, 205 172, 215 170" stroke={teams.kingfishers.color} strokeWidth="10" fill="none" strokeLinecap="round" />
      <Rect x="116" y="62" width="4" height="56" rx="2" fill="#E9E3C8" />
      <Path d="M120 62 L 156 72 L 120 84 Z" fill={colors.gold} />
      <Circle cx="120" cy="120" r="7" fill={colors.white} />
      <Circle cx="60" cy="40" r="3" fill={colors.gold} opacity={0.8} />
      <Circle cx="190" cy="60" r="2" fill={colors.white} opacity={0.7} />
      <Circle cx="175" cy="35" r="2.5" fill={colors.gold} opacity={0.6} />
    </Svg>
  );
}

/** A magnifying glass over water drops and a clipboard: your play helps science. */
export function MissionArt() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 240 240">
      <Circle cx="120" cy="120" r="112" fill="#123F4D" />
      <G opacity={0.9}>
        <Rect x="44" y="70" width="90" height="116" rx="10" fill="#F4F1E4" />
        <Rect x="70" y="62" width="38" height="16" rx="5" fill="#C9B98A" />
        <Rect x="58" y="96" width="60" height="7" rx="3" fill="#9FB7BD" />
        <Rect x="58" y="114" width="48" height="7" rx="3" fill="#9FB7BD" />
        <Rect x="58" y="132" width="56" height="7" rx="3" fill="#9FB7BD" />
        <Path d="M60 158 l8 8 l16 -18" stroke={colors.success} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>
      <Path d="M168 70 C 168 70, 150 96, 150 108 a18 18 0 0 0 36 0 C 186 96, 168 70, 168 70 Z" fill={colors.water} />
      <Path d="M196 120 C 196 120, 186 134, 186 141 a10 10 0 0 0 20 0 C 206 134, 196 120, 196 120 Z" fill={colors.waterSoft} />
      <Circle cx="150" cy="150" r="30" fill="rgba(155,212,240,0.25)" stroke={colors.gold} strokeWidth="8" />
      <Path d="M172 172 L 200 200" stroke={colors.gold} strokeWidth="12" strokeLinecap="round" />
      <Circle cx="140" cy="140" r="7" fill={colors.white} opacity={0.6} />
    </Svg>
  );
}

/** A shield on a safe path beside the water. */
export function SafetyArt() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 240 240">
      <Circle cx="120" cy="120" r="112" fill="#163B44" />
      <Path d="M20 170 C 80 150, 160 190, 220 160 L 220 230 L 20 230 Z" fill={colors.water} opacity={0.45} />
      <Path d="M30 150 C 90 132, 150 168, 214 140" stroke="#D9C9A0" strokeWidth="14" fill="none" strokeLinecap="round" />
      <Path d="M120 40 L 168 58 L 168 102 C 168 134, 146 154, 120 166 C 94 154, 72 134, 72 102 L 72 58 Z" fill={colors.success} />
      <Path d="M120 52 L 158 66 L 158 102 C 158 128, 141 144, 120 154 Z" fill="#7BE0A6" opacity={0.5} />
      <Path d="M98 104 l15 15 l29 -31" stroke={colors.white} strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
