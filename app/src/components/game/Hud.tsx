import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { Card, InfoTip, Row, Txt } from '@/components/ui/kit';
import { usePlayer, useStorm } from '@/lib/api';
import { avatarEmoji } from '@/lib/format';
import { useGame } from '@/lib/store';
import { colors, fonts, radius, space, teams } from '@/lib/theme';

export function Hud() {
  const local = useGame((s) => s.player);
  const { data: player } = usePlayer();
  const warp = useGame((s) => s.timeWarpDays);
  if (!local) return null;
  const team = teams[local.team];
  return (
    <Card padded={false} style={styles.hud}>
      <View style={[styles.avatar, { borderColor: team.color }]}>
        <Text style={{ fontSize: 22 }}>{avatarEmoji(local.avatar)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="label" numberOfLines={1}>
          {local.nickname}
        </Txt>
        <Row gap={4}>
          <Text style={{ fontSize: 11 }}>{team.emoji}</Text>
          <Txt v="small" style={{ color: team.soft }}>
            Team {team.name}
          </Txt>
          {warp > 0 && <Txt v="small" style={{ color: colors.gold }}>· ⏩ +{warp}d</Txt>}
        </Row>
      </View>
      <View style={styles.stat}>
        <Text style={{ fontSize: 16 }}>🔥</Text>
        <Text style={styles.statNum}>{player?.streak ?? 0}</Text>
      </View>
      <View style={[styles.stat, styles.points]}>
        <Text style={{ fontSize: 16 }}>🪙</Text>
        <Text style={[styles.statNum, { color: colors.gold }]}>{player?.points ?? 0}</Text>
      </View>
    </Card>
  );
}

function Drop({ x, delay }: { x: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -10 + t.value * 80 }, { rotate: '12deg' }], opacity: 1 - t.value }));
  return <Animated.View style={[styles.drop, { left: `${x}%` }, style]} />;
}

export function StormBanner() {
  const { data } = useStorm();
  const drops = useMemo(() => Array.from({ length: 18 }, (_, i) => ({ x: (i * 37) % 100, delay: (i * 137) % 900 })), []);
  if (!data?.active) return null;
  return (
    <View style={styles.storm}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {drops.map((d, i) => (
          <Drop key={i} x={d.x} delay={d.delay} />
        ))}
      </View>
      <Row>
        <Text style={{ fontSize: 22 }}>⛈️</Text>
        <View style={{ flex: 1 }}>
          <Row gap={4}>
            <Txt v="h3" style={{ fontFamily: fonts.titleBlack, color: colors.white }}>
              STORM QUEST · x2
            </Txt>
            <InfoTip
              color={colors.white}
              title="Storm Quest"
              text="Heavy rain is coming (10 mm or more in the next 48 hours, from the Open-Meteo forecast). After heavy rain, sewers can overflow into streams. Checks now are the most useful for scientists, so all points are doubled."
            />
          </Row>
          <Txt v="small" style={{ color: '#E6F2FF' }}>
            After heavy rain, sewers can overflow. Your checks matter most now!
            {data.forced ? ' (Storm switched on in the Dev Panel for the demo.)' : data.rain_mm_48h != null ? ` (${data.rain_mm_48h.toFixed(1)} mm of rain forecast in 48 h)` : ''}
          </Txt>
        </View>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, paddingRight: space.md, borderRadius: radius.pill, backgroundColor: 'rgba(14,42,51,0.92)' },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.25)' },
  points: { borderWidth: 1, borderColor: 'rgba(242,201,76,0.45)' },
  statNum: { fontFamily: fonts.titleBlack, fontSize: 16, color: colors.text },
  storm: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    padding: space.md,
    backgroundColor: '#3B2F7A',
    borderWidth: 1,
    borderColor: '#8E7CFF',
  },
  drop: { position: 'absolute', top: 0, width: 2, height: 14, borderRadius: 1, backgroundColor: 'rgba(180,210,255,0.7)' },
});
