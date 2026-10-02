import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { EmptyState, GameButton } from '@/components/ui/kit';
import { colors } from '@/lib/theme';

export default function Claim() {
  const { tileId } = useLocalSearchParams<{ tileId: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
      <EmptyState icon="📷" title="Stream check" text={`Tile ${tileId}. The check flow comes in the next build.`} />
      <GameButton label="Back to map" onPress={() => router.back()} />
    </View>
  );
}
