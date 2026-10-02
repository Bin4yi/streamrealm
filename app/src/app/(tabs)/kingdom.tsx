import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { KingdomPlant } from '@/components/game/KingdomPlant';
import { healthColor } from '@/components/game/TileSheet';
import { Card, ErrorBox, InfoTip, ProgressBar, Row, Skeleton, Txt } from '@/components/ui/kit';
import { Screen } from '@/components/ui/Screen';
import { useKingdom } from '@/lib/api';
import { inDays } from '@/lib/format';
import { useGame } from '@/lib/store';
import { colors, fonts, radius, space, teamIds, teams } from '@/lib/theme';

function mood(h: number | null) {
  if (h == null) return 'No land yet';
  if (h >= 75) return 'Thriving';
  if (h >= 55) return 'Doing okay';
  if (h >= 40) return 'Needs care';
  return 'Wilting';
}

export default function KingdomScreen() {
  const player = useGame((s) => s.player);
  const set = useGame((s) => s.set);
  const { data, isLoading, error, refetch, isRefetching } = useKingdom();
  if (!player) return null;
  const team = teams[player.team];

  return (
    <Screen title={`Kingdom of the ${team.name}`} subtitle={`${team.emoji} ${team.motto}`} refreshing={isRefetching} onRefresh={refetch}>
      {error && <ErrorBox message={(error as Error).message} onRetry={refetch} />}
      {isLoading || !data ? (
        <View style={{ gap: space.md }}>
          <Skeleton height={260} />
          <Skeleton height={120} />
        </View>
      ) : (
        <>
          <Card style={{ alignItems: 'center', gap: space.sm, borderColor: team.color }}>
            <Row gap={4}>
              <Txt v="tiny">Kingdom health</Txt>
              <InfoTip
                title="Kingdom health"
                text="The average health score of all fresh and fading tiles your team holds. It goes up when players report clean water, and when scientists mark a reported problem (like a leaking pipe) as fixed. It is a game number, not a lab test."
              />
            </Row>
            <KingdomPlant health={data.teams[player.team].health} color={team.color} size={190} />
            <Row gap={space.sm}>
              <Text style={[styles.health, { color: healthColor(data.teams[player.team].health) }]}>{data.teams[player.team].health ?? '–'}</Text>
              <View>
                <Txt v="h3">{mood(data.teams[player.team].health)}</Txt>
                <Txt v="small">out of 100</Txt>
              </View>
            </Row>
            <View style={styles.motto}>
              <Txt v="small" style={{ color: colors.text, textAlign: 'center' }}>
                🌊 Healthy streams → 🐟 healthy animals → 🧑‍🤝‍🧑 healthy people
              </Txt>
            </View>
            {data.fixed_treasures > 0 && (
              <Txt v="small" style={{ color: colors.success, textAlign: 'center' }}>
                ✨ {data.fixed_treasures} reported problem{data.fixed_treasures === 1 ? ' was' : 's were'} fixed after players found them.
              </Txt>
            )}
          </Card>

          <Card style={{ gap: space.md }}>
            <Txt v="tiny">Territory</Txt>
            <Row gap={space.lg}>
              <View>
                <Text style={styles.big}>{data.teams[player.team].tiles}</Text>
                <Txt v="small">tiles held</Txt>
              </View>
              <View>
                <Text style={styles.big}>{Math.round(data.teams[player.team].share * 100)}%</Text>
                <Txt v="small">of the stream</Txt>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt v="small">
                  🌟 {data.teams[player.team].fresh} fresh · ⏳ {data.teams[player.team].fading} fading
                </Txt>
                <ProgressBar value={data.teams[player.team].tiles ? data.teams[player.team].fresh / data.teams[player.team].tiles : 0} color={team.color} />
              </View>
            </Row>
            <View style={{ gap: 6 }}>
              {teamIds.map((t) => (
                <Row key={t}>
                  <Text style={{ width: 24 }}>{teams[t].emoji}</Text>
                  <Txt v="label" style={{ width: 92 }}>
                    {teams[t].name}
                  </Txt>
                  <View style={{ flex: 1 }}>
                    <ProgressBar value={data.teams[t].share / 0.5} color={teams[t].color} height={12} />
                  </View>
                  <Txt v="small" style={{ width: 44, textAlign: 'right' }}>
                    {Math.round(data.teams[t].share * 100)}%
                  </Txt>
                </Row>
              ))}
            </View>
          </Card>

          <Card style={{ gap: space.sm }}>
            <Txt v="tiny">My contribution</Txt>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={styles.stat}>
                <Text style={styles.big}>{data.my.tiles_held}</Text>
                <Txt v="small">tiles I hold</Txt>
              </View>
              <View style={styles.stat}>
                <Text style={styles.big}>{data.my.checks_week}</Text>
                <Txt v="small">checks this week</Txt>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.big, { color: colors.gold }]}>{data.my.points}</Text>
                <Txt v="small">points</Txt>
              </View>
            </Row>
          </Card>

          <View style={{ gap: space.sm }}>
            <Row gap={4}>
              <Txt v="h2">Defend these!</Txt>
              <InfoTip title="Why defend?" text="Land fades 7 days after the last check, and is lost after 14 days. A new check keeps the data fresh for scientists, and keeps the land yours." />
            </Row>
            {data.fading_soon.length === 0 ? (
              <Card>
                <Txt v="small">All your land is fresh. Great work! 🌟</Txt>
              </Card>
            ) : (
              data.fading_soon.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    set({ selectedTileId: t.id });
                    router.navigate('/map');
                  }}
                >
                  <Card padded={false} style={styles.fadeRow}>
                    <Text style={{ fontSize: 22 }}>{t.state === 'owned_fading' ? '⏳' : '🌟'}</Text>
                    <View style={{ flex: 1 }}>
                      <Txt v="label">{t.stream_name}</Txt>
                      <Txt v="small" style={{ color: t.state === 'owned_fading' ? colors.warn : colors.textMuted }}>
                        {t.state === 'owned_fading' ? `Lost in ${inDays(t.days_left)}` : `Starts fading in ${inDays(t.days_left)}`}
                      </Txt>
                    </View>
                    <Txt v="label" style={{ color: colors.gold }}>
                      Show ›
                    </Txt>
                  </Card>
                </Pressable>
              ))
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  health: { fontFamily: fonts.titleBlack, fontSize: 48 },
  big: { fontFamily: fonts.titleBlack, fontSize: 26, color: colors.text },
  motto: { backgroundColor: 'rgba(79,179,232,0.12)', borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, marginTop: space.xs },
  stat: { alignItems: 'center', flex: 1 },
  fadeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
});
