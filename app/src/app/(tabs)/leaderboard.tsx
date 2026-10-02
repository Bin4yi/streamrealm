import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Chip, ErrorBox, Row, Skeleton, Txt } from '@/components/ui/kit';
import { Screen } from '@/components/ui/Screen';
import { useLeaderboard, type LeaderRow } from '@/lib/api';
import { avatarEmoji } from '@/lib/format';
import { useGame } from '@/lib/store';
import { colors, fonts, radius, space, teams } from '@/lib/theme';

const MEDAL = ['🥇', '🥈', '🥉'];

function PlayerRow({ r, me }: { r: LeaderRow; me: boolean }) {
  return (
    <View style={[styles.row, me && styles.meRow]}>
      <Text style={styles.rank}>{r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}</Text>
      <View style={[styles.avatar, { borderColor: teams[r.team].color }]}>
        <Text style={{ fontSize: 18 }}>{avatarEmoji(r.avatar)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Row gap={6}>
          <Txt v="label" numberOfLines={1}>
            {r.nickname}
          </Txt>
          {me && <Txt v="small" style={{ color: colors.gold }}>(you)</Txt>}
        </Row>
        <Txt v="small">
          {teams[r.team].emoji} {teams[r.team].name}
          {r.is_bot ? ' · demo bot' : ''}
          {r.streak > 1 ? ` · 🔥${r.streak}` : ''}
        </Txt>
      </View>
      <Text style={styles.pts}>{r.points}</Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const [scope, setScope] = useState<'week' | 'all'>('week');
  const myId = useGame((s) => s.player?.id);
  const { data, isLoading, error, refetch, isRefetching } = useLeaderboard(scope);
  const meInTop = data?.players.some((p) => p.id === myId);
  return (
    <Screen
      title="Leaderboard"
      subtitle="Points from checks, treasures and quests"
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      <Row gap={6}>
        <Chip label="This week" active={scope === 'week'} onPress={() => setScope('week')} color={colors.goldDeep} />
        <Chip label="All time" active={scope === 'all'} onPress={() => setScope('all')} color={colors.goldDeep} />
      </Row>
      {error && <ErrorBox message={(error as Error).message} onRetry={refetch} />}
      {isLoading || !data ? (
        <View style={{ gap: space.md }}>
          <Skeleton height={110} />
          <Skeleton height={300} />
        </View>
      ) : (
        <>
          <Row gap={space.sm} style={{ alignItems: 'flex-end' }}>
            {data.teams.map((t, i) => (
              <Card key={t.team} padded={false} style={[styles.team, { borderColor: teams[t.team].color, paddingVertical: i === 0 ? space.lg : space.md }]}>
                <Text style={{ fontSize: i === 0 ? 34 : 26 }}>{teams[t.team].emoji}</Text>
                <Txt v="label">{teams[t.team].name}</Txt>
                <Text style={[styles.teamPts, { color: teams[t.team].soft }]}>{t.points}</Text>
                <Txt v="small">{t.tiles} tiles</Txt>
                {i === 0 && <Text style={styles.crown}>👑</Text>}
              </Card>
            ))}
          </Row>
          <Card padded={false} style={{ paddingVertical: space.sm }}>
            {data.players.map((r) => (
              <PlayerRow key={r.id} r={r} me={r.id === myId} />
            ))}
            {!meInTop && data.me && (
              <>
                <Txt v="small" style={{ textAlign: 'center' }}>
                  ⋯
                </Txt>
                <PlayerRow r={data.me} me />
              </>
            )}
          </Card>
          <Txt v="small" style={{ textAlign: 'center' }}>
            Demo bots are part of the seeded demo world so the map feels alive.
          </Txt>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  team: { flex: 1, alignItems: 'center', gap: 2, borderWidth: 2 },
  teamPts: { fontFamily: fonts.titleBlack, fontSize: 20 },
  crown: { position: 'absolute', top: -14, fontSize: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 8 },
  meRow: { backgroundColor: 'rgba(242,201,76,0.12)', borderRadius: radius.md },
  rank: { width: 28, textAlign: 'center', fontFamily: fonts.titleBlack, fontSize: 16, color: colors.textMuted },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pts: { fontFamily: fonts.titleBlack, fontSize: 17, color: colors.gold },
});
