import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { Row, Txt } from '@/components/ui/kit';
import { FADING_DAYS, FRESH_DAYS } from '@/lib/gameRules';
import { colors, radius, shadow, space, teamIds, teams } from '@/lib/theme';

function Swatch({ color, pattern, dashed, faded }: { color: string; pattern?: 'dots' | 'dashes'; dashed?: boolean; faded?: boolean }) {
  return (
    <Svg width={46} height={14}>
      {!dashed && <Line x1={4} x2={42} y1={7} y2={7} stroke={color} strokeWidth={9} strokeLinecap="round" opacity={faded ? 0.5 : 1} />}
      {dashed && <Line x1={4} x2={42} y1={7} y2={7} stroke={color} strokeWidth={8} strokeDasharray="7 5" />}
      {pattern === 'dots' && <Line x1={6} x2={42} y1={7} y2={7} stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeDasharray="0.1 7" />}
      {pattern === 'dashes' && <Line x1={6} x2={42} y1={7} y2={7} stroke="#fff" strokeWidth={2.5} strokeDasharray="6 5" />}
    </Svg>
  );
}

export function MapLegend({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: [React.ReactNode, string, string][] = [
    [<Swatch key="f" color={colors.fog} dashed />, 'Fog', 'Never checked. Explore it for +50.'],
    [<Swatch key="n" color={colors.neutral} />, 'Free land', `Last check over ${FADING_DAYS} days ago. Anyone can claim it.`],
    [<Swatch key="fa" color={teams.otters.color} faded />, 'Fading', `Checked ${FRESH_DAYS}-${FADING_DAYS} days ago. It pulses. Defend it!`],
    [<Text key="d" style={{ fontSize: 18, width: 46, textAlign: 'center' }}>⚔️</Text>, 'Disputed', 'Two checks disagree. A third player decides.'],
    [<Text key="t" style={{ fontSize: 18, width: 46, textAlign: 'center' }}>💎</Text>, 'Treasure', 'Pipe, trash, wildlife, plant or algae found here.'],
    [<Text key="u" style={{ fontSize: 18, width: 46, textAlign: 'center' }}>⚠️</Text>, 'Unsafe', 'Scientists closed this tile. Do not check it.'],
    [<Text key="h" style={{ fontSize: 18, width: 46, textAlign: 'center' }}>✨</Text>, 'Healed', 'A reported problem here was fixed.'],
  ];
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.card, shadow]}>
          <ScrollView contentContainerStyle={{ gap: space.sm }}>
            <Txt v="h2">Map legend</Txt>
            <Txt v="tiny">Teams</Txt>
            {teamIds.map((t) => (
              <Row key={t}>
                <Swatch color={teams[t].color} pattern={t === 'frogs' ? 'dots' : t === 'kingfishers' ? 'dashes' : undefined} />
                <Txt v="label" style={{ width: 96 }}>
                  {teams[t].emoji} {teams[t].name}
                </Txt>
                <Txt v="small">{t === 'otters' ? 'solid line' : t === 'frogs' ? 'line with dots' : 'line with dashes'}</Txt>
              </Row>
            ))}
            <Txt v="tiny" style={{ marginTop: space.sm }}>
              Land
            </Txt>
            {rows.map(([icon, label, text]) => (
              <Row key={label} style={{ alignItems: 'flex-start' }}>
                {icon}
                <View style={{ flex: 1 }}>
                  <Txt v="label">{label}</Txt>
                  <Txt v="small">{text}</Txt>
                </View>
              </Row>
            ))}
            <Txt v="small" style={{ marginTop: space.sm, textAlign: 'right' }}>
              Tap to close
            </Txt>
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { maxWidth: 400, width: '100%', maxHeight: '85%', backgroundColor: colors.cardSolid, borderRadius: radius.lg, padding: space.xl, borderWidth: 1, borderColor: colors.cardBorder },
});
