import { View } from 'react-native';

import { EmptyState } from '@/components/ui/kit';
import { colors } from '@/lib/theme';

export default function Screen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
      <EmptyState icon="🚧" title="Coming soon" text="This screen is being built." />
    </View>
  );
}
