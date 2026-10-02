import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StormBanner } from '@/components/game/Hud';
import { Card, EmptyState, ErrorBox, GameButton, ProgressBar, Row, Skeleton, Txt } from '@/components/ui/kit';
import { Screen } from '@/components/ui/Screen';
import { api, useQuests, type Quest } from '@/lib/api';
import { useGame } from '@/lib/store';
import { colors, fonts, radius, space, teams } from '@/lib/theme';

function QuestCard({ q }: { q: Quest }) {
  const qc = useQueryClient();
  const player = useGame((s) => s.player);
  const warp = useGame((s) => s.timeWarpDays);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const color = q.kind === 'storm' ? '#8E7CFF' : q.kind === 'weekly_team' && player ? teams[player.team].color : colors.gold;
  const claim = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/quests/${q.id}/claim?player_id=${player?.id}&time_warp_days=${warp}`);
      qc.invalidateQueries();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={[styles.card, q.claimed && { opacity: 0.6 }, q.done && !q.claimed && { borderColor: colors.gold }]}>
      <Row style={{ alignItems: 'flex-start' }} gap={space.md}>
        <View style={[styles.icon, { borderColor: color }]}>
          <Text style={{ fontSize: 24 }}>{q.icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt v="h3">{q.title}</Txt>
          <Txt v="small">{q.description}</Txt>
          <Row style={{ marginTop: 4 }}>
            <View style={{ flex: 1 }}>
              <ProgressBar value={q.progress / q.target} color={color} />
            </View>
            <Txt v="label">
              {q.progress}/{q.target}
            </Txt>
          </Row>
        </View>
        <View style={styles.reward}>
          <Text style={styles.rewardText}>+{q.reward}</Text>
          <Text style={{ fontSize: 12 }}>🪙</Text>
        </View>
      </Row>
      {q.done && !q.claimed && <GameButton label="Claim reward" icon="gift" onPress={claim} loading={busy} style={{ marginTop: space.md }} />}
      {q.claimed && (
        <Txt v="small" style={{ marginTop: space.sm, color: colors.success }}>
          ✓ Reward claimed
        </Txt>
      )}
      {err && (
        <Txt v="small" style={{ color: colors.danger }}>
          {err}
        </Txt>
      )}
    </Card>
  );
}

export default function QuestsScreen() {
  const { data, isLoading, error, refetch, isRefetching } = useQuests();
  const daily = data?.filter((q) => q.kind === 'daily') ?? [];
  const storm = data?.filter((q) => q.kind === 'storm') ?? [];
  const weekly = data?.filter((q) => q.kind === 'weekly_team') ?? [];
  return (
    <Screen title="Quests" subtitle="Small goals. Big help for the stream." refreshing={isRefetching} onRefresh={refetch}>
      {error && <ErrorBox message={(error as Error).message} onRetry={refetch} />}
      <StormBanner />
      {isLoading ? (
        <View style={{ gap: space.md }}>
          <Skeleton height={100} />
          <Skeleton height={100} />
          <Skeleton height={100} />
        </View>
      ) : (
        <>
          {storm.map((q) => (
            <QuestCard key={q.id} q={q} />
          ))}
          <Row>
            <Txt v="h2" style={{ flex: 1 }}>
              Daily quests
            </Txt>
            {daily[0] && <Txt v="small">New in {Math.ceil(daily[0].resets_in_hours)} h</Txt>}
          </Row>
          {daily.length ? daily.map((q) => <QuestCard key={q.id} q={q} />) : <EmptyState icon="🌙" title="No quests" text="Come back tomorrow." />}
          <Row>
            <Txt v="h2" style={{ flex: 1 }}>
              Weekly team challenge
            </Txt>
            {weekly[0] && <Txt v="small">Ends in {Math.ceil(weekly[0].resets_in_hours / 24)} d</Txt>}
          </Row>
          {weekly.map((q) => (
            <QuestCard key={q.id} q={q} />
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg },
  icon: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  reward: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: 'rgba(242,201,76,0.12)' },
  rewardText: { fontFamily: fonts.titleBlack, color: colors.gold, fontSize: 16 },
});
