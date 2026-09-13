import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CardFace } from "../../components/CardFace";
import { WatchDial } from "../../components/WatchDial";
import { itemArtGradient } from "../../content/cardArt";
import { marketplaceService, type FeePreview } from "../../services/marketplaceService";
import { useListingViewModel } from "../../viewmodels/useListingViewModel";
import { useActionBarPadding, useHideTabBarOnScreen } from "../../navigation/tabBarVisibility";
import { colors, typography } from "../../theme/tokens";
import { sellItem as copy } from "../../content/copy";
import type { CollectionStackParamList } from "../../navigation/CollectionStack";

type Nav = NativeStackNavigationProp<CollectionStackParamList, "SellItem">;
type Route = RouteProp<CollectionStackParamList, "SellItem">;

// Setting a price is its own blue-lavender register (mockup 12c) — distinct from both the item's
// own category color and the gold "paying" tone; the live/done state switches to green.
const BLUE_WASH: [string, string, string] = ["rgba(143,169,255,0.18)", colors.bg, "#04010A"];
const GREEN_WASH: [string, string, string] = ["rgba(99,232,92,0.16)", colors.bg, "#04010A"];

/**
 * "Set price → fee → confirm → live" (mockup 12c), collapsed to what's actually one real
 * network call: creating the listing. The fee/net figures update live off the real
 * /marketplace/fee-preview rate as the seller types — not a guessed constant — because a fee
 * screen that shows the wrong split is worse than not showing one.
 */
