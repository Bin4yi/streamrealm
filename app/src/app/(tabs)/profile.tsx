import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card, ErrorBox, GameButton, InfoTip, ProgressBar, Row, Skeleton, TeamBadge, Txt } from '@/components/ui/kit';
import { Screen } from '@/components/ui/Screen';
import { usePlayer, usePlayerStats } from '@/lib/api';
import { avatarEmoji } from '@/lib/format';
import { useGame } from '@/lib/store';
import { colors, fonts, radius, space, teams } from '@/lib/theme';

function Setting({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.setting} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={{ flex: 1 }}>
        <Txt v="label">{label}</Txt>
        {hint ? <Txt v="small">{hint}</Txt> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.gold, false: 'rgba(255,255,255,0.2)' }} thumbColor={colors.white} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const g = useGame();
  const { data: player } = usePlayer();
  const stats = usePlayerStats();
  if (!g.player) return null;
  const team = teams[g.player.team];

  return (
    <Screen title="Profile">
      <Card style={{ alignItems: 'center', gap: space.sm }}>
        <View style={[styles.avatar, { borderColor: team.color }]}>
          <Text style={{ fontSize: 44 }}>{avatarEmoji(g.player.avatar)}</Text>
        </View>
        <Txt v="h1">{g.player.nickname}</Txt>
        <View style={{ alignItems: 'center' }}>
          <TeamBadge team={g.player.team} />
        </View>
        <Row gap={space.xl} style={{ marginTop: space.sm }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.big, { color: colors.gold }]}>{player?.points ?? 0}</Text>
            <Txt v="small">points</Txt>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.big}>🔥 {player?.streak ?? 0}</Text>
            <Txt v="small">day streak</Txt>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.big}>{stats.data?.checks ?? 0}</Text>
            <Txt v="small">checks</Txt>
          </View>
        </Row>
      </Card>

      {stats.error && <ErrorBox message={(stats.error as Error).message} onRetry={stats.refetch} />}
      {stats.data ? (
        <>
          <Card style={{ gap: space.sm }}>
            <Row gap={4}>
              <Txt v="tiny">Your science impact</Txt>
              <InfoTip
                title="Independent checks"
                text="When another player checks the same tile and agrees with you, your data is 'confirmed'. Scientists trust confirmed data more."
              />
            </Row>
            <Txt>
              ✅ {stats.data.confirmed_mine} of your checks were confirmed by other players.{'\n'}🔍 You confirmed {stats.data.confirmations_given} checks by others.{'\n'}💎{' '}
              {stats.data.treasures} treasures reported · 🌊 {stats.data.streams} streams visited.
            </Txt>
          </Card>
          <Txt v="h2">Badges</Txt>
          <View style={styles.badges}>
            {stats.data.badges.map((b) => (
              <Card key={b.id} padded={false} style={[styles.badge, b.earned && { borderColor: colors.gold, backgroundColor: 'rgba(242,201,76,0.12)' }]}>
                <Text style={[styles.badgeIcon, !b.earned && { opacity: 0.35 }]}>{b.icon}</Text>
                <Txt v="label" style={{ textAlign: 'center' }}>
                  {b.name}
                </Txt>
                <Txt v="small" style={{ textAlign: 'center' }}>
                  {b.how}
                </Txt>
                {!b.earned && (
                  <View style={{ alignSelf: 'stretch' }}>
                    <ProgressBar value={b.progress / b.target} height={6} />
                  </View>
                )}
                {b.earned && <Txt v="small" style={{ color: colors.gold }}>Earned!</Txt>}
              </Card>
            ))}
          </View>
        </>
      ) : (
        <Skeleton height={200} />
      )}

      <Txt v="h2">Settings</Txt>
      <Card padded={false}>
        <Setting label="Use real GPS" hint="Off = move with the Dev Panel (good for laptops)." value={g.realGps} onChange={(v) => g.set({ realGps: v })} />
        <Setting label="Dev Panel (for demos)" hint="Teleport, time warp, storm switch, bots." value={g.devPanelEnabled} onChange={(v) => g.set({ devPanelEnabled: v, devPanelOpen: false })} />
        <Setting label="Sounds" hint="Small click and success sounds." value={!g.muted} onChange={(v) => g.set({ muted: !v })} />
        <View style={styles.setting}>
          <View style={{ flex: 1 }}>
            <Txt v="label">Language</Txt>
            <Txt v="small">English. Portuguese and more coming soon.</Txt>
          </View>
          <Txt v="label">🇬🇧</Txt>
        </View>
      </Card>

      <Card style={{ gap: 6 }}>
        <Txt v="tiny">Safety and privacy</Txt>
        <Txt v="small">Never enter the water. Stay on public paths. Kids play with an adult.</Txt>
        <Txt v="small">We only store your nickname and avatar. Photo location data (GPS in the photo file) is removed when you upload.</Txt>
      </Card>

      <GameButton label="Scientist dashboard" icon="analytics" kind="primary" onPress={() => router.push('/dashboard')} />
      <GameButton
        label="Start again as a new player"
        icon="log-out"
        kind="ghost"
        onPress={() => {
          g.setPlayer(null);
          router.replace('/onboarding');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  big: { fontFamily: fonts.titleBlack, fontSize: 22, color: colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: { width: '48%', flexGrow: 1, alignItems: 'center', gap: 4, padding: space.md },
  badgeIcon: { fontSize: 34 },
  setting: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 56, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', borderRadius: radius.sm },
});
