import { useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp, type CompositeNavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { usePackDetailViewModel } from "../viewmodels/usePackDetailViewModel";
import { useActionBarPadding } from "../navigation/tabBarVisibility";
import { useSessionViewModel } from "../viewmodels/useSessionViewModel";
import { usePackFlowViewModel } from "../viewmodels/usePackFlowViewModel";
import { useAuthStore } from "../state/authStore";
import { PackFace } from "../components/PackFace";
import { PACK_RENDER } from "../content/localArt";
import { StatBox } from "../components/StatBox";
import { OddsBarList } from "../components/OddsBarList";
import { ItemPreviewGrid } from "../components/ItemPreviewGrid";
import { ExpectedValueNote } from "../components/ExpectedValueNote";
import { ConfirmPurchaseSheet } from "../components/ConfirmPurchaseSheet";
import { ART_GRADIENT, tierLabel } from "../components/PackTile";
import { accents, fonts, ink, spacing } from "../theme/tokens";
import { packDetail as copy } from "../content/copy";
import type { RootTabParamList } from "../navigation/RootTabs";
import type { AppStackParamList } from "../navigation/AppNavigator";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<AppStackParamList, "PackDetail">,
  BottomTabNavigationProp<RootTabParamList>
>;

/**
 * Everything the Cards journey mockup says a buyer needs before tapping RIP
 * NOW: price/count/value-range, the published odds, a real collection
 * preview (owned vs. unknown, from the portfolio — not invented), and the
 * expected-value math. Reached by tapping a tier row on the cards Shelf or
 * Explore; "RIP NOW" opens the same `ConfirmPurchaseSheet` every purchase in
 * the app uses, then pushes Reveal exactly like Shelf/Drops already do.
 */
export function PackDetailScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { skuId } = useRoute<RouteProp<AppStackParamList, "PackDetail">>().params;
  const { sku } = usePackDetailViewModel(skuId);
  const session = useSessionViewModel();
  const flow = usePackFlowViewModel();
  const requireAuth = useAuthStore((s) => s.requireAuth);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quantity, setQuantity] = useState<1 | 10>(1);
  const isRippingRef = useRef(false);
  const actionBarPadding = useActionBarPadding();

  // Bulk ripping (PRD §46) is offered here — the evergreen shelf's own detail screen — for every
  // card tier. This used to exclude Vault Break, because a batch meant replaying that tier's
  // richer 3D tear+fan reveal ten times over, which it isn't built for. A bulk buy no longer
  // replays any per-pack reveal at all: it runs the Grail Hunt presentation instead (see
  // engine/cards/bulk/), which renders one premium 3D moment at a time and flat 2D for everything
  // else, so every card tier can batch safely now. Never offered for watches (one case at a time)
  // or timed drops (DropDetailScreen, a separate screen entirely — "1 per account" is the whole
  // point of a drop's scarcity, so a bulk buy there would undercut its own mechanic).
  const bulkEligible = sku?.category === "cards";

  // Gated here, before the confirm sheet ever opens — not inside handleConfirm — because that
  // sheet is itself a native Modal, and requireAuth's own sign-in sheet is too; two Modals open
  // at once is unreliable (especially on Android), so a guest never gets past this point without
  // the confirm sheet opening at all. By the time handleConfirm runs, sign-in is guaranteed.
  function handleOpenSheet() {
    requireAuth(() => {
      setQuantity(1);
      setSheetOpen(true);
    });
  }

  function handleConfirm() {
    if (!sku) return;
    if (isRippingRef.current) return;
    (async () => {
      isRippingRef.current = true;
      try {
        const result = await flow.startFlow(sku, bulkEligible ? quantity : 1);
        if (result.ok) {
          setSheetOpen(false);
          navigation.navigate("Reveal");
        } else {
          Alert.alert("Couldn't rip that pack", result.error);
        }
      } finally {
        isRippingRef.current = false;
      }
    })();
  }

  if (!sku) return <View style={styles.fill} />;

  const art = ART_GRADIENT[sku.tier] ?? ART_GRADIENT.street_rip;
  const valueRange = sku.rarityTiers.reduce(
    (acc, t) => ({
      min: Math.min(acc.min, t.valueMinCents),
      max: Math.max(acc.max, t.valueMaxCents),
    }),
    { min: Infinity, max: 0 }
  );

  return (
    <View style={styles.fill}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerTier}>{tierLabel(sku)}</Text>
        {/* Invisible — same footprint as the back button on the left so the title above stays
            centered (this row is `justifyContent: "space-between"`), without actually drawing a
            second box on the right. */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 140 + actionBarPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {/* GrailhausPacks.js's own real per-tier render — falls back to the flat-gradient
              PackFace box for any tier with no render yet. */}
          {PACK_RENDER[sku.tier] ? (
            <Image source={PACK_RENDER[sku.tier]} style={styles.heroPhoto} resizeMode="contain" />
          ) : (
            <PackFace art={art} width={110} height={152} radius={14} crimp />
          )}
        </View>

        <Text style={styles.name}>{sku.name}</Text>
        <Text style={styles.body}>{copy.body(sku)}</Text>

        <View style={styles.statRow}>
          <StatBox label={copy.price} value={`$${(sku.priceCents / 100).toLocaleString()}`} />
          <StatBox label={copy.cards} value={String(sku.itemCount)} />
          <StatBox
            label={copy.valueRange}
            value={`$${formatCompact(valueRange.min)} – $${formatCompact(valueRange.max)}`}
          />
        </View>

        <OddsBarList sku={sku} title={copy.possibleRarities} />
        <ItemPreviewGrid sku={sku} title={copy.collectionPreview} />
        <ExpectedValueNote sku={sku} linkLabel={copy.fullOdds} accentColor={accents.cards.top} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: actionBarPadding }]}>
        <Pressable onPress={handleOpenSheet} style={styles.ripButtonWrap}>
          <LinearGradient colors={[accents.cards.top, accents.cards.bottom]} style={styles.ripButton}>
            <Text style={styles.ripLabel}>{copy.ripNow}</Text>
            <View style={styles.ripPricePill}>
              <Text style={styles.ripPrice}>${(sku.priceCents / 100).toLocaleString()}</Text>
            </View>
          </LinearGradient>
        </Pressable>
        {bulkEligible && <Text style={styles.bulkHint}>Or rip a 10-pack — tap RIP NOW to choose</Text>}
      </View>

      <ConfirmPurchaseSheet
        visible={sheetOpen}
        sku={sheetOpen ? sku : null}
        balanceCents={session.balanceCents}
        isPurchasing={flow.isPurchasing}
        quantity={quantity}
        bulkEligible={bulkEligible}
        onQuantityChange={setQuantity}
        onClose={() => setSheetOpen(false)}
        onConfirm={handleConfirm}
      />
    </View>
  );
}

function formatCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `${(dollars / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return dollars.toLocaleString();
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: ink.groundDeep },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
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
  headerSpacer: { width: 38, height: 38 },
  headerTier: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, color: "rgba(255,255,255,0.62)" },

  scroll: { padding: 20, paddingBottom: 40, gap: spacing.lg },
  hero: { alignItems: "center", marginTop: spacing.sm },
  heroPhoto: { width: 220, height: 260 },
  name: { fontFamily: fonts.black, fontSize: 30, letterSpacing: -0.3, color: ink.text },
  body: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: "rgba(255,255,255,0.6)" },
  statRow: { flexDirection: "row", gap: 10 },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    gap: 10,
    alignItems: "center",
    backgroundColor: ink.groundDeep,
  },
  bulkHint: { fontFamily: fonts.semibold, fontSize: 11.5, color: "rgba(255,255,255,0.45)" },
  ripButtonWrap: { borderRadius: 18, alignSelf: "stretch" },
  ripButton: {
    height: 62,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.26)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    shadowColor: accents.cards.top,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 26,
    elevation: 8,
  },
  ripLabel: { fontFamily: fonts.black, fontSize: 16, letterSpacing: 1.1, color: "#fff" },
  ripPricePill: { height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.25)" },
  ripPrice: { fontFamily: fonts.bold, fontSize: 14, color: "#fff", lineHeight: 28 },
});
