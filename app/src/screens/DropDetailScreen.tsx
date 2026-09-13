import { useEffect, useRef, useState } from "react";
import { Alert, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from "react-native-svg";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming, Easing } from "react-native-reanimated";
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
import { useDropLiveFeed } from "../viewmodels/useDropLiveFeed";
import { useSessionViewModel } from "../viewmodels/useSessionViewModel";
import { usePackFlowViewModel } from "../viewmodels/usePackFlowViewModel";
import { useAuthStore } from "../state/authStore";
import { CountdownBoxes } from "../components/Countdown";
import { ConfirmPurchaseSheet } from "../components/ConfirmPurchaseSheet";
import { fonts, ink, spacing } from "../theme/tokens";
import { dropDetail as copy } from "../content/copy";
import type { RootTabParamList } from "../navigation/RootTabs";
import type { AppStackParamList } from "../navigation/AppNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const GOLD = "#F6C040";
const GOLD_DEEP = "#E0A51C";
const PINK = "#FF3D71";
const { width: SCREEN_W } = Dimensions.get("window");
/** How tall the hero background image runs, measured from where the scroll content starts
 * (i.e. below the floating back/gear buttons) — not from the very top of the image itself,
 * which extends further up behind the status bar/buttons (see the inline `top` offset where
 * it's rendered). */
const HERO_HEIGHT = 420;
/** Positive = the image's own top edge starts this far *below* the hero's top (revealing solid
 * black above it, matching the fill/blob background); the bottom edge always stays pinned at
 * HERO_HEIGHT regardless of this value. */
const HERO_TOP_SHIFT = 90;

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

/** The claims feed itself is real now (see useDropLiveFeed) — genuine recent pulls of this exact
 * pack, pushed live over the drop's own WebSocket channel. Viewer count, the sold-out timer, and
 * the next-drop teaser below stay static placeholder copy: there's no viewer-presence tracking
 * or queued-drops backend behind those yet, so they're flagged here rather than invented as if
 * they were live numbers. */
const PLACEHOLDER_VIEWER_COUNT = "1,842 watching";
const PLACEHOLDER_SOLD_OUT_IN = "Sold out in 41 seconds";
const PLACEHOLDER_NEXT_DROP = { name: "NEO GENESIS", meta: "Cards · 500 units", eta: "2d 04h" };

/** "now" / "4s" / "3m" / "2h" — same granularity as the reference mockup's own `ago()`, just fed
 * a real ISO timestamp off `RecentPull.acquiredAt` instead of a fabricated `Date.now() - N`. */
function formatClaimAgo(acquiredAtIso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(acquiredAtIso).getTime()) / 1000));
  if (seconds < 3) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

/** Renders a "Series: Drop Name" title as two gradient-filled lines (plain white→grey lead-in,
 * gold payoff on its own line) — an SVG text mask, same technique the reference mockup used
 * (there via @react-native-masked-view, which this app doesn't otherwise depend on; this gets
 * the identical look off react-native-svg, already a dependency everywhere else in the app, so
 * it doesn't add a new native module just for two lines of gradient text). A name with no colon
 * renders as one plain gradient line. Closed drops skip the gradient entirely — a plain muted
 * line reads better than a gold treatment on something no longer live. */
