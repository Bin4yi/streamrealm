import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { colors, fonts, glass, radius, shadow, space, teams, type TeamId } from '@/lib/theme';

// ---------- Text ----------

type Variant = 'title' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny' | 'number' | 'label';
const variants: Record<Variant, TextStyle> = {
  title: { fontFamily: fonts.titleBlack, fontSize: 30, letterSpacing: 1, color: colors.text },
  h1: { fontFamily: fonts.title, fontSize: 24, color: colors.text },
  h2: { fontFamily: fonts.title, fontSize: 19, color: colors.text },
  h3: { fontFamily: fonts.bodyBlack, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text },
  small: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  tiny: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.5, color: colors.textDim, textTransform: 'uppercase' },
  number: { fontFamily: fonts.titleBlack, fontSize: 22, color: colors.gold },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
};

export function Txt({ v = 'body', style, ...rest }: TextProps & { v?: Variant }) {
  return <Text {...rest} style={[variants[v], style]} />;
}

// ---------- Containers ----------

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, glass, shadow, padded && { padding: space.lg }, style]}>{children}</View>;
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

// ---------- Buttons ----------

type BtnKind = 'gold' | 'primary' | 'ghost' | 'danger' | 'team';
export function GameButton({
  label,
  onPress,
  kind = 'gold',
  icon,
  disabled,
  loading,
  team,
  style,
  big,
  testID,
}: {
  label: string;
  onPress?: () => void;
  kind?: BtnKind;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  team?: TeamId;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
  testID?: string;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const grad: [string, string] =
    kind === 'gold'
      ? ['#FFE08A', colors.gold]
      : kind === 'danger'
        ? ['#FF8A8A', colors.danger]
        : kind === 'team' && team
          ? [teams[team].soft, teams[team].color]
          : kind === 'primary'
            ? ['#6CCBF5', '#2B8FC4']
            : ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.06)'];
  const textColor = kind === 'gold' ? '#3B2A00' : colors.white;
  return (
    <Animated.View style={[anim, { opacity: disabled ? 0.5 : 1 }, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled || loading}
        onPress={onPress}
        onPressIn={() => (scale.value = withSpring(0.95, { damping: 15 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 12 }))}
        style={Platform.OS === 'web' ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as ViewStyle) : undefined}
      >
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.btn, big && styles.btnBig, kind === 'ghost' && styles.btnGhost, kind !== 'ghost' && shadow]}
        >
          {loading ? (
            <ActivityIndicator color={textColor} />
          ) : (
            <>
              {icon && <Ionicons name={icon} size={big ? 22 : 18} color={textColor} />}
              <Text style={[styles.btnText, big && styles.btnTextBig, { color: textColor }]}>{label}</Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color = colors.water,
  icon,
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[styles.chip, active ? { backgroundColor: color, borderColor: color } : null, style]}
    >
      {icon ? <Text style={{ fontSize: 14 }}>{icon}</Text> : null}
      <Text style={[styles.chipText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color = colors.text,
  bg = 'rgba(14,42,51,0.85)',
  size = 44,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  color?: string;
  bg?: string;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, shadow]}
    >
      <Ionicons name={icon} size={size * 0.48} color={color} />
    </Pressable>
  );
}

// ---------- Info tooltip ----------

/** Small (i) button that explains a word in simple English. */
export function InfoTip({ title, text, color = colors.textMuted }: { title: string; text: string; color?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel={`What is ${title}?`} hitSlop={10}>
        <Ionicons name="information-circle-outline" size={18} color={color} />
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.tipBackdrop} onPress={() => setOpen(false)}>
          <View style={[styles.tipCard, shadow]}>
            <Row>
              <Ionicons name="information-circle" size={22} color={colors.water} />
              <Txt v="h3">{title}</Txt>
            </Row>
            <Txt style={{ marginTop: space.sm }}>{text}</Txt>
            <Txt v="small" style={{ marginTop: space.md, textAlign: 'right' }}>
              Tap to close
            </Txt>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ---------- Progress ----------

export function ProgressBar({ value, color = colors.gold, height = 10, track = 'rgba(255,255,255,0.12)' }: { value: number; color?: string; height?: number; track?: string }) {
  const w = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, value));
  useEffect(() => {
    w.value = withTiming(clamped, { duration: 700 });
  }, [clamped, w]);
  const anim = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: color }, anim]} />
    </View>
  );
}

// ---------- Team badge ----------

export function TeamBadge({ team, size = 'md' }: { team: TeamId; size?: 'sm' | 'md' }) {
  const t = teams[team];
  const sm = size === 'sm';
  return (
    <View style={[styles.teamBadge, { backgroundColor: t.color, paddingHorizontal: sm ? 8 : 12, paddingVertical: sm ? 3 : 6 }]}>
      <Text style={{ fontSize: sm ? 12 : 16 }}>{t.emoji}</Text>
      <Text style={{ fontFamily: fonts.bodyBlack, color: colors.white, fontSize: sm ? 12 : 14 }}>{t.name}</Text>
    </View>
  );
}

// ---------- States ----------

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.gold} size="large" />
      <Txt v="small" style={{ marginTop: space.md }}>
        {label}
      </Txt>
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ margin: space.lg, alignItems: 'center', gap: space.sm }}>
      <Ionicons name="cloud-offline-outline" size={36} color={colors.warn} />
      <Txt v="h3" style={{ textAlign: 'center' }}>
        Something went wrong
      </Txt>
      <Txt v="small" style={{ textAlign: 'center' }}>
        {message}
      </Txt>
      {onRetry && <GameButton label="Try again" kind="primary" icon="refresh" onPress={onRetry} style={{ marginTop: space.sm }} />}
    </Card>
  );
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height, width, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' }, style]} />;
}

export function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Txt v="h3">{title}</Txt>
      <Txt v="small" style={{ textAlign: 'center' }}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.cardBorder },
  btn: { minHeight: 48, borderRadius: radius.pill, paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  btnBig: { minHeight: 60, paddingHorizontal: space.xxl },
  btnGhost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  btnText: { fontFamily: fonts.bodyBlack, fontSize: 16, letterSpacing: 0.3 },
  btnTextBig: { fontFamily: fonts.titleBlack, fontSize: 18, letterSpacing: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(14,42,51,0.82)',
  },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.textMuted },
  tipBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  tipCard: { maxWidth: 380, width: '100%', backgroundColor: colors.cardSolid, borderRadius: radius.lg, padding: space.xl, borderWidth: 1, borderColor: colors.cardBorder },
  teamBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, alignSelf: 'flex-start' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
});
