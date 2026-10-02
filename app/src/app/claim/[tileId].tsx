import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HEALTH_DISCLAIMER, healthColor } from '@/components/game/TileSheet';
import { VictoryBurst } from '@/components/game/Victory';
import { Card, GameButton, InfoTip, ProgressBar, Row, TeamBadge, Txt } from '@/components/ui/kit';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { api, API_URL, ApiError, useStorm, useTiles } from '@/lib/api';
import {
  ACTION_LABEL,
  ANSWER_LABEL,
  classifyAction,
  healthScore,
  previewPoints,
  QUESTION_LABEL,
  QUESTIONS,
  TREASURE_INFO,
  TREASURE_TYPES,
  type Answers,
  type QuestionId,
  type TreasureType,
} from '@/lib/gameRules';
import { play } from '@/lib/sound';
import { useGame } from '@/lib/store';
import { colors, fonts, radius, space, teams } from '@/lib/theme';
import { appendPhoto, pickPhoto } from '@/lib/upload';

const OPTION_EMOJI: Record<string, string> = {
  clear: '💧', slightly_cloudy: '🌫️', brown: '🟤', green: '🟢', other: '❓',
  none: '✨', earthy: '🍂', bad: '🤢', chemical: '🧪',
  a_little: '🫧', a_lot: '🧼', a_few: '🥤',
  flowing: '🌊', slow: '🐌', still: '🪞', dry: '🏜️',
  good: '😊', moderate: '😐', poor: '😟',
};
const OPTION_EMOJI_BY_Q: Partial<Record<QuestionId, Record<string, string>>> = {
  smell: { none: '🙂' },
  trash: { none: '🌿', a_lot: '🗑️' },
};
const QUESTION_TIP: Record<QuestionId, string> = {
  color: 'Look at the water in the middle of the stream. Is it clear, a bit cloudy, brown (mud), or green (algae)?',
  smell: 'Smell the air near the water from the path. Do not touch the water. "Bad" means sewage or rotten eggs.',
  foam: 'Foam: white bubbles that stay on the water. Oily film: a shiny rainbow layer. Both can mean soap or oil pollution.',
  trash: 'Count bottles, bags and other trash in the water or on the banks you can see.',
  flow: 'Watch a leaf or a bubble on the water. Does it move fast, slowly, or not at all? Or is there no water?',
  overall: 'Your own feeling about this place. Same 3 levels as the official OneAquaHealth citizen app.',
};
const Q_STEPS: QuestionId[] = ['color', 'smell', 'foam', 'trash', 'flow', 'overall'];
type Step = 'safety' | 'up' | 'down' | QuestionId | 'treasure' | 'check' | 'victory';
const STEPS: Step[] = ['safety', 'up', 'down', ...Q_STEPS, 'treasure', 'check', 'victory'];

type AiResult = {
  verdict: 'pass' | 'warn' | 'fail';
  reasons: string[];
  suggestions: { question: QuestionId; value: string; confidence: number; why: string }[];
  notable?: string[];
  checks: { blur_score: number | null; duplicate_of: string | null; exif_time_ok: boolean | null; is_stream_photo: boolean | null };
  mode: 'ai' | 'heuristic';
  ai_error?: string;
};
type Draft = { observation_id: string; ai_result: AiResult; health_score: number; distance_m: number };
type Result = {
  action: string;
  outcome: string;
  status: string;
  agreement: number | null;
  confirmed_previous: boolean;
  points: number;
  breakdown: { label: string; points: number }[];
  health_score: number;
  streak: number;
  treasure: TreasureType | null;
  storm: boolean;
  animation: { type: 'paint' | 'clash'; team: keyof typeof teams; points: number };
};

const DEMO_PREVIEW = [`${API_URL}/demo-photos/generated/demo-0.jpg`, `${API_URL}/demo-photos/generated/demo-3.jpg`];

