import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ChunkyProgress, GameButton, GameImage, StrokeText, WoodPanel } from '@/components/kit';
import { InfoTip, Skeleton } from '@/components/ui/kit';
import { photoUrl, useTile } from '@/lib/api';
import { Images } from '@/lib/assets';
import { ago, avatarEmoji, avatarImage, inDays } from '@/lib/format';
import { ANSWER_LABEL, CLAIM_RADIUS_M, FADING_DAYS, FRESH_DAYS, STATE_LABEL, TREASURE_INFO, type TreasureType } from '@/lib/gameRules';
import { formatDistance } from '@/lib/geo';
import { useGame } from '@/lib/store';
import { colors, teams } from '@/lib/theme';
import { button, parchment } from '@/theme/tokens';

export const HEALTH_DISCLAIMER =
  'The health score (0-100) comes from the 6 answers in a stream check. It is a game score, not a safety test. It does not say if the water is safe to swim in or drink.';

const STATE_ICON: Record<string, string> = { fog: '🌫️', owned_fresh: '🌟', owned_fading: '⏳', neutral: '🏳️', disputed: '⚔️' };

export function healthColor(h: number | null | undefined) {
  if (h == null) return colors.fog;
  if (h >= 75) return colors.success;
  if (h >= 50) return colors.gold;
  return colors.danger;
}

/** Kingdom plant stage 1-5 for a 0-100 health number (also used for a tile). */
export function plantStage(h: number | null | undefined): number {
  if (h == null) return 1;
  return h <= 20 ? 1 : h <= 40 ? 2 : h <= 60 ? 3 : h <= 80 ? 4 : 5;
}

