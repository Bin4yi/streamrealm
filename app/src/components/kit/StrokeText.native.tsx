import { StyleSheet, Text, View } from 'react-native';

import { displayFont, ink } from '@/theme/tokens';

import { STROKE_SIZES, type StrokeTextProps } from './StrokeText.types';

const OFFSETS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/** Game title text: native has no text stroke, so 8 dark copies are layered behind the white one. */
export default function StrokeText({ children, size = 'M', fontSize, color = ink.white, strokeColor = ink.stroke, align, numberOfLines, style, accessibilityLabel }: StrokeTextProps) {
  const base = STROKE_SIZES[size];
  const fs = fontSize ?? base.font;
  const sw = Math.max(1.5, (base.stroke * fs) / base.font / 2);
  const text = { fontFamily: displayFont, fontSize: fs, lineHeight: fs * 1.15, textAlign: align, letterSpacing: 0.4 } as const;
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={{ alignSelf: align === 'center' ? 'center' : undefined }}>
      {OFFSETS.map(([x, y], i) => (
        <Text key={i} numberOfLines={numberOfLines} style={[text, style, styles.layer, { color: strokeColor, transform: [{ translateX: x * sw }, { translateY: y * sw + sw * 0.6 }] }]} aria-hidden>
          {children}
        </Text>
      ))}
      <Text numberOfLines={numberOfLines} style={[text, style, { color }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ layer: { position: 'absolute', left: 0, right: 0, top: 0 } });
