import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInRight, FadeOutLeft, runOnJS, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot } from '@/components/game/Mascot';
import { GameButton, GameImage, RewardBurst, StrokeText, WoodPanel } from '@/components/kit';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { api, type Player } from '@/lib/api';
import { Images } from '@/lib/assets';
import { AVATAR_IDS, AVATARS, avatarImage } from '@/lib/format';
import { useGame } from '@/lib/store';
import { teamIds, teams, type TeamId } from '@/lib/theme';
import { spring } from '@/theme/motion';
import { bodyFont, bodyFontHeavy, gold, ink, parchment } from '@/theme/tokens';

const CARDS = [
  {
    img: Images.onboarding.explore,
    id: 'onboarding-explore',
    title: 'Conquer your stream',
    lines: ['Your city stream is cut into 100 m pieces of land.', 'Walk to one, do a quick photo check, and it is yours.', 'Keep it fresh, or other teams take it!'],
  },
  {
    img: Images.onboarding.science,
    id: 'onboarding-science',
    title: 'Your play helps science',
    lines: ['Every check is real data for scientists.', 'Exploring fills gaps. Defending keeps data fresh.', 'Treasures show problems like pipes and trash.'],
  },
  {
    img: Images.onboarding.safety,
    id: 'onboarding-safety',
    title: 'Stay safe',
    lines: ['Never go into the water. Stay on public paths.', 'Skip any place that feels unsafe.', 'Kids: play with an adult. Use a nickname.'],
  },
];
function TeamCard({ id, selected, onPress }: { id: TeamId; selected: boolean; onPress: () => void }) {
  const t = teams[id];
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: withSpring(selected ? -10 : 0, spring.pop) }, { scale: withSpring(selected ? 1.04 : 1, spring.pop) }] }), [selected]);
  return (
    <Pressable onPress={onPress} testID={`team-${id}`} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`Team ${t.name}`} style={{ flex: 1 }}>
      <Animated.View style={[styles.team, { borderColor: selected ? gold.light : ink.stroke, backgroundColor: t.color }, selected && styles.teamOn, lift]}>
        <View style={styles.teamInner}>
          {selected ? (
            <RewardBurst size={96}>
              <Mascot team={id} size={84} />
            </RewardBurst>
          ) : (
            <View style={{ height: 96, justifyContent: 'center' }}>
              <Mascot team={id} size={84} />
            </View>
          )}
          <GameImage src={Images.emblem[id]} id={`emblem-${id}`} size={44} fallback={t.emoji} />
          <StrokeText size="S" fontSize={15} align="center" numberOfLines={1}>
            {t.name}
          </StrokeText>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const setPlayer = useGame((s) => s.setPlayer);
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('fox');
  const [team, setTeam] = useState<TeamId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPick = step === CARDS.length;
  const nickOk = nickname.trim().length >= 2;
  const swipe = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .onEnd((e) => {
      if (e.translationX < -60) runOnJS(setStep)(Math.min(CARDS.length, step + 1));
      else if (e.translationX > 60) runOnJS(setStep)(Math.max(0, step - 1));
    });

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
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Images.identity.splash && <Image source={Images.identity.splash as never} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />}
        <LinearGradient colors={['rgba(14,42,51,0.1)', 'rgba(14,42,51,0.55)', 'rgba(8,28,35,0.97)']} locations={[0, 0.35, 0.7]} style={StyleSheet.absoluteFill} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}>
          <StrokeText size="XL" align="center" color={gold.light}>
            StreamRealm
          </StrokeText>
          {!isPick ? (
            <GestureDetector gesture={swipe}>
              <Animated.View key={step} entering={FadeInRight.duration(320)} exiting={FadeOutLeft.duration(180)} style={{ marginTop: 10 }}>
                <GameImage src={CARDS[step].img} id={CARDS[step].id} size={230} style={{ alignSelf: 'center', zIndex: 2 }} fallback="🌊" />
                <WoodPanel style={{ marginTop: -14 }}>
                  <StrokeText size="L" align="center">
                    {CARDS[step].title}
                  </StrokeText>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {CARDS[step].lines.map((l) => (
                      <View key={l} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                        <Text style={styles.bullet}>◆</Text>
                        <Text style={styles.line}>{l}</Text>
                      </View>
                    ))}
                  </View>
                </WoodPanel>
              </Animated.View>
            </GestureDetector>
          ) : (
            <Animated.View entering={FadeInRight.duration(320)} style={{ gap: 14, marginTop: 8 }}>
              <StrokeText size="L" align="center">
                Pick your team
              </StrokeText>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {teamIds.map((id) => (
                  <TeamCard key={id} id={id} selected={team === id} onPress={() => setTeam(id)} />
                ))}
              </View>
              <WoodPanel>
                <Text style={styles.label}>Nickname (no real names)</Text>
                <TextInput
                  value={nickname}
                  onChangeText={(t) => setNickname(t.replace(/[^A-Za-z0-9_\- ]/g, '').slice(0, 20))}
                  placeholder="e.g. RiverFox"
                  placeholderTextColor={parchment.muted}
                  style={styles.input}
                  autoCapitalize="none"
                  testID="nickname"
                />
                <Text style={[styles.label, { marginTop: 12 }]}>Avatar</Text>
                <View style={styles.avatars}>
                  {AVATAR_IDS.map((a) => {
                    const on = avatar === a;
                    return (
                      <Pressable
                        key={a}
                        onPress={() => setAvatar(a)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`Avatar ${a}`}
                        style={[styles.avatar, { borderColor: on ? (team ? teams[team].color : gold.dark) : 'transparent' }, on && styles.avatarOn]}
                      >
                        <GameImage src={avatarImage(a)} id={`avatar-${a}`} size={52} fallback={AVATARS[a]} />
                      </Pressable>
                    );
                  })}
                </View>
                {error && <Text style={[styles.line, { color: '#B3261E', marginTop: 8 }]}>{error}</Text>}
              </WoodPanel>
            </Animated.View>
          )}

          <View style={styles.dots}>
            {[...CARDS, null].map((_, i) => (
              <View key={i} style={[styles.gem, i === step && styles.gemOn]} />
            ))}
          </View>
          <View style={{ gap: 10, marginTop: 14 }}>
            {!isPick ? (
              <GameButton label={step === CARDS.length - 1 ? 'I WILL PLAY SAFE' : 'NEXT'} size="L" onPress={() => setStep(step + 1)} testID="onb-next" />
            ) : (
              <GameButton label="ENTER THE REALM" size="L" color="orange" disabled={!team || !nickOk} loading={busy} onPress={start} testID="onb-start" />
            )}
            {step > 0 && <GameButton label="BACK" color="blue" size="S" onPress={() => setStep(step - 1)} style={{ alignSelf: 'center' }} />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, flexGrow: 1, justifyContent: 'flex-end' },
  bullet: { color: '#B8860B', fontSize: 14, marginTop: 2 },
  line: { flex: 1, color: parchment.text, fontFamily: bodyFont, fontSize: 16, lineHeight: 22 },
  label: { color: parchment.muted, fontFamily: bodyFontHeavy, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    marginTop: 6,
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFF6E2',
    borderWidth: 2.5,
    borderColor: parchment.line,
    color: parchment.text,
    fontFamily: bodyFontHeavy,
    fontSize: 18,
  },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, justifyContent: 'space-between' },
  avatar: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  avatarOn: { backgroundColor: 'rgba(255,255,255,0.6)' },
  team: { borderRadius: 18, borderWidth: 3, overflow: 'hidden' },
  teamOn: { shadowColor: gold.light, shadowOpacity: 1, shadowRadius: 14, elevation: 10 },
  teamInner: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 4, backgroundColor: 'rgba(0,0,0,0.18)' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 16 },
  gem: { width: 12, height: 12, transform: [{ rotate: '45deg' }], backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 2, borderColor: ink.stroke },
  gemOn: { backgroundColor: gold.base, width: 16, height: 16 },
});
