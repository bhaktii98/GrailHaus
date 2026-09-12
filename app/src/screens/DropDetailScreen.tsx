import { useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  type RouteProp,
  type CompositeNavigationProp,
} from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDropDetailViewModel } from "../viewmodels/useDropDetailViewModel";
import { useSessionViewModel } from "../viewmodels/useSessionViewModel";
import { usePackFlowViewModel } from "../viewmodels/usePackFlowViewModel";
import { useAuthStore } from "../state/authStore";
import { CountdownBoxes } from "../components/Countdown";
import { ConfirmPurchaseSheet } from "../components/ConfirmPurchaseSheet";
import { BoxGlyph } from "../components/BoxGlyph";
import { fonts, ink, spacing } from "../theme/tokens";
import { dropDetail as copy } from "../content/copy";
import type { RootTabParamList } from "../navigation/RootTabs";
import type { AppStackParamList } from "../navigation/AppNavigator";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<AppStackParamList, "DropDetail">,
  BottomTabNavigationProp<RootTabParamList>
>;

/** DropDetail sits on the root stack, a sibling of `Tabs` rather than a descendant of it — a
 * plain `navigate("Home")` can't bubble into the tab tree from here (react-navigation only
 * bubbles through actual ancestors) and silently no-ops. Same nested-navigate workaround used by
 * RevealScreen/ItemForkScreen for the same root-stack-to-tab jump. */
function rootNavigateHome(navigation: Nav) {
  (navigation.navigate as (name: string, params?: object) => void)("Tabs", { screen: "Home" });
}

/** Fixed illustrative content for the "live" claims feed and the "closed"
 * next-drop teaser — the app has no claims log, viewer-count, sold-out-timer
 * or queued-drops backend, so these stay static placeholder copy straight
 * from the mockup rather than invented live numbers. */
const PLACEHOLDER_CLAIMS = [
  { handle: "@heirloom", time: "now", opacity: 1 },
  { handle: "@vaultrat", time: "4s", opacity: 0.9 },
  { handle: "@toploader", time: "9s", opacity: 0.72 },
  { handle: "@slabbed", time: "15s", opacity: 0.56 },
  { handle: "@fifthgen", time: "22s", opacity: 0.4 },
  { handle: "@casebound", time: "31s", opacity: 0.24 },
];
const PLACEHOLDER_VIEWER_COUNT = "1,842 watching";
const PLACEHOLDER_SOLD_OUT_IN = "Sold out in 41 seconds";
const PLACEHOLDER_NEXT_DROP = { name: "NEO GENESIS", meta: "Cards · 500 units", eta: "2d 04h" };

