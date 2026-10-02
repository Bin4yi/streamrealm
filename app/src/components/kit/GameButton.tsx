import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { play } from '@/lib/sound';
import { spring } from '@/theme/motion';
import { button, ink, type ButtonColor } from '@/theme/tokens';

import { GameImage } from './GameImage';
import StrokeText from './StrokeText';

type Size = 'S' | 'M' | 'L' | 'Round' | 'RoundS';
const SIZES: Record<Size, { h: number; lip: number; pad: number; font: number; icon: number; radius: number }> = {
  S: { h: 40, lip: 5, pad: 14, font: 16, icon: 24, radius: 14 },
  M: { h: 50, lip: 6, pad: 18, font: 20, icon: 30, radius: 16 },
  L: { h: 62, lip: 6, pad: 24, font: 25, icon: 38, radius: 20 },
  Round: { h: 92, lip: 7, pad: 0, font: 22, icon: 40, radius: 46 },
  RoundS: { h: 58, lip: 5, pad: 0, font: 12, icon: 30, radius: 29 },
};

/**
 * Chunky 3D game button: gradient body, dark bottom lip, glossy top strip, dark outline.
 * Pressing pushes the body down into the lip.
 */
export function GameButton({
  label,
  onPress,
  color = 'green',
  size = 'M',
  icon,
  iconFallback,
  disabled,
  loading,
  style,
  testID,
  children,
  accessibilityLabel,
}: {
  label?: string;
  onPress?: () => void;
  color?: ButtonColor;
  size?: Size;
  icon?: ImageSourcePropType | null;
  iconFallback?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const s = SIZES[size];
  const c = button[disabled ? 'disabled' : color];
  const p = useSharedValue(0);
  const body = useAnimatedStyle(() => ({ transform: [{ translateY: p.value * (s.lip - 1) }] }));
  const wrap = useAnimatedStyle(() => ({ transform: [{ scale: 1 - p.value * 0.04 }] }));
  const round = size === 'Round' || size === 'RoundS';

  return (
    <Animated.View style={[wrap, round ? { width: s.h } : null, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled || loading}
        hitSlop={s.h < 48 ? (48 - s.h) / 2 : 0}
        onPressIn={() => {
          p.set(withSpring(1, spring.press));
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }}
        onPressOut={() => p.set(withSpring(0, spring.pop))}
        onPress={() => {
          play('click');
          onPress?.();
        }}
        style={Platform.OS === 'web' ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as ViewStyle) : undefined}
      >
        <View style={[styles.outline, { borderRadius: s.radius + 3, backgroundColor: c.lip, paddingBottom: s.lip, width: round ? s.h : undefined }]}>
          <Animated.View style={[{ borderRadius: s.radius, overflow: 'hidden' }, body]}>
            <LinearGradient colors={[c.top, c.base]} style={[styles.body, { height: round ? s.h - s.lip - 6 : s.h, paddingHorizontal: s.pad, borderRadius: s.radius }]}>
              <View style={[styles.gloss, { borderRadius: s.radius }]} pointerEvents="none" />
              {loading ? (
                <ActivityIndicator color={ink.white} />
              ) : (
                <View style={[styles.row, round && { flexDirection: 'column', gap: 0 }]}>
                  {(icon !== undefined || iconFallback) && <GameImage src={icon ?? null} size={s.icon} fallback={iconFallback} />}
                  {label ? (
                    <StrokeText fontSize={round ? s.font * 0.8 : s.font} align="center" numberOfLines={1}>
                      {label}
                    </StrokeText>
                  ) : null}
                  {children}
                </View>
              )}
            </LinearGradient>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outline: { borderWidth: 3, borderColor: ink.stroke },
  body: { alignItems: 'center', justifyContent: 'center' },
  gloss: { position: 'absolute', top: 3, left: 8, right: 8, height: '32%', backgroundColor: 'rgba(255,255,255,0.28)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
