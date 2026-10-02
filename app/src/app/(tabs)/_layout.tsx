import { Redirect, Tabs } from 'expo-router';

import { TabBar, type TabBarProps } from '@/components/kit/TabBar';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { useGame } from '@/lib/store';
import { colors } from '@/lib/theme';

export default function TabsLayout() {
  const player = useGame((s) => s.player);
  if (!player) return <Redirect href="/onboarding" />;
  return (
    <PhoneFrame>
      <Tabs tabBar={(p) => <TabBar {...(p as unknown as TabBarProps)} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
        <Tabs.Screen name="map" />
        <Tabs.Screen name="kingdom" />
        <Tabs.Screen name="quests" />
        <Tabs.Screen name="leaderboard" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </PhoneFrame>
  );
}
