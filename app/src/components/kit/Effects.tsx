import { useEffect, useMemo, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Images } from '@/lib/assets';
import { play } from '@/lib/sound';
import { spring, useMotionOK } from '@/theme/motion';
import { PHONE_MAX_WIDTH as PHONE } from '@/lib/theme';
import { button, gold, ink } from '@/theme/tokens';

import { useFx } from './fx';
import { GameImage } from './GameImage';
import { WoodPanel } from './Panels';
import { RibbonTitle } from './RibbonTitle';
import StrokeText from './StrokeText';

// ---------------------------------------------------------------- GameModal

/** Dim backdrop, wooden panel springing in with an overshoot, ribbon title and a round red close button. */
export function GameModal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const s = useSharedValue(0.6);
  const o = useSharedValue(0);
  useEffect(() => {
    if (open) {
      o.set(withTiming(1, { duration: 160 }));
      s.set(withSequence(withTiming(0.6, { duration: 0 }), withSpring(1.05, { damping: 9, stiffness: 300 }), withSpring(1, spring.soft)));
    }
  }, [open, s, o]);
  const panel = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: o.value }));
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Animated.View style={[styles.modalWrap, panel]}>
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            <RibbonTitle title={title} style={{ marginBottom: -18, zIndex: 3 }} />
            <WoodPanel contentStyle={{ paddingTop: 26 }}>{children}</WoodPanel>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
              <StrokeText size="M" fontSize={22} align="center">
                ✕
              </StrokeText>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------- RewardBurst

function Sparkle({ x, y, delay, size }: { x: number; y: number; delay: number; size: number }) {
  const t = useSharedValue(0);
  const motion = useMotionOK();
  useEffect(() => {
    t.set(motion ? withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0, { duration: 650 })), -1)) : withTiming(0.8, { duration: 300 }));
  }, [t, delay, motion]);
  const a = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: 0.4 + t.value * 0.7 }, { rotate: `${t.value * 40}deg` }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, a]} pointerEvents="none">
      <GameImage src={Images.effect.sparkle} size={size} fallback="✨" />
    </Animated.View>
  );
}

/** Rotating light rays behind something, with sparkles popping around it. */
export function RewardBurst({ size = 240, children, rayColor = gold.light }: { size?: number; children: ReactNode; rayColor?: string }) {
  const spin = useSharedValue(0);
  const motion = useMotionOK();
  useEffect(() => {
    if (motion) spin.set(withRepeat(withTiming(360, { duration: 14000, easing: Easing.linear }), -1));
  }, [motion, spin]);
  const rays = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const path = useMemo(() => {
    let d = '';
    for (let i = 0; i < 14; i++) {
      const a1 = (i / 14) * Math.PI * 2;
      const a2 = a1 + Math.PI / 22;
      d += `M50 50 L${50 + Math.cos(a1) * 50} ${50 + Math.sin(a1) * 50} L${50 + Math.cos(a2) * 50} ${50 + Math.sin(a2) * 50} Z `;
    }
    return d;
  }, []);
  const sparkles = useMemo(
    () => Array.from({ length: 7 }, (_, i) => ({ x: size / 2 + Math.cos(i * 0.9) * size * 0.42 - 14, y: size / 2 + Math.sin(i * 0.9) * size * 0.42 - 14, delay: i * 180, s: 22 + (i % 3) * 8 })),
    [size],
  );
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, rays]} pointerEvents="none">
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path d={path} fill={rayColor} opacity={0.32} />
        </Svg>
      </Animated.View>
      {sparkles.map((s, i) => (
        <Sparkle key={i} x={s.x} y={s.y} delay={s.delay} size={s.s} />
      ))}
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- CoinFly

function FlyingCoin({ from, to, delay, bend, onLand }: { from: { x: number; y: number }; to: { x: number; y: number }; delay: number; bend: number; onLand: () => void }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withTiming(1, { duration: 750, easing: Easing.in(Easing.quad) }, (done) => done && runOnJS(onLand)())));
  }, [t, delay, onLand]);
  const a = useAnimatedStyle(() => {
    const k = t.value;
    // Quadratic curve through a control point pulled sideways.
    const cx = (from.x + to.x) / 2 + bend;
    const cy = Math.min(from.y, to.y) - 120;
    const x = (1 - k) * (1 - k) * from.x + 2 * (1 - k) * k * cx + k * k * to.x;
    const y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * cy + k * k * to.y;
    return { opacity: k < 0.98 ? 1 : 0, transform: [{ translateX: x - 16 }, { translateY: y - 16 }, { scale: 1.2 - k * 0.5 }] };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, a]} pointerEvents="none">
      <GameImage src={Images.effect.coin} size={32} fallback="🪙" />
    </Animated.View>
  );
}

/** 8-12 coins fly in curves from a point to the coin pill. Each landing calls onLand. */
export function CoinFly({ from, count = 10, onLand, onDone }: { from: { x: number; y: number }; count?: number; onLand?: () => void; onDone?: () => void }) {
  const target = useFx((s) => s.coinTarget);
  const { width } = useWindowDimensions();
  const to = target ?? { x: width - 60, y: 40 };
  const coins = useMemo(() => Array.from({ length: count }, (_, i) => ({ delay: i * 70, bend: ((i % 5) - 2) * 50 })), [count]);
  let landed = 0;
  const land = () => {
    landed += 1;
    if (landed % 3 === 1) play('coin');
    onLand?.();
    if (landed === count) onDone?.();
  };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {coins.map((c, i) => (
        <FlyingCoin key={i} from={from} to={to} delay={c.delay} bend={c.bend} onLand={land} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- Toast

function ToastItem({ id, text, icon, fallback }: { id: number; text: string; icon?: unknown; fallback?: string }) {
  const dismiss = useFx((s) => s.dismiss);
  const y = useSharedValue(-120);
  useEffect(() => {
    y.set(withSequence(withSpring(0, spring.pop), withDelay(2600, withTiming(-140, { duration: 260 }, (done) => done && runOnJS(dismiss)(id)))));
  }, [y, id, dismiss]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[styles.toast, a]}>
      <GameImage src={(icon as ImageSourcePropType) ?? null} size={34} fallback={fallback ?? '📣'} />
      <StrokeText size="S" fontSize={16} numberOfLines={2} style={{ flexShrink: 1 }}>
        {text}
      </StrokeText>
    </Animated.View>
  );
}

/** Wooden mini banners sliding down from the top. Mount once at the root. */
export function ToastHost() {
  const toasts = useFx((s) => s.toasts);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.toastHost, { top: insets.top + 8 }]} pointerEvents="none">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,12,16,0.72)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalWrap: { width: '100%', maxWidth: PHONE - 40 },
  close: {
    position: 'absolute',
    top: 30,
    right: -6,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: button.red.base,
    borderWidth: 3,
    borderColor: ink.stroke,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  toastHost: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 6, zIndex: 100 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: PHONE - 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#8B5A2B',
    borderWidth: 3,
    borderColor: '#3B240E',
  },
});
