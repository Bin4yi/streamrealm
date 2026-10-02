import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInRight, FadeOutLeft, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConquerArt, MissionArt, SafetyArt } from '@/components/game/Illustrations';
import { GameButton, Row, Txt } from '@/components/ui/kit';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { api, type Player } from '@/lib/api';
import { AVATAR_IDS, AVATARS } from '@/lib/format';
import { useGame } from '@/lib/store';
import { colors, fonts, radius, space, teamIds, teams, type TeamId } from '@/lib/theme';

const CARDS: { art: ReactNode; title: string; lines: string[] }[] = [
  {
    art: <ConquerArt />,
    title: 'Conquer your stream',
    lines: [
      'Your city stream is cut into 100 m pieces of land.',
      'Walk to a piece, do a quick photo check, and it becomes yours.',
      'Keep your land fresh, or other teams will take it!',
    ],
  },
  {
    art: <MissionArt />,
    title: 'The secret mission',
    lines: [
      'Every check is real data for scientists who protect streams.',
      'Exploring fog fills gaps on the map. Defending land keeps data fresh.',
      'Attacks are second opinions. Treasures show problems like pipes and trash.',
    ],
  },
  {
    art: <SafetyArt />,
    title: 'Play safe',
    lines: [
      'Never go into the water. Stay on public paths.',
      'Skip any place that feels unsafe. A ⚠️ tile gives no points.',
      'Kids: play with an adult. Use a nickname, not your real name.',
    ],
  },
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const setPlayer = useGame((s) => s.setPlayer);
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('otter');
  const [team, setTeam] = useState<TeamId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPick = step === CARDS.length;
  // Swipe left / right between the intro cards.
  const swipe = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .onEnd((e) => {
      if (e.translationX < -60) runOnJS(setStep)(Math.min(CARDS.length, step + 1));
      else if (e.translationX > 60) runOnJS(setStep)(Math.max(0, step - 1));
    });
  const nickOk = nickname.trim().length >= 2;

  const start = async () => {
    if (!team || !nickOk) return;
    setBusy(true);
    setError(null);
    try {
      const p = await api.post<Player>('/players', { nickname: nickname.trim(), avatar, team });
      setPlayer({ id: p.id, nickname: p.nickname, avatar: p.avatar, team: p.team });
      router.replace('/map');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your player');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PhoneFrame>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
          <Txt v="title" style={styles.logo}>
            StreamRealm
          </Txt>
          {!isPick ? (
            <GestureDetector gesture={swipe}>
              <Animated.View key={step} entering={FadeInRight.duration(350)} exiting={FadeOutLeft.duration(200)} style={styles.card}>
                <View style={{ alignItems: 'center' }}>{CARDS[step].art}</View>
                <Txt v="h1" style={{ textAlign: 'center', marginTop: space.lg }}>
                  {CARDS[step].title}
                </Txt>
                <View style={{ gap: space.sm, marginTop: space.md }}>
                  {CARDS[step].lines.map((l) => (
                    <Row key={l} style={{ alignItems: 'flex-start' }}>
                      <Text style={{ color: colors.gold, fontSize: 16 }}>✦</Text>
                      <Txt style={{ flex: 1 }}>{l}</Txt>
                    </Row>
                  ))}
                </View>
              </Animated.View>
            </GestureDetector>
          ) : (
            <Animated.View entering={FadeInRight.duration(350)} style={styles.card}>
              <Txt v="h1" style={{ textAlign: 'center' }}>
                Who are you?
              </Txt>
              <Txt v="tiny" style={{ marginTop: space.lg }}>
                Nickname (no real names)
              </Txt>
              <TextInput
                value={nickname}
                onChangeText={(t) => setNickname(t.replace(/[^A-Za-z0-9_\- ]/g, '').slice(0, 20))}
                placeholder="e.g. RiverFox"
                placeholderTextColor={colors.textDim}
                style={styles.input}
                autoCapitalize="none"
                testID="nickname"
              />
              <Txt v="tiny" style={{ marginTop: space.lg }}>
                Avatar
              </Txt>
              <View style={styles.avatars}>
                {AVATAR_IDS.map((a) => (
                  <Pressable
                    key={a}
                    onPress={() => setAvatar(a)}
                    accessibilityLabel={`Avatar ${a}`}
                    style={[styles.avatar, avatar === a && { borderColor: colors.gold, backgroundColor: 'rgba(242,201,76,0.15)' }]}
                  >
                    <Text style={{ fontSize: 26 }}>{AVATARS[a]}</Text>
                  </Pressable>
                ))}
              </View>
              <Txt v="tiny" style={{ marginTop: space.lg }}>
                Pick your team
              </Txt>
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                {teamIds.map((id) => {
                  const t = teams[id];
                  const on = team === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setTeam(id)}
                      testID={`team-${id}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={[
                        styles.team,
                        { borderColor: on ? t.color : 'rgba(255,255,255,0.12)', backgroundColor: on ? `${t.color}33` : 'rgba(255,255,255,0.04)' },
                      ]}
                    >
                      <View style={[styles.teamIcon, { backgroundColor: t.color }]}>
                        <Text style={{ fontSize: 26 }}>{t.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.teamName}>{t.name}</Text>
                        <Txt v="small">{t.motto}</Txt>
                      </View>
                      {on && <Text style={{ fontSize: 20 }}>✔️</Text>}
                    </Pressable>
                  );
                })}
              </View>
              {error && (
                <Txt v="small" style={{ color: colors.danger, marginTop: space.md }}>
                  {error}
                </Txt>
              )}
            </Animated.View>
          )}

          <Row style={{ justifyContent: 'center', marginTop: space.xl, gap: 8 }}>
            {[...CARDS, null].map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
            ))}
          </Row>
          <View style={{ marginTop: space.lg, gap: space.sm }}>
            {!isPick ? (
              <GameButton
                label={step === CARDS.length - 1 ? 'I will play safe' : 'Next'}
                icon="arrow-forward"
                big
                onPress={() => setStep(step + 1)}
                testID="onb-next"
              />
            ) : (
              <GameButton label="Enter the realm" icon="flag" big disabled={!team || !nickOk} loading={busy} onPress={start} testID="onb-start" />
            )}
            {step > 0 && <GameButton label="Back" kind="ghost" onPress={() => setStep(step - 1)} />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, flexGrow: 1, justifyContent: 'center' },
  logo: { textAlign: 'center', color: colors.gold, marginBottom: space.lg, fontSize: 34 },
  card: { minHeight: 420 },
  input: {
    marginTop: 6,
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 17,
  },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  team: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 2, minHeight: 64 },
  teamIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  teamName: { fontFamily: fonts.title, fontSize: 18, color: colors.text },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotOn: { width: 24, backgroundColor: colors.gold },
});
