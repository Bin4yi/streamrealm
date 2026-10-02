/** Clean, light "science" theme for the dashboard (deliberately not game-styled). */
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { fonts } from '@/lib/theme';

export const d = {
  page: '#F3F4F2',
  surface: '#FCFCFB',
  border: '#E3E2DE',
  ink: '#0B0B0B',
  ink2: '#52514E',
  muted: '#7D7C77',
  grid: '#E9E8E4',
  accent: '#2A78D6',
  // Categorical slots (validated): 1 blue, 2 orange, 3 aqua.
  s1: '#2A78D6',
  s2: '#EB6834',
  s3: '#1BAF7A',
  good: '#0CA30C',
  warning: '#B57E00',
  serious: '#C2541F',
  critical: '#C4302B',
  dispute: '#A1316D',
};

export function DText({ v = 'body', style, children, numberOfLines }: { v?: 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'kpi' | 'hero'; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[ts[v], style]}>
      {children}
    </Text>
  );
}

const ts = StyleSheet.create({
  h1: { fontFamily: fonts.bodyBlack, fontSize: 22, color: d.ink },
  h2: { fontFamily: fonts.bodyBlack, fontSize: 17, color: d.ink },
  h3: { fontFamily: fonts.bodyBold, fontSize: 14, color: d.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: d.ink },
  small: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 17, color: d.ink2 },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, color: d.ink2 },
  kpi: { fontFamily: fonts.bodyBlack, fontSize: 26, color: d.ink },
  hero: { fontFamily: fonts.bodyBlack, fontSize: 52, color: d.ink, lineHeight: 58 },
});

export function Panel({ title, right, children, style }: { title?: string; right?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.panel, style]}>
      {(title || right) && (
        <View style={styles.panelHead}>
          {title ? (
            <DText v="h2" style={{ flex: 1 }}>
              {title}
            </DText>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function DButton({
  label,
  onPress,
  kind = 'default',
  disabled,
  small,
  testID,
}: {
  label: string;
  onPress?: () => void;
  kind?: 'default' | 'primary' | 'good' | 'danger' | 'active';
  disabled?: boolean;
  small?: boolean;
  testID?: string;
}) {
  const bg = { default: d.surface, primary: d.accent, good: d.good, danger: d.critical, active: '#E3EEFB' }[kind];
  const fg = kind === 'default' || kind === 'active' ? d.ink : '#FFFFFF';
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, borderColor: kind === 'default' ? d.border : kind === 'active' ? d.accent : bg },
        Platform.OS === 'web' ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as ViewStyle) : null,
      ]}
    >
      <Text style={[styles.btnText, { color: fg }, small && { fontSize: 12 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: d.surface, borderRadius: 12, borderWidth: 1, borderColor: d.border, padding: 16, gap: 12 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { minHeight: 36, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { minHeight: 30, paddingHorizontal: 10 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 13 },
});
