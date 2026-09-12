import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WatchDial } from "../../components/WatchDial";
import { PositionCard } from "../../components/PositionCard";
import { ValueDriftChart } from "../../components/ValueDriftChart";
import { itemArtGradient } from "../../content/cardArt";
import { colors, ink } from "../../theme/tokens";
import { useHideTabBarWhileFocused } from "../../navigation/tabBarVisibility";
import { useRarityTiers } from "../../viewmodels/useRarityTiers";
import { itemDetail as copy } from "../../content/copy";
import type { CollectionStackParamList } from "../../navigation/CollectionStack";

type Nav = NativeStackNavigationProp<CollectionStackParamList, "WatchDetail">;
type Route = RouteProp<CollectionStackParamList, "WatchDetail">;

export function WatchDetailScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { owned } = useRoute<Route>().params;
  const item = owned.item;
  // Admin-configurable (rarity_tiers table), not a hardcoded name map — see useRarityTiers.ts.
  // Reads the *owned item's own* category, not a hardcoded "watches", since CollectionScreen
  // routes every non-cards category here (there's no per-category detail screen pipeline yet) —
  // hardcoding "watches" would show a handbags item its wrong tier names/colors.
  const rarityTiers = useRarityTiers(item.category);
  const [marketValueOpen, setMarketValueOpen] = useState(false);
  useHideTabBarWhileFocused();

  const heldDays = Math.max(0, Math.floor((Date.now() - new Date(owned.acquiredAt).getTime()) / 86_400_000));

  const specs: [string, string][] = [
    ["Brand", item.brand ?? "—"],
    // `watchName` ("Royal Oak") and `modelName` ("Perpetual Calendar") are two distinct real
    // catalog fields, not a fallback chain — collapsing them into one "Model" row was losing
    // the specific edition within the base line.
    item.watchName ? (["Model", item.watchName] as [string, string]) : ["Model", item.name],
    item.modelName ? (["Edition", item.modelName] as [string, string]) : null,
    item.style ? (["Style", item.style] as [string, string]) : null,
    item.caseMaterial ? (["Case material", item.caseMaterial] as [string, string]) : null,
    item.dialColor ? (["Dial color", item.dialColor] as [string, string]) : null,
    item.movement ? (["Movement", item.movement] as [string, string]) : null,
    item.caseSize ? (["Case size", item.caseSize] as [string, string]) : null,
  ].filter((s): s is [string, string] => s != null);

  return (
    <View style={styles.fill}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 220 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Wash lives in content coordinates, not as a screen-fixed sibling — a fixed wash
            would stay pinned to the viewport as the header/hero scroll away, bleeding into
            whatever section (specs, value) scrolls into that same screen region. */}
        <View style={styles.washWrap}>
          <LinearGradient colors={["rgba(242,196,107,0.2)", "transparent"]} style={StyleSheet.absoluteFill} />

          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="chevron-back" size={18} color="#F2C46B" />
            </Pressable>
            <Text style={styles.headerLabel}>IN YOUR VAULT</Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={styles.heroWrap}>
            <WatchDial art={itemArtGradient(item)} imageUrl={item.textureUrl} size={150} />
          </View>

          <View style={styles.heroText}>
            <Text style={styles.brand}>{(item.brand ?? "INDEPENDENT").toUpperCase()}</Text>
            <Text style={styles.name}>{item.watchName ?? item.name}</Text>
            <View style={styles.pillRow}>
              <Text style={styles.pillRarity}>{(rarityTiers[item.rarityTierLevel]?.name ?? "").toUpperCase()}</Text>
              <View style={styles.pillDivider} />
              <Text style={styles.pillMeta}>HELD {heldDays}D</Text>
            </View>
            {item.tagline ? <Text style={styles.tagline}>{item.tagline}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.hairlineFade} />
          <Text style={styles.sectionLabel}>{copy.specifications}</Text>
          <View style={styles.specList}>
            {specs.map(([label, value]) => (
              <View key={label} style={styles.specRow}>
                <Text style={styles.specLabel}>{label}</Text>
                <Text style={styles.specValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Position first, appraisal second — see the same note on CardDetailScreen. */}
        <View style={styles.section}>
          <PositionCard owned={owned} register="watches" />
        </View>

        <View style={styles.section}>
          <View style={styles.valueCard}>
            <View>
              <Text style={styles.valueLabel}>{copy.estimatedValue}</Text>
              <Text style={styles.valueBig}>${(item.currentValueCents / 100).toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.actionRow}>
          <Pressable style={styles.keepButton} onPress={() => navigation.goBack()}>
            <Text style={styles.keepLabel}>{copy.keep}</Text>
          </Pressable>
          <Pressable style={styles.sellButton} onPress={() => navigation.navigate("SellItem", { owned })}>
            <Text style={styles.sellLabel}>{copy.sell}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.marketButton} onPress={() => setMarketValueOpen(true)}>
          <LinearGradient colors={["#FFD75E", "#E08A16"]} style={StyleSheet.absoluteFill} />
          <Text style={styles.marketLabel}>{copy.marketValue}</Text>
        </Pressable>
      </View>

      <Modal visible={marketValueOpen} transparent animationType="slide" onRequestClose={() => setMarketValueOpen(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setMarketValueOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetLabel}>{copy.marketValue}</Text>
            <Text style={styles.sheetTitle}>{item.watchName ?? item.name}</Text>
            <Text style={styles.sheetAppraised}>APPRAISED TODAY</Text>
            <Text style={styles.sheetValue}>${(item.currentValueCents / 100).toLocaleString()}</Text>
            <Text style={styles.sheetRange}>
              Simulated range ${(item.minValueCents / 100).toLocaleString()} – $
              {(item.maxValueCents / 100).toLocaleString()}, ticking every 30 seconds.
            </Text>
            <ValueDriftChart
              item={{ id: item.id, category: item.category, baseValueCents: item.baseValueCents }}
              minValueCents={item.minValueCents}
              maxValueCents={item.maxValueCents}
              accentColor={colors.watchesTop}
            />
            <View style={styles.sheetNote}>
              <Text style={styles.sheetNoteText}>
                This is a simulated appraisal, not a market comp — GrailHaus doesn't track sales history for this
                piece yet.
              </Text>
            </View>
            <Pressable style={styles.sheetClose} onPress={() => setMarketValueOpen(false)}>
              <Text style={styles.sheetCloseLabel}>CLOSE</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#020101" },
  scroll: { paddingBottom: 220 },
  washWrap: { position: "relative" },
  header: {
    paddingTop: 56,
    paddingHorizontal: 22,
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
  headerLabel: { fontFamily: "Outfit_600SemiBold", fontSize: 10, letterSpacing: 2.4, color: "rgba(242,196,107,0.7)" },
  heroWrap: { alignItems: "center", paddingTop: 20 },
  heroText: { paddingHorizontal: 26, paddingTop: 18, alignItems: "center" },
  brand: { fontFamily: "Outfit_600SemiBold", fontSize: 11, letterSpacing: 3, color: "rgba(242,196,107,0.8)" },
  name: {
    fontFamily: "Outfit_400Regular",
    fontSize: 33,
    letterSpacing: -0.3,
    color: ink.textOnWatches,
    marginTop: 10,
    textAlign: "center",
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(242,196,107,0.12)",
    borderWidth: 1,
    borderColor: "rgba(242,196,107,0.42)",
  },
  pillRarity: { fontFamily: "Outfit_700Bold", fontSize: 10, letterSpacing: 2, color: "#F2C46B" },
  pillDivider: { width: 1, height: 9, backgroundColor: "rgba(242,196,107,0.4)" },
  pillMeta: { fontFamily: "Outfit_600SemiBold", fontSize: 10, letterSpacing: 1.4, color: "rgba(246,243,236,0.72)" },
  tagline: {
    fontFamily: "Outfit_400Regular",
    fontStyle: "italic",
    fontSize: 13,
    lineHeight: 21,
    color: "rgba(246,243,236,0.66)",
    marginTop: 12,
    textAlign: "center",
  },
  section: { paddingHorizontal: 26, paddingTop: 18 },
  hairlineFade: { height: 1, backgroundColor: "rgba(242,196,107,0.34)" },
  sectionLabel: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 10,
    letterSpacing: 2.6,
    color: "rgba(242,196,107,0.7)",
    marginTop: 18,
  },
  specList: { marginTop: 13, gap: 10 },
  specRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  specLabel: { fontFamily: "Outfit_500Medium", fontSize: 12, color: "rgba(246,243,236,0.6)" },
  specValue: { fontFamily: "Outfit_600SemiBold", fontSize: 12.5, color: ink.textOnWatches },
  valueCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(242,196,107,0.28)",
  },
  valueLabel: { fontFamily: "Outfit_600SemiBold", fontSize: 10, letterSpacing: 2, color: "rgba(246,243,236,0.6)" },
  valueBig: { fontFamily: "Outfit_600SemiBold", fontSize: 30, letterSpacing: -0.3, color: "#fff", marginTop: 5 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 26, gap: 9, backgroundColor: "#050403" },
  actionRow: { flexDirection: "row", gap: 10 },
  keepButton: {
    flex: 1,
    height: 54,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(246,243,236,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  keepLabel: { fontFamily: "Outfit_700Bold", fontSize: 13, letterSpacing: 1.2, color: ink.textOnWatches },
  sellButton: {
    flex: 1,
    height: 54,
    borderRadius: 15,
    backgroundColor: "rgba(242,196,107,0.14)",
    borderWidth: 1,
    borderColor: "rgba(242,196,107,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  sellLabel: { fontFamily: "Outfit_700Bold", fontSize: 13, letterSpacing: 1.2, color: "#F2C46B" },
  marketButton: {
    height: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  marketLabel: { fontFamily: "Outfit_800ExtraBold", fontSize: 13, letterSpacing: 1.2, color: "#2A1706" },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(2,1,1,0.76)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#12100C",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderTopColor: "rgba(242,196,107,0.34)",
    padding: 26,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: "rgba(246,243,236,0.24)",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetLabel: { fontFamily: "Outfit_600SemiBold", fontSize: 10, letterSpacing: 3, color: "rgba(242,196,107,0.75)" },
  sheetTitle: { fontFamily: "Outfit_400Regular", fontSize: 26, color: ink.textOnWatches, marginTop: 8 },
  sheetAppraised: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 10,
    letterSpacing: 2,
    color: "rgba(246,243,236,0.6)",
    marginTop: 22,
  },
  sheetValue: { fontFamily: "Outfit_600SemiBold", fontSize: 40, letterSpacing: -0.4, color: "#fff", marginTop: 5 },
  sheetRange: {
    fontFamily: "Outfit_500Medium",
    fontSize: 12.5,
    color: "rgba(246,243,236,0.62)",
    marginTop: 10,
    lineHeight: 19,
  },
  sheetNote: {
    marginTop: 18,
    padding: 13,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  sheetNoteText: { fontFamily: "Outfit_400Regular", fontSize: 11.5, lineHeight: 18, color: "rgba(246,243,236,0.6)" },
  sheetClose: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(246,243,236,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  sheetCloseLabel: { fontFamily: "Outfit_700Bold", fontSize: 13, letterSpacing: 1, color: ink.textOnWatches },
});
