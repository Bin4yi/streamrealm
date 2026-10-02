import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ink, ribbon } from '@/theme/tokens';

import StrokeText from './StrokeText';
import type { StrokeSize } from './StrokeText.types';

/** Cloth ribbon banner with folded ends and outlined title text. */
export function RibbonTitle({
  title,
  color = 'red',
  size = 'L',
  style,
}: {
  title: string;
  color?: keyof typeof ribbon;
  size?: StrokeSize;
  style?: StyleProp<ViewStyle>;
}) {
  const c = ribbon[color];
  const h = size === 'XL' ? 58 : size === 'L' ? 48 : 40;
  const tail = h * 0.75;
  return (
    <View style={[styles.row, { height: h + 10 }, style]} accessibilityRole="header">
      <Svg width={tail} height={h} viewBox="0 0 30 40" style={{ marginRight: -tail * 0.45, marginTop: 10 }}>
        <Path d="M30 4 L2 4 L10 20 L2 36 L30 36 Z" fill={c.dark} stroke={ink.stroke} strokeWidth={2.4} strokeLinejoin="round" />
      </Svg>
      <View style={[styles.body, { height: h, backgroundColor: c.base, borderColor: ink.stroke }]}>
        <View style={[styles.shine, { backgroundColor: c.light }]} />
        <StrokeText size={size === 'XL' ? 'L' : size === 'L' ? 'M' : 'S'} fontSize={h * 0.5} align="center" numberOfLines={1}>
          {title}
        </StrokeText>
      </View>
      <Svg width={tail} height={h} viewBox="0 0 30 40" style={{ marginLeft: -tail * 0.45, marginTop: 10 }}>
        <Path d="M0 4 L28 4 L20 20 L28 36 L0 36 Z" fill={c.dark} stroke={ink.stroke} strokeWidth={2.4} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', alignSelf: 'center' },
  body: { zIndex: 1, justifyContent: 'center', paddingHorizontal: 22, borderWidth: 3, borderRadius: 6, minWidth: 140, overflow: 'hidden' },
  shine: { position: 'absolute', left: 0, right: 0, top: 0, height: 8, opacity: 0.6 },
});