export function DropDetailScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { packId } = useRoute<RouteProp<AppStackParamList, "DropDetail">>().params;
  const { drop } = useDropDetailViewModel(packId);
  const session = useSessionViewModel();
  const flow = usePackFlowViewModel();
  const requireAuth = useAuthStore((s) => s.requireAuth);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isRippingRef = useRef(false);

  function handleConfirm() {
    if (!drop) return;
    const sku = drop.sku;
    requireAuth(async () => {
      if (isRippingRef.current) return;
      isRippingRef.current = true;
      try {
        const result = await flow.startFlow(sku);
        if (result.ok) {
          setSheetOpen(false);
          navigation.navigate("Reveal");
        } else {
          Alert.alert("Couldn't claim that drop", result.error);
        }
      } finally {
        isRippingRef.current = false;
      }
    });
  }

  if (!drop) {
    return <View style={styles.fill} />;
  }

  const { sku, phase } = drop;
  const washColor =
    phase === "soon" ? "rgba(242,196,107,0.24)" : phase === "live" ? "rgba(255,92,122,0.28)" : "transparent";
  const maxStock = sku.maxStock ?? 0;
  const remaining = sku.stockRemaining ?? 0;
  const claimedCount = Math.max(0, maxStock - remaining);

  return (
    <View style={styles.fill}>
      {/* Every other detail screen in the app has an explicit back button (see PackDetailScreen,
          VaultDetailScreen, etc.) — this one previously relied solely on the OS swipe-back
          gesture/hardware back, which is easy to miss and inconsistent with the rest of the app. */}
      <Pressable
        style={[styles.backButton, { top: insets.top + 12 }]}
        onPress={() => navigation.goBack()}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={18} color="#fff" />
      </Pressable>
      <ScrollView
        // Cleared below the floating back button above (insets.top + 12, 38pt tall) rather than
        // just below the status bar, so the hero eyebrow/title row doesn't sit underneath it.
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 60, paddingBottom: 140 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <LinearGradient colors={[washColor, "transparent"]} style={StyleSheet.absoluteFill} />

          <View style={styles.eyebrowRow}>
            {phase === "live" && <View style={styles.liveDot} />}
            <Text style={[styles.eyebrow, PHASE_EYEBROW_STYLE[phase]]}>{PHASE_EYEBROW[phase]}</Text>
            {phase === "live" && <Text style={styles.viewerCount}>{PLACEHOLDER_VIEWER_COUNT}</Text>}
          </View>

          <Text style={[styles.title, phase === "closed" && styles.titleMuted]}>{sku.name}</Text>

          {phase === "soon" && <Text style={styles.body}>{copy.body(sku)}</Text>}

          <View style={styles.heroArtOuter}>
            <View
              style={[
                styles.heroArt,
                phase === "soon" && styles.heroArtSoon,
                phase === "closed" && styles.heroArtClosed,
              ]}
            >
              <LinearGradient
                colors={phase === "closed" ? ["#2A2620", "#131110"] : ["#FFF8E4", "#B39550", "#120C04"]}
                start={{ x: 0.3, y: 0.15 }}
                end={{ x: 0.7, y: 0.9 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={["transparent", "rgba(255,255,255,0.34)", "transparent"]}
                locations={[0.3, 0.46, 0.58]}
                start={{ x: 0.05, y: 0.28 }}
                end={{ x: 0.95, y: 0.72 }}
                style={StyleSheet.absoluteFill}
              />
              {phase === "soon" && (
                <View style={styles.heroGlyph}>
                  <BoxGlyph size={44} />
                </View>
              )}
            </View>
          </View>
        </View>

        {phase === "soon" && sku.goesLiveAt && (
          <View style={styles.opensPanel}>
            <Text style={styles.panelEyebrow}>{copy.goesLiveIn}</Text>
            <CountdownBoxes target={sku.goesLiveAt} />
            <View style={styles.opensBottomRow}>
              <View>
                <Text style={styles.opensPrice}>${(sku.priceCents / 100).toLocaleString()}</Text>
                <Text style={styles.opensMeta}>{maxStock} units · 1 per account</Text>
              </View>
              <Pressable
                style={styles.notifyButton}
                onPress={() =>
                  Alert.alert(
                    copy.notifyConfirmTitle,
                    copy.notifyConfirmBody
                  )
                }
              >
                <Text style={styles.notifyLabel}>NOTIFY ME</Text>
              </Pressable>
            </View>
          </View>
        )}

        {phase === "live" && (
          <View style={styles.livePanel}>
            <Text style={styles.panelEyebrow}>{copy.remaining}</Text>
            <View style={styles.remainingRow}>
              <Text style={styles.remainingValue}>{remaining}</Text>
              <Text style={styles.remainingMax}> / {maxStock}</Text>
            </View>
            {maxStock > 0 && maxStock <= 20 && (
              <View style={styles.pipRow}>
                {Array.from({ length: maxStock }).map((_, i) => (
                  <View key={i} style={[styles.pip, i < claimedCount ? styles.pipFilled : styles.pipEmpty]} />
                ))}
              </View>
            )}

            <Text style={[styles.panelEyebrow, styles.claimsEyebrow]}>CLAIMS</Text>
            <View style={styles.claimsDivider} />
            {PLACEHOLDER_CLAIMS.map((claim, i) => (
              <View key={claim.handle} style={[styles.claimRow, { opacity: claim.opacity }]}>
                <LinearGradient colors={CLAIM_AVATAR_COLORS[i % CLAIM_AVATAR_COLORS.length]} style={styles.claimAvatar} />
                <Text style={styles.claimText} numberOfLines={1}>
                  {claim.handle} claimed unit {Math.max(0, claimedCount - i)}
                </Text>
                <Text style={styles.claimTime}>{claim.time}</Text>
              </View>
            ))}
          </View>
        )}

        {phase === "closed" && (
          <>
            <View style={styles.soldOutCard}>
              <Text style={styles.soldOutTitle}>{PLACEHOLDER_SOLD_OUT_IN}</Text>
              <Text style={styles.soldOutBody}>
                All {maxStock} claimed. You weren't charged — nothing left your balance.
              </Text>
            </View>
            <View style={styles.nextDropCard}>
              <Text style={styles.panelEyebrow}>NEXT DROP</Text>
              <View style={styles.nextDropRow}>
                <View>
                  <Text style={styles.nextDropName}>{PLACEHOLDER_NEXT_DROP.name}</Text>
                  <Text style={styles.nextDropMeta}>{PLACEHOLDER_NEXT_DROP.meta}</Text>
                </View>
                <Text style={styles.nextDropEta}>{PLACEHOLDER_NEXT_DROP.eta}</Text>
              </View>
              <Pressable style={styles.browseButton} onPress={() => rootNavigateHome(navigation)}>
                <Text style={styles.browseLabel}>BROWSE THE SHELF</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      {phase === "live" && (
        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          <Pressable onPress={() => setSheetOpen(true)} style={styles.claimButton}>
            <Text style={styles.claimLabel}>
              {copy.claim} · ${(sku.priceCents / 100).toLocaleString()}
            </Text>
          </Pressable>
          <Text style={styles.fairnessNote}>{copy.fairness}</Text>
        </View>
      )}

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

const CLAIM_AVATAR_COLORS: [string, string][] = [
  ["#D9A15C", "#6B4B26"],
  ["#6E9BFF", "#2B3D6B"],
  ["#9BD37F", "#3A5230"],
  ["#D98A7F", "#5C332E"],
  ["#EDE7DA", "#6B6862"],
  ["#D9A15C", "#6B4B26"],
];

const PHASE_EYEBROW: Record<"soon" | "live" | "closed", string> = {
  soon: "NOT YET LIVE",
  live: "LIVE NOW",
  closed: "CLOSED",
};

const PHASE_EYEBROW_STYLE = {
  soon: { color: "rgba(242,196,107,0.85)" },
  live: { color: "#FF8DA1" },
  closed: { color: "rgba(255,255,255,0.62)" },
} as const;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0B0716" },
  scroll: { padding: 24, paddingTop: 63, paddingBottom: 40 },
  backButton: {
    position: "absolute",
    left: 20,
    zIndex: 1,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroWrap: { position: "relative" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF5C7A",
    shadowColor: "#FF5C7A",
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 2.86 },
  viewerCount: { fontFamily: fonts.semibold, fontSize: 12, color: "rgba(255,255,255,0.62)", marginLeft: "auto" },
  title: {
    fontFamily: fonts.black,
    fontSize: 34,
    letterSpacing: -1.02,
    lineHeight: 36,
    color: ink.text,
    marginTop: 12,
  },
  titleMuted: { color: "rgba(255,255,255,0.62)" },
  body: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    lineHeight: 21.6,
    color: "rgba(255,255,255,0.55)",
    marginTop: 12,
  },
  heroArtOuter: { alignItems: "center", marginTop: spacing.xl },
  heroArt: {
    width: 154,
    height: 154,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(242,196,107,0.5)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.7,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 24 },
  },
  heroArtSoon: { width: 184, height: 184, transform: [{ rotate: "-4deg" }] },
  heroArtClosed: { borderColor: "rgba(255,255,255,0.08)" },
  heroGlyph: { position: "absolute" },

  panelEyebrow: { fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 2.4, color: "rgba(255,255,255,0.62)" },

  opensPanel: {
    marginTop: spacing.xl,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(242,196,107,0.28)",
  },
  opensBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
  },
  opensPrice: { fontFamily: fonts.black, fontSize: 26, color: ink.text },
  opensMeta: { fontFamily: fonts.semibold, fontSize: 11, color: "rgba(255,255,255,0.62)", marginTop: 6 },
  notifyButton: {
    height: 48,
    minWidth: 116,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: "rgba(242,196,107,0.16)",
    borderWidth: 1,
    borderColor: "rgba(242,196,107,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifyLabel: { fontFamily: fonts.extrabold, fontSize: 13.5, color: "#F2C46B" },

  livePanel: { marginTop: spacing.xl },
  remainingRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
  remainingValue: { fontFamily: fonts.black, fontSize: 32, color: "#F2C46B" },
  remainingMax: { fontFamily: fonts.bold, fontSize: 14, color: "rgba(255,255,255,0.62)" },
  pipRow: { flexDirection: "row", gap: 4, marginTop: 14 },
  pip: { flex: 1, height: 6, borderRadius: 4 },
  pipFilled: { backgroundColor: "#D9A15C" },
  pipEmpty: { backgroundColor: "rgba(237,231,218,0.12)" },
  claimsEyebrow: { marginTop: 26 },
  claimsDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginTop: 10 },
  claimRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  claimAvatar: { width: 26, height: 26, borderRadius: 13 },
  claimText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: ink.text },
  claimTime: { fontFamily: fonts.semibold, fontSize: 10.5, color: "rgba(255,255,255,0.62)" },

  soldOutCard: {
    marginTop: spacing.xl,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  soldOutTitle: { fontFamily: fonts.black, fontSize: 22, color: ink.text },
  soldOutBody: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20.8, color: "rgba(255,255,255,0.5)", marginTop: 10 },
  nextDropCard: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  nextDropRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 14 },
  nextDropName: { fontFamily: fonts.black, fontSize: 20, color: ink.text },
  nextDropMeta: { fontFamily: fonts.semibold, fontSize: 11, color: "rgba(255,255,255,0.62)", marginTop: 4 },
  nextDropEta: { fontFamily: fonts.extrabold, fontSize: 16, color: "#C99BFF" },
  browseButton: {
    marginTop: 20,
    height: 58,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  browseLabel: { fontFamily: fonts.extrabold, fontSize: 14, letterSpacing: 0.7, color: ink.text },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingTop: 0,
    gap: spacing.sm,
    backgroundColor: "#0B0716",
  },
  claimButton: {
    height: 66,
    borderRadius: 18,
    backgroundColor: "#F2C46B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    shadowColor: "#F2C46B",
    shadowOpacity: 0.4,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
  },
  claimLabel: { fontFamily: fonts.black, fontSize: 16, letterSpacing: 1.12, color: "#1A1206" },
  fairnessNote: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: "rgba(255,255,255,0.62)",
    textAlign: "center",
  },
});
