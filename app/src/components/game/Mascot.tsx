import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { GameImage } from '@/components/kit';
import { Images } from '@/lib/assets';
import { teams, type TeamId } from '@/lib/theme';
import { useMotionOK } from '@/theme/motion';

export const MASCOT: Record<TeamId, keyof typeof Images.mascot> = { otters: 'otter', frogs: 'frog', kingfishers: 'kingfisher' };

/** Team mascot that gently "breathes" (off with reduced motion). */
export function Mascot({ team, size }: { team: TeamId; size: number }) {
  const motion = useMotionOK();
  const s = useSharedValue(1);
  useEffect(() => {
    if (motion) s.set(withRepeat(withSequence(withTiming(1.03, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1));
    else s.set(1);
  }, [motion, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={a}>
      <GameImage src={Images.mascot[MASCOT[team]]} id={`mascot-${MASCOT[team]}`} size={size} fallback={teams[team].emoji} />
    </Animated.View>
  );
}
