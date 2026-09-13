import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Category } from "@grailhaus/shared";
import { RootTabs } from "./RootTabs";
import { DropDetailScreen } from "../screens/DropDetailScreen";
import { PackDetailScreen } from "../screens/PackDetailScreen";
import { VaultDetailScreen } from "../screens/VaultDetailScreen";
import { RevealScreen } from "../screens/RevealScreen";
import { ItemForkScreen } from "../screens/discover/ItemForkScreen";
import type { DiscoverItem } from "../viewmodels/useDiscoverViewModel";

/**
 * Root stack above the tab bar — exists so Drop Detail, Pack Detail, Vault
 * Detail, Item Fork, and the Reveal flow are each reachable from wherever a
 * purchase or catalog browse can start (Home, Explore, Drops, Discover)
 * without duplicating the screen per entry point. React Navigation bubbles
 * an unrecognised route name up through parent navigators, so
 * `navigate("DropDetail"/"PackDetail"/"VaultDetail"/"ItemFork"/"Reveal", ...)`
 * from any tab resolves here regardless of how deep it's called from. Reveal
 * used to be its own tab, but it's only ever meaningful mid-purchase — as a
 * pushed screen it now pops back to wherever the buy happened once the
 * summary's "done" is tapped, instead of leaving an idle empty tab.
 */
export type AppStackParamList = {
  Tabs: undefined;
  DropDetail: { packId: string };
  PackDetail: { skuId: string };
  VaultDetail: { skuId: string };
  ItemFork: { category: Category; item: DiscoverItem };
  Reveal: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={RootTabs} />
      <Stack.Screen name="DropDetail" component={DropDetailScreen} />
      <Stack.Screen name="PackDetail" component={PackDetailScreen} />
      <Stack.Screen name="VaultDetail" component={VaultDetailScreen} />
      <Stack.Screen name="ItemFork" component={ItemForkScreen} />
      <Stack.Screen name="Reveal" component={RevealScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
