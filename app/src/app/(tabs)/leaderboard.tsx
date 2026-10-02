import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CoinLoader, GameButton, GameImage, GameScreen, StrokeText, WoodPanel } from '@/components/kit';
import { ErrorBox } from '@/components/ui/kit';
import { useLeaderboard, type LeaderRow } from '@/lib/api';
import { Images } from '@/lib/assets';
import { avatarEmoji, avatarImage } from '@/lib/format';
import { useGame } from '@/lib/store';
import { teams } from '@/lib/theme';
import { ink, parchment, wood } from '@/theme/tokens';

const SHIELD: Record<number, [string, string]> = { 1: ['#FFD54A', '#B8860B'], 2: ['#E3E7EA', '#8C99A3'], 3: ['#E0975A', '#8B5A2B'] };

/** Rank in a shield drawn in code: gold, silver, bronze for 1-3, wood for the rest. */
function RankShield({ rank }: { rank: number }) {
  const [fill, edge] = SHIELD[rank] ?? [wood.light, wood.dark];
  return (
    <View style={{ width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={36} height={40} viewBox="0 0 36 40" style={StyleSheet.absoluteFill}>
        <Path d="M18 2 L33 7 L33 20 C33 30 25 36 18 38 C11 36 3 30 3 20 L3 7 Z" fill={fill} stroke={ink.stroke} strokeWidth={2.5} />
        <Path d="M18 6 L29 10 L29 20 C29 27 23 32 18 34 Z" fill={edge} opacity={0.35} />
      </Svg>
      <StrokeText size="S" fontSize={rank > 99 ? 11 : 15} align="center">
        {String(rank)}
      </StrokeText>
    </View>
  );
}

function PlayerRow({ r, me }: { r: LeaderRow; me: boolean }) {
  return (
    <View style={[styles.row, me && styles.meRow]}>
      <RankShield rank={r.rank} />
      <GameImage src={avatarImage(r.avatar)} size={40} fallback={avatarEmoji(r.avatar)} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>
          {r.nickname}
          {me ? ' (you)' : ''}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {r.is_bot ? 'demo bot' : 'player'}
          {r.streak > 1 ? ` · 🔥${r.streak}` : ''}
        </Text>
      </View>
      <GameImage src={Images.emblem[r.team]} size={28} fallback={teams[r.team].emoji} />
      {r.rank === 1 && <GameImage src={Images.effect.coinPile} size={28} fallback="🪙" />}
      <StrokeText size="S" fontSize={18} style={{ minWidth: 44, textAlign: 'right' }}>
        {String(r.points)}
      </StrokeText>
    </View>
  );
}

export default function LeaderboardScreen() {
  const [scope, setScope] = useState<'week' | 'all'>('week');
  const myId = useGame((s) => s.player?.id);
  const { data, isLoading, error, refetch, isRefetching } = useLeaderboard(scope);
  const meInTop = data?.players.some((p) => p.id === myId);
  // Podium order: 2nd, 1st, 3rd.
  const podium = data ? [data.teams[1], data.teams[0], data.teams[2]].filter(Boolean) : [];
  return (
    <GameScreen title="LEADERBOARD" refreshing={isRefetching} onRefresh={refetch}>
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
        <GameButton size="S" label="THIS WEEK" color={scope === 'week' ? 'orange' : 'blue'} onPress={() => setScope('week')} />
        <GameButton size="S" label="ALL TIME" color={scope === 'all' ? 'orange' : 'blue'} onPress={() => setScope('all')} />
      </View>
      {error && <ErrorBox message={(error as Error).message} onRetry={refetch} />}
      {isLoading || !data ? (
        <CoinLoader label="Counting coins…" />
      ) : (
        <>
          <View style={styles.podium}>
            {podium.map((t) => {
              const place = data.teams.indexOf(t) + 1;
              const h = place === 1 ? 92 : place === 2 ? 66 : 48;
              return (
                <View key={t.team} style={{ flex: 1, alignItems: 'center' }}>
                  {place === 1 && <Text style={{ fontSize: 26 }}>👑</Text>}
                  <GameImage src={Images.emblem[t.team]} size={place === 1 ? 72 : 58} fallback={teams[t.team].emoji} />
                  <StrokeText size="S" fontSize={14} align="center">
                    {teams[t.team].name}
                  </StrokeText>
                  <View style={[styles.step, { height: h, backgroundColor: teams[t.team].color }]}>
                    <StrokeText size="M" fontSize={20} align="center">
                      {String(t.points)}
                    </StrokeText>
                    <Text style={styles.stepSub}>{t.tiles} tiles</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <WoodPanel contentStyle={{ padding: 6, gap: 2 }}>
            {data.players.map((r) => (
              <PlayerRow key={r.id} r={r} me={r.id === myId} />
            ))}
          </WoodPanel>
          {!meInTop && data.me && (
            <WoodPanel border={8} contentStyle={{ padding: 6 }}>
              <PlayerRow r={data.me} me />
            </WoodPanel>
          )}
          <StrokeText size="S" align="center">
            Demo bots keep the demo world alive.
          </StrokeText>
        </>
      )}
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  step: { width: '100%', marginTop: 4, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 3, borderColor: ink.stroke, alignItems: 'center', justifyContent: 'center' },
  stepSub: { color: '#FFFFFF', fontFamily: 'Nunito_800ExtraBold', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 12 },
  meRow: { backgroundColor: '#FCE9A9', borderWidth: 2, borderColor: '#B8860B' },
  name: { fontFamily: 'LilitaOne_400Regular', fontSize: 16, color: parchment.text },
  sub: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: parchment.muted },
});
