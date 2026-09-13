import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CardFace } from "../../components/CardFace";
import { WatchDial } from "../../components/WatchDial";
import { itemArtGradient } from "../../content/cardArt";
import { useSessionViewModel } from "../../viewmodels/useSessionViewModel";
import { useBuyListingViewModel } from "../../viewmodels/useMarketplaceViewModel";
import { useActionBarPadding, useHideTabBarOnScreen } from "../../navigation/tabBarVisibility";
import { colors, typography } from "../../theme/tokens";
import { buyListing as copy } from "../../content/copy";
import type { MarketplaceStackParamList } from "../../navigation/MarketplaceStack";

type Nav = NativeStackNavigationProp<MarketplaceStackParamList, "BuyListing">;
type Route = RouteProp<MarketplaceStackParamList, "BuyListing">;

type Step = "confirm" | "processing" | "done" | "failed";

// Paying is always a gold/money-colored beat regardless of item category; the done state
// switches to green, matching the success badge/eyebrow already used there.
const GOLD_WASH: [string, string, string] = ["rgba(255,215,94,0.16)", colors.bg, "#04010A"];
const GREEN_WASH: [string, string, string] = ["rgba(99,232,92,0.16)", colors.bg, "#04010A"];

/**
 * "Confirm → payment → atomic transaction → success" (mockup 12b), collapsed to the one real
 * call that actually is atomic — POST /listings/:id/buy — with the confirm step merged into
 * the payment step, since GrailHaus balance is the only funding source that exists. The
 * "processing" beat is honest theater around a request that's already atomic server-side; it
 * isn't simulating steps that didn't happen.
 */
