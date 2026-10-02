import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { Txt } from '@/components/ui/kit';
import { useEvents, type GameEvent } from '@/lib/api';
import { ago, daysSince } from '@/lib/format';
import { TREASURE_INFO } from '@/lib/gameRules';
import { useGame } from '@/lib/store';
import { teams } from '@/lib/theme';

const VERB: Record<string, string> = {
  claimed: 'claimed land on',
  refreshed: 'refreshed',
  defended: 'defended',
  attack_won: 'won an attack on',
  dispute_started: 'started a dispute on',
  dispute_settled: 'settled a dispute on',
  farming: 're-checked',
};

function text(e: GameEvent) {
  if (e.type === 'join') return `${e.nickname} joined Team ${e.team ? teams[e.team].name : ''}`;
  const t = e.treasure ? ` and found ${TREASURE_INFO[e.treasure].emoji}` : '';
  return `${e.nickname} ${VERB[e.outcome ?? ''] ?? 'checked'} ${e.stream}${t}`;
}

/** Live feed of what other players do, one line at a time. */
export function ActivityTicker() {
  const { data } = useEvents(6);
  const set = useGame((s) => s.set);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), 4500);
    return () => clearInterval(t);
  }, []);
  if (!data?.length) return null;
  const e = data[i % data.length];
  const team = e.team ? teams[e.team] : null;
  return (
    <Animated.View key={e.id} entering={FadeInDown.duration(300)} exiting={FadeOutUp.duration(200)} style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
      <Pressable onPress={() => e.tile_id && set({ selectedTileId: e.tile_id })} style={[styles.pill, team && { borderColor: team.color }]}>
        <Text style={{ fontSize: 13 }}>{team?.emoji ?? '📣'}</Text>
        <Txt v="small" numberOfLines={1} style={{ color: '#E8F1F2', flexShrink: 1 }}>
          {text(e)} · {ago(daysSince(e.created_at))}
        </Txt>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(14,42,51,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
});
