import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors, PHONE_MAX_WIDTH } from '@/lib/theme';

/** On a wide browser window, show game screens as a phone-sized column in the middle. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const framed = Platform.OS === 'web' && width > PHONE_MAX_WIDTH + 40;
  if (!framed) return <View style={{ flex: 1, backgroundColor: colors.bg }}>{children}</View>;
  return (
    <LinearGradient colors={['#06161C', '#0B2830', '#06161C']} style={styles.outer}>
      <View style={styles.frame}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: PHONE_MAX_WIDTH,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 60px rgba(0,0,0,0.6)' } as object) : {}),
  },
});
