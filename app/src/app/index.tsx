import { Redirect } from 'expo-router';

import { useGame } from '@/lib/store';

export default function Index() {
  const player = useGame((s) => s.player);
  return <Redirect href={player ? '/map' : '/onboarding'} />;
}