export function SellItemScreen() {
  const navigation = useNavigation<Nav>();
  const { owned } = useRoute<Route>().params;
  const item = owned.item;
  const { isWorking, createListing } = useListingViewModel();
  // Nothing to tab away to mid-listing — this is a committed task with its own back button, and
  // the pill nav would otherwise sit between "Confirm listing" and the bottom of the screen.
  useHideTabBarOnScreen();
  const actionBarPadding = useActionBarPadding();

  const [priceText, setPriceText] = useState(String(Math.round(item.currentValueCents / 100)));
  const [preview, setPreview] = useState<FeePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listedPriceCents, setListedPriceCents] = useState<number | null>(null);

  const priceCents = Math.round((Number(priceText.replace(/[^0-9.]/g, "")) || 0) * 100);

  useEffect(() => {
    if (priceCents <= 0) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      marketplaceService
        .previewFee(item.category, item.rarityTierLevel, priceCents)
        .then((p) => !cancelled && setPreview(p))
        .catch(() => !cancelled && setPreview(null));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [priceCents, item.category, item.rarityTierLevel]);

  async function handleConfirm() {
    setError(null);
    const result = await createListing(owned.ownedItemId, priceCents);
    if (result.ok) {
      setListedPriceCents(priceCents);
    } else {
      setError(result.error);
    }
  }

  /** Cross-tab hop: unwind this stack first so Portfolio isn't left parked on a stale "listed"
   * screen behind the tab switch, then land on Marketplace with My Listings already selected —
   * the seller's new listing is the first thing there. */
  function handleViewListing() {
    navigation.popToTop();
    navigation.getParent()?.navigate("Marketplace", { screen: "Marketplace", params: { initialTab: "mine" } });
  }

  if (listedPriceCents != null) {
    return (
      <View style={styles.fill}>
        <LinearGradient colors={GREEN_WASH} locations={[0, 0.4, 1]} style={styles.base} />
        <View style={styles.doneWrap}>
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark" size={28} color="#fff" />
          </View>
          <Text style={styles.doneTitle}>{copy.liveTitle}</Text>
          <Text style={styles.doneBody}>{copy.liveBody(listedPriceCents)}</Text>
        </View>
        {/* Two ways out, because "I listed it" has two natural next steps: go look at it on the
            market, or get back to the collection and keep going. Previously only the second
            existed, which left "where did my listing go?" unanswered at the exact moment the
            seller was most likely to ask it. */}
        <View style={[styles.footer, { paddingBottom: actionBarPadding }]}>
          <Pressable style={styles.primaryButton} onPress={handleViewListing}>
            <LinearGradient colors={["#63E85C", "#12864A"]} style={StyleSheet.absoluteFill} />
            <Text style={styles.primaryLabel}>{copy.viewListing}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.popToTop()}>
            <Text style={styles.secondaryLabel}>{copy.done}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <LinearGradient colors={BLUE_WASH} locations={[0, 0.4, 1]} style={styles.base} />
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerLabel}>{copy.header.toUpperCase()}</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.itemRow}>
        {/* Cards keeps its own rectangular card-face art; every other category shares the
            watch-dial treatment as a generic fallback — same rule as the rest of this pass. */}
        {item.category === "cards" ? (
          <CardFace gradient={itemArtGradient(item)} imageUrl={item.textureUrl} width={58} height={81} />
        ) : (
          <WatchDial art={itemArtGradient(item)} size={58} />
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{(item.cardTitle ?? item.watchName ?? item.name).toUpperCase()}</Text>
          <Text style={styles.itemSub}>{item.collection ?? item.brand ?? ""}</Text>
        </View>
      </View>

      {/* The price field sits mid-screen with the confirm action pinned below it, so the
          keyboard would otherwise cover both the live fee breakdown and the button the user is
          trying to reach. Lifting the whole body+footer keeps "type a price → see your net →
          confirm" visible as one continuous step. */}
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            style={styles.flexFill}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.askLabel}>{copy.yourAsk}</Text>
            <View style={styles.askBox}>
              <Text style={styles.askDollar}>$</Text>
              <TextInput
                style={styles.askInput}
                value={priceText}
                onChangeText={setPriceText}
                keyboardType="decimal-pad"
                selectionColor={colors.violetTop}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>

            <View style={styles.splitCard}>
              <Row label={copy.buyerPays} value={`$${priceCents > 0 ? (priceCents / 100).toFixed(2) : "0.00"}`} />
              {preview && (
                <>
                  <Row label={copy.platformFee(preview.feePercent)} value={`−$${(preview.feeCents / 100).toFixed(2)}`} danger />
                  <View style={styles.hairline} />
                  <Row label={copy.youReceive} value={`$${(preview.sellerProceedsCents / 100).toFixed(2)}`} big success />
                </>
              )}
              <Text style={styles.netNote}>{copy.netNote}</Text>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>
        </TouchableWithoutFeedback>

        <View style={[styles.footer, { paddingBottom: actionBarPadding }]}>
          <Pressable
            style={[styles.primaryButton, (isWorking || priceCents <= 0) && styles.disabled]}
            onPress={handleConfirm}
            disabled={isWorking || priceCents <= 0}
          >
            <LinearGradient colors={["#8FA9FF", "#3F52C4"]} style={StyleSheet.absoluteFill} />
            {isWorking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>{copy.confirm}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Row({ label, value, danger, success, big }: { label: string; value: string; danger?: boolean; success?: boolean; big?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, big && styles.rowLabelBig]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          big && styles.rowValueBig,
          danger && { color: colors.danger },
          success && { color: "#8BF285" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  base: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  header: {
    paddingTop: 24,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLabel: { ...typography.eyebrow, letterSpacing: 2.4 },
  itemRow: { flexDirection: "row", gap: 14, alignItems: "center", paddingHorizontal: 22, paddingTop: 20 },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { ...typography.pageHeading, fontSize: 20 },
  itemSub: { ...typography.sectionSub, marginTop: 3 },
  flexFill: { flex: 1 },
  body: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 24, flexGrow: 1 },
  askLabel: typography.eyebrow,
  askBox: {
    marginTop: 11,
    height: 92,
    borderRadius: 20,
    backgroundColor: "rgba(143,169,255,0.12)",
    borderWidth: 2,
    borderColor: "rgba(143,169,255,0.6)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  askDollar: { fontFamily: "Outfit_600SemiBold", fontSize: 26, color: "rgba(255,255,255,0.5)" },
  askInput: {
    fontFamily: "Outfit_900Black",
    fontSize: 46,
    letterSpacing: -0.6,
    color: "#fff",
    minWidth: 90,
    textAlign: "center",
    padding: 0,
  },
  splitCard: {
    marginTop: 22,
    padding: 17,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 11 },
  rowLabel: { ...typography.sectionSub },
  rowLabelBig: { ...typography.body, color: colors.textPrimary },
  rowValue: { ...typography.body, color: colors.textPrimary },
  rowValueBig: { ...typography.heroWordmark, fontSize: 30 },
  hairline: { height: 1, backgroundColor: "rgba(255,255,255,0.14)", marginVertical: 14 },
  netNote: { ...typography.footNote, marginTop: 9, lineHeight: 17 },
  error: { ...typography.errorText, marginTop: 14 },
  footer: { padding: 22, gap: 10 },
  secondaryButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: { ...typography.chipLabel, fontSize: 14, color: "rgba(255,255,255,0.8)" },
  primaryButton: {
    height: 60,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  disabled: { opacity: 0.5 },
  primaryLabel: {
    ...typography.buttonLabel,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  doneBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#63E85C",
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: { ...typography.pageHeading, fontSize: 26, marginTop: 20, color: "#8BF285" },
  doneBody: { ...typography.sectionSub, marginTop: 8, textAlign: "center" },
});
