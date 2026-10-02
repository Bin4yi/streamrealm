import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { ChunkyProgress, CoinLoader, GameButton, GameImage, GameModal, GameScreen, RewardBurst, StonePanel, StrokeText, WoodPanel } from '@/components/kit';
import { ErrorBox } from '@/components/ui/kit';
import { usePlayer, usePlayerStats, type Badge } from '@/lib/api';
import { Images } from '@/lib/assets';
import { avatarEmoji, avatarImage, levelFor } from '@/lib/format';
import { useGame } from '@/lib/store';
import { teams } from '@/lib/theme';
import { spring } from '@/theme/motion';
import { button, gold, ink, parchment } from '@/theme/tokens';

const BADGE_IMG: Record<string, [ImageSourcePropType | null, ImageSourcePropType | null]> = {
  explorer: [Images.badge.explorer, Images.badgeLocked.explorer],
  defender: [Images.badge.defender, Images.badgeLocked.defender],
  detective: [Images.badge.detective, Images.badgeLocked.detective],
  storm: [Images.badge.stormChaser, Images.badgeLocked.stormChaser],
  treasure: [Images.badge.treasureHunter, Images.badgeLocked.treasureHunter],
};

/** Chunky on/off switch. */
function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(value ? 26 : 0, spring.pop) }] }), [value]);
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.setting} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        {hint ? <Text style={styles.small}>{hint}</Text> : null}
      </View>
      <View style={[styles.track, { backgroundColor: value ? button.green.base : '#8A949A' }]}>
        <Animated.View style={[styles.knob, knob]} />
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const g = useGame();
  const { data: player } = usePlayer();
  const stats = usePlayerStats();
  const [badge, setBadge] = useState<Badge | null>(null);
  if (!g.player) return null;
  const team = teams[g.player.team];
  const level = levelFor(player?.points);

  return (
    <GameScreen
      title="PROFILE"
      ribbon="blue"
      header={
        <View style={{ alignItems: 'center', gap: 4 }}>
          <View style={[styles.frame, { borderColor: team.color }]}>
            <GameImage src={avatarImage(g.player.avatar)} size={104} fallback={avatarEmoji(g.player.avatar)} label="Your avatar" />
          </View>
          <StrokeText size="L" align="center">
            {g.player.nickname}
          </StrokeText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <GameImage src={Images.emblem[g.player.team]} size={30} fallback={team.emoji} />
            <StrokeText size="S" color={team.soft}>
              {`Team ${team.name} · Level ${level}`}
            </StrokeText>
          </View>
          <ChunkyProgress value={(player?.points ?? 0) % 250} max={250} label={`${(player?.points ?? 0) % 250} / 250 to level ${level + 1}`} color={gold.dark} style={{ width: '90%', marginTop: 6 }} />
        </View>
      }
    >
      {stats.error && <ErrorBox message={(stats.error as Error).message} onRetry={stats.refetch} />}
      {!stats.data ? (
        <CoinLoader label="Loading your badges…" />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              [player?.points ?? 0, 'coins'],
              [player?.streak ?? 0, 'day streak'],
              [stats.data.checks, 'checks'],
              [stats.data.confirmed_mine, 'confirmed'],
            ].map(([v, l]) => (
              <StonePanel key={String(l)} inner="teal" border={6} style={{ flex: 1 }} contentStyle={{ padding: 8, alignItems: 'center' }}>
                <StrokeText size="M">{String(v)}</StrokeText>
                <Text style={styles.tabletLabel}>{String(l)}</Text>
              </StonePanel>
            ))}
          </View>

          <StrokeText size="L" align="center">
            Badges
          </StrokeText>
          <View style={styles.badges}>
            {stats.data.badges.map((b) => {
              const [on, off] = BADGE_IMG[b.id] ?? [null, null];
              return (
                <Pressable key={b.id} onPress={() => setBadge(b)} style={styles.badge} accessibilityRole="button" accessibilityLabel={`${b.name} badge, ${b.earned ? 'earned' : 'locked'}`}>
                  <View style={b.earned ? styles.glow : null}>
                    <GameImage src={b.earned ? on : off} size={86} fallback={b.icon} />
                  </View>
                  <StrokeText size="S" fontSize={14} align="center" color={b.earned ? gold.light : ink.dim}>
                    {b.name}
                  </StrokeText>
                  {!b.earned && <ChunkyProgress value={b.progress} max={b.target} height={18} style={{ alignSelf: 'stretch' }} />}
                </Pressable>
              );
            })}
          </View>

          <WoodPanel contentStyle={{ padding: 6 }}>
            <Toggle label="Use real GPS" hint="Off = move with the Dev Panel (good for laptops)." value={g.realGps} onChange={(v) => g.set({ realGps: v })} />
            <Toggle label="Sound" hint="Small click and coin sounds." value={!g.muted} onChange={(v) => g.set({ muted: !v })} />
            <Toggle label="Reduced motion" hint="Stops idle animations, rays and shakes." value={g.reducedMotion} onChange={(v) => g.set({ reducedMotion: v })} />
            <Toggle label="Dev Panel (for demos)" hint="Teleport, time warp, storm switch, bots." value={g.devPanelEnabled} onChange={(v) => g.set({ devPanelEnabled: v, devPanelOpen: false })} />
            <View style={styles.setting}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Language</Text>
                <Text style={styles.small}>English. Portuguese and more coming soon.</Text>
              </View>
            </View>
          </WoodPanel>

          <WoodPanel>
            <Text style={styles.settingLabel}>Safety and privacy</Text>
            <Text style={styles.small}>Never enter the water. Stay on public paths. Kids play with an adult.</Text>
            <Text style={styles.small}>We only store your nickname and avatar. GPS data inside photos is removed when you upload.</Text>
          </WoodPanel>

          <GameButton label="SCIENTIST DASHBOARD" color="blue" onPress={() => router.push('/dashboard')} />
          <GameButton
            label="NEW PLAYER"
            color="red"
            size="S"
            style={{ alignSelf: 'center' }}
            onPress={() => {
              g.setPlayer(null);
              router.replace('/onboarding');
            }}
          />
        </>
      )}

      <GameModal open={!!badge} onClose={() => setBadge(null)} title={badge?.name.toUpperCase() ?? ''}>
        {badge && (
          <View style={{ alignItems: 'center', gap: 6 }}>
            {badge.earned ? (
              <RewardBurst size={190}>
                <GameImage src={BADGE_IMG[badge.id]?.[0] ?? null} size={120} fallback={badge.icon} />
              </RewardBurst>
            ) : (
              <GameImage src={BADGE_IMG[badge.id]?.[1] ?? null} size={120} fallback={badge.icon} />
            )}
            <Text style={[styles.settingLabel, { textAlign: 'center' }]}>{badge.earned ? 'You earned this badge!' : 'How to earn it'}</Text>
            <Text style={[styles.small, { textAlign: 'center', fontSize: 15 }]}>{badge.how}.</Text>
            {!badge.earned && <ChunkyProgress value={badge.progress} max={badge.target} style={{ alignSelf: 'stretch', marginTop: 6 }} />}
          </View>
        )}
      </GameModal>
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  frame: { width: 124, height: 124, borderRadius: 30, borderWidth: 5, backgroundColor: '#FFF3D6', alignItems: 'center', justifyContent: 'center' },
  tabletLabel: { color: '#DCEFF2', fontFamily: 'Nunito_700Bold', fontSize: 11, textAlign: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  badge: { width: '30%', minWidth: 100, alignItems: 'center', gap: 4 },
  glow: { borderRadius: 50, shadowColor: gold.light, shadowOpacity: 0.9, shadowRadius: 14, elevation: 8 },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, minHeight: 56, borderBottomWidth: 2, borderBottomColor: parchment.line },
  settingLabel: { fontFamily: 'LilitaOne_400Regular', fontSize: 17, color: parchment.text },
  small: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: parchment.muted, lineHeight: 18 },
  track: { width: 58, height: 32, borderRadius: 16, borderWidth: 3, borderColor: ink.stroke, padding: 2 },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: ink.white, borderWidth: 2, borderColor: ink.stroke },
});
