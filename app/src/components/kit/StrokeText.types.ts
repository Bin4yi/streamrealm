import type { StyleProp, TextStyle } from 'react-native';

export type StrokeSize = 'S' | 'M' | 'L' | 'XL';
export const STROKE_SIZES: Record<StrokeSize, { font: number; stroke: number }> = {
  S: { font: 15, stroke: 3 },
  M: { font: 20, stroke: 4 },
  L: { font: 28, stroke: 5 },
  XL: { font: 40, stroke: 7 },
};

export type StrokeTextProps = {
  children: React.ReactNode;
  size?: StrokeSize;
  /** Override font size (stroke scales with it). */
  fontSize?: number;
  color?: string;
  strokeColor?: string;
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};