function DropTitle({ name, muted }: { name: string; muted?: boolean }) {
  const splitAt = name.indexOf(":");
  const lead = splitAt === -1 ? name : name.slice(0, splitAt + 1);
  const payoff = splitAt === -1 ? null : name.slice(splitAt + 1).trim();
  const svgWidth = SCREEN_W - 48;

  if (muted) {
    return (
      <Text style={[styles.title, styles.titleMuted]}>
        {lead}
        {payoff ? `\n${payoff}` : ""}
      </Text>
    );
  }

  return (
    <View>
      <Svg width={svgWidth} height={44}>
        <Defs>
          <SvgLinearGradient id="titleLead" x1="0" y1="0" x2="1" y2="0.4">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#CFC6D6" />
          </SvgLinearGradient>
        </Defs>
        <SvgText x="0" y="34" fontSize={35} fontFamily={fonts.black} letterSpacing={-0.5} fill="url(#titleLead)">
          {lead}
        </SvgText>
      </Svg>
      {payoff && (
        <Svg width={svgWidth} height={44} style={{ marginTop: -6 }}>
          <Defs>
            <SvgLinearGradient id="titlePayoff" x1="0" y1="0" x2="1" y2="0.4">
              <Stop offset="0" stopColor={GOLD} />
              <Stop offset="0.5" stopColor="#FFE9A3" />
              <Stop offset="1" stopColor="#E3A520" />
            </SvgLinearGradient>
          </Defs>
          <SvgText x="0" y="34" fontSize={35} fontFamily={fonts.black} letterSpacing={-0.5} fill="url(#titlePayoff)">
            {payoff}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

/** The pulsing dot next to "LIVE NOW" — opacity+scale breathing loop. */
function LiveDot() {
  const t = useSharedValue(1);
  useEffect(() => {
    t.value = withRepeat(withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: t.value }] }));
  return <Animated.View style={[styles.liveDot, style]} />;
}

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
  const ctaScale = useSharedValue(1);
  const ctaAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));
  // Called unconditionally (Rules of Hooks) even before `drop` itself has loaded — `active` just
  // stays false until phase is known, so the socket only ever opens once this really is live.
  const { claims, liveStockRemaining } = useDropLiveFeed(packId, drop?.phase === "live");

  // Gated here, before the confirm sheet ever opens — not inside handleConfirm — because that
  // sheet is itself a native Modal, and requireAuth's own sign-in sheet is too; two Modals open
  // at once is unreliable (especially on Android), so a guest never gets past this point without
  // the confirm sheet opening at all. By the time handleConfirm runs, sign-in is guaranteed.
  function handleOpenSheet() {
    requireAuth(() => setSheetOpen(true));
  }

  function handleConfirm() {
    if (!drop) return;
    if (isRippingRef.current) return;
    const sku = drop.sku;
    (async () => {
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
    })();
  }

  if (!drop) {
    return <View style={styles.fill} />;
  }

  const { sku, phase } = drop;
  const blobColor =
    phase === "soon" ? "rgba(242,196,107,0.1)" : phase === "live" ? "rgba(190,50,150,0.08)" : "rgba(255,255,255,0.04)";
  const maxStock = sku.maxStock ?? 0;
  // A push already arrived this session takes priority over the polled value — it's strictly
  // newer (see useDropLiveFeed), and this is exactly the number the live claims feed below is
  // scoped to keep in sync with.
  const remaining = liveStockRemaining ?? sku.stockRemaining ?? 0;
  const claimedCount = Math.max(0, maxStock - remaining);

  return (
    <View style={styles.fill}>
      {/* Flat black (set on `fill` below) — matching the hero image's own near-black background
          exactly, not just approximating it with a gradient, so there's no visible tone shift
          where the image ends and the page background begins. */}
      <View style={[styles.blob, { left: -60, top: 140, backgroundColor: blobColor }]} pointerEvents="none" />
      <View
        style={[styles.blob, { right: -70, top: 220, backgroundColor: "rgba(190,50,150,0.06)" }]}
        pointerEvents="none"
      />

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

      {phase !== "closed" && (
        <Pressable
          style={[styles.gearButton, { top: insets.top + 12 }]}
          onPress={() => Alert.alert(copy.claim, copy.fairness)}
          hitSlop={12}
        >
          <Ionicons name="settings-sharp" size={17} color="rgba(255,255,255,0.85)" />
        </Pressable>
      )}

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
          {/* The background for the whole hero, not a boxed image below the text — it runs from
              behind the status bar/back-gear buttons down through HERO_HEIGHT, with the title
              etc. sitting on top of it (a plain sibling further down, so it stacks above by
              render order alone, no zIndex needed). */}
          <Image
            source={require("../../assets/Midnight.png")}
            style={[
              styles.heroBgImage,
              // Shifted down further still — starts *below* the status bar now (a positive
              // offset, not just "less negative"), so there's a real strip of solid black above
              // the image itself before it begins, not just less overlap with the buttons.
              // Bottom edge stays pinned at HERO_HEIGHT either way (top + height is constant), so
              // only the *top* moves.
              { top: HERO_TOP_SHIFT, height: HERO_HEIGHT - HERO_TOP_SHIFT },
              phase === "closed" && styles.heroImgClosed,
            ]}
            resizeMode="cover"
          />
          {/* Blends the image into the page background at its own top edge rather than showing a
              hard photo edge there — this is what makes it read as "the background", not a
              banner pasted on top of one. */}
          <LinearGradient
            colors={["#000000", "rgba(0,0,0,0.35)", "transparent"]}
            locations={[0, 0.6, 1]}
            style={[styles.heroTopFade, { top: HERO_TOP_SHIFT, height: 130 }]}
            pointerEvents="none"
          />
          {/* Same idea at the bottom — fades the image out into the page background before the
              Remaining/Claims panel starts, instead of the image just stopping dead. */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.85)", "#000000"]}
            locations={[0, 0.65, 1]}
            style={styles.heroBottomFade}
            pointerEvents="none"
          />

          <View style={styles.heroContent}>
            <View style={styles.eyebrowRow}>
              {phase === "live" && <LiveDot />}
              <Text style={[styles.eyebrow, PHASE_EYEBROW_STYLE[phase]]}>{PHASE_EYEBROW[phase]}</Text>
              {phase === "live" && (
                <View style={styles.watchWrap}>
                  <Ionicons name="people" size={14} color="rgba(255,255,255,0.72)" />
                  <Text style={styles.viewerCount}>{PLACEHOLDER_VIEWER_COUNT}</Text>
                </View>
              )}
            </View>

            <View style={{ marginTop: 8 }}>
              <DropTitle name={sku.name} muted={phase === "closed"} />
            </View>

            {phase !== "closed" && <Text style={styles.tagline}>{copy.tagline}</Text>}
            {phase === "soon" && <Text style={styles.body}>{copy.body(sku)}</Text>}
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
                onPress={() => Alert.alert(copy.notifyConfirmTitle, copy.notifyConfirmBody)}
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
              <Text style={styles.remainingMax}>/{maxStock}</Text>
            </View>
            {maxStock > 0 && maxStock <= 20 && (
              <View style={styles.pipRow}>
                {Array.from({ length: maxStock }).map((_, i) => (
                  <View key={i} style={[styles.pip, i < claimedCount ? styles.pipFilled : styles.pipEmpty]} />
                ))}
              </View>
            )}

            <Text style={[styles.panelEyebrow, styles.claimsEyebrow]}>CLAIMS</Text>
            <View style={styles.claimsCard}>
              {claims.length > 0 ? (
                claims.map((claim, i) => (
                  <View key={claim.ownedItemId} style={[styles.claimRow, { opacity: Math.max(0.34, 1 - i * 0.13) }]}>
                    <View style={[styles.claimAvatar, { backgroundColor: CLAIM_AVATAR_COLORS[i % CLAIM_AVATAR_COLORS.length] }]} />
                    <Text style={styles.claimText} numberOfLines={1}>
                      <Text style={styles.claimUser}>{claim.username ? `@${claim.username}` : "a collector"}</Text> claimed{" "}
                      {claim.item.cardTitle ?? claim.item.watchName ?? claim.item.name}
                    </Text>
                    <Text style={styles.claimTime}>{formatClaimAgo(claim.acquiredAt)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.claimsEmpty}>Nobody's claimed one yet — be the first.</Text>
              )}
            </View>
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
          <AnimatedPressable
            onPress={handleOpenSheet}
            onPressIn={() => (ctaScale.value = withSpring(0.985, { damping: 15 }))}
            onPressOut={() => (ctaScale.value = withSpring(1, { damping: 15 }))}
            style={ctaAnimatedStyle}
          >
            <LinearGradient colors={["#FFD863", "#F0B52C", "#E2A41E"]} locations={[0, 0.55, 1]} style={styles.cta}>
              <Text style={styles.ctaText}>
                {copy.claim} · ${(sku.priceCents / 100).toLocaleString()}
              </Text>
              <View style={styles.ctaArrow}>
                <Ionicons name="arrow-forward" size={18} color={GOLD} />
              </View>
            </LinearGradient>
          </AnimatedPressable>
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

const CLAIM_AVATAR_COLORS = ["#D9A43C", "#3F7FD8", "#3F9B5C", "#C4666E", "#9A9AA2", "#7D5334"];

const PHASE_EYEBROW: Record<"soon" | "live" | "closed", string> = {
  soon: "NOT YET LIVE",
  live: "LIVE NOW",
  closed: "CLOSED",
};

const PHASE_EYEBROW_STYLE = {
  soon: { color: "rgba(242,196,107,0.85)" },
  live: { color: PINK },
  closed: { color: "rgba(255,255,255,0.62)" },
} as const;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000000" },
  blob: { position: "absolute", width: 290, height: 330, borderRadius: 165 },
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
  gearButton: {
    position: "absolute",
    right: 20,
    zIndex: 1,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  // `marginHorizontal: -24` cancels the scroll's own side padding (see `scroll` below) so the
  // absolutely-positioned background image runs edge-to-edge; `heroContent` (a normal in-flow
  // child, stacking above the image/fades purely by render order) puts that padding right back
  // for the actual title/text so it doesn't also run edge-to-edge.
  heroWrap: { position: "relative", marginHorizontal: -24, minHeight: HERO_HEIGHT },
  // An explicit numeric `width` (not `left:0, right:0`, letting layout compute it) — on Android,
  // resizeMode="cover" can miscalculate its scale-to-cover math when an absolutely-positioned
  // Image's width comes from layout rather than a real number, and stretches instead of cropping.
  heroBgImage: { position: "absolute", left: 0, width: SCREEN_W },
  heroTopFade: { position: "absolute", left: 0, right: 0 },
  heroBottomFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 140 },
  heroContent: { paddingHorizontal: 24, paddingTop: 4 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PINK,
    shadowColor: PINK,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 2.86 },
  watchWrap: { flexDirection: "row", alignItems: "center", gap: 7, marginLeft: "auto" },
  viewerCount: { fontFamily: fonts.medium, fontSize: 12, color: "rgba(255,255,255,0.72)" },
  title: {
    fontFamily: fonts.black,
    fontSize: 34,
    letterSpacing: -1.02,
    lineHeight: 36,
    color: ink.text,
  },
  titleMuted: { color: "rgba(255,255,255,0.62)" },
  tagline: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    lineHeight: 20,
    color: "rgba(255,255,255,0.68)",
    marginTop: 8,
    maxWidth: 260,
  },
  body: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    lineHeight: 21.6,
    color: "rgba(255,255,255,0.55)",
    marginTop: 12,
  },
  // Breaks out of the scroll's own 24pt side padding (see `scroll` below) so the image runs
  // edge-to-edge instead of sitting in a small centered box.
  heroImgClosed: { opacity: 0.4 },

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
  notifyLabel: { fontFamily: fonts.extrabold, fontSize: 13.5, color: GOLD },

  livePanel: { marginTop: spacing.xl },
  remainingRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 2 },
  remainingValue: { fontFamily: fonts.black, fontSize: 31, lineHeight: 34, color: GOLD },
  remainingMax: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: "rgba(255,255,255,0.42)" },
  pipRow: { flexDirection: "row", gap: 4, marginTop: 9 },
  pip: { flex: 1, height: 7, borderRadius: 4 },
  pipFilled: { backgroundColor: GOLD },
  pipEmpty: { backgroundColor: "rgba(255,255,255,0.1)" },
  claimsEyebrow: { marginTop: 26 },
  claimsCard: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  claimsEmpty: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    paddingVertical: 16,
    textAlign: "center",
  },
  claimRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  claimAvatar: { width: 22, height: 22, borderRadius: 11 },
  claimText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.62)" },
  claimUser: { fontFamily: fonts.semibold, color: ink.text },
  claimTime: { fontFamily: fonts.medium, fontSize: 12, color: "rgba(255,255,255,0.42)" },

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
    backgroundColor: "#000000",
  },
  cta: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GOLD_DEEP,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  ctaText: { fontFamily: fonts.bold, fontSize: 17, letterSpacing: 0.4, color: "#1A1005" },
  ctaArrow: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#120B04",
    alignItems: "center",
    justifyContent: "center",
  },
  fairnessNote: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    lineHeight: 17,
    color: "rgba(255,255,255,0.62)",
    textAlign: "center",
    marginTop: 4,
  },
});
