import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { GameImage, ResourcePill, StrokeText } from '@/components/kit';
import { InfoTip } from '@/components/ui/kit';
import { usePlayer, useStorm } from '@/lib/api';
import { Images } from '@/lib/assets';
import { avatarEmoji, avatarImage, levelFor } from '@/lib/format';
import { useGame } from '@/lib/store';
import { teams } from '@/lib/theme';
import { useMotionOK } from '@/theme/motion';
import { gold, ink, wood } from '@/theme/tokens';

/** Top HUD: avatar with level star, nickname, coin and streak pills, team shield. */
export function Hud() {
  const local = useGame((s) => s.player);
  const warp = useGame((s) => s.timeWarpDays);
  const { data: player } = usePlayer();
  if (!local) return null;
  const team = teams[local.team];
  const level = levelFor(player?.points);
  return (
    <View style={styles.hud}>
      <View style={[styles.avatarFrame, { borderColor: team.color }]}>
        <GameImage src={avatarImage(local.avatar)} size={44} fallback={avatarEmoji(local.avatar)} label="Your avatar" />
        <View style={styles.level} accessibilityLabel={`Level ${level}`}>
          <Text style={styles.star}>★</Text>
          <View style={StyleSheet.absoluteFill}>
            <StrokeText size="S" fontSize={11} align="center" style={{ lineHeight: 26 }}>
              {level}
            </StrokeText>
          </View>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <StrokeText size="S" fontSize={16} numberOfLines={1}>
          {local.nickname}
        </StrokeText>
        <StrokeText size="S" fontSize={11} color={team.soft} numberOfLines={1}>
          {`Lv ${level}${warp ? ` · ⏩+${warp}d` : ''}`}
        </StrokeText>
      </View>
      <ResourcePill icon={Images.effect.coin} fallback="🪙" value={player?.points ?? 0} label="Coins" coinTarget shine />
      <ResourcePill icon={Images.effect.streak} fallback="🔥" value={player?.streak ?? 0} label="Day streak" />
      <GameImage src={Images.emblem[local.team]} id={`emblem-${local.team}`} size={34} fallback={team.emoji} />
    </View>
  );
}

function Drop({ x, delay }: { x: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1)));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -10 + t.value * 90 }, { rotate: '12deg' }], opacity: 1 - t.value }));
  return <Animated.View style={[styles.drop, { left: `${x}%` }, style]} />;
}

/** Storm Quest banner: purple cloth with the storm cloud, rain and "x2 POINTS!". */
export function StormBanner() {
  const { data } = useStorm();
  const motion = useMotionOK();
  const drops = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ x: (i * 37) % 100, delay: (i * 137) % 900 })), []);
  if (!data?.active) return null;
  return (
    <LinearGradient colors={['#5B48B8', '#3B2F7A']} style={styles.storm}>
      {motion && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {drops.map((d, i) => (
            <Drop key={i} x={d.x} delay={d.delay} />
          ))}
        </View>
      )}
      <GameImage src={Images.moment.storm} id="storm-cloud" size={58} fallback="⛈️" style={{ marginTop: -14, marginBottom: -6 }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <StrokeText size="M" fontSize={19} color={gold.light}>
            STORM QUEST · x2 POINTS!
          </StrokeText>
          <InfoTip
            color={ink.white}
            title="Storm Quest"
            text="Heavy rain is coming (10 mm or more in the next 48 hours, from the Open-Meteo forecast). After heavy rain, sewers can overflow into streams. Checks now are the most useful for scientists, so all points are doubled. Wait until the rain stops and stay away from high water."
          />
        </View>
        <Text style={styles.stormText}>
          After heavy rain, sewers can overflow. Your checks matter most now!
          {data.forced ? ' (Switched on in the Dev Panel.)' : data.rain_mm_48h != null ? ` (${data.rain_mm_48h.toFixed(1)} mm in 48 h)` : ''}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(30,18,8,0.78)',
    borderWidth: 3,
    borderColor: wood.outline,
  },
  avatarFrame: { width: 52, height: 52, borderRadius: 14, borderWidth: 3, backgroundColor: '#FFF3D6', alignItems: 'center', justifyContent: 'center' },
  level: { position: 'absolute', right: -9, bottom: -9, width: 26, height: 26 },
  star: { position: 'absolute', fontSize: 28, lineHeight: 28, top: -2, left: 0, color: gold.base, textShadowColor: ink.stroke, textShadowRadius: 2 },
  storm: { flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden', borderRadius: 16, padding: 10, borderWidth: 3, borderColor: ink.stroke },
  stormText: { color: '#EAE6FF', fontFamily: 'Nunito_700Bold', fontSize: 13, lineHeight: 17 },
  drop: { position: 'absolute', top: 0, width: 2, height: 14, borderRadius: 1, backgroundColor: 'rgba(180,210,255,0.7)' },
});
