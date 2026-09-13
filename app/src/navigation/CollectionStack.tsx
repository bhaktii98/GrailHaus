import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { OwnedItem } from "@grailhaus/shared";
import { CollectionScreen } from "../screens/collection/CollectionScreen";
import { BinderScreen } from "../screens/collection/BinderScreen";
import { CardDetailScreen } from "../screens/collection/CardDetailScreen";
import { VaultScreen } from "../screens/collection/VaultScreen";
import { WatchDetailScreen } from "../screens/collection/WatchDetailScreen";
import { SellItemScreen } from "../screens/marketplace/SellItemScreen";

/**
 * Portfolio's own drill-down, mirroring HomeStack's "commit to a world" shape (see that file's
 * comment): the hub forks into Binder (cards) or Vault (watches) — per the mockup's "a fork,
 * not a tab bar" — and each world owns its own detail screen. SellItem is reached from either
 * detail screen and is the same screen the Marketplace tab's "My Listings" uses to list a new
 * item, so it lives under the Marketplace feature and is just re-used here.
 */
export type CollectionStackParamList = {
  /** `justAddedIds` — set only when this screen is landed on right off a reveal's "deal away"
   * exit (see RevealScreen.handleViewCollection) — the `ownedItemId`s of what was just pulled,
   * so the grid can sort them to the top and give them a brief landing/highlight animation
   * ("this is where your cards went") instead of just silently having new rows appear. */
  Collection: { justAddedIds?: string[] } | undefined;
  Binder: { collectionFilter?: string } | undefined;
  CardDetail: { owned: OwnedItem };
  Vault: undefined;
  WatchDetail: { owned: OwnedItem };
  SellItem: { owned: OwnedItem };
};

const Stack = createNativeStackNavigator<CollectionStackParamList>();

export function CollectionStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Collection" component={CollectionScreen} />
      <Stack.Screen name="Binder" component={BinderScreen} />
      <Stack.Screen name="CardDetail" component={CardDetailScreen} />
      <Stack.Screen name="Vault" component={VaultScreen} />
      <Stack.Screen name="WatchDetail" component={WatchDetailScreen} />
      <Stack.Screen name="SellItem" component={SellItemScreen} options={{ presentation: "modal" }} />
    </Stack.Navigator>
  );
}
