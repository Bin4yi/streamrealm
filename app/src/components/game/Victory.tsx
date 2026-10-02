import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts } from '@/lib/theme';

function Coin({ i, n }: { i: number; n: number }) {
  const t = useSharedValue(0);
  const ang = (i / n) * Math.PI * 2;
  const dist = 110 + (i % 3) * 25;
  useEffect(() => {
    t.value = withDelay(250 + (i % 5) * 40, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [t, i]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value * 0.9,
    transform: [{ translateX: Math.cos(ang) * dist * t.value }, { translateY: Math.sin(ang) * dist * t.value + t.value * t.value * 60 }, { scale: 0.5 + t.value * 0.6 }],
  }));
  return <Animated.View style={[styles.coin, style]} />;
}

/** Big emblem with rotating rays, a coin burst and floating points. */
export function VictoryBurst({ emoji, color, points }: { emoji: string; color: string; points: number }) {
  const scale = useSharedValue(0);
  const spin = useSharedValue(0);
  const float = useSharedValue(0);
  useEffect(() => {
    scale.value = withSequence(withSpring(1.15, { damping: 8 }), withSpring(1, { damping: 12 }));
    spin.value = withRepeat(withTiming(360, { duration: 12000, easing: Easing.linear }), -1);
    float.value = withDelay(300, withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }));
  }, [scale, spin, float]);
  const emblem = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const rays = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }, { scale: scale.value }] }));
  const pts = useAnimatedStyle(() => ({ opacity: float.value < 0.85 ? Math.min(1, float.value * 4) : (1 - float.value) * 6.6, transform: [{ translateY: -float.value * 90 }] }));
  const coins = useMemo(() => Array.from({ length: 16 }, (_, i) => i), []);
  const rayPath = useMemo(() => {
    let d = '';
    for (let i = 0; i < 12; i++) {
      const a1 = (i / 12) * Math.PI * 2;
      const a2 = a1 + Math.PI / 24;
      d += `M110 110 L${110 + Math.cos(a1) * 110} ${110 + Math.sin(a1) * 110} L${110 + Math.cos(a2) * 110} ${110 + Math.sin(a2) * 110} Z `;
    }
    return d;
  }, []);
  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.rays, rays]}>
        <Svg width={220} height={220}>
          <Path d={rayPath} fill={colors.gold} opacity={0.22} />
        </Svg>
      </Animated.View>
      {coins.map((i) => (
        <Coin key={i} i={i} n={coins.length} />
      ))}
      <Animated.View style={[styles.emblem, { backgroundColor: color, shadowColor: color }, emblem]}>
        <Text style={{ fontSize: 64 }}>{emoji}</Text>
      </Animated.View>
      {points > 0 && <Animated.Text style={[styles.points, pts]}>+{points}</Animated.Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 260, height: 240, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  rays: { position: 'absolute' },
  emblem: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: colors.gold,
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 12,
  },
  coin: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.goldDeep },
  points: { position: 'absolute', top: 96, fontFamily: fonts.titleBlack, fontSize: 40, color: colors.gold, textShadowColor: '#7a5a00', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
});
