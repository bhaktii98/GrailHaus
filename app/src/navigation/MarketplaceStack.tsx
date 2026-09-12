import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Listing } from "@grailhaus/shared";
import { MarketplaceScreen } from "../screens/marketplace/MarketplaceScreen";
import { ListingDetailScreen } from "../screens/marketplace/ListingDetailScreen";
import { BuyListingScreen } from "../screens/marketplace/BuyListingScreen";

export type MarketplaceStackParamList = {
  /** `initialTab` — set when something else in the app sends the user here with a specific view
   * in mind, e.g. SellItem's "View in marketplace" landing straight on My Listings rather than
   * on Browse (where, by design, the listing they just made isn't shown). */
  Marketplace: { initialTab?: "browse" | "mine" } | undefined;
  ListingDetail: { listing: Listing };
  BuyListing: { listing: Listing };
};

const Stack = createNativeStackNavigator<MarketplaceStackParamList>();

export function MarketplaceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <Stack.Screen name="BuyListing" component={BuyListingScreen} options={{ presentation: "modal" }} />
    </Stack.Navigator>
  );
}
