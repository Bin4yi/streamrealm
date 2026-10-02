import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { spring, useMotionOK } from '@/theme/motion';
import { button, ink } from '@/theme/tokens';

import { useFx } from './fx';
import { GameImage } from './GameImage';
import StrokeText from './StrokeText';

/** Number that counts up/down to its new value (about 0.6 s). */
export function useCountUp(value: number, ms = 650) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** Top-bar resource pill: big icon overlapping the left edge, outlined number, optional "+". */
export function ResourcePill({
  icon,
  fallback,
  value,
  onPlus,
  coinTarget,
  label,
  style,
  shine,
}: {
  icon: ImageSourcePropType | null;
  fallback?: string;
  value: number;
  onPlus?: () => void;
  /** Register this pill as the place where flying coins land. */
  coinTarget?: boolean;
  label: string;
  style?: StyleProp<ViewStyle>;
  /** Idle shine on the icon every few seconds. */
  shine?: boolean;
}) {
  const shown = useCountUp(value);
  const bounce = useSharedValue(1);
  const glow = useSharedValue(0);
  const motion = useMotionOK();
  const ref = useRef<View>(null);
  const setTarget = useFx((s) => s.setCoinTarget);
  const prev = useRef(value);
  useEffect(() => {
    if (value !== prev.current) bounce.set(withSequence(withSpring(1.35, spring.pop), withSpring(1, spring.pop)));
    prev.current = value;
  }, [value, bounce]);
  useEffect(() => {
    if (!shine || !motion) return;
    glow.set(withRepeat(withSequence(withTiming(0, { duration: 2600 }), withTiming(1, { duration: 250 }), withTiming(0, { duration: 350 })), -1));
  }, [shine, motion, glow]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value * (1 + glow.value * 0.08) }, { rotate: `${glow.value * 8}deg` }] }));
  const measure = () => {
    if (!coinTarget) return;
    ref.current?.measureInWindow((x, y, w, h) => setTarget({ x: x + 14, y: y + h / 2 }));
  };
  return (
    <View ref={ref} onLayout={measure} style={[styles.pill, style]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Animated.View style={[styles.pillIcon, iconStyle]}>
        <GameImage src={icon} size={38} fallback={fallback} />
      </Animated.View>
      <StrokeText size="S" fontSize={18} style={{ minWidth: 34, textAlign: 'right' }}>
        {shown}
      </StrokeText>
      {onPlus && (
        <Pressable onPress={onPlus} accessibilityLabel={`More ${label}`} style={styles.plus} hitSlop={10}>
          <StrokeText size="S" fontSize={16}>
            +
          </StrokeText>
        </Pressable>
      )}
    </View>
  );
}

/** Thick outlined progress bar with a moving shine stripe and centered text. */
export function ChunkyProgress({
  value,
  max,
  color = button.green.base,
  height = 26,
  label,
  end,
  endFallback,
  style,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
  label?: string;
  end?: ImageSourcePropType | null;
  endFallback?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const k = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const w = useSharedValue(0);
  const shine = useSharedValue(0);
  const motion = useMotionOK();
  useEffect(() => {
    w.set(withTiming(k, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [k, w]);
  useEffect(() => {
    if (motion) shine.set(withRepeat(withTiming(1, { duration: 2200, easing: Easing.linear }), -1));
  }, [motion, shine]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  const stripe = useAnimatedStyle(() => ({ left: `${-30 + shine.value * 160}%` }));
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }} accessibilityLabel={label}>
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <Animated.View style={[styles.fill, { backgroundColor: color, borderRadius: height / 2 }, fill]}>
          <View style={styles.fillTop} />
          <Animated.View style={[styles.stripe, stripe]} />
        </Animated.View>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <StrokeText size="S" fontSize={Math.max(13, height * 0.58)} align="center" style={{ lineHeight: height - 4 }}>
            {label ?? `${value} / ${max}`}
          </StrokeText>
        </View>
      </View>
      {end !== undefined && (
        <View style={{ marginLeft: -height * 0.6 }}>
          <GameImage src={end} size={height * 1.7} fallback={endFallback} />
        </View>
      )}
    </View>
  );
}

/** Small red counter that pops in. */
export function RedBadge({ count, style }: { count: number; style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(0);
  useEffect(() => {
    s.set(count > 0 ? withSpring(1, spring.pop) : withTiming(0, { duration: 120 }));
  }, [count, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  if (count <= 0) return null;
  return (
    <Animated.View style={[styles.badge, a, style]} accessibilityLabel={`${count} new`}>
      <StrokeText size="S" fontSize={12} align="center">
        {count > 9 ? '9+' : count}
      </StrokeText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingLeft: 30,
    paddingRight: 8,
    marginLeft: 12,
    borderRadius: 17,
    backgroundColor: 'rgba(14,20,24,0.82)',
    borderWidth: 2.5,
    borderColor: ink.stroke,
  },
  pillIcon: { position: 'absolute', left: -14, top: -5 },
  plus: { width: 22, height: 22, borderRadius: 6, backgroundColor: button.green.base, borderWidth: 2, borderColor: ink.stroke, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, backgroundColor: '#2A1A0C', borderWidth: 3, borderColor: ink.stroke, overflow: 'hidden', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  fillTop: { position: 'absolute', left: 4, right: 4, top: 2, height: '35%', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.3)' },
  stripe: { position: 'absolute', top: -10, bottom: -10, width: 18, backgroundColor: 'rgba(255,255,255,0.35)', transform: [{ skewX: '-20deg' }] },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 11,
    backgroundColor: button.red.base,
    borderWidth: 2,
    borderColor: ink.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
});
