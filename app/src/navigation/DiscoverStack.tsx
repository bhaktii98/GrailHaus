import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Category } from "@grailhaus/shared";
import { DiscoverScreen } from "../screens/discover/DiscoverScreen";
import { DiscoverCategoryScreen } from "../screens/discover/DiscoverCategoryScreen";
import { VersionsScreen } from "../screens/discover/VersionsScreen";
import { CollectionsScreen } from "../screens/discover/CollectionsScreen";
import { CollectionDetailScreen } from "../screens/discover/CollectionDetailScreen";
import type { DiscoverGroup, DiscoverItem } from "../viewmodels/useDiscoverViewModel";

/** ItemFork now lives on the root stack (see AppNavigator) since Explore
 * also links into it, not just Discover's own drill-down. */
export type DiscoverStackParamList = {
  Discover: undefined;
  /** `autoFocusSearch` — set when arriving from the Discover hub's own search bar, so the
   * keyboard is already up rather than landing on an unfiltered browse list. */
  DiscoverCategory: { category: Category; autoFocusSearch?: boolean };
  Versions: { category: Category; group: DiscoverGroup };
  /** The Discover hub's third door (cross-category) and each category hub's own
   * "Collections" facet both land here — see CollectionDetailScreen.tsx. */
  Collections: undefined;
  CollectionDetail: { title: string; items: DiscoverItem[] };
};

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

export function DiscoverStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Discover" component={DiscoverScreen} />
      <Stack.Screen name="DiscoverCategory" component={DiscoverCategoryScreen} />
      <Stack.Screen name="Versions" component={VersionsScreen} />
      <Stack.Screen name="Collections" component={CollectionsScreen} />
      <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
    </Stack.Navigator>
  );
}
