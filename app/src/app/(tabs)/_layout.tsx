import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { useGame } from '@/lib/store';
import { colors, fonts } from '@/lib/theme';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap, string]> = {
  map: ['map', 'map-outline', 'Map'],
  kingdom: ['shield', 'shield-outline', 'Kingdom'],
  quests: ['ribbon', 'ribbon-outline', 'Quests'],
  leaderboard: ['trophy', 'trophy-outline', 'Ranks'],
  profile: ['person-circle', 'person-circle-outline', 'Profile'],
};

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const [on, off, label] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline', route.name];
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={styles.item}
          >
            <View style={[styles.iconWrap, focused && styles.iconWrapOn]}>
              <Ionicons name={focused ? on : off} size={22} color={focused ? colors.gold : colors.textDim} />
            </View>
            <Text style={[styles.label, focused && { color: colors.gold }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const player = useGame((s) => s.player);
  if (!player) return <Redirect href="/onboarding" />;
  return (
    <PhoneFrame>
      <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
        <Tabs.Screen name="map" />
        <Tabs.Screen name="kingdom" />
        <Tabs.Screen name="quests" />
        <Tabs.Screen name="leaderboard" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bgDeep,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 6,
  },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 48 },
  iconWrap: { width: 46, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconWrapOn: { backgroundColor: 'rgba(242,201,76,0.14)' },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.textDim },
});
