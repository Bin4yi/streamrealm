import { LinearGradient } from 'expo-linear-gradient';
import type { ImageSourcePropType } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useQuests } from '@/lib/api';
import { Images } from '@/lib/assets';
import { avatarImage } from '@/lib/format';
import { useGame } from '@/lib/store';
import { spring } from '@/theme/motion';
import { gold, ink, wood } from '@/theme/tokens';

import { RedBadge } from './Bits';
import { GameImage } from './GameImage';
import StrokeText from './StrokeText';

type Route = { key: string; name: string };
export type TabBarProps = {
  state: { index: number; routes: Route[] };
  navigation: { emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean }; navigate: (name: string) => void };
};

function Tab({ focused, icon, fallback, label, badge, onPress }: { focused: boolean; icon: ImageSourcePropType | null; fallback: string; label: string; badge?: number; onPress: () => void }) {
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: withSpring(focused ? -8 : 0, spring.pop) }, { scale: withSpring(focused ? 1.08 : 1, spring.pop) }] }), [focused]);
  return (
    <Pressable style={styles.item} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label}>
      <Animated.View style={lift}>
        <View style={[styles.square, focused ? styles.squareOn : styles.squareOff]}>
          <GameImage src={icon} size={34} fallback={fallback} />
          {badge ? <RedBadge count={badge} /> : null}
        </View>
      </Animated.View>
      <StrokeText size="S" fontSize={12} align="center" color={focused ? gold.light : ink.dim}>
        {label}
      </StrokeText>
    </Pressable>
  );
}

/** Wooden bottom bar with square chunky tab buttons. The active tab is raised and glows. */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const player = useGame((s) => s.player);
  const quests = useQuests();
  const ready = quests.data?.filter((q) => q.done && !q.claimed).length ?? 0;
  const icons: Record<string, [ImageSourcePropType | null, string, string, number?]> = {
    map: [Images.marker.player, '🗺️', 'Map'],
    kingdom: [player ? Images.emblem[player.team] : null, '🛡️', 'Kingdom'],
    quests: [Images.moment.questScroll, '📜', 'Quests', ready],
    leaderboard: [Images.effect.coinPile, '🏆', 'Ranks'],
    profile: [avatarImage(player?.avatar), '🙂', 'Profile'],
  };
  return (
    <LinearGradient colors={[wood.light, wood.base, wood.dark]} style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const [icon, fallback, label, badge] = icons[route.name] ?? [null, '•', route.name];
        return (
          <Tab
            key={route.key}
            focused={focused}
            icon={icon}
            fallback={fallback}
            label={label}
            badge={badge}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          />
        );
      })}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingTop: 8, borderTopWidth: 3, borderTopColor: wood.outline },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 56 },
  square: { width: 50, height: 50, borderRadius: 14, borderWidth: 3, borderColor: ink.stroke, alignItems: 'center', justifyContent: 'center' },
  squareOn: { backgroundColor: '#F7D774', shadowColor: gold.light, shadowOpacity: 0.9, shadowRadius: 10, elevation: 6 },
  squareOff: { backgroundColor: '#5E3A17' },
});
