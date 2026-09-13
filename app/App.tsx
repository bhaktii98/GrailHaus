import { useCallback, useEffect, useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
} from "@expo-google-fonts/outfit";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { navigationRef, navigateToReveal } from "./src/navigation/navigationRef";
import { TitleScreen } from "./src/screens/TitleScreen";
import { OnboardingCarousel } from "./src/screens/onboarding/OnboardingCarousel";
import { queryClient } from "./src/state/queryClient";
import { useOnboardingStore } from "./src/state/onboardingStore";
import { useAuthStore } from "./src/state/authStore";
import { AuthProvider } from "./src/providers/AuthProvider";
import { ShaderWarmup } from "./src/engine/core/ShaderWarmup";
import { colors } from "./src/theme/tokens";
import { usePackFlowStore } from "./src/state/packFlowStore";
import { initSfx } from "./src/lib/sfx";

SplashScreen.preventAutoHideAsync().catch(() => {});

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.textPrimary,
    border: colors.outlineSoft,
    primary: colors.violetTop,
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });
  const needsOnboardingFlag = useOnboardingStore((s) => s.needsOnboarding);
  const setNeedsOnboarding = useOnboardingStore((s) => s.setNeedsOnboarding);
  // The title screen (mockup turn 10) is a game-style launch beat shown every cold start, not
  // a one-time flag — it's session-only state, unlike onboarding's persisted "seen it" flag.
  const [started, setStarted] = useState(false);
  // AuthProvider (mounted below, unconditionally) hydrates both of these from the token
  // persisted in SecureStore — see providers/AuthProvider.tsx. `isReady` here waits for that
  // hydration too, so the onboarding-vs-home decision never runs against a still-unknown session.
  const token = useAuthStore((s) => s.token);
  const authReady = useAuthStore((s) => s.isReady);

  useEffect(() => {
    // Onboarding is gated purely on sign-in state (see `showOnboarding` below), not on any
    // device-persisted "seen it" flag — a signed-out user should see it every time they open
    // the app, not just once ever, so this always starts true rather than reading from disk.
    setNeedsOnboarding(true);
  }, [setNeedsOnboarding]);

  useEffect(() => {
    initSfx();
  }, []);

  const isReady = fontsLoaded && needsOnboardingFlag !== null && authReady;

  const onLayout = useCallback(async () => {
    if (isReady) await SplashScreen.hideAsync();
  }, [isReady]);

  useEffect(() => {
    onLayout();
  }, [onLayout]);

  // A restored session token means this is a returning, already-known user — send them
  // straight to Home. Onboarding is only ever for someone who isn't signed in yet, and shows
  // again every time they open the app in that state (see the effect above).
  const showOnboarding = !token && needsOnboardingFlag;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          {/* TEMP: commented out to test whether it's causing the blank-screen-on-fresh-install
              issue — mounting a GL Canvas this early (before fonts/auth resolve) is untested. */}
          {/* <ShaderWarmup /> */}
          {/* Mounted unconditionally (not just around AppNavigator) so its token hydration —
              what `isReady`/`showOnboarding` above depend on — always runs, even while the
              splash/onboarding gate above is still deciding what to show first. */}
          <AuthProvider>
            {!isReady ? null : !started ? (
              <TitleScreen onStart={() => setStarted(true)} />
            ) : showOnboarding ? (
              <OnboardingCarousel onFinish={() => setNeedsOnboarding(false)} />
            ) : (
              <NavigationContainer
                ref={navigationRef}
                theme={navTheme}
                onReady={() => {
                  // Covers the race where AuthProvider's boot-time reveal resume (see
                  // providers/AuthProvider.tsx) finishes and populates packFlowStore *before*
                  // this container exists to navigate on — `navigateToReveal` there was a no-op
                  // in that case. `resumedToSummary`/`resumedOpenedCount` are only ever
                  // set for a disk-restored flow (see state/packFlowStore.ts), never a normal
                  // fresh purchase, so this can't accidentally hijack a purchase that's genuinely
                  // starting fresh right now. Checking both (not just `resumedToSummary`) is what
                  // makes a partial-progress resume (lands on card 3 of 5, not the pack's summary)
                  // actually navigate here too, instead of silently resuming state nobody sees.
                  const state = usePackFlowStore.getState();
                  if (state.resumedToSummary || state.resumedOpenedCount != null) navigateToReveal();
                }}
              >
                <AppNavigator />
              </NavigationContainer>
            )}
          </AuthProvider>
          <StatusBar style="light" />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