export default function ClaimScreen() {
  const { tileId } = useLocalSearchParams<{ tileId: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const g = useGame();
  const tiles = useTiles();
  const storm = useStorm();
  const tile = tiles.data?.features.find((f) => f.id === tileId);

  const [step, setStep] = useState<Step>('safety');
  const [photos, setPhotos] = useState<{ up: string | null; down: string | null }>({ up: null, down: null });
  const [demo, setDemo] = useState(g.useDemoPhotos && g.devPanelEnabled);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [treasure, setTreasure] = useState<TreasureType | null>(null);
  const [treasurePhoto, setTreasurePhoto] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [choices, setChoices] = useState<Record<string, 'accepted' | 'kept'>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idx = STEPS.indexOf(step);
  const action = tile && g.player ? classifyAction(tile.properties.state, tile.properties.owner_team, g.player.team) : null;
  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };
  const next = () => go(STEPS[idx + 1]);
  const back = () => (idx === 0 ? router.back() : go(STEPS[idx - 1]));

  const choose = async (which: 'up' | 'down', source: 'camera' | 'library') => {
    try {
      const uri = await pickPhoto(source);
      if (uri) {
        setDemo(false);
        setPhotos((p) => ({ ...p, [which]: uri }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the camera');
    }
  };

  const submit = async () => {
    if (!g.player || !g.position || !tile) return;
    setBusy(true);
    setError(null);
    go('check');
    try {
      const form = new FormData();
      form.append('player_id', g.player.id);
      form.append('tile_id', tile.id);
      form.append('lat', String(g.position.lat));
      form.append('lon', String(g.position.lon));
      form.append('answers', JSON.stringify(answers));
      form.append('time_warp_days', String(g.timeWarpDays));
      if (demo) form.append('demo_photos', 'true');
      else {
        await appendPhoto(form, 'photo_up', photos.up!);
        await appendPhoto(form, 'photo_down', photos.down!);
      }
      if (treasure) {
        form.append('treasure_type', treasure);
        if (treasurePhoto) await appendPhoto(form, 'treasure_photo', treasurePhoto);
      }
      const d = await api.form<Draft>('/observations', form);
      setDraft(d);
      setChoices({});
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const finalAnswers = useMemo(() => {
    const a = { ...answers };
    for (const s of draft?.ai_result.suggestions ?? []) if (choices[s.question] === 'accepted') (a as Record<string, string>)[s.question] = s.value;
    return a as Answers;
  }, [answers, choices, draft]);

  const claim = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<Result>(`/observations/${draft.observation_id}/confirm-ai`, {
        answers: finalAnswers,
        choices,
        time_warp_days: g.timeWarpDays,
      });
      setResult(r);
      play(r.outcome === 'dispute_started' ? 'clash' : 'success');
      if (r.points > 0) setTimeout(() => play('coin'), 450);
      go('victory');
      qc.invalidateQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the check');
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    if (result && tile && result.animation.type === 'paint') {
      g.flashClaim(tile.id, result.animation.team, result.points);
    } else g.set({ selectedTileId: null });
    router.replace('/map');
  };

  const myTeam = g.player ? teams[g.player.team] : teams.otters;

  // ---------- render helpers ----------
  const photoStep = (which: 'up' | 'down') => {
    const uri = demo ? DEMO_PREVIEW[which === 'up' ? 0 : 1] : photos[which];
    return (
      <View style={{ gap: space.md }}>
        <Txt v="h1">{which === 'up' ? 'Photo upstream' : 'Photo downstream'}</Txt>
        <Txt>
          {which === 'up'
            ? 'Stand on the path and point the camera to where the water comes FROM.'
            : 'Now turn around. Point the camera to where the water goes TO.'}
        </Txt>
        <View style={styles.photoBox}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 46 }}>{which === 'up' ? '⬆️' : '⬇️'}</Text>
              <Txt v="small">No photo yet</Txt>
            </View>
          )}
          {demo && (
            <View style={styles.demoTag}>
              <Txt v="tiny" style={{ color: colors.gold }}>
                Demo photo
              </Txt>
            </View>
          )}
        </View>
        <Row style={{ flexWrap: 'wrap' }}>
          <GameButton label={Platform.OS === 'web' ? 'Camera / file' : 'Take photo'} icon="camera" kind="primary" onPress={() => choose(which, 'camera')} />
          <GameButton label="From gallery" icon="images" kind="ghost" onPress={() => choose(which, 'library')} />
        </Row>
        {g.devPanelEnabled && (
          <GameButton label={demo ? 'Using demo photos ✓' : 'Use demo photo (Dev)'} icon="image" kind="ghost" onPress={() => setDemo(true)} testID="use-demo" />
        )}
        <GameButton label="Next" icon="arrow-forward" big disabled={!uri} onPress={next} testID="photo-next" />
      </View>
    );
  };

  const questionStep = (q: QuestionId) => (
    <View style={{ gap: space.md }}>
      <Row>
        <Txt v="h1" style={{ flex: 1 }}>
          {QUESTION_LABEL[q]}
        </Txt>
        <InfoTip title={QUESTION_LABEL[q]} text={QUESTION_TIP[q]} />
      </Row>
      <Txt v="small">{q === 'overall' ? 'How does this place feel to you overall?' : 'Tap the answer that fits best.'}</Txt>
      <View style={{ gap: space.sm }}>
        {(QUESTIONS[q] as readonly string[]).map((v) => {
          const on = answers[q] === v;
          return (
            <Pressable
              key={v}
              testID={`opt-${q}-${v}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                play('click');
                setAnswers((a) => ({ ...a, [q]: v }));
                setTimeout(next, 180);
              }}
              style={[styles.option, on && { borderColor: colors.gold, backgroundColor: 'rgba(242,201,76,0.14)' }]}
            >
              <Text style={{ fontSize: 28 }}>{OPTION_EMOJI_BY_Q[q]?.[v] ?? OPTION_EMOJI[v]}</Text>
              <Txt v="h3" style={{ flex: 1 }}>
                {ANSWER_LABEL[v]}
              </Txt>
              {on && <Ionicons name="checkmark-circle" size={24} color={colors.gold} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const body = () => {
    switch (step) {
      case 'safety':
        return (
          <View style={{ gap: space.lg }}>
            <Text style={{ fontSize: 64, textAlign: 'center' }}>🦺</Text>
            <Txt v="h1" style={{ textAlign: 'center' }}>
              Safety first
            </Txt>
            <Card style={{ gap: space.sm }}>
              {['Stay on the path or the bank. Never go into the water.', 'Do not touch the water or any pipes.', 'If it feels unsafe, skip this tile.', 'Kids: play with an adult.'].map((l) => (
                <Row key={l} style={{ alignItems: 'flex-start' }}>
                  <Text style={{ color: colors.success }}>✔</Text>
                  <Txt style={{ flex: 1 }}>{l}</Txt>
                </Row>
              ))}
            </Card>
            <GameButton label="I am on a safe path, not in the water" icon="shield-checkmark" big onPress={next} testID="safety-ok" />
          </View>
        );
      case 'up':
      case 'down':
        return photoStep(step);
      case 'treasure':
        return (
          <View style={{ gap: space.md }}>
            <Txt v="h1">Found something special?</Txt>
            <Txt>Treasures help scientists find problems and wildlife. You get +40 points.</Txt>
            <View style={{ gap: space.sm }}>
              {TREASURE_TYPES.map((t) => {
                const on = treasure === t;
                return (
                  <Pressable
                    key={t}
                    testID={`treasure-${t}`}
                    onPress={() => setTreasure(on ? null : t)}
                    style={[styles.option, on && { borderColor: colors.gold, backgroundColor: 'rgba(242,201,76,0.14)' }]}
                  >
                    <Text style={{ fontSize: 26 }}>{TREASURE_INFO[t].emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Txt v="h3">{TREASURE_INFO[t].label}</Txt>
                      <Txt v="small">{TREASURE_INFO[t].hint}</Txt>
                    </View>
                    {on && <Ionicons name="checkmark-circle" size={24} color={colors.gold} />}
                  </Pressable>
                );
              })}
            </View>
            {treasure && !demo && (
              <GameButton
                label={treasurePhoto ? 'Treasure photo added ✓' : 'Add a photo of it (optional)'}
                icon="camera"
                kind="ghost"
                onPress={async () => setTreasurePhoto(await pickPhoto('camera').catch(() => null))}
              />
            )}
            <GameButton label={treasure ? 'Check my photos' : 'No treasure. Check my photos'} icon="sparkles" big onPress={submit} testID="submit-check" />
          </View>
        );
      case 'check':
        return checkStep();
      case 'victory':
        return victoryStep();
      default:
        return questionStep(step);
    }
  };

  const checkStep = () => {
    if (busy && !draft) {
      return (
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Txt v="h3">Checking your photos…</Txt>
          <Txt v="small">Sharpness, light, re-used photos and more.</Txt>
        </View>
      );
    }
    if (!draft) return null;
    const ai = draft.ai_result;
    const verdictStyle = {
      pass: { icon: '✅', title: 'Photos look good', color: colors.success },
      warn: { icon: '⚠️', title: 'Photos are OK, with notes', color: colors.warn },
      fail: { icon: '⛔', title: 'We cannot use these photos', color: colors.danger },
    }[ai.verdict];
    const score = healthScore(finalAnswers);
    return (
      <View style={{ gap: space.md }}>
        <Card style={[styles.verdict, { borderColor: verdictStyle.color }]}>
          <Row>
            <Text style={{ fontSize: 28 }}>{verdictStyle.icon}</Text>
            <View style={{ flex: 1 }}>
              <Txt v="h3">{verdictStyle.title}</Txt>
              <Txt v="small">{ai.mode === 'ai' ? 'Checked by AI (OpenAI) + photo rules' : 'Checked by photo rules (AI is off)'}</Txt>
            </View>
          </Row>
          {ai.reasons.map((r) => (
            <Txt key={r} v="small" style={{ color: colors.text }}>
              • {r}
            </Txt>
          ))}
        </Card>

        {ai.verdict !== 'fail' && ai.suggestions.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Row gap={4}>
              <Txt v="tiny">Second opinion</Txt>
              <InfoTip title="You decide" text="These are only suggestions. Nothing changes unless you tap 'Use this'. We keep both your answer and the suggestion, so scientists can see where people and the computer disagree." />
            </Row>
            {ai.suggestions.map((s) => {
              const mine = answers[s.question];
              const same = mine === s.value;
              const choice = choices[s.question];
              return (
                <Card key={s.question} padded={false} style={styles.sugg}>
                  <Txt v="label">
                    {ai.mode === 'ai' ? 'AI thinks' : 'Colour rule thinks'}: {ANSWER_LABEL[s.value]} {QUESTION_LABEL[s.question].toLowerCase()} ({Math.round(s.confidence * 100)}%)
                  </Txt>
                  <Txt v="small">Why? {s.why}</Txt>
                  {same ? (
                    <Txt v="small" style={{ color: colors.success }}>
                      ✓ Same as your answer
                    </Txt>
                  ) : (
                    <Row style={{ marginTop: 4, flexWrap: 'wrap' }}>
                      <Txt v="small">You said: {mine ? ANSWER_LABEL[mine] : '–'}</Txt>
                      <View style={{ flex: 1 }} />
                      <Pressable
                        testID={`use-${s.question}`}
                        onPress={() => setChoices((c) => ({ ...c, [s.question]: 'accepted' }))}
                        style={[styles.smallBtn, choice === 'accepted' && { backgroundColor: colors.water }]}
                      >
                        <Txt v="label">Use this</Txt>
                      </Pressable>
                      <Pressable
                        onPress={() => setChoices((c) => ({ ...c, [s.question]: 'kept' }))}
                        style={[styles.smallBtn, choice !== 'accepted' && { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                      >
                        <Txt v="label">Keep mine</Txt>
                      </Pressable>
                    </Row>
                  )}
                </Card>
              );
            })}
          </View>
        )}
        {ai.notable && ai.notable.length > 0 && (
          <Card style={{ gap: 4 }}>
            <Txt v="tiny">The AI also noticed</Txt>
            {ai.notable.map((n) => (
              <Txt key={n} v="small" style={{ color: colors.text }}>
                🔎 {n}
              </Txt>
            ))}
            {!treasure && <Txt v="small">If it is real, go back and add it as a treasure.</Txt>}
          </Card>
        )}

        {ai.verdict !== 'fail' && (
          <Card>
            <Row>
              <View style={{ flex: 1 }}>
                <Row gap={4}>
                  <Txt v="tiny">Tile health from your answers</Txt>
                  <InfoTip title="Health score" text={HEALTH_DISCLAIMER} />
                </Row>
                <Text style={[styles.bigNum, { color: healthColor(score) }]}>{score}</Text>
              </View>
              <View style={{ flex: 1.4 }}>
                <ProgressBar value={score / 100} color={healthColor(score)} />
              </View>
            </Row>
          </Card>
        )}

        {ai.verdict === 'fail' ? (
          <GameButton label="Retake photos" icon="camera-reverse" big onPress={() => { setDraft(null); go('up'); }} />
        ) : (
          <GameButton
            label={action === 'attack' ? 'ATTACK!' : action === 'confirm_dispute' ? 'Settle it!' : 'Claim it!'}
            icon="flag"
            big
            loading={busy}
            onPress={claim}
            testID="claim-it"
          />
        )}
      </View>
    );
  };

  const victoryStep = () => {
    if (!result) return null;
    const ownerTeam = teams[result.animation.team] ?? myTeam;
    const clash = result.outcome === 'dispute_started';
    const titles: Record<string, string> = {
      claimed: 'Land claimed!',
      refreshed: 'Land refreshed!',
      defended: 'Land defended!',
      attack_won: 'Attack won!',
      dispute_started: 'Dispute!',
      dispute_settled: 'Dispute settled!',
      farming: 'Thanks for checking!',
    };
    const texts: Record<string, string> = {
      claimed: `This piece of ${tile?.properties.stream_name ?? 'the stream'} now belongs to Team ${myTeam.name}.`,
      refreshed: 'Your team keeps this land fresh for 7 more days.',
      defended: 'It was fading. You saved it just in time!',
      attack_won: `Your check agrees with the last one, so the tile is now yours.`,
      dispute_started: 'Your answers do not match the last check. A third player will decide who is right. If they agree with you, you win +30.',
      dispute_settled: 'Your check broke the tie. The side that agrees with you wins.',
      farming: 'You checked this tile less than 6 hours ago, so no points this time. The data still helps!',
    };
    return (
      <View style={{ gap: space.md }}>
        <VictoryBurst emoji={clash ? '⚔️' : ownerTeam.emoji} color={clash ? colors.disputed : ownerTeam.color} points={result.points} />
        <Txt v="title" style={{ textAlign: 'center', color: clash ? colors.disputed : colors.gold }}>
          {titles[result.outcome] ?? 'Done!'}
        </Txt>
        <Txt style={{ textAlign: 'center' }}>{texts[result.outcome]}</Txt>
        {result.confirmed_previous && (
          <Card style={{ borderColor: colors.success }}>
            <Txt v="label" style={{ color: colors.success }}>
              ✅ Independent check
            </Txt>
            <Txt v="small">Your check agrees with an earlier one by another player. Scientists now trust that data more.</Txt>
          </Card>
        )}
        <Card style={{ gap: 6 }}>
          {result.breakdown.map((b) => (
            <Row key={b.label}>
              <Txt style={{ flex: 1 }}>{b.label}</Txt>
              <Txt v="label" style={{ color: colors.gold }}>
                +{b.points}
              </Txt>
            </Row>
          ))}
          <View style={styles.divider} />
          <Row>
            <Txt v="h3" style={{ flex: 1 }}>
              Total
            </Txt>
            <Txt v="number">+{result.points} 🪙</Txt>
          </Row>
          {result.streak > 1 && <Txt v="small">🔥 {result.streak}-day streak!</Txt>}
        </Card>
        <GameButton label="Back to the map" icon="map" big onPress={finish} testID="victory-done" />
      </View>
    );
  };

  if (!tile) {
    return (
      <PhoneFrame>
        <View style={[styles.center, { paddingTop: insets.top }]}>
          {tiles.isLoading ? <ActivityIndicator color={colors.gold} /> : <Txt>Tile not found.</Txt>}
          <GameButton label="Back" kind="ghost" onPress={() => router.back()} style={{ marginTop: space.lg }} />
        </View>
      </PhoneFrame>
    );
  }

  const showHeader = step !== 'victory';
  return (
    <PhoneFrame>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {showHeader && (
          <View style={styles.header}>
            <Row>
              <Pressable onPress={back} accessibilityLabel="Back" hitSlop={10} style={styles.headerBtn}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Txt v="label" numberOfLines={1}>
                  {tile.properties.stream_name}
                </Txt>
                <Txt v="small" numberOfLines={1}>
                  {action ? `${ACTION_LABEL[action]} · +${previewPoints(action, !!storm.data?.active)} 🪙` : ''}
                </Txt>
              </View>
              {tile.properties.owner_team && <TeamBadge team={tile.properties.owner_team} size="sm" />}
              <Pressable onPress={() => router.back()} accessibilityLabel="Cancel check" hitSlop={10} style={styles.headerBtn}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </Row>
            <View style={{ marginTop: space.sm }}>
              <ProgressBar value={(idx + 1) / (STEPS.length - 1)} color={myTeam.color} height={8} />
            </View>
          </View>
        )}
        <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: insets.bottom + space.xxl }}>
          <Animated.View key={step} entering={FadeInRight.duration(250)}>
            {error && (
              <Card style={{ borderColor: colors.danger, marginBottom: space.md }}>
                <Txt v="label" style={{ color: colors.danger }}>
                  {error}
                </Txt>
                {step === 'check' && <GameButton label="Back to map" kind="ghost" onPress={() => router.replace('/map')} style={{ marginTop: space.sm }} />}
              </Card>
            )}
            {body()}
          </Animated.View>
        </ScrollView>
      </View>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  photoBox: {
    height: 240,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoTag: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(14,42,51,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  verdict: { gap: 6, borderWidth: 2 },
  sugg: { padding: space.md, gap: 4 },
  smallBtn: { minHeight: 36, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  bigNum: { fontFamily: fonts.titleBlack, fontSize: 34 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 4 },
});
