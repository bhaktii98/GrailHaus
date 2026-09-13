import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Category } from "@grailhaus/shared";
import { HomeScreen } from "../screens/HomeScreen";
import { ShelfScreen } from "../screens/ShelfScreen";
import { DropsScreen } from "../screens/DropsScreen";

/**
 * Home replaces the old flat "Shelf" tab with a two-level drill-down, per the
 * mockup's Home → Card World / Watch World structure: the dashboard picks a
 * category, then hands off to a world screen that also carries its own
 * Cards/Watches switch, so a visitor can flip categories from either Home's
 * doors or the switch on the shelf itself. A tier row on the Cards side
 * drills one level further into `PackDetail` — now a root-stack screen (see
 * AppNavigator) since Explore also links into it — for odds, expected
 * value, and a collection preview before a purchase.
 */
export type HomeStackParamList = {
  Home: undefined;
  World: { category: Category };
  /** Was its own tab; now reached from Home's "Upcoming Drops" section — see RootTabs. */
  Drops: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="World" component={ShelfScreen} />
      <Stack.Screen name="Drops" component={DropsScreen} />
    </Stack.Navigator>
  );
}
