import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useSharedValue, useAnimatedScrollHandler, withTiming, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** The pill's own height — shared with PillTabBar.tsx so the two can never drift apart. */
export const TAB_BAR_HEIGHT = 62;

const TabBarHiddenContext = createContext<SharedValue<number> | null>(null);

/** Wraps the tab navigator so any scrollable screen inside it can hide/show
 * the floating pill tab bar in response to scroll direction — one shared
 * value (0 = shown, 1 = hidden), read by PillTabBar and written by every
 * screen's scroll handler below. */
export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const hidden = useSharedValue(0);
  return <TabBarHiddenContext.Provider value={hidden}>{children}</TabBarHiddenContext.Provider>;
}

export function useTabBarHidden(): SharedValue<number> {
  const ctx = useContext(TabBarHiddenContext);
  if (!ctx) throw new Error("useTabBarHidden must be used within TabBarVisibilityProvider");
  return ctx;
}

/** Below this much scroll delta in one update, don't react — otherwise the
 * tiny deltas FlatList/ScrollView emit while momentum-settling flicker the
 * bar in and out. */
const SCROLL_DELTA_THRESHOLD = 6;

/**
 * The pill nav floats over screen content (`position: "absolute"` in
 * PillTabBar) rather than reserving its own row, so any screen with content
 * that can reach the bottom of the viewport needs this much extra bottom
 * padding/margin to keep that content from sitting underneath the pill.
 *
 * The hidden/shown flag this clearance is sized around is one value shared
 * across the whole tab tree (see `TabBarVisibilityProvider` above) — if a
 * previous screen scrolled down and hid the bar, and this screen never wires
 * `useHideTabBarOnScroll` itself (most detail screens don't scroll enough to
 * need it), that hidden state otherwise persists here with nothing to clear
 * it, leaving this exact amount of reserved space empty with no bar in it —
 * scrolled content ends up visible underneath whatever's anchored to this
 * clearance instead. Forcing the bar back to shown on every focus means any
 * screen calling this always gets the space it asked for actually filled;
 * a screen that separately wants scroll-driven hiding still gets it the
 * moment the user actually scrolls, since that handler runs after this. */
export function useTabBarClearance(extraGap = 24) {
  const insets = useSafeAreaInsets();
  const hidden = useTabBarHidden();
  useFocusEffect(
    useCallback(() => {
      hidden.value = withTiming(0, { duration: 200 });
    }, [hidden])
  );
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 16) + extraGap;
}

/**
 * Suppresses the floating pill nav for as long as this screen is focused, restoring it on the
 * way out. For pushed screens that own a bottom action bar ("Sell", "Buy now", "Confirm"): the
 * pill is a *root-level* destination switcher, so leaving it up on a leaf screen both competes
 * with that screen's primary action and forces the action to float a nav-bar's height above the
 * bottom edge — the thing that reads as broken. Such a screen is exited via its own back
 * affordance, not by tab-hopping mid-task.
 *
 * Pairs with `useActionBarPadding()` below, which gives the now-unobstructed footer plain
 * safe-area padding instead of `useTabBarClearance()`'s tab-sized gap.
 *
 * Safe on screens outside the tab navigator (the root stack's PackDetail/VaultDetail/ItemFork):
 * there's no provider there, so this no-ops rather than throwing.
 */
export function useHideTabBarOnScreen() {
  const hidden = useContext(TabBarHiddenContext);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!hidden || !isFocused) return;
    // Instant on the way in — animating it out would race the push transition and show the pill
    // sliding away after the new screen has already landed.
    hidden.value = 1;
    return () => {
      hidden.value = withTiming(0, { duration: 200 });
    };
  }, [hidden, isFocused]);
}

/**
 * Bottom padding for an action bar on a screen that has *no* tab bar over it — either because
 * it called `useHideTabBarOnScreen()` or because it lives on the root stack above the tabs.
 * Just the home-indicator inset plus a small breathing gap, so the primary action sits where
 * the thumb expects it: at the bottom of the screen.
 */
export function useActionBarPadding(extraGap = 12) {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + extraGap;
}

/**
 * Attach to any scrollable screen's `onScroll` (via `Animated.ScrollView` /
 * `Animated.FlatList` from `react-native-reanimated`, with
 * `scrollEventThrottle={16}`) to drive the shared tab bar in and out of view:
 * scrolling down past the threshold hides it, scrolling up — or being at the
 * very top — brings it back.
 */
export function useHideTabBarOnScroll() {
  const hidden = useTabBarHidden();
  const lastY = useSharedValue(0);

  return useAnimatedScrollHandler({
    onScroll: (event) => {
      "worklet";
      const y = event.contentOffset.y;
      const delta = y - lastY.value;
      if (y <= 0) {
        hidden.value = withTiming(0, { duration: 200 });
      } else if (delta > SCROLL_DELTA_THRESHOLD) {
        hidden.value = withTiming(1, { duration: 200 });
      } else if (delta < -SCROLL_DELTA_THRESHOLD) {
        hidden.value = withTiming(0, { duration: 200 });
      }
      lastY.value = y;
    },
  });
}
