import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { ImageAlt } from '@/lib/assets';

/**
 * An image from the Images registry with an emoji fallback.
 * If the asset is missing (null in the registry) or fails to load, the emoji shows instead,
 * so a missing file can never crash the app.
 */
export function GameImage({
  src,
  id,
  size = 48,
  width,
  height,
  fallback = '✨',
  style,
  label,
}: {
  src: ImageSourcePropType | null | undefined;
  /** Asset id for the accessibility label, e.g. "emblem-otters". */
  id?: string;
  size?: number;
  width?: number;
  height?: number;
  fallback?: string;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  const w = width ?? size;
  const h = height ?? size;
  const a11y = label ?? (id ? ImageAlt[id] : undefined);
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <View style={[{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }, style]} accessible accessibilityRole="image" accessibilityLabel={a11y}>
        <Text style={{ fontSize: Math.min(w, h) * 0.62 }}>{fallback}</Text>
      </View>
    );
  }
  return (
    <View style={[{ width: w, height: h }, style]}>
      <Image
        source={src as never}
        style={{ width: w, height: h }}
        contentFit="contain"
        cachePolicy="memory-disk"
        accessibilityLabel={a11y}
        accessible={!!a11y}
        transition={120}
        onError={() => setFailed(true)}
      />
    </View>
  );
}
