import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Card, GameButton, InfoTip, ProgressBar, Row, Skeleton, TeamBadge, Txt } from '@/components/ui/kit';
import { photoUrl, useTile } from '@/lib/api';
import { ago, avatarEmoji, inDays } from '@/lib/format';
import { ANSWER_LABEL, CLAIM_RADIUS_M, FADING_DAYS, FRESH_DAYS, STATE_LABEL, TREASURE_INFO } from '@/lib/gameRules';
import { formatDistance } from '@/lib/geo';
import { useGame } from '@/lib/store';
import { colors, fonts, radius, space, teams } from '@/lib/theme';

export const HEALTH_DISCLAIMER =
  'The health score (0-100) comes from the 6 answers in a stream check. It is a game indicator, not a scientific measurement. It does not say if the water is safe to swim in or drink.';

const STATE_ICON: Record<string, string> = { fog: '🌫️', owned_fresh: '🌟', owned_fading: '⏳', neutral: '🏳️', disputed: '⚔️' };

export function healthColor(h: number | null | undefined) {
  if (h == null) return colors.fog;
  if (h >= 75) return colors.success;
  if (h >= 50) return colors.gold;
  return colors.danger;
}

export function TileSheet({
  tileId,
  distance,
  onClose,
  onCheck,
  onTeleport,
}: {
  tileId: string;
  distance: number | null;
  onClose: () => void;
  onCheck: () => void;
  onTeleport?: () => void;
}) {
  const { data, isLoading, error } = useTile(tileId);
  const myId = useGame((st) => st.player?.id);
  const y = useSharedValue(400);
  useEffect(() => {
    y.value = 400;
    y.value = withSpring(0, { damping: 18, stiffness: 160 });
  }, [tileId, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  const inRange = distance != null && distance <= CLAIM_RADIUS_M;
  return (
    <Animated.View style={[styles.wrap, anim]}>
      <Card padded={false} style={styles.sheet}>
        <View style={styles.grabber} />
        <Pressable onPress={onClose} style={styles.close} accessibilityLabel="Close tile details" hitSlop={10}>
          <Ionicons name="close-circle" size={28} color={colors.textMuted} />
        </Pressable>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.md }}>
          {isLoading || !data ? (
            error ? (
              <Txt v="small">Could not load this tile. {String((error as Error).message)}</Txt>
            ) : (
              <View style={{ gap: space.sm }}>
                <Skeleton height={22} width="60%" />
                <Skeleton height={14} width="40%" />
                <Skeleton height={60} />
              </View>
            )
          ) : (
            <>
              <View>
                <Txt v="h2" numberOfLines={1} style={{ paddingRight: 36 }}>
                  {data.stream_name}
                </Txt>
                <Row style={{ marginTop: 6, flexWrap: 'wrap' }}>
                  <View style={[styles.statePill, { borderColor: data.state === 'disputed' ? colors.disputed : 'rgba(255,255,255,0.2)' }]}>
                    <Text>{STATE_ICON[data.state]}</Text>
                    <Txt v="label">{STATE_LABEL[data.state]}</Txt>
                  </View>
                  {data.owner_team && <TeamBadge team={data.owner_team} size="sm" />}
                  {data.unsafe && (
                    <View style={[styles.statePill, { borderColor: colors.danger }]}>
                      <Text>⚠️</Text>
                      <Txt v="label" style={{ color: colors.danger }}>
                        Unsafe: do not check
                      </Txt>
                    </View>
                  )}
                </Row>
                <Txt v="small" style={{ marginTop: 6 }}>
                  {Math.round(data.length_m)} m of stream · last check {ago(data.age_days)}
                  {distance != null ? ` · ${formatDistance(distance)} from you` : ''}
                </Txt>
              </View>

              {data.state !== 'fog' && (
                <Row gap={space.md}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Row gap={4}>
                      <Txt v="tiny">Health</Txt>
                      <InfoTip title="Health score" text={HEALTH_DISCLAIMER} />
                    </Row>
                    <Row>
                      <Text style={[styles.big, { color: healthColor(data.health) }]}>{data.health ?? '–'}</Text>
                      <Txt v="small">/ 100 {data.healed ? '✨ healed' : ''}</Txt>
                    </Row>
                  </View>
                  {(data.state === 'owned_fresh' || data.state === 'owned_fading') && (
                    <View style={{ flex: 1.3, gap: 6 }}>
                      <Row gap={4}>
                        <Txt v="tiny">{data.state === 'owned_fresh' ? 'Starts fading in' : 'Lost in'}</Txt>
                        <InfoTip
                          title="Fading land"
                          text={`Land stays fresh for ${FRESH_DAYS} days after a check. Then it fades. After ${FADING_DAYS} days it is free again. Fresh checks keep the science data up to date.`}
                        />
                      </Row>
                      <Txt v="h3" style={{ color: data.state === 'owned_fading' ? colors.warn : colors.text }}>
                        {inDays(data.next_change_days)}
                      </Txt>
                      <ProgressBar
                        value={(data.age_days ?? 0) / FADING_DAYS}
                        color={data.state === 'owned_fading' ? colors.warn : data.owner_team ? teams[data.owner_team].color : colors.water}
                        height={6}
                      />
                    </View>
                  )}
                </Row>
              )}
              {data.state === 'fog' && (
                <Txt v="small">Nobody has checked this place yet. Be the first explorer and earn the Explorer bonus!</Txt>
              )}
              {data.state === 'disputed' && (
                <Txt v="small">
                  Two checks here disagree. A third check from another player decides who is right. You can settle it!
                </Txt>
              )}

              {data.treasure_list.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Txt v="tiny">Treasures found here</Txt>
                  <Row style={{ flexWrap: 'wrap' }}>
                    {data.treasure_list.map((t) => (
                      <View key={t.id} style={styles.statePill}>
                        <Text>{TREASURE_INFO[t.type]?.emoji}</Text>
                        <Txt v="small">
                          {TREASURE_INFO[t.type]?.label} · {t.status.replace('_', ' ')}
                        </Txt>
                      </View>
                    ))}
                  </Row>
                </View>
              )}

              {data.history.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Txt v="tiny">Last checks</Txt>
                  {data.history.map((h) => (
                    <Row key={h.id} style={styles.histRow}>
                      {h.photo_up ? (
                        <Image source={{ uri: photoUrl(h.photo_up)! }} style={styles.thumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center' }]}>
                          <Text>{avatarEmoji(h.avatar)}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Row gap={6}>
                          <Text>{teams[h.team]?.emoji}</Text>
                          <Txt v="label" numberOfLines={1}>
                            {h.nickname}
                          </Txt>
                          {h.status === 'confirmed' && <Txt v="small" style={{ color: colors.success }}>✅ confirmed</Txt>}
                          {h.status === 'disputed' && <Txt v="small" style={{ color: colors.disputed }}>⚔️ disputed</Txt>}
                        </Row>
                        <Txt v="small" numberOfLines={1}>
                          {ANSWER_LABEL[h.answers.color]} water · foam {ANSWER_LABEL[h.answers.foam]?.toLowerCase()} · {ANSWER_LABEL[h.answers.overall]}
                        </Txt>
                      </View>
                      <Text style={[styles.histScore, { color: healthColor(h.health_score) }]}>{h.health_score}</Text>
                    </Row>
                  ))}
                </View>
              )}

              <View style={{ gap: space.sm, marginTop: space.xs }}>
                {data.unsafe ? (
                  <GameButton label="Unsafe tile" icon="warning" kind="ghost" disabled />
                ) : inRange && myId && data.state === 'disputed' && data.dispute_parties.includes(myId) ? (
                  <GameButton label="Waiting for a third player" icon="hourglass" kind="ghost" disabled />
                ) : inRange ? (
                  <GameButton label="CHECK THIS TILE" icon="camera" big onPress={onCheck} testID="sheet-check" />
                ) : (
                  <GameButton
                    label={distance != null ? `Walk closer (${formatDistance(distance)})` : 'Set your position first'}
                    icon="walk"
                    kind="ghost"
                    disabled
                  />
                )}
                {onTeleport && !inRange && (
                  <GameButton label="Teleport here (Dev)" icon="locate" kind="primary" onPress={onTeleport} testID="sheet-teleport" />
                )}
              </View>
            </>
          )}
        </ScrollView>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.cardSolid },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 8 },
  close: { position: 'absolute', right: 12, top: 12, zIndex: 2 },
  statePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  big: { fontFamily: fonts.titleBlack, fontSize: 30 },
  histRow: { padding: 8, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.05)' },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  histScore: { fontFamily: fonts.titleBlack, fontSize: 18, minWidth: 30, textAlign: 'right' },
});
