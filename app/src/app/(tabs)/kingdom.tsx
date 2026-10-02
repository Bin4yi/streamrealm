import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Mascot } from '@/components/game/Mascot';
import { plantStage } from '@/components/game/TileSheet';
import { ChunkyProgress, CoinLoader, EmptyArt, GameButton, GameImage, GameScreen, RewardBurst, StonePanel, StrokeText, WoodPanel } from '@/components/kit';
import { ErrorBox, InfoTip } from '@/components/ui/kit';
import { useKingdom, usePlayerStats } from '@/lib/api';
import { Images } from '@/lib/assets';
import { inDays } from '@/lib/format';
import { useGame } from '@/lib/store';
import { teamIds, teams } from '@/lib/theme';
import { ink, parchment } from '@/theme/tokens';

/** Plant in a stone pot frame. Crossfades between stages; a sparkle burst when it grows. */
function PlantPot({ health }: { health: number | null }) {
  const stage = plantStage(health);
  const [shown, setShown] = useState(stage);
  const [prev, setPrev] = useState(stage);
  const [grew, setGrew] = useState(false);
  const fade = useSharedValue(1);
  const last = useRef(stage);
  useEffect(() => {
    if (stage === last.current) return;
    setPrev(last.current);
    setGrew(stage > last.current);
    setShown(stage);
    last.current = stage;
    fade.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 650 })));
    const t = setTimeout(() => setGrew(false), 1800);
    return () => clearTimeout(t);
  }, [stage, fade]);
  const inStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const outStyle = useAnimatedStyle(() => ({ opacity: 1 - fade.value }));
  const plant = (s: number) => <GameImage src={Images.plant[s - 1]} id={`plant-stage-${s}`} size={150} fallback="🌱" />;
  const body = (
    <View style={{ width: 150, height: 150 }}>
      <Animated.View style={[StyleSheet.absoluteFill, outStyle]}>{plant(prev)}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, inStyle]}>{plant(shown)}</Animated.View>
    </View>
  );
  return grew ? <RewardBurst size={180}>{body}</RewardBurst> : <View style={{ width: 180, height: 180, alignItems: 'center', justifyContent: 'center' }}>{body}</View>;
}

function Tablet({ value, label }: { value: string | number; label: string }) {
  return (
    <StonePanel inner="teal" border={6} style={{ flex: 1 }} contentStyle={{ padding: 8, alignItems: 'center' }}>
      <StrokeText size="L" fontSize={24}>
        {String(value)}
      </StrokeText>
      <Text style={styles.tabletLabel} numberOfLines={2}>
        {label}
      </Text>
    </StonePanel>
  );
}

export default function KingdomScreen() {
  const player = useGame((s) => s.player);
  const set = useGame((s) => s.set);
  const { data, isLoading, error, refetch, isRefetching } = useKingdom();
  const stats = usePlayerStats();
  if (!player) return null;
  const team = teams[player.team];
  const mine = data?.teams[player.team];

  return (
    <GameScreen
      title={`KINGDOM OF THE ${team.name.toUpperCase()}`}
      ribbon="blue"
      refreshing={isRefetching}
      onRefresh={refetch}
      header={<GameImage src={Images.emblem[player.team]} id={`emblem-${player.team}`} size={92} fallback={team.emoji} style={{ alignSelf: 'center', marginBottom: -26, zIndex: 2 }} />}
    >
      {error && <ErrorBox message={(error as Error).message} onRetry={refetch} />}
      {isLoading || !data || !mine ? (
        <CoinLoader label="Loading your kingdom…" />
      ) : (
        <>
          <StonePanel inner="teal">
            <View style={styles.hero}>
              <Mascot team={player.team} size={120} />
              <PlantPot health={mine.health} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <StrokeText size="S">Kingdom health</StrokeText>
              <InfoTip
                title="Kingdom health"
                text="The average health score of all fresh and fading tiles your team holds, plus a small bonus for each place where a reported problem was fixed. It is a game number, not a lab test."
                color={ink.white}
              />
            </View>
            <ChunkyProgress value={mine.health ?? 0} max={100} label={`${mine.health ?? '–'} / 100`} color={team.color} height={30} />
            <Text style={styles.motto}>🌊 Healthy streams → 🐟 healthy animals → 🧑‍🤝‍🧑 healthy people</Text>
            {data.fixed_treasures > 0 && (
              <Text style={[styles.motto, { color: '#9BE59A' }]}>
                ✨ {data.fixed_treasures} reported problem{data.fixed_treasures === 1 ? ' was' : 's were'} fixed after players found them.
              </Text>
            )}
          </StonePanel>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Tablet value={mine.tiles} label="tiles held" />
            <Tablet value={`${Math.round(mine.share * 100)}%`} label="of the stream" />
            <Tablet value={data.my.checks_week} label="my checks" />
            <Tablet value={stats.data?.confirmed_mine ?? 0} label="confirmed" />
          </View>

          <WoodPanel>
            <Text style={styles.label}>All teams</Text>
            {teamIds.map((t) => (
              <View key={t} style={styles.teamRow}>
                <GameImage src={Images.emblem[t]} size={34} fallback={teams[t].emoji} />
                <Text style={styles.teamName}>{teams[t].name}</Text>
                <ChunkyProgress value={Math.round(data.teams[t].share * 100)} max={50} label={`${Math.round(data.teams[t].share * 100)}%`} color={teams[t].color} height={22} style={{ flex: 1 }} />
              </View>
            ))}
          </WoodPanel>

          <StrokeText size="L" align="center">
            Defend these!
          </StrokeText>
          {data.fading_soon.length === 0 ? (
            <EmptyArt img={Images.moment.emptyPeace} title="All is peaceful" text="All your land is fresh. Great work!" fallback="🕊️" />
          ) : (
            data.fading_soon.map((t) => (
              <WoodPanel key={t.id} border={8} contentStyle={styles.defendRow}>
                <GameImage src={Images.flag[player.team]} size={40} fallback="🚩" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.defendName} numberOfLines={1}>
                    {t.stream_name}
                  </Text>
                  <Text style={[styles.defendInfo, t.state === 'owned_fading' && { color: '#B3261E' }]}>
                    {t.state === 'owned_fading' ? `⏳ Lost in ${inDays(t.days_left)}` : `Starts fading in ${inDays(t.days_left)}`}
                  </Text>
                </View>
                <GameButton
                  size="S"
                  color="red"
                  label="DEFEND"
                  onPress={() => {
                    set({ selectedTileId: t.id });
                    router.navigate('/map');
                  }}
                />
              </WoodPanel>
            ))
          )}
        </>
      )}
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
  motto: { color: '#DCEFF2', fontFamily: 'Nunito_800ExtraBold', fontSize: 14, textAlign: 'center', marginTop: 8 },
  tabletLabel: { color: '#DCEFF2', fontFamily: 'Nunito_700Bold', fontSize: 11, textAlign: 'center' },
  label: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: parchment.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 },
  teamName: { width: 86, fontFamily: 'LilitaOne_400Regular', fontSize: 15, color: parchment.text },
  defendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 },
  defendName: { fontFamily: 'LilitaOne_400Regular', fontSize: 16, color: parchment.text },
  defendInfo: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: parchment.muted },
});
