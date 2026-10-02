import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinFly, GameButton, GameImage, ResourcePill, RewardBurst, RibbonTitle, StrokeText, WoodPanel } from '@/components/kit';
import { Images } from '@/lib/assets';
import { teams, type TeamId } from '@/lib/theme';
import { spring, useMotionOK } from '@/theme/motion';
import { gold, parchment } from '@/theme/tokens';

export type VictoryResult = {
  outcome: string;
  points: number;
  player_points: number;
  breakdown: { label: string; points: number }[];
  streak: number;
  confirmed_previous: boolean;
  animation: { type: 'paint' | 'clash'; team: TeamId; points: number };
};

const TITLES: Record<string, string> = {
  claimed: 'TILE CONQUERED!',
  refreshed: 'LAND REFRESHED!',
  defended: 'LAND DEFENDED!',
  attack_won: 'ATTACK WON!',
  dispute_started: 'DISPUTE!',
  dispute_settled: 'DISPUTE SETTLED!',
  farming: 'THANKS!',
};

/**
 * Victory moment: rays + trophy springing in, ribbon title, team-tinted conquered tile,
 * big "+50", coins flying to the coin pill, a short shake for attacks.
 */
export function VictoryScreen({ result, streamName, myTeam, onDone }: { result: VictoryResult; streamName: string; myTeam: TeamId; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const motion = useMotionOK();
  const clash = result.outcome === 'dispute_started';
  const team = teams[result.animation.team] ?? teams[myTeam];
  const [coins, setCoins] = useState(Math.max(0, result.player_points - result.points));
  const [fly, setFly] = useState(false);
  const pop = useSharedValue(0);
  const shake = useSharedValue(0);
  const pts = useSharedValue(0);

  useEffect(() => {
    pop.set(withSequence(withTiming(0, { duration: 0 }), withSpring(1.12, { damping: 8, stiffness: 220 }), withSpring(1, spring.soft)));
    pts.set(withDelay(500, withSpring(1, spring.pop)));
    if (motion && (result.outcome === 'attack_won' || clash)) {
      shake.set(withDelay(250, withSequence(...[10, -10, 7, -7, 4, 0].map((x) => withTiming(x, { duration: 55 })))));
    }
    const t = setTimeout(() => setFly(result.points > 0), 900);
    return () => clearTimeout(t);
  }, [pop, pts, shake, motion, clash, result.outcome, result.points]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const ptsStyle = useAnimatedStyle(() => ({ opacity: pts.value, transform: [{ scale: 0.5 + pts.value * 0.5 }] }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const per = result.points / 10;

  const texts: Record<string, string> = {
    claimed: `This piece of ${streamName} now belongs to Team ${teams[myTeam].name}.`,
    refreshed: 'Your team keeps this land fresh for 7 more days.',
    defended: 'It was fading. You saved it just in time!',
    attack_won: 'Your check agrees with the last one, so the tile is now yours.',
    dispute_started: 'Your answers do not match the last check. A third player will decide. If they agree with you, you win +30.',
    dispute_settled: 'Your check broke the tie. The side that agrees with you wins.',
    farming: 'You checked this tile less than 6 hours ago, so no points this time. The data still helps!',
  };

  return (
    <Animated.View style={[styles.wrap, { paddingTop: insets.top + 8 }, shakeStyle]}>
      <View style={{ alignItems: 'flex-end' }}>
        <ResourcePill icon={Images.effect.coin} fallback="🪙" value={coins} label="Coins" coinTarget />
      </View>
      <RewardBurst size={250} rayColor={clash ? '#E58AC0' : gold.light}>
        <Animated.View style={popStyle}>
          <GameImage src={clash ? Images.marker.disputed : Images.moment.victory} id={clash ? 'marker-disputed' : 'victory-banner'} size={170} fallback={clash ? '⚔️' : '🏆'} />
        </Animated.View>
      </RewardBurst>
      <RibbonTitle title={TITLES[result.outcome] ?? 'DONE!'} color={clash ? 'red' : result.outcome === 'farming' ? 'blue' : 'green'} size="XL" style={{ marginTop: -24 }} />
      <View style={styles.row}>
        {!clash && result.outcome !== 'farming' && (
          <GameImage src={Images.conquered[result.animation.team]} id="tile-conquered" size={86} fallback={team.emoji} />
        )}
        <Animated.View style={ptsStyle}>
          <StrokeText size="XL" fontSize={58} color={gold.base}>
            {`+${result.points}`}
          </StrokeText>
        </Animated.View>
      </View>
      <WoodPanel>
        <Text style={styles.body}>{texts[result.outcome]}</Text>
        {result.confirmed_previous && <Text style={[styles.body, { color: '#2E7D32', marginTop: 6 }]}>✅ Independent check: you confirmed another player&apos;s data.</Text>}
        <View style={styles.divider} />
        {result.breakdown.map((b) => (
          <View key={b.label} style={styles.line}>
            <Text style={[styles.body, { flex: 1 }]}>{b.label}</Text>
            <Text style={styles.pts}>+{b.points}</Text>
          </View>
        ))}
        {result.streak > 1 && <Text style={[styles.body, { marginTop: 4 }]}>🔥 {result.streak}-day streak!</Text>}
      </WoodPanel>
      <GameButton label="BACK TO MAP" size="L" onPress={onDone} testID="victory-done" style={{ marginTop: 12 }} />
      {fly && <CoinFly from={{ x: 200, y: 420 }} count={10} onLand={() => setCoins((c) => Math.min(result.player_points, Math.round(c + per)))} onDone={() => setCoins(result.player_points)} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 4, backgroundColor: 'rgba(5,12,16,0.55)' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginVertical: 4 },
  body: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: parchment.text, lineHeight: 21 },
  divider: { height: 2, backgroundColor: parchment.line, marginVertical: 8, borderRadius: 1 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  pts: { fontFamily: 'LilitaOne_400Regular', fontSize: 18, color: '#9A6A00' },
});
