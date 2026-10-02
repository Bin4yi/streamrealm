import '@/global.css';

import { Cinzel_700Bold, Cinzel_900Black } from '@expo-google-fonts/cinzel';
import { LilitaOne_400Regular } from '@expo-google-fonts/lilita-one';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Asset } from 'expo-asset';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastHost } from '@/components/kit/Effects';
import { Images } from '@/lib/assets';
import { useGame } from '@/lib/store';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Images shown on the first screens, loaded behind the splash. */
const PRELOAD = [
  ...Object.values(Images.emblem),
  ...Object.values(Images.marker),
  ...Object.values(Images.flag),
  ...Object.values(Images.treasure),
  ...Object.values(Images.effect),
  ...Images.plant,
  ...Object.values(Images.onboarding),
  Images.identity.splash,
  Images.identity.bgPattern,
].filter((m): m is number => typeof m === 'number');

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cinzel_700Bold,
    Cinzel_900Black,
    LilitaOne_400Regular,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const hydrated = useGame((s) => s.hydrated);
  const [timedOut, setTimedOut] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  useEffect(() => {
    // A missing or slow image must never block the app: give up waiting after the timeout below.
    Asset.loadAsync(PRELOAD)
      .catch(() => {})
      .finally(() => setImagesReady(true));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const ready = ((fontsLoaded || !!fontError) && hydrated && imagesReady) || timedOut;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bgDeep }} />;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgDeep }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgDeep } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="claim/[tileId]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="dashboard/index" />
        </Stack>
        <ToastHost />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
