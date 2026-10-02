import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ink, parchment, radius, stone, wood, world } from '@/theme/tokens';

function Rivet({ style }: { style: ViewStyle }) {
  return (
    <View style={[styles.rivet, style]}>
      <View style={styles.rivetShine} />
    </View>
  );
}

function Grain() {
  // A few soft wavy lines, drawn once and stretched over the frame.
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
      {[8, 22, 37, 55, 71, 88].map((y, i) => (
        <Path key={y} d={`M0 ${y} C 25 ${y + (i % 2 ? 3 : -3)}, 60 ${y + (i % 2 ? -2 : 4)}, 100 ${y + 1}`} stroke={wood.grain} strokeWidth={0.8} fill="none" />
      ))}
    </Svg>
  );
}

type Inner = 'parchment' | 'teal' | 'none';

function Frame({
  kind,
  inner = 'parchment',
  children,
  style,
  contentStyle,
  border = 12,
}: {
  kind: 'wood' | 'stone';
  inner?: Inner;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  border?: number;
}) {
  const c = kind === 'wood' ? { a: wood.light, b: wood.base, c: wood.dark, o: wood.outline } : { a: stone.light, b: stone.base, c: stone.dark, o: stone.outline };
  const innerBg = inner === 'parchment' ? parchment.bg : inner === 'teal' ? world.top : 'transparent';
  return (
    <View style={[styles.outer, { borderColor: c.o, borderRadius: radius.lg }, style]}>
      <LinearGradient colors={[c.a, c.b, c.c]} style={[styles.frame, { padding: border, borderRadius: radius.lg - 3 }]}>
        {kind === 'wood' && <Grain />}
        <Rivet style={{ top: 3, left: 3 }} />
        <Rivet style={{ top: 3, right: 3 }} />
        <Rivet style={{ bottom: 3, left: 3 }} />
        <Rivet style={{ bottom: 3, right: 3 }} />
        <View
          style={[
            styles.inner,
            { backgroundColor: innerBg, borderColor: c.o, borderRadius: radius.md - 4 },
            inner !== 'none' && Platform.OS === 'web' ? ({ boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.35)' } as object) : null,
            contentStyle,
          ]}
        >
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}

/** Wooden frame with grain, corner rivets and a parchment (or dark teal) content area. */
export function WoodPanel(props: { inner?: Inner; children: ReactNode; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; border?: number }) {
  return <Frame kind="wood" {...props} />;
}

/** Grey stone variant for secondary panels and stat tablets. */
export function StonePanel(props: { inner?: Inner; children: ReactNode; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; border?: number }) {
  return <Frame kind="stone" border={8} {...props} />;
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 3,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 18px rgba(20,10,0,0.45)' } as object) : { elevation: 6 }),
  },
  frame: { overflow: 'hidden' },
  inner: { borderWidth: 2, padding: 14, overflow: 'hidden' },
  rivet: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#B9B2A4',
    borderWidth: 1,
    borderColor: ink.stroke,
    zIndex: 2,
  },
  rivetShine: { position: 'absolute', top: 1, left: 1, width: 3, height: 3, borderRadius: 2, backgroundColor: '#F4F0E6' },
});
