import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

function mix(a: number[], b: number[], t: number) {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * A plant that blooms when the kingdom is healthy and wilts when it is not.
 * health 0..100 (null = no land yet).
 */
export function KingdomPlant({ health, color, size = 180 }: { health: number | null; color: string; size?: number }) {
  const h = health == null ? 0 : Math.max(0, Math.min(100, health)) / 100;
  const droop = useSharedValue(0);
  const grow = useSharedValue(0.6);
  const sway = useSharedValue(0);
  const bloom = useSharedValue(0);

  useEffect(() => {
    droop.value = withSpring((1 - h) * 38, { damping: 14, stiffness: 60 });
    grow.value = withSpring(0.75 + h * 0.25, { damping: 12 });
    bloom.value = withDelay(300, withSpring(h >= 0.6 ? 1 : 0, { damping: 10 }));
  }, [h, droop, grow, bloom]);
  useEffect(() => {
    sway.value = withRepeat(withSequence(withTiming(1, { duration: 2200 }), withTiming(-1, { duration: 2200 })), -1, true);
  }, [sway]);

  const crown = useAnimatedStyle(() => ({
    transform: [{ translateY: size * 0.42 }, { rotate: `${droop.value + sway.value * 2.5}deg` }, { translateY: -size * 0.42 }, { scale: grow.value }],
  }));
  const flowers = useAnimatedStyle(() => ({ opacity: bloom.value, transform: [{ scale: 0.4 + bloom.value * 0.6 }] }));

  const leaf = mix([150, 120, 60], [70, 190, 110], h);
  const leafDark = mix([110, 85, 45], [40, 140, 80], h);
  const nFlowers = h >= 0.85 ? 3 : h >= 0.6 ? 2 : 0;
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Svg width={s} height={s * 0.3} viewBox="0 0 200 60" style={{ position: 'absolute', bottom: 0 }}>
        <Ellipse cx="100" cy="40" rx="78" ry="16" fill="#3B2A1A" opacity={0.55} />
        <Path d="M40 40 Q100 18 160 40 Q100 52 40 40 Z" fill="#5A3D24" />
        <Path d="M64 34 Q100 24 136 34" stroke="#4FB3E8" strokeWidth="4" fill="none" strokeLinecap="round" opacity={0.4 + h * 0.6} />
      </Svg>
      <Animated.View style={[{ position: 'absolute', width: s, height: s, bottom: s * 0.08 }, crown]}>
        <Svg width={s} height={s} viewBox="0 0 200 200">
          <Path d="M100 175 C 98 140, 104 110, 100 70" stroke={leafDark} strokeWidth="7" fill="none" strokeLinecap="round" />
          <G>
            <Path d="M100 140 C 70 132, 55 112, 52 96 C 75 98, 94 112, 100 140 Z" fill={leaf} />
            <Path d="M100 120 C 130 112, 146 92, 148 76 C 124 80, 106 96, 100 120 Z" fill={leaf} />
            <Path d="M100 98 C 80 88, 72 70, 74 58 C 90 64, 100 78, 100 98 Z" fill={leafDark} />
          </G>
          <Circle cx="100" cy="66" r="12" fill={h >= 0.4 ? color : leafDark} />
        </Svg>
        <Animated.View style={[{ position: 'absolute', width: s, height: s }, flowers]}>
          <Svg width={s} height={s} viewBox="0 0 200 200">
            {[
              [100, 52],
              [58, 92],
              [146, 72],
            ]
              .slice(0, nFlowers || 1)
              .map(([x, y], i) => (
                <G key={i}>
                  {[0, 72, 144, 216, 288].map((a) => (
                    <Ellipse
                      key={a}
                      cx={x + Math.cos((a * Math.PI) / 180) * 9}
                      cy={y + Math.sin((a * Math.PI) / 180) * 9}
                      rx="7"
                      ry="5"
                      fill="#FFF3C4"
                      transform={`rotate(${a} ${x + Math.cos((a * Math.PI) / 180) * 9} ${y + Math.sin((a * Math.PI) / 180) * 9})`}
                    />
                  ))}
                  <Circle cx={x} cy={y} r="5" fill="#F2C94C" />
                </G>
              ))}
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
