import { useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { PackItem } from "@grailhaus/shared";
import { usePackDetailViewModel } from "../viewmodels/usePackDetailViewModel";
import { useSessionViewModel } from "../viewmodels/useSessionViewModel";
import { usePackFlowViewModel } from "../viewmodels/usePackFlowViewModel";
import { useAuthStore } from "../state/authStore";
import { useActionBarPadding } from "../navigation/tabBarVisibility";
import { WatchDial } from "../components/WatchDial";
import { OddsBarList } from "../components/OddsBarList";
import { ItemPreviewGrid } from "../components/ItemPreviewGrid";
import { ExpectedValueNote } from "../components/ExpectedValueNote";
import { ConfirmPurchaseSheet } from "../components/ConfirmPurchaseSheet";
import { itemArtGradient } from "../content/cardArt";
import { ART_GRADIENT, tierLabel } from "../components/PackTile";
import { PACK_RENDER } from "../content/localArt";
import { accents, ink } from "../theme/tokens";
import { vaultDetail as copy } from "../content/copy";
import type { AppStackParamList } from "../navigation/AppNavigator";

type Nav = NativeStackNavigationProp<AppStackParamList, "VaultDetail">;

const FEATURED_COUNT = 3;

/**
 * The "Vault Experience" detail screen shared by every non-cards category — watches originally,
 * now also handbags and anything else ShelfScreen routes here (any category whose packs are a
 * single sealed item per pull, not cards' multi-item tear). Same real data sources as Cards'
 * detail screen (`useTierOdds`/`useTierOwnership`/`useExpectedValue` via the shared components
 * below) — any category's tier publishes its odds and EV exactly like a card tier does, just
 * registered in the dark, quiet vault language instead. The art (WatchDial's sphere/orb) and
 * accent color are a shared placeholder for every non-cards category, same as the Home doors and
 * Shelf's own register — there's no per-category 3D icon pipeline for this decorative glyph.
 */
export function VaultDetailScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { skuId } = useRoute<RouteProp<AppStackParamList, "VaultDetail">>().params;
  const { sku } = usePackDetailViewModel(skuId);
  const session = useSessionViewModel();
  const flow = usePackFlowViewModel();
  const requireAuth = useAuthStore((s) => s.requireAuth);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isRippingRef = useRef(false);
  const actionBarPadding = useActionBarPadding();

  const featured = useMemo<PackItem[]>(() => {
    if (!sku) return [];
    return Object.values(sku.itemsByTier)
      .flat()
      .sort((a, b) => b.baseValueCents - a.baseValueCents)
      .slice(0, FEATURED_COUNT);
  }, [sku]);

  function handleConfirm() {
    if (!sku) return;
    requireAuth(async () => {
      if (isRippingRef.current) return;
      isRippingRef.current = true;
      try {
        const result = await flow.startFlow(sku);
        if (result.ok) {
          setSheetOpen(false);
          navigation.navigate("Reveal");
        } else {
          Alert.alert("Couldn't unlock that vault", result.error);
        }
      } finally {
        isRippingRef.current = false;
      }
    });
  }

  if (!sku) return <View style={styles.fill} />;

  const art = ART_GRADIENT[sku.tier] ?? ART_GRADIENT.reserve;
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
          <Ionicons name="chevron-back" size={18} color="#F2C46B" />
        </Pressable>
        <Text style={styles.headerTier}>{tierLabel(sku)}</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: actionBarPadding + 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {/* GrailhausPacks.js's own real per-tier box render — falls back to the dial for any
              tier with no render yet. */}
          {PACK_RENDER[sku.tier] ? (
            <Image source={PACK_RENDER[sku.tier]} style={styles.heroPhoto} resizeMode="contain" />
          ) : (
            <WatchDial art={art} size={140} />
          )}
        </View>

        <Text style={styles.name}>{sku.name}</Text>
        <Text style={styles.body}>{copy.body}</Text>

        <View style={styles.statRow}>
          <Stat label={copy.price} value={`$${(sku.priceCents / 100).toLocaleString()}`} />
          <Stat label={copy.receive} value={copy.oneItem} />
          <Stat label={copy.valueRange} value={`$${formatCompact(valueRange.min)} – $${formatCompact(valueRange.max)}`} />
        </View>

        <OddsBarList sku={sku} title={copy.rarityPossibilities} />

        {featured.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{copy.featuredItems}</Text>
            <View style={styles.featuredList}>
              {featured.map((item) => (
                <View key={item.id} style={styles.featuredRow}>
                  <WatchDial art={itemArtGradient({ pokemonType: null, rarityTierLevel: item.rarityTierLevel })} size={44} />
                  <Text style={styles.featuredName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.featuredValue}>${(item.baseValueCents / 100).toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <ItemPreviewGrid sku={sku} title={copy.collectionPreview} />
        <ExpectedValueNote
          sku={sku}
          linkLabel={copy.fullOdds}
          accentColor={(accents[sku.category as keyof typeof accents] ?? accents.watches).top}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: actionBarPadding }]}>
        <Pressable onPress={() => setSheetOpen(true)} style={styles.unlockButton}>
          <Text style={styles.unlockLabel}>{copy.unlockVault}</Text>
          <View style={styles.unlockPricePill}>
            <Text style={styles.unlockPrice}>${(sku.priceCents / 100).toLocaleString()}</Text>
          </View>
        </Pressable>
      </View>

      <ConfirmPurchaseSheet
        visible={sheetOpen}
        sku={sheetOpen ? sku : null}
        balanceCents={session.balanceCents}
        isPurchasing={flow.isPurchasing}
        onClose={() => setSheetOpen(false)}
        onConfirm={handleConfirm}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function formatCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `${(dollars / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return dollars.toLocaleString();
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#020101" },
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
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(242,196,107,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTier: { fontFamily: "Outfit_600SemiBold", fontSize: 10, letterSpacing: 2.4, color: "rgba(242,196,107,0.7)" },

  scroll: { padding: 24, paddingTop: 18, gap: 22 },
  hero: { alignItems: "center", marginTop: 8 },
  heroPhoto: { width: 220, height: 260 },
  name: {
    fontFamily: "Outfit_400Regular",
    fontSize: 30,
    color: ink.textOnWatches,
    textAlign: "center",
  },
  body: {
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(246,243,236,0.6)",
    textAlign: "center",
  },
  statRow: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    padding: 12,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(242,196,107,0.2)",
  },
  statLabel: { fontFamily: "Outfit_600SemiBold", fontSize: 9, letterSpacing: 1.2, color: "rgba(246,243,236,0.55)" },
  statValue: { fontFamily: "Outfit_600SemiBold", fontSize: 15, color: ink.textOnWatches, marginTop: 5 },

  section: { gap: 12 },
  sectionLabel: { fontFamily: "Outfit_600SemiBold", fontSize: 10, letterSpacing: 2, color: "rgba(242,196,107,0.7)" },
  featuredList: { gap: 10 },
  featuredRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  featuredName: { flex: 1, fontFamily: "Outfit_500Medium", fontSize: 12.5, color: ink.textOnWatches },
  featuredValue: { fontFamily: "Outfit_600SemiBold", fontSize: 13, color: "#F2C46B" },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    backgroundColor: "#020101",
  },
  unlockButton: {
    height: 62,
    borderRadius: 18,
    backgroundColor: "#F2C46B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  unlockLabel: { fontFamily: "Outfit_800ExtraBold", fontSize: 15, letterSpacing: 0.8, color: "#1A1206" },
  unlockPricePill: { height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.16)", justifyContent: "center" },
  unlockPrice: { fontFamily: "Outfit_700Bold", fontSize: 13, color: "#1A1206" },
});
