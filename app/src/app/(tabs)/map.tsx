import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityTicker } from '@/components/game/ActivityTicker';
import { DevPanel } from '@/components/game/DevPanel';
import { Hud, StormBanner } from '@/components/game/Hud';
import { TileSheet } from '@/components/game/TileSheet';
import GameMap from '@/components/map/GameMap';
import { Card, Chip, ErrorBox, GameButton, Txt } from '@/components/ui/kit';
import { useCities, useStorm, useTiles } from '@/lib/api';
import { ACTION_LABEL, CLAIM_RADIUS_M, classifyAction, previewPoints } from '@/lib/gameRules';
import { distanceToLineM, formatDistance, nearest, offset } from '@/lib/geo';
import { useKeyboardWalk, useRealGps } from '@/lib/location';
import { useGame, type MapFilter } from '@/lib/store';
import { colors, space } from '@/lib/theme';

const FILTERS: { id: MapFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '🗺️' },
  { id: 'mine', label: 'My team', icon: '🛡️' },
  { id: 'fog', label: 'Fog', icon: '🌫️' },
  { id: 'disputed', label: 'Disputed', icon: '⚔️' },
  { id: 'treasures', label: 'Treasures', icon: '💎' },
];

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const g = useGame();
  const tiles = useTiles();
  const cities = useCities();
  const storm = useStorm();
  const city = cities.data?.find((c) => c.key === g.city);
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
        onTilePress={(id) => g.set({ selectedTileId: id })}
        onMapPress={(pos) => {
          if (g.selectedTileId) g.set({ selectedTileId: null });
          else if (g.devPanelEnabled && g.teleportMode && !g.realGps) g.setPosition(pos);
        }}
      />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <Hud />
        <StormBanner />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={f.label} icon={f.icon} active={g.filter === f.id} onPress={() => g.set({ filter: f.id })} />
          ))}
        </ScrollView>
        {!g.selectedTileId && <ActivityTicker />}
      </View>

      {tiles.isLoading && (
        <View style={styles.loading} pointerEvents="none">
          <Card style={{ paddingVertical: space.sm }}>
            <Txt v="small">Loading the stream map…</Txt>
          </Card>
        </View>
      )}

      {!g.selectedTileId && (
        <View style={styles.bottom} pointerEvents="box-none">
          {claimable && waitingForThird ? (
            <Card style={{ paddingVertical: space.sm }}>
              <Txt v="small" style={{ color: colors.text }}>
                ⚔️ Your dispute here waits for a third player. Ask a friend from any team to check it!
              </Txt>
            </Card>
          ) : claimable && action ? (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Card padded={false} style={styles.hint}>
                <Txt v="small" style={{ color: colors.text }} numberOfLines={1}>
                  {ACTION_LABEL[action]} · {claimable.properties.stream_name} · +{previewPoints(action, !!storm.data?.active)} 🪙
                </Txt>
              </Card>
              <GameButton label="CHECK THIS TILE" icon="camera" big onPress={() => openCheck(claimable.id)} testID="check-tile" />
            </View>
          ) : near ? (
            <GameButton
              label={near.item.properties.unsafe && near.distance <= CLAIM_RADIUS_M ? 'Unsafe tile nearby' : `Walk closer (${formatDistance(near.distance)})`}
              icon="walk"
              kind="ghost"
              style={{ backgroundColor: 'rgba(14,42,51,0.9)', borderRadius: 999 }}
              onPress={() => g.set({ selectedTileId: near.item.id })}
              testID="walk-closer"
            />
          ) : (
            <Card>
              <Txt v="small">{g.devPanelEnabled ? 'Click the map to set your position.' : 'Turn on GPS in Profile.'}</Txt>
            </Card>
          )}
        </View>
      )}

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
  bottom: { position: 'absolute', left: space.md, right: space.md, bottom: 40, alignItems: 'center' },
  hint: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 999, maxWidth: '100%' },
  loading: { position: 'absolute', top: '45%', left: 0, right: 0, alignItems: 'center' },
});
