import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { withTiming } from "react-native-reanimated";
import { HomeStack } from "./HomeStack";
// import { ExploreScreen } from "../screens/ExploreScreen";
import { CollectionStack } from "./CollectionStack";
import { MarketplaceStack } from "./MarketplaceStack";
import { DiscoverStack } from "./DiscoverStack";
import { PillTabBar } from "./PillTabBar";
import { TabBarVisibilityProvider, useTabBarHidden } from "./tabBarVisibility";
import { colors, typography } from "../theme/tokens";

/** Drops used to be its own tab, but five items already crowds the floating pill bar (its
 * reference design — rn/src/components/TabBar.js — was built for four) — see HomeStack for
 * where DropsScreen lives now: pushed from Home's "Upcoming Drops" section, not a tab root. */
export type RootTabParamList = {
  Home: undefined;
  Discover: undefined;
  /** Explore is parked: it browsed the same catalog Discover does, so keeping both was
   * redundant shelf space in a four-slot bar. Screen and view model still exist — uncomment
   * the route below (plus PillTabBar's icon entry) to bring the tab back. */
  // Explore: undefined;
  Portfolio: undefined;
  Marketplace: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootTabs() {
  return (
    <TabBarVisibilityProvider>
      <RootTabsInner />
    </TabBarVisibilityProvider>
  );
}

function RootTabsInner() {
  const hidden = useTabBarHidden();

  return (
    <Tab.Navigator
      tabBar={(props) => <PillTabBar {...props} />}
      // Switching tabs always brings the bar back — landing on a fresh
      // screen with the nav chrome hidden from a scroll position on the
      // previous tab would be disorienting.
      screenListeners={{
        tabPress: () => {
          hidden.value = withTiming(0, { duration: 200 });
        },
      }}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgElevated },
        headerTitleStyle: { ...typography.title, color: colors.textPrimary },
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeStack} options={{ headerShown: false }} />
      <Tab.Screen name="Discover" component={DiscoverStack} options={{ headerShown: false }} />
      {/* <Tab.Screen name="Explore" component={ExploreScreen} options={{ headerShown: false }} /> */}
      <Tab.Screen name="Portfolio" component={CollectionStack} options={{ headerShown: false }} />
      <Tab.Screen name="Marketplace" component={MarketplaceStack} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}
