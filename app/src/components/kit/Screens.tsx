import { useEffect, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlayer } from '@/lib/api';
import { Images } from '@/lib/assets';
import { useMotionOK } from '@/theme/motion';
import { gold, parchment } from '@/theme/tokens';

import { ResourcePill } from './Bits';
import { GameImage } from './GameImage';
import { WoodPanel } from './Panels';
import { RibbonTitle } from './RibbonTitle';
import StrokeText from './StrokeText';
import { WorldBackground } from './WorldBackground';

/** Spinning coin: the game's loading indicator (never a blank screen). */
export function CoinLoader({ label = 'Loading…', size = 56 }: { label?: string; size?: number }) {
  const motion = useMotionOK();
  const r = useSharedValue(0);
  useEffect(() => {
    if (motion) r.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1));
  }, [motion, r]);
  // A coin "spin" is a horizontal squash, not a rotation.
  const a = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.cos(r.value * Math.PI * 2) }] }));
  return (
    <View style={{ alignItems: 'center', gap: 8, padding: 24 }} accessibilityRole="progressbar" accessibilityLabel={label}>
      <Animated.View style={a}>
        <GameImage src={Images.effect.coin} size={size} fallback="🪙" />
      </Animated.View>
      <StrokeText size="S">{label}</StrokeText>
    </View>
  );
}

/** Friendly empty state with an image and one sentence. */
export function EmptyArt({ img, title, text, fallback = '🌿' }: { img: ImageSourcePropType | null; title: string; text: string; fallback?: string }) {
  return (
    <WoodPanel contentStyle={{ alignItems: 'center', gap: 6 }}>
      <GameImage src={img} size={130} fallback={fallback} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </WoodPanel>
  );
}

/** Game screen: world background, ribbon title, coin pill, pull to refresh. */
export function GameScreen({
  title,
  ribbon = 'red',
  header,
  children,
  refreshing,
  onRefresh,
  coins = true,
}: {
  title: string;
  ribbon?: 'red' | 'blue' | 'green';
  header?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  coins?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { data: player } = usePlayer();
  return (
    <WorldBackground>
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingTop: insets.top + 10, paddingBottom: 30, gap: 14 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={gold.base} /> : undefined}
      >
        {coins && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <ResourcePill icon={Images.effect.coin} fallback="🪙" value={player?.points ?? 0} label="Coins" coinTarget shine />
          </View>
        )}
        {header}
        <RibbonTitle title={title} color={ribbon} />
        {children}
      </ScrollView>
    </WorldBackground>
  );
}

const styles = StyleSheet.create({
  emptyTitle: { fontFamily: 'LilitaOne_400Regular', fontSize: 20, color: parchment.text, textAlign: 'center' },
  emptyText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: parchment.muted, textAlign: 'center' },
});
