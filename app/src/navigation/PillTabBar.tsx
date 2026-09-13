import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import type { RootTabParamList } from "./RootTabs";
import { accents, fonts, ink } from "../theme/tokens";
import { TAB_BAR_HEIGHT, useTabBarHidden } from "./tabBarVisibility";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** One glyph per tab (Ionicons' filled/outline pair — filled while active, outline at rest),
 * matched to what each tab actually does rather than a generic placeholder: Home is the
 * dashboard, Discover browses the shared cards+watches catalog, Portfolio is your holdings,
 * Marketplace is peer resale. (Drops — the time-limited live releases — moved off the tab bar,
 * and Explore is parked as redundant with Discover; see RootTabs for both.) */
const TAB_ICON: Record<keyof RootTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: "home", inactive: "home-outline" },
  Discover: { active: "compass", inactive: "compass-outline" },
  // Explore's bag stayed visually distinct from Marketplace's storefront — GrailHaus's own
  // shop vs. buying from other collectors — if the tab is ever restored.
  // Explore: { active: "bag-handle", inactive: "bag-handle-outline" },
  Portfolio: { active: "briefcase", inactive: "briefcase-outline" },
  Marketplace: { active: "storefront", inactive: "storefront-outline" },
};

/** The floating pill nav: every tab shows its icon and its name at all times — the active one
 * additionally gets a gradient chip behind it, so which tab you're on still reads at a glance
 * without depending on label-visibility alone to say so.
 *
 * Slides down and fades out while a screen is scrolled down, and back on scroll-up — see
 * tabBarVisibility.ts for the shared value driving this. A frosted-glass surface (BlurView) plus
 * a per-tab spring press for a bit of tactile feedback (matching GlossyButton's press-spring
 * elsewhere in the app) round out the rest of the surface.
 *
 * `position: "absolute"` here is load-bearing: react-navigation's
 * bottom-tabs otherwise lays this component out as a normal flex sibling
 * above the screen content, reserving its own row painted in the
 * navigator's flat background color — a rectangle that doesn't match
 * whatever the active screen actually looks like, sitting behind the
 * "floating" pill and defeating the point of it. Taking this out of flow
 * lets the screen's own content extend all the way to the bottom of the
 * viewport, so there's nothing back there but that content — the pill
 * genuinely floats over it. (Screens are responsible for their own bottom
 * clearance via `useTabBarClearance()` so their last row isn't permanently
 * covered by the pill at rest.) */
export function PillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const hidden = useTabBarHidden();
  const bottomPad = Math.max(insets.bottom, 16);
  // Clears the pill's own footprint plus a little extra so it's fully off-screen (not just
  // invisible) once hidden, and can't intercept touches meant for the content behind it.
  const hideDistance = TAB_BAR_HEIGHT + bottomPad + 24;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hidden.value * hideDistance }],
    opacity: 1 - hidden.value,
  }));

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: bottomPad }, animatedStyle]}>
      <View style={styles.barShadow}>
        <BlurView intensity={62} tint="dark" style={styles.bar}>
          <View style={styles.barTint} pointerEvents="none" />
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = (options.tabBarLabel ?? options.title ?? route.name) as string;
            const isFocused = state.index === index;
            const icon = TAB_ICON[route.name as keyof RootTabParamList];

            function onPress() {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
            }

            return <TabSlot key={route.key} label={label} icon={icon} isFocused={isFocused} onPress={onPress} />;
          })}
        </BlurView>
      </View>
    </Animated.View>
  );
}

function TabSlot({
  label,
  icon,
  isFocused,
  onPress,
}: {
  label: string;
  icon: { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap };
  isFocused: boolean;
  onPress: () => void;
}) {
  const press = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => (press.value = withSpring(0.9, { damping: 14, stiffness: 300 }))}
      onPressOut={() => (press.value = withSpring(1, { damping: 12, stiffness: 220 }))}
      style={[styles.tabWrap, pressStyle]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
    >
      {isFocused ? (
        <LinearGradient colors={[accents.cards.top, accents.cards.bottom]} style={styles.tabActive}>
          <Ionicons name={icon.active} size={21} color={ink.text} />
          <Text style={styles.labelActive} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {label}
          </Text>
        </LinearGradient>
      ) : (
        <View style={styles.tabInactive}>
          <Ionicons name={icon.inactive} size={20} color="rgba(255,255,255,0.58)" />
          <Text style={styles.labelInactive} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {label}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18 },
  // Shadow and blur can't share a layer in RN — a blurred/clipped view can't also cast a soft
  // shadow (overflow:hidden clips it) — so the shadow lives on this wrapper and the blur/border/
  // clip live on the BlurView itself.
  barShadow: {
    borderRadius: 26,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 14,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  // BlurView's own tint washes out this app's near-black palette toward mid-grey — a thin dark
  // veil over the blur keeps the glass effect while staying close to `ink.card`'s original depth.
  barTint: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(8,4,16,0.92)" },
  tabWrap: { flex: 1, paddingVertical: 5 },
  tabActive: {
    height: TAB_BAR_HEIGHT - 10,
    borderRadius: 20,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 4,
    shadowColor: accents.cards.glow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 6,
  },
  tabInactive: {
    height: TAB_BAR_HEIGHT - 10,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 4,
  },
  labelActive: { fontFamily: fonts.extrabold, fontSize: 9.5, letterSpacing: 0.1, color: ink.text },
  labelInactive: { fontFamily: fonts.semibold, fontSize: 9.5, letterSpacing: 0.1, color: "rgba(255,255,255,0.5)" },
});
