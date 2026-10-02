import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { ChunkyProgress, CoinFly, CoinLoader, EmptyArt, GameButton, GameImage, GameScreen, StonePanel, StrokeText, useFx, WoodPanel } from '@/components/kit';
import { ErrorBox } from '@/components/ui/kit';
import { api, useQuests, type Quest } from '@/lib/api';
import { Images } from '@/lib/assets';
import { useGame } from '@/lib/store';
import { teams } from '@/lib/theme';
import { spring, useMotionOK } from '@/theme/motion';
import { button, gold, parchment } from '@/theme/tokens';

function useClaim(q: Quest) {
  const qc = useQueryClient();
  const player = useGame((s) => s.player);
  const warp = useGame((s) => s.timeWarpDays);
  const toast = useFx((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const claim = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/quests/${q.id}/claim?player_id=${player?.id}&time_warp_days=${warp}`);
      toast(`Quest reward: +${q.reward} coins!`, Images.effect.coinPile, '🪙');
      qc.invalidateQueries();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { claim, busy, err };
}

function Reward({ amount }: { amount: number }) {
  return (
    <View style={styles.reward}>
      <GameImage src={Images.effect.coinPile} size={30} fallback="🪙" />
      <StrokeText size="S" fontSize={16} color={gold.light}>
        {`+${amount}`}
      </StrokeText>
    </View>
  );
}

/** Daily quest: a parchment scroll card. */
function ScrollCard({ q }: { q: Quest }) {
  const { claim, busy, err } = useClaim(q);
  const ready = q.done && !q.claimed;
  return (
    <WoodPanel border={8} style={q.claimed && { opacity: 0.65 }} contentStyle={{ padding: 10, gap: 8 }}>
      <View style={styles.cardTop}>
        <GameImage src={q.kind === 'storm' ? Images.moment.storm : Images.moment.questScroll} size={52} fallback={q.icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{q.title}</Text>
          <Text style={styles.desc}>{q.description}</Text>
        </View>
        <Reward amount={q.reward} />
      </View>
      <ChunkyProgress value={q.progress} max={q.target} color={q.kind === 'storm' ? '#7B68EE' : button.green.base} end={q.done ? Images.effect.sparkle : undefined} endFallback="✨" />
      {ready && <GameButton label="CLAIM" color="orange" size="M" icon={Images.effect.coinPile} onPress={claim} loading={busy} testID={`claim-${q.id}`} />}
      {q.claimed && <Text style={[styles.desc, { color: '#2E7D32' }]}>✓ Reward claimed</Text>}
      {err && <Text style={[styles.desc, { color: '#B3261E' }]}>{err}</Text>}
    </WoodPanel>
  );
}

/** Weekly team challenge with a chest that wiggles when ready and opens on claim. */
function ChestCard({ q }: { q: Quest }) {
  const player = useGame((s) => s.player);
  const { claim, busy, err } = useClaim(q);
  const motion = useMotionOK();
  const ready = q.done && !q.claimed;
  const wiggle = useSharedValue(0);
  const open = useSharedValue(0);
  const [fly, setFly] = useState(false);
  const chestRef = useRef<View>(null);
  const [from, setFrom] = useState({ x: 200, y: 400 });
  useEffect(() => {
    if (ready && motion) wiggle.set(withRepeat(withSequence(withTiming(-6, { duration: 90 }), withTiming(6, { duration: 90 }), withTiming(0, { duration: 90 }), withTiming(0, { duration: 900 })), -1));
    else wiggle.set(0);
  }, [ready, motion, wiggle]);
  const chest = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.value}deg` }, { scale: 1 + open.value * 0.25 }, { translateY: -open.value * 10 }] }));
  const onClaim = async () => {
    chestRef.current?.measureInWindow((x, y, w, h) => setFrom({ x: x + w / 2, y: y + h / 2 }));
    wiggle.set(withSequence(...[12, -12, 10, -10, 0].map((v) => withTiming(v, { duration: 70 }))));
    if (await claim()) {
      open.set(withSequence(withSpring(1, spring.pop), withTiming(0.6, { duration: 600 })));
      setFly(true);
    }
  };
  const color = player ? teams[player.team].color : button.blue.base;
  return (
    <StonePanel inner="teal">
      <View style={styles.cardTop}>
        <Animated.View style={chest} ref={chestRef as never}>
          <GameImage src={Images.moment.questChest} id="quest-chest" size={78} fallback="🎁" />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <StrokeText size="M">{q.title}</StrokeText>
          <Text style={[styles.desc, { color: '#DCEFF2' }]}>{q.description}</Text>
        </View>
        <Reward amount={q.reward} />
      </View>
      <ChunkyProgress value={q.progress} max={q.target} color={color} end={Images.moment.questChest} endFallback="🎁" style={{ marginTop: 8 }} />
      {ready && <GameButton label="OPEN CHEST" color="orange" onPress={onClaim} loading={busy} style={{ marginTop: 10 }} testID={`claim-${q.id}`} />}
      {q.claimed && <Text style={[styles.desc, { color: '#9BE59A', marginTop: 6 }]}>✓ Chest opened this week</Text>}
      {err && <Text style={[styles.desc, { color: '#FFB4A9' }]}>{err}</Text>}
      {fly && <CoinFly from={from} count={12} onDone={() => setFly(false)} />}
    </StonePanel>
  );
}

export default function QuestsScreen() {
  const { data, isLoading, error, refetch, isRefetching } = useQuests();
  const daily = data?.filter((q) => q.kind === 'daily') ?? [];
  const storm = data?.filter((q) => q.kind === 'storm') ?? [];
  const weekly = data?.filter((q) => q.kind === 'weekly_team') ?? [];
  return (
    <GameScreen title="QUESTS" ribbon="green" refreshing={isRefetching} onRefresh={refetch}>
      {error && <ErrorBox message={(error as Error).message} onRetry={refetch} />}
      {isLoading ? (
        <CoinLoader label="Loading quests…" />
      ) : (
        <>
          {storm.map((q) => (
            <ScrollCard key={q.id} q={q} />
          ))}
          <View style={styles.sectionRow}>
            <StrokeText size="M" style={{ flex: 1 }}>
              Daily quests
            </StrokeText>
            {daily[0] && <StrokeText size="S">{`New in ${Math.ceil(daily[0].resets_in_hours)} h`}</StrokeText>}
          </View>
          {daily.length ? daily.map((q) => <ScrollCard key={q.id} q={q} />) : <EmptyArt img={Images.moment.emptyPeace} title="No quests right now" text="Come back tomorrow for new quests." />}
          <View style={styles.sectionRow}>
            <StrokeText size="M" style={{ flex: 1 }}>
              Team challenge
            </StrokeText>
            {weekly[0] && <StrokeText size="S">{`Ends in ${Math.ceil(weekly[0].resets_in_hours / 24)} d`}</StrokeText>}
          </View>
          {weekly.map((q) => (
            <ChestCard key={q.id} q={q} />
          ))}
        </>
      )}
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: 'LilitaOne_400Regular', fontSize: 18, color: parchment.text },
  desc: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: parchment.muted, lineHeight: 19 },
  reward: { alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(30,18,8,0.8)' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
});
