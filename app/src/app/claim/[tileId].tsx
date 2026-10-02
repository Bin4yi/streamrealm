import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HEALTH_DISCLAIMER, healthColor } from '@/components/game/TileSheet';
import { VictoryScreen, type VictoryResult } from '@/components/game/VictoryScreen';
import { ChunkyProgress, GameButton, GameImage, RibbonTitle, StonePanel, StrokeText, WoodPanel, WorldBackground } from '@/components/kit';
import { InfoTip } from '@/components/ui/kit';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { api, API_URL, ApiError, useStorm, useTiles } from '@/lib/api';
import { Images } from '@/lib/assets';
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
import { teams } from '@/lib/theme';
import { appendPhoto, pickPhoto } from '@/lib/upload';
import { spring } from '@/theme/motion';
import { gold, ink, parchment } from '@/theme/tokens';

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
type Result = VictoryResult & {
  action: string;
  status: string;
  agreement: number | null;
  health_score: number;
  treasure: TreasureType | null;
  storm: boolean;
};

const DEMO_PREVIEW = [`${API_URL}/demo-photos/generated/demo-0.jpg`, `${API_URL}/demo-photos/generated/demo-3.jpg`];
const TREASURE_IMG = { pipe: Images.treasure.pipe, trash: Images.treasure.trash, wildlife: Images.treasure.wildlife, plant: Images.treasure.plant, algae: Images.treasure.algae };

