import { Text } from 'react-native';

import { displayFont, ink } from '@/theme/tokens';

import { STROKE_SIZES, type StrokeTextProps } from './StrokeText.types';

/** Game title text: white fill, thick dark outline, small drop shadow. Web uses a real CSS text stroke. */
export default function StrokeText({ children, size = 'M', fontSize, color = ink.white, strokeColor = ink.stroke, align, numberOfLines, style, accessibilityLabel }: StrokeTextProps) {
  const base = STROKE_SIZES[size];
  const fs = fontSize ?? base.font;
  const sw = (base.stroke * fs) / base.font;
  return (
    <Text
      numberOfLines={numberOfLines}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          fontFamily: displayFont,
          fontSize: fs,
          lineHeight: fs * 1.15,
          color,
          textAlign: align,
          letterSpacing: 0.4,
          // Stroke drawn behind the fill so the letters keep their shape.
          WebkitTextStroke: `${sw}px ${strokeColor}`,
          paintOrder: 'stroke fill',
          textShadow: `0 ${Math.max(2, sw * 0.6)}px 0 ${strokeColor}`,
        } as object,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