export function BuyListingScreen() {
  const navigation = useNavigation<Nav>();
  const { listing } = useRoute<Route>().params;
  const item = listing.item;
  const session = useSessionViewModel();
  const { buy } = useBuyListingViewModel();
  const [step, setStep] = useState<Step>("confirm");
  const [error, setError] = useState<string | null>(null);
  // A checkout step — tab-switching out of a half-finished purchase isn't a flow worth
  // supporting, and the pill nav under "Confirm purchase" is exactly the float this pass fixes.
  useHideTabBarOnScreen();
  const actionBarPadding = useActionBarPadding();

  const balanceNow = session.balanceCents ?? 0;
  const balanceAfter = balanceNow - listing.priceCents;
  // Checked before the request, not after: the server rejects an unaffordable buy anyway
  // (failureReason "insufficient_funds"), but letting the user tap through to a spinner and a
  // failure screen for something the balance row above already shows is a wasted round trip.
  // `session.balanceCents == null` means the profile hasn't loaded yet — don't block on that.
  const canAfford = session.balanceCents == null || balanceAfter >= 0;

  async function handleConfirm() {
    setStep("processing");
    const result = await buy(listing.id);
    if (result.ok) {
      setStep("done");
    } else {
      setError(result.error);
      setStep("failed");
    }
  }

  /** Unwind the Marketplace stack before hopping tabs, so returning to Marketplace later lands
   * on the browse grid rather than on this now-stale purchase-complete screen. */
  function handleViewInCollection() {
    navigation.popToTop();
    navigation.getParent()?.navigate("Portfolio" as never);
  }

  if (step === "processing") {
    return (
      <View style={styles.fill}>
        <LinearGradient colors={GOLD_WASH} locations={[0, 0.4, 1]} style={styles.base} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.goldTop} />
          <Text style={styles.processingTitle}>Atomic transaction</Text>
          <Text style={styles.processingBody}>
            Debit, fee, credit and ownership transfer all commit together — or none do.
          </Text>
        </View>
      </View>
    );
  }

  if (step === "done") {
    return (
      <View style={styles.fill}>
        <LinearGradient colors={GREEN_WASH} locations={[0, 0.4, 1]} style={styles.base} />
        <View style={styles.centered}>
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark" size={28} color="#fff" />
          </View>
          <Text style={styles.successEyebrow}>{copy.successSub}</Text>
          <Text style={styles.successTitle}>{copy.successTitle}</Text>

          <View style={styles.receipt}>
            <Row label={copy.paid} value={`$${(listing.priceCents / 100).toFixed(2)}`} />
            <Row label={copy.newBalance} value={`$${(balanceAfter / 100).toFixed(2)}`} />
          </View>
        </View>
        <View style={[styles.footer, { paddingBottom: actionBarPadding }]}>
          <Pressable
            style={styles.primaryButton}
            onPress={handleViewInCollection}
          >
            <LinearGradient colors={["#63E85C", "#12864A"]} style={StyleSheet.absoluteFill} />
            <Text style={styles.primaryLabel}>{copy.viewInCollection}</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={() => navigation.popToTop()}>
            <Text style={styles.linkLabel}>{copy.keepBrowsing}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <LinearGradient colors={GOLD_WASH} locations={[0, 0.4, 1]} style={styles.base} />
      <View style={styles.header}>
        <Text style={styles.headerLabel}>{copy.header.toUpperCase()}</Text>
      </View>

      <View style={styles.itemRow}>
        {/* Cards keeps its own rectangular card-face art; every other category shares the
            watch-dial treatment as a generic fallback — same rule as the rest of this pass. */}
        {item.category === "cards" ? (
          <CardFace gradient={itemArtGradient(item)} imageUrl={item.textureUrl} width={64} height={89} />
        ) : (
          <WatchDial art={itemArtGradient(item)} size={64} />
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{(item.cardTitle ?? item.watchName ?? item.name).toUpperCase()}</Text>
          <Text style={styles.itemSub}>
            {[item.collection ?? item.brand, listing.seller.username ? `from @${listing.seller.username}` : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.payCard}>
          <Row label={copy.youPay} value={`$${(listing.priceCents / 100).toFixed(2)}`} big />
        </View>

        <View style={styles.balanceRows}>
          <Row label={copy.balanceNow} value={`$${(balanceNow / 100).toFixed(2)}`} />
          <View style={styles.hairline} />
          <Row label={copy.balanceAfter} value={`$${(balanceAfter / 100).toFixed(2)}`} big />
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteText}>{copy.feeNote}</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {/* Was the one footer on this screen with no bottom padding at all — its button sat flush
          against the bottom edge, under the home indicator on gesture-nav devices. */}
      <View style={[styles.footer, { paddingBottom: actionBarPadding }]}>
        <Pressable
          style={[styles.primaryButton, !canAfford && styles.disabled]}
          onPress={handleConfirm}
          disabled={!canAfford}
        >
          <LinearGradient colors={["#FFD75E", "#E08A16"]} style={StyleSheet.absoluteFill} />
          <Text style={[styles.primaryLabel, { color: "#2A1706" }]}>
            {canAfford ? copy.continue : copy.insufficientFunds}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, big && styles.rowLabelBig]}>{label}</Text>
      <Text style={[styles.rowValue, big && styles.rowValueBig]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  base: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  header: { paddingTop: 24, paddingHorizontal: 22, alignItems: "center" },
  headerLabel: { ...typography.eyebrow, letterSpacing: 2.4 },
  itemRow: { flexDirection: "row", gap: 14, alignItems: "center", paddingHorizontal: 22, paddingTop: 18 },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { ...typography.pageHeading, fontSize: 20 },
  itemSub: { ...typography.sectionSub, marginTop: 3 },
  body: { paddingHorizontal: 22, paddingTop: 22, flex: 1 },
  payCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,215,94,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,215,94,0.34)",
  },
  balanceRows: { marginTop: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginVertical: 5 },
  rowLabel: typography.sectionSub,
  rowLabelBig: { ...typography.body, color: colors.textPrimary },
  rowValue: { ...typography.body, color: colors.textPrimary },
  rowValueBig: { ...typography.heroWordmark, fontSize: 26 },
  hairline: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 8 },
  noteCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  noteText: { ...typography.footNote, lineHeight: 17 },
  error: { ...typography.errorText, marginTop: 14 },
  footer: { padding: 22, gap: 12 },
  primaryButton: {
    height: 60,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  primaryLabel: {
    ...typography.buttonLabel,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  disabled: { opacity: 0.5 },
  linkButton: { alignItems: "center" },
  linkLabel: { ...typography.body, color: colors.textSecondary },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  processingTitle: { ...typography.pageHeading, fontSize: 24, marginTop: 24, textAlign: "center" },
  processingBody: { ...typography.sectionSub, marginTop: 8, textAlign: "center" },
  doneBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#63E85C",
    alignItems: "center",
    justifyContent: "center",
  },
  successEyebrow: { ...typography.eyebrow, color: "#8BF285", letterSpacing: 3.4, marginTop: 18 },
  successTitle: { ...typography.heroWordmark, fontSize: 30, marginTop: 8 },
  receipt: {
    marginTop: 26,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
    width: "100%",
  },
});