/** Path of stars at the top: done steps are gold. */
function StarPath({ done, total }: { done: number; total: number }) {
  return (
    <View style={styles.stars} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: done }} accessibilityLabel={`Step ${done} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', flex: i < total - 1 ? 1 : 0 }}>
          <Text style={[styles.star, { color: i < done ? gold.base : 'rgba(255,255,255,0.25)' }]}>★</Text>
          {i < total - 1 && <View style={[styles.starLine, { backgroundColor: i < done - 1 ? gold.dark : 'rgba(255,255,255,0.15)' }]} />}
        </View>
      ))}
    </View>
  );
}

function Choice({ label, emoji, img, selected, color, onPress, testID }: { label: string; emoji?: string; img?: unknown; selected: boolean; color: string; onPress: () => void; testID?: string }) {
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: withSpring(selected ? -5 : 0, spring.pop) }, { scale: withSpring(selected ? 1.03 : 1, spring.pop) }] }), [selected]);
  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label} style={{ width: '48.5%' }}>
      <Animated.View style={[styles.choice, selected && { borderColor: color, backgroundColor: '#FFF8E6', shadowColor: color, shadowOpacity: 0.9, shadowRadius: 10, elevation: 6 }, lift]}>
        {img !== undefined ? <GameImage src={img as never} size={56} fallback={emoji} /> : <Text style={{ fontSize: 32 }}>{emoji}</Text>}
        <Text style={styles.choiceText} numberOfLines={2}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

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
  const myTeam = g.player ? teams[g.player.team] : teams.otters;
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
      go('victory');
      qc.invalidateQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the check');
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    if (result && tile && result.animation.type === 'paint') g.flashClaim(tile.id, result.animation.team, result.points);
    else g.set({ selectedTileId: null });
    router.replace('/map');
  };

  // ---------- steps ----------
  const photoStep = (which: 'up' | 'down') => {
    const uri = demo ? DEMO_PREVIEW[which === 'up' ? 0 : 1] : photos[which];
    return (
      <View style={{ gap: 12 }}>
        <RibbonTitle title={which === 'up' ? 'PHOTO UPSTREAM' : 'PHOTO DOWNSTREAM'} color="blue" />
        <WoodPanel>
          <Text style={styles.body}>
            {which === 'up' ? 'Stand on the path. Point the camera to where the water comes FROM.' : 'Now turn around. Point the camera to where the water goes TO.'}
          </Text>
          <View style={styles.photoBox}>
            {uri ? (
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 46 }}>📷</Text>
                <Text style={styles.small}>{which === 'up' ? '⬆️ Upstream' : '⬇️ Downstream'}</Text>
              </View>
            )}
            {demo && (
              <View style={styles.demoTag}>
                <StrokeText size="S" fontSize={12} color={gold.light}>
                  DEMO PHOTO
                </StrokeText>
              </View>
            )}
          </View>
          <View style={styles.btnRow}>
            <GameButton label={Platform.OS === 'web' ? 'CAMERA / FILE' : 'CAMERA'} color="blue" size="S" onPress={() => choose(which, 'camera')} />
            <GameButton label="GALLERY" color="blue" size="S" onPress={() => choose(which, 'library')} />
            {g.devPanelEnabled && <GameButton label={demo ? 'DEMO ✓' : 'USE DEMO PHOTO'} color="orange" size="S" onPress={() => setDemo(true)} testID="use-demo" />}
          </View>
        </WoodPanel>
        <GameButton label="NEXT" size="L" disabled={!uri} onPress={next} testID="photo-next" />
      </View>
    );
  };

  const questionStep = (q: QuestionId) => (
    <View style={{ gap: 12 }}>
      <RibbonTitle title={QUESTION_LABEL[q].toUpperCase()} color="blue" />
      <WoodPanel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Text style={[styles.body, { flex: 1 }]}>{q === 'overall' ? 'How does this place feel to you overall?' : 'Tap the answer that fits best.'}</Text>
          <InfoTip title={QUESTION_LABEL[q]} text={QUESTION_TIP[q]} color={parchment.muted} />
        </View>
        <View style={styles.grid}>
          {(QUESTIONS[q] as readonly string[]).map((v) => (
            <Choice
              key={v}
              label={ANSWER_LABEL[v]}
              emoji={OPTION_EMOJI_BY_Q[q]?.[v] ?? OPTION_EMOJI[v]}
              selected={answers[q] === v}
              color={myTeam.color}
              testID={`opt-${q}-${v}`}
              onPress={() => {
                play('click');
                setAnswers((a) => ({ ...a, [q]: v }));
                setTimeout(next, 220);
              }}
            />
          ))}
        </View>
      </WoodPanel>
    </View>
  );

  const checkStep = () => {
    if (busy && !draft) {
      return (
        <WoodPanel contentStyle={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
          <GameImage src={Images.effect.coin} size={64} fallback="🪙" />
          <ActivityIndicator color={gold.dark} />
          <Text style={styles.body}>Checking your photos: sharpness, light, re-used photos…</Text>
        </WoodPanel>
      );
    }
    if (!draft) return null;
    const ai = draft.ai_result;
    const v = { pass: ['✅', 'PHOTOS LOOK GOOD', 'green'], warn: ['⚠️', 'OK, WITH NOTES', 'blue'], fail: ['⛔', 'PHOTOS NOT OK', 'red'] }[ai.verdict] as [string, string, 'green' | 'blue' | 'red'];
    const score = healthScore(finalAnswers);
    return (
      <View style={{ gap: 12 }}>
        <RibbonTitle title={v[1]} color={v[2]} />
        <WoodPanel>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <GameImage src={Images.mascot[g.player?.team === 'frogs' ? 'frog' : g.player?.team === 'kingfishers' ? 'kingfisher' : 'otter']} size={64} fallback="🦦" />
            <View style={{ flex: 1 }}>
              <Text style={styles.bodyBold}>
                {v[0]} {ai.mode === 'ai' ? 'Checked by AI (OpenAI) + photo rules' : 'Checked by photo rules (AI is off)'}
              </Text>
              {ai.reasons.map((r) => (
                <Text key={r} style={styles.small}>
                  • {r}
                </Text>
              ))}
            </View>
          </View>
          {ai.verdict !== 'fail' && ai.suggestions.length > 0 && (
            <View style={{ gap: 8, marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.label}>Second opinion</Text>
                <InfoTip
                  title="You decide"
                  text="These are only suggestions. Nothing changes unless you tap 'Use this'. We keep both your answer and the suggestion, so scientists can see where people and the computer disagree."
                  color={parchment.muted}
                />
              </View>
              {ai.suggestions.map((s) => {
                const mine = answers[s.question];
                const same = mine === s.value;
                const choice = choices[s.question];
                return (
                  <View key={s.question} style={styles.sugg}>
                    <Text style={styles.bodyBold}>
                      {ai.mode === 'ai' ? 'AI thinks' : 'Colour rule thinks'}: {ANSWER_LABEL[s.value]} {QUESTION_LABEL[s.question].toLowerCase()} ({Math.round(s.confidence * 100)}%)
                    </Text>
                    <Text style={styles.small}>Why? {s.why}</Text>
                    {same ? (
                      <Text style={[styles.small, { color: '#2E7D32' }]}>✓ Same as your answer</Text>
                    ) : (
                      <View style={[styles.btnRow, { marginTop: 4 }]}>
                        <Text style={[styles.small, { flex: 1 }]}>You said: {mine ? ANSWER_LABEL[mine] : '–'}</Text>
                        <GameButton size="S" label="USE THIS" color={choice === 'accepted' ? 'green' : 'blue'} onPress={() => setChoices((c) => ({ ...c, [s.question]: 'accepted' }))} testID={`use-${s.question}`} />
                        <GameButton size="S" label="KEEP MINE" color={choice !== 'accepted' ? 'green' : 'blue'} onPress={() => setChoices((c) => ({ ...c, [s.question]: 'kept' }))} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          {ai.notable && ai.notable.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>The AI also noticed</Text>
              {ai.notable.map((n) => (
                <Text key={n} style={styles.small}>
                  🔎 {n}
                </Text>
              ))}
            </View>
          )}
        </WoodPanel>
        {ai.verdict !== 'fail' && (
          <StonePanel inner="teal">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <StrokeText size="S">Tile health from your answers</StrokeText>
              <InfoTip title="Health score" text={HEALTH_DISCLAIMER} color={ink.white} />
            </View>
            <ChunkyProgress value={score} max={100} label={`${score} / 100`} color={healthColor(score)} />
          </StonePanel>
        )}
        {ai.verdict === 'fail' ? (
          <GameButton
            label="RETAKE PHOTOS"
            color="blue"
            size="L"
            onPress={() => {
              setDraft(null);
              go('up');
            }}
          />
        ) : (
          <GameButton
            label={action === 'attack' ? 'ATTACK!' : action === 'confirm_dispute' ? 'SETTLE IT!' : 'CLAIM IT!'}
            color={action === 'attack' ? 'red' : 'orange'}
            size="L"
            loading={busy}
            onPress={claim}
            testID="claim-it"
          />
        )}
      </View>
    );
  };

  const body = () => {
    switch (step) {
      case 'safety':
        return (
          <View style={{ gap: 12 }}>
            <RibbonTitle title="SAFETY FIRST" color="green" />
            <GameImage src={Images.onboarding.safety} id="onboarding-safety" size={190} style={{ alignSelf: 'center' }} fallback="🦺" />
            <WoodPanel>
              {['Stay on the path or the bank. Never go into the water.', 'Do not touch the water or any pipes.', 'If it feels unsafe, skip this tile.', 'Kids: play with an adult.'].map((l) => (
                <Text key={l} style={[styles.body, { marginBottom: 4 }]}>
                  ✔ {l}
                </Text>
              ))}
            </WoodPanel>
            <GameButton label="I AM ON A SAFE PATH" size="L" onPress={next} testID="safety-ok" />
          </View>
        );
      case 'up':
      case 'down':
        return photoStep(step);
      case 'treasure':
        return (
          <View style={{ gap: 12 }}>
            <RibbonTitle title="FOUND A TREASURE?" color="blue" />
            <WoodPanel>
              <Text style={[styles.body, { marginBottom: 10 }]}>Treasures help scientists find problems and wildlife. +40 points.</Text>
              <View style={styles.grid}>
                {TREASURE_TYPES.map((t) => (
                  <Choice key={t} label={TREASURE_INFO[t].label} img={TREASURE_IMG[t]} emoji={TREASURE_INFO[t].emoji} selected={treasure === t} color={gold.dark} onPress={() => setTreasure(treasure === t ? null : t)} testID={`treasure-${t}`} />
                ))}
              </View>
              {treasure && !demo && (
                <GameButton label={treasurePhoto ? 'PHOTO ADDED ✓' : 'ADD A PHOTO'} color="blue" size="S" onPress={async () => setTreasurePhoto(await pickPhoto('camera').catch(() => null))} style={{ marginTop: 10 }} />
              )}
            </WoodPanel>
            <GameButton label={treasure ? 'CHECK MY PHOTOS' : 'NO TREASURE · CHECK'} size="L" onPress={submit} testID="submit-check" />
          </View>
        );
      case 'check':
        return checkStep();
      default:
        return questionStep(step as QuestionId);
    }
  };

  if (!tile) {
    return (
      <PhoneFrame>
        <WorldBackground style={{ alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {tiles.isLoading ? <GameImage src={Images.effect.coin} size={56} fallback="🪙" /> : <StrokeText>Tile not found.</StrokeText>}
          <GameButton label="BACK" color="blue" onPress={() => router.back()} />
        </WorldBackground>
      </PhoneFrame>
    );
  }

  if (step === 'victory' && result) {
    return (
      <PhoneFrame>
        <WorldBackground>
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 20 }}>
            <VictoryScreen result={result} streamName={tile.properties.stream_name} myTeam={g.player?.team ?? 'otters'} onDone={finish} />
          </ScrollView>
        </WorldBackground>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <WorldBackground>
        <View style={{ flex: 1, paddingTop: insets.top }}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <GameButton size="RoundS" color="blue" iconFallback="◀" accessibilityLabel="Back" onPress={back} style={{ transform: [{ scale: 0.75 }] }} />
              <View style={{ flex: 1 }}>
                <StrokeText size="S" fontSize={17} numberOfLines={1}>
                  {tile.properties.stream_name}
                </StrokeText>
                <Text style={styles.headSmall} numberOfLines={1}>
                  {action ? `${ACTION_LABEL[action]} · +${previewPoints(action, !!storm.data?.active)} coins` : ''}
                </Text>
              </View>
              {tile.properties.owner_team && <GameImage src={Images.emblem[tile.properties.owner_team]} size={36} fallback={teams[tile.properties.owner_team].emoji} />}
              <GameButton size="RoundS" color="red" iconFallback="✕" accessibilityLabel="Cancel check" onPress={() => router.back()} style={{ transform: [{ scale: 0.75 }] }} />
            </View>
            <StarPath done={idx + 1} total={STEPS.length - 1} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
            <Animated.View key={step} entering={FadeInRight.duration(230)}>
              {error && (
                <WoodPanel style={{ marginBottom: 12 }}>
                  <Text style={[styles.bodyBold, { color: '#B3261E' }]}>{error}</Text>
                  {step === 'check' && <GameButton label="BACK TO MAP" color="blue" size="S" onPress={() => router.replace('/map')} style={{ marginTop: 8 }} />}
                </WoodPanel>
              )}
              {body()}
            </Animated.View>
          </ScrollView>
        </View>
      </WorldBackground>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 10, paddingVertical: 6, gap: 4, backgroundColor: 'rgba(30,18,8,0.6)', borderBottomWidth: 3, borderBottomColor: '#3B240E' },
  headSmall: { color: '#E8DCC4', fontFamily: 'Nunito_700Bold', fontSize: 13 },
  stars: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  star: { fontSize: 18, textShadowColor: ink.stroke, textShadowRadius: 2 },
  starLine: { flex: 1, height: 3, borderRadius: 2, marginHorizontal: 1 },
  body: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: parchment.text, lineHeight: 21 },
  bodyBold: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: parchment.text, lineHeight: 21 },
  small: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: parchment.muted, lineHeight: 18 },
  label: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: parchment.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  photoBox: {
    height: 220,
    marginVertical: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: parchment.bgDark,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: parchment.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoTag: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(30,18,8,0.85)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  choice: { minHeight: 96, borderRadius: 16, borderWidth: 3, borderColor: parchment.line, backgroundColor: '#FFF2D2', alignItems: 'center', justifyContent: 'center', padding: 8, gap: 4 },
  choiceText: { fontFamily: 'LilitaOne_400Regular', fontSize: 16, color: parchment.text, textAlign: 'center' },
  sugg: { padding: 10, borderRadius: 12, backgroundColor: parchment.bgDark, gap: 2 },
});


