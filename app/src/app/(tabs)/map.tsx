import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityTicker } from '@/components/game/ActivityTicker';
import { DevPanel } from '@/components/game/DevPanel';
import { Hud, StormBanner } from '@/components/game/Hud';
import { MapLegend } from '@/components/game/MapLegend';
import { TileSheet } from '@/components/game/TileSheet';
import { GameButton, GameImage, RedBadge, StrokeText } from '@/components/kit';
import GameMap from '@/components/map/GameMap';
import { Chip, ErrorBox } from '@/components/ui/kit';
import { useCities, useQuests, useStorm, useTiles } from '@/lib/api';
import { Images } from '@/lib/assets';
import { ACTION_LABEL, CLAIM_RADIUS_M, classifyAction, previewPoints } from '@/lib/gameRules';
import { distanceToLineM, formatDistance, nearest, offset } from '@/lib/geo';
import { useKeyboardWalk, useRealGps } from '@/lib/location';
import { useGame, type MapFilter } from '@/lib/store';
import { colors, space } from '@/lib/theme';
import { useMotionOK } from '@/theme/motion';
import { gold, ink, wood } from '@/theme/tokens';

const FILTERS: { id: MapFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '🗺️' },
  { id: 'mine', label: 'My team', icon: '🛡️' },
  { id: 'fog', label: 'Fog', icon: '🌫️' },
  { id: 'disputed', label: 'Disputed', icon: '⚔️' },
  { id: 'treasures', label: 'Treasures', icon: '💎' },
];

/** Soft pulsing glow behind the CHECK button. */
function Glow() {
  const motion = useMotionOK();
  const t = useSharedValue(0.5);
  useEffect(() => {
    if (motion) t.set(withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.35, { duration: 700 })), -1));
  }, [motion, t]);
  const a = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: 0.9 + t.value * 0.25 }] }));
  return <Animated.View style={[styles.glow, a]} pointerEvents="none" />;
}