const TREASURE_IMG: Record<TreasureType, keyof typeof Images.treasure> = { pipe: 'pipe', trash: 'trash', wildlife: 'wildlife', plant: 'plant', algae: 'algae' };

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
  const y = useSharedValue(420);
  useEffect(() => {
    y.set(420);
    y.set(withSpring(0, { damping: 17, stiffness: 170 }));
  }, [tileId, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  const inRange = distance != null && distance <= CLAIM_RADIUS_M;
  return (
    <Animated.View style={[styles.wrap, anim]}>
      <WoodPanel border={10} contentStyle={{ padding: 0 }}>
        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close tile details" hitSlop={10}>
          <StrokeText size="S" fontSize={18} align="center">
            ✕
          </StrokeText>
        </Pressable>
        <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ padding: 14, gap: 12 }}>
          {isLoading || !data ? (
            error ? (
              <Text style={styles.body}>Could not load this tile. {String((error as Error).message)}</Text>
            ) : (
              <View style={{ gap: 8 }}>
                <Skeleton height={22} width="60%" style={{ backgroundColor: parchment.line }} />
                <Skeleton height={60} style={{ backgroundColor: parchment.line }} />
              </View>
            )
          ) : (
            <>
              <View style={styles.head}>
                {data.owner_team ? (
                  <GameImage src={Images.emblem[data.owner_team]} id={`emblem-${data.owner_team}`} size={54} fallback={teams[data.owner_team].emoji} />
                ) : (
                  <GameImage src={data.state === 'fog' ? Images.marker.fog : Images.flag.white} size={54} fallback={STATE_ICON[data.state]} />
                )}
                <View style={{ flex: 1, paddingRight: 30 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {data.stream_name}
                  </Text>
                  <Text style={styles.small}>
                    {STATE_ICON[data.state]} {STATE_LABEL[data.state]}
                    {data.owner_team ? ` · ${teams[data.owner_team].name}` : ''}
                    {data.unsafe ? ' · ⚠️ Unsafe' : ''}
                  </Text>
                  <Text style={styles.small}>
                    {Math.round(data.length_m)} m · last check {ago(data.age_days)}
                    {distance != null ? ` · ${formatDistance(distance)} away` : ''}
                  </Text>
                </View>
              </View>

              {data.state !== 'fog' && (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.label}>Health</Text>
                    <InfoTip title="Health score" text={HEALTH_DISCLAIMER} color={parchment.muted} />
                    {data.healed && <Text style={[styles.small, { color: '#2E7D32' }]}>✨ healed</Text>}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <GameImage src={Images.plant[plantStage(data.health) - 1]} size={40} fallback="🌱" label={`Plant stage ${plantStage(data.health)}`} />
                    <ChunkyProgress value={data.health ?? 0} max={100} label={`${data.health ?? '–'} / 100`} color={healthColor(data.health)} style={{ flex: 1 }} />
                  </View>
                  <Text style={styles.tiny}>Game score, not a safety test.</Text>
                </View>
              )}

              {(data.state === 'owned_fresh' || data.state === 'owned_fading') && (
                <View style={styles.timer}>
                  <Text style={{ fontSize: 18 }}>⏳</Text>
                  <Text style={[styles.body, { flex: 1 }]}>
                    {data.state === 'owned_fresh' ? `Starts fading in ${inDays(data.next_change_days)}` : `Lost in ${inDays(data.next_change_days)}. Defend it!`}
                  </Text>
                  <InfoTip
                    title="Fading land"
                    text={`Land stays fresh for ${FRESH_DAYS} days after a check. Then it fades. After ${FADING_DAYS} days it is free again. Fresh checks keep the science data up to date.`}
                    color={parchment.muted}
                  />
                </View>
              )}
              {data.state === 'fog' && <Text style={styles.body}>Nobody has checked this place yet. Be the first explorer!</Text>}
              {data.state === 'disputed' && <Text style={styles.body}>Two checks here disagree. A third check from another player decides who is right.</Text>}

              {data.treasure_list.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Treasures</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {data.treasure_list.map((t) => (
                      <View key={t.id} style={styles.chip}>
                        <GameImage src={Images.treasure[TREASURE_IMG[t.type]]} size={28} fallback={TREASURE_INFO[t.type]?.emoji} />
                        <Text style={styles.small}>
                          {TREASURE_INFO[t.type]?.label} · {t.status.replace('_', ' ')}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {data.history.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Last checks</Text>
                  {data.history.map((h) => (
                    <View key={h.id} style={styles.histRow}>
                      {h.photo_up ? (
                        <Image source={{ uri: photoUrl(h.photo_up)! }} style={styles.thumb} contentFit="cover" />
                      ) : (
                        <View style={styles.thumb} />
                      )}
                      <GameImage src={avatarImage(h.avatar)} size={30} fallback={avatarEmoji(h.avatar)} style={{ marginLeft: -14, marginTop: 18 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.body, { fontFamily: 'Nunito_800ExtraBold' }]} numberOfLines={1}>
                          {teams[h.team]?.emoji} {h.nickname}
                          {h.status === 'confirmed' ? '  ✅' : h.status === 'disputed' ? '  ⚔️' : ''}
                        </Text>
                        <Text style={styles.small} numberOfLines={1}>
                          {ANSWER_LABEL[h.answers.color]} water · foam {ANSWER_LABEL[h.answers.foam]?.toLowerCase()} · {ANSWER_LABEL[h.answers.overall]}
                        </Text>
                      </View>
                      <Text style={[styles.score, { color: healthColor(h.health_score) }]}>{h.health_score}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={{ gap: 8 }}>
                {data.unsafe ? (
                  <GameButton label="UNSAFE TILE" disabled />
                ) : inRange && myId && data.state === 'disputed' && data.dispute_parties.includes(myId) ? (
                  <GameButton label="WAITING FOR A 3RD PLAYER" disabled size="S" />
                ) : inRange ? (
                  <GameButton label="CHECK THIS TILE" color="orange" size="L" icon={Images.marker.player} onPress={onCheck} testID="sheet-check" />
                ) : (
                  <GameButton label={distance != null ? `WALK CLOSER · ${formatDistance(distance)}` : 'SET YOUR POSITION'} disabled />
                )}
                {onTeleport && !inRange && <GameButton label="TELEPORT HERE (DEV)" color="blue" size="S" onPress={onTeleport} testID="sheet-teleport" />}
              </View>
            </>
          )}
        </ScrollView>
      </WoodPanel>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 6, right: 6, bottom: 4 },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 3,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: button.red.base,
    borderWidth: 2.5,
    borderColor: '#1E1208',
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  title: { fontFamily: 'LilitaOne_400Regular', fontSize: 22, color: parchment.text },
  label: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: parchment.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: parchment.text, lineHeight: 20 },
  small: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: parchment.muted },
  tiny: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: parchment.muted },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 12, backgroundColor: parchment.bgDark },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 10, paddingLeft: 4, paddingVertical: 2, borderRadius: 999, backgroundColor: parchment.bgDark },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, borderRadius: 12, backgroundColor: parchment.bgDark },
  thumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: parchment.line },
  score: { fontFamily: 'LilitaOne_400Regular', fontSize: 20, minWidth: 30, textAlign: 'right' },
});
