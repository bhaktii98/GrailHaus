import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useFocusEffect } from "@react-navigation/native";
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
 * For a detail screen nested in a tab's own stack (e.g. WatchDetail/CardDetail under Portfolio)
 * that should read as a full, chrome-free detail view rather than a peer of the tab's own list
 * screen — same treatment PackDetail/DropDetail/VaultDetail/ItemFork already get for free by
 * being root-stack siblings of `Tabs` itself (pushing over them hides the whole tab tree,
 * bar included). Those nested detail screens don't get that for free since they're still inside
 * the tab's own stack, so this hides the bar for as long as the screen stays focused, and
 * restores it the moment focus leaves (back to the list, or a tab switch) rather than leaving it
 * hidden behind whatever's navigated to next. Use `insets.bottom` (not `useTabBarClearance`) for
 * this screen's own bottom clearance once there's no bar left to reserve room for.
 */
export function useHideTabBarWhileFocused() {
  const hidden = useTabBarHidden();
  useFocusEffect(
    useCallback(() => {
      hidden.value = withTiming(1, { duration: 200 });
      return () => {
        hidden.value = withTiming(0, { duration: 200 });
      };
    }, [hidden])
  );
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