function Pill({ children, onPress, testID }: { children: React.ReactNode; onPress?: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} disabled={!onPress} style={styles.pill} accessibilityRole={onPress ? 'button' : undefined}>
      {children}
    </Pressable>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const g = useGame();
  const tiles = useTiles();
  const cities = useCities();
  const storm = useStorm();
  const quests = useQuests();
  const [legend, setLegend] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const city = cities.data?.find((c) => c.key === g.city);
  const readyQuests = quests.data?.filter((q) => q.done && !q.claimed).length ?? 0;
  useKeyboardWalk(g.devPanelEnabled);
  useRealGps();

  // First launch: drop the player 120 m from the Ribeira de Coselhas so they must walk a little.
  useEffect(() => {
    if (g.position || !tiles.data) return;
    const start = tiles.data.features.find((f) => f.properties.stream_name === 'Ribeira de Coselhas') ?? tiles.data.features[0];
    if (start) {
      const [lon, lat] = start.properties.center;
      g.setPosition(offset({ lat, lon }, 90, -80));
    }
  }, [tiles.data, g]);

  const near = useMemo(() => nearest(g.position, tiles.data?.features ?? []), [g.position, tiles.data]);
  const selected = tiles.data?.features.find((f) => f.id === g.selectedTileId) ?? null;
  const selectedDistance = selected && g.position ? distanceToLineM(g.position, selected.geometry.coordinates) : null;
  const claimable = near && near.distance <= CLAIM_RADIUS_M && !near.item.properties.unsafe ? near.item : null;
  const action = claimable && g.player ? classifyAction(claimable.properties.state, claimable.properties.owner_team, g.player.team) : null;
  const waitingForThird = action === 'confirm_dispute' && !!g.player && claimable!.properties.dispute_parties.includes(g.player.id);
  const canCheck = !!claimable && !!action && !waitingForThird;

  const openCheck = (tileId: string) => router.push({ pathname: '/claim/[tileId]', params: { tileId } });

  if (tiles.error && !tiles.data) {
    return (
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <ErrorBox message={(tiles.error as Error).message} onRetry={() => tiles.refetch()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <GameMap
        tiles={tiles.data}
        center={city?.center ?? [-8.405, 40.2225]}
        zoom={city ? city.zoom + 1 : 15.2}
        position={g.position}
        myTeam={g.player?.team}
        filter={g.filter}
        highlightTileId={claimable?.id}
        selectedTileId={g.selectedTileId}
        flash={g.claimFlash}
        followPosition
        controlsTop={insets.top + (storm.data?.active ? 250 : 150)}
        onTilePress={(id) => g.set({ selectedTileId: id })}
        onMapPress={(pos) => {
          if (g.selectedTileId) g.set({ selectedTileId: null });
          else if (g.devPanelEnabled && g.teleportMode && !g.realGps) g.setPosition(pos);
        }}
      />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <Hud />
        <StormBanner />
        {filtersOpen && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
            {FILTERS.map((f) => (
              <Chip key={f.id} label={f.label} icon={f.icon} active={g.filter === f.id} onPress={() => g.set({ filter: f.id })} color={wood.base} />
            ))}
          </ScrollView>
        )}
        {!g.selectedTileId && <ActivityTicker />}
      </View>

      {tiles.isLoading && (
        <View style={styles.loading} pointerEvents="none">
          <GameImage src={Images.effect.coin} size={56} fallback="🪙" />
          <StrokeText size="S" align="center">
            Loading the stream map…
          </StrokeText>
        </View>
      )}

      {!g.selectedTileId && !g.devPanelOpen && (
        <View style={styles.side} pointerEvents="box-none">
          <View>
            <GameButton size="RoundS" color="blue" icon={Images.moment.questScroll} iconFallback="📜" accessibilityLabel="Quests" onPress={() => router.navigate('/quests')} />
            <RedBadge count={readyQuests} />
          </View>
          <GameButton
            size="RoundS"
            color={filtersOpen || g.filter !== 'all' ? 'orange' : 'blue'}
            icon={Images.marker.fog}
            iconFallback="🔍"
            accessibilityLabel="Map filters"
            onPress={() => setFiltersOpen(!filtersOpen)}
            testID="filters"
          />
          <GameButton size="RoundS" color="blue" iconFallback="❔" accessibilityLabel="Map legend" onPress={() => setLegend(true)} />
          {g.devPanelEnabled && Platform.OS === 'web' && (
            <GameButton size="RoundS" color="disabled" iconFallback="🛠" accessibilityLabel="Open Dev Panel" onPress={() => g.set({ devPanelOpen: true })} testID="open-dev" />
          )}
        </View>
      )}

      {!g.selectedTileId && (
        <View style={styles.bottom} pointerEvents="box-none">
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 6 }} pointerEvents="box-none">
            {claimable && waitingForThird ? (
              <Pill>
                <Text style={styles.pillText}>⚔️ Your dispute waits for a third player.</Text>
              </Pill>
            ) : canCheck ? (
              <Pill>
                <Text style={styles.pillText} numberOfLines={2}>
                  {ACTION_LABEL[action!]} · {claimable!.properties.stream_name}
                </Text>
                <StrokeText size="S" fontSize={15} color={gold.light}>
                  {`+${previewPoints(action!, !!storm.data?.active)}`}
                </StrokeText>
              </Pill>
            ) : near ? (
              <Pill onPress={() => g.set({ selectedTileId: near.item.id })} testID="walk-closer">
                <Text style={styles.pillText}>
                  {near.item.properties.unsafe && near.distance <= CLAIM_RADIUS_M ? '⚠️ Unsafe tile nearby' : `🚶 Walk closer · ${formatDistance(near.distance)}`}
                </Text>
              </Pill>
            ) : (
              <Pill>
                <Text style={styles.pillText}>{g.devPanelEnabled ? 'Click the map to set your position.' : 'Turn on GPS in Profile.'}</Text>
              </Pill>
            )}
          </View>
          <View>
            {canCheck && <Glow />}
            <GameButton
              size="Round"
              color={canCheck ? 'orange' : 'disabled'}
              disabled={!canCheck}
              label={canCheck ? 'CHECK' : 'WALK'}
              icon={canCheck ? Images.marker.player : null}
              iconFallback={canCheck ? undefined : '🚶'}
              accessibilityLabel={canCheck ? 'Check this tile' : 'Walk closer to a tile'}
              onPress={() => claimable && openCheck(claimable.id)}
              testID="check-tile"
            />
          </View>
        </View>
      )}

      <MapLegend open={legend} onClose={() => setLegend(false)} />
      {!g.selectedTileId && <DevPanel />}

      {selected && (
        <TileSheet
          tileId={selected.id}
          distance={selectedDistance}
          onClose={() => g.set({ selectedTileId: null })}
          onCheck={() => openCheck(selected.id)}
          onTeleport={
            g.devPanelEnabled && !g.realGps
              ? () => {
                  const [lon, lat] = selected.properties.center;
                  g.setPosition({ lat, lon });
                }
              : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', left: space.md, right: space.md, top: 0, gap: space.sm },
  side: { position: 'absolute', left: space.md, bottom: 24, gap: 10 },
  bottom: { position: 'absolute', left: 90, right: space.md, bottom: 28, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 230,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(30,18,8,0.85)',
    borderWidth: 2.5,
    borderColor: wood.outline,
  },
  pillText: { color: ink.white, fontFamily: 'Nunito_800ExtraBold', fontSize: 14, flexShrink: 1 },
  glow: { position: 'absolute', left: -14, top: -14, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,229,138,0.55)' },
  loading: { position: 'absolute', top: '42%', left: 0, right: 0, alignItems: 'center', gap: 6 },
});
