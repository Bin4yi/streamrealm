import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ImageBackground, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Images } from '@/lib/assets';
import { world } from '@/theme/tokens';

/** Deep water teal gradient, the tiled water pattern at ~30%, and a soft dark vignette. */
export function WorldBackground({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const pattern = Images.identity.bgPattern;
  return (
    <View style={[{ flex: 1 }, style]}>
      <LinearGradient colors={[world.top, world.bottom]} style={StyleSheet.absoluteFill} />
      {pattern && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ImageBackground source={pattern as never} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: 0.3 }]} />
        </View>
      )}
      {Platform.OS === 'web' ? (
        <View style={[StyleSheet.absoluteFill, { backgroundImage: `radial-gradient(ellipse at center, transparent 55%, ${world.vignette} 100%)` } as object]} pointerEvents="none" />
      ) : (
        <LinearGradient colors={['rgba(3,12,16,0.45)', 'transparent', 'transparent', 'rgba(3,12,16,0.5)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      )}
      {children}
    </View>
  );
}
