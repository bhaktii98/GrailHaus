import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Listing } from "@grailhaus/shared";
import { CardFace } from "../../components/CardFace";
import { WatchDial } from "../../components/WatchDial";
import { itemArtGradient } from "../../content/cardArt";
import { useSessionViewModel } from "../../viewmodels/useSessionViewModel";
import { useAuthStore } from "../../state/authStore";
import { useListingViewModel } from "../../viewmodels/useListingViewModel";
import { useRarityTiers } from "../../viewmodels/useRarityTiers";
import { useActionBarPadding, useHideTabBarOnScreen } from "../../navigation/tabBarVisibility";
import { marketplaceService, type FeePreview } from "../../services/marketplaceService";
import { colors, ink, typography } from "../../theme/tokens";
import { listingDetail as copy, editPriceSheet as editCopy } from "../../content/copy";
import type { MarketplaceStackParamList } from "../../navigation/MarketplaceStack";

type Nav = NativeStackNavigationProp<MarketplaceStackParamList, "ListingDetail">;
type Route = RouteProp<MarketplaceStackParamList, "ListingDetail">;

export function ListingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { listing: initialListing } = useRoute<Route>().params;
  // Local copy, not the route param directly — a successful price edit updates this in place
  // (plus invalidates the shared ["listings"] query for Browse) rather than needing a
  // navigation.setParams round-trip just to reflect the new ask on this same screen.
  const [listing, setListing] = useState(initialListing);
  const [editOpen, setEditOpen] = useState(false);
  const item = listing.item;
  // Cards gets its own bespoke visual register (art shape, wash/button color); everything else
  // (watches, and any category added after, e.g. handbags) shares the other register as a
  // generic fallback — same "cards is special, else shared" rule used throughout this pass.
  const isCards = item.category === "cards";
  // Admin-configurable (rarity_tiers table) — this used to be a hardcoded "Common"/"Rare"/
  // "Chase" map that didn't even match the real tier names ("Core"/"Prime"/"Grail" etc.).
  const rarityTiers = useRarityTiers(item.category);
  const session = useSessionViewModel();
  const requireAuth = useAuthStore((s) => s.requireAuth);
  const { isWorking, delist } = useListingViewModel();
  // Compared on the opaque public id, which both `/me` (Profile.id) and ListingParty.id
  // externalize from the same `profiles.public_id` column — a username match was the old proxy
  // for this and quietly failed for any seller who hadn't set one, showing them "Buy now" on
  // their own listing.
  const isMine = session.profile?.id != null && session.profile.id === listing.seller.id;
  // Leaf screen with its own Buy / Edit-price / Delist action bar — see CardDetailScreen.
  useHideTabBarOnScreen();
  const actionBarPadding = useActionBarPadding();

  async function handleDelist() {
    const result = await delist(listing.id);
    if (result.ok) navigation.goBack();
    else Alert.alert("Couldn't delist", result.error);
  }

  return (
    <View style={styles.fill}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 160 + actionBarPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Wash lives in content coordinates, not as a screen-fixed sibling — a fixed wash
            would stay pinned to the viewport as the header/hero scroll away, bleeding into
            whatever section (seller card, actions) scrolls into that same screen region. */}
        <View style={styles.washWrap}>
          <LinearGradient
            colors={[isCards ? "rgba(177,75,255,0.24)" : "rgba(242,196,107,0.2)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="chevron-back" size={18} color="#fff" />
            </Pressable>
            <Text style={styles.headerLabel}>LISTING</Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={styles.heroWrap}>
            {isCards ? (
              <CardFace
                gradient={itemArtGradient(item)}
                imageUrl={item.textureUrl}
                width={174}
                height={243}
                borderColor="rgba(255,215,94,0.75)"
                badge={(rarityTiers[item.rarityTierLevel]?.name ?? "").toUpperCase()}
                style={styles.rotatedFace}
              />
            ) : (
              <WatchDial art={itemArtGradient(item)} size={150} />
            )}
          </View>

          <Text style={styles.name}>{(item.cardTitle ?? item.watchName ?? item.name).toUpperCase()}</Text>
          <Text style={styles.sub}>{[item.collection ?? item.brand, item.style].filter(Boolean).join(" · ")}</Text>
        </View>

        <View style={styles.info}>

          <View style={styles.askRow}>
            <View>
              <Text style={styles.askLabel}>{copy.ask}</Text>
              <Text style={styles.askValue}>${(listing.priceCents / 100).toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar} />
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{listing.seller.username ? `@${listing.seller.username}` : "Collector"}</Text>
              <Text style={styles.sellerMeta}>{copy.from(listing.seller.username)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: actionBarPadding }]}>
        {/* A resolved listing has no actions left on it — "My Listings" now includes sold and
            delisted rows, so this screen has to say what happened instead of offering an Edit
            price / Delist (or Buy now) that the server would simply reject. */}
        {listing.status !== "active" ? (
          <View style={[styles.resolvedNote, listing.status === "sold" && styles.resolvedNoteSold]}>
            <Ionicons
              name={listing.status === "sold" ? "checkmark-circle" : "close-circle"}
              size={17}
              color={listing.status === "sold" ? "#8BF285" : "rgba(255,255,255,0.55)"}
            />
            <Text style={[styles.resolvedText, listing.status === "sold" && styles.resolvedTextSold]}>
              {listing.status === "sold" ? copy.soldNote : copy.delistedNote}
            </Text>
          </View>
        ) : isMine ? (
          <>
            <Pressable style={styles.editPriceButton} onPress={() => setEditOpen(true)} disabled={isWorking}>
              <Text style={styles.editPriceLabel}>{copy.editPrice}</Text>
            </Pressable>
            <Pressable style={styles.delistButton} onPress={handleDelist} disabled={isWorking}>
              {isWorking ? <ActivityIndicator color="#FF8DA1" /> : <Text style={styles.delistLabel}>{copy.cancelListing}</Text>}
            </Pressable>
          </>
        ) : (
          <Pressable
            style={styles.buyButton}
            onPress={() => requireAuth(() => navigation.navigate("BuyListing", { listing }))}
          >
            <LinearGradient colors={isCards ? ["#B14BFF", "#5B1FD6"] : ["#FFD75E", "#E08A16"]} style={StyleSheet.absoluteFill} />
            <Text style={[styles.buyLabel, !isCards && { color: "#2A1706" }]}>{copy.buyNow}</Text>
            <View style={styles.buyPricePill}>
              <Text style={[styles.buyPriceText, !isCards && { color: "#2A1706" }]}>
                ${(listing.priceCents / 100).toLocaleString()}
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      {isMine && listing.status === "active" && (
        <EditPriceModal
          visible={editOpen}
          listing={listing}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setListing(updated);
            setEditOpen(false);
          }}
        />
      )}
    </View>
  );
}

function EditPriceModal({
  visible,
  listing,
  onClose,
  onSaved,
}: {
  visible: boolean;
  listing: Listing;
  onClose: () => void;
  onSaved: (listing: Listing) => void;
}) {
  const item = listing.item;
  const { isWorking, updatePrice } = useListingViewModel();
  const [priceText, setPriceText] = useState(String(Math.round(listing.priceCents / 100)));
  const [preview, setPreview] = useState<FeePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const priceCents = Math.round((Number(priceText.replace(/[^0-9.]/g, "")) || 0) * 100);

  useEffect(() => {
    if (!visible) return;
    setPriceText(String(Math.round(listing.priceCents / 100)));
    setError(null);
  }, [visible, listing.priceCents]);

  useEffect(() => {
    if (!visible || priceCents <= 0) {
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
  }, [visible, priceCents, item.category, item.rarityTierLevel]);

  async function handleSave() {
    setError(null);
    const result = await updatePrice(listing.id, priceCents);
    if (result.ok) onSaved(result.listing);
    else setError(result.error);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{editCopy.title}</Text>

          <Text style={styles.editAskLabel}>{editCopy.yourAsk}</Text>
          <View style={styles.editAskBox}>
            <Text style={styles.editAskDollar}>$</Text>
            <TextInput
              style={styles.editAskInput}
              value={priceText}
              onChangeText={setPriceText}
              keyboardType="decimal-pad"
              selectionColor={colors.violetTop}
              autoFocus
            />
          </View>

          {preview && (
            <View style={styles.editSplitCard}>
              <View style={styles.editRow}>
                <Text style={styles.editRowLabel}>{editCopy.platformFee(preview.feePercent)}</Text>
                <Text style={[styles.editRowValue, { color: colors.danger }]}>
                  −${(preview.feeCents / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.editHairline} />
              <View style={styles.editRow}>
                <Text style={styles.editRowLabelBig}>{editCopy.youReceive}</Text>
                <Text style={[styles.editRowValueBig, { color: "#8BF285" }]}>
                  ${(preview.sellerProceedsCents / 100).toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.editSaveButton, (isWorking || priceCents <= 0) && styles.disabled]}
            onPress={handleSave}
            disabled={isWorking || priceCents <= 0}
          >
            {isWorking ? <ActivityIndicator color="#fff" /> : <Text style={styles.editSaveLabel}>{editCopy.save}</Text>}
          </Pressable>
          <Pressable style={styles.editCancelLink} onPress={onClose}>
            <Text style={styles.editCancelLabel}>{editCopy.cancel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: ink.groundDeep },
  scroll: { paddingBottom: 160 },
  washWrap: { position: "relative" },
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
  headerLabel: { ...typography.eyebrow, letterSpacing: 2.4 },
  heroWrap: { alignItems: "center", paddingTop: 16 },
  rotatedFace: { transform: [{ rotate: "-3deg" }] },
  info: { paddingHorizontal: 22, paddingTop: 18 },
  name: { ...typography.pageHeading, fontSize: 30, textAlign: "center", paddingHorizontal: 22 },
  sub: { ...typography.sectionSub, marginTop: 5, textAlign: "center", paddingHorizontal: 22 },
  askRow: { alignItems: "center", marginTop: 18 },
  askLabel: typography.eyebrow,
  askValue: { ...typography.heroWordmark, fontSize: 34, marginTop: 3 },
  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 20,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sellerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.violetTop },
  sellerInfo: { flex: 1, minWidth: 0 },
  sellerName: { ...typography.body, fontSize: 13 },
  sellerMeta: { ...typography.footNote, marginTop: 1 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingTop: 16,
    gap: 10,
    // Opaque ground + hairline so the action bar reads as a fixed bar rather than buttons
    // floating over whatever text happens to scroll behind them.
    backgroundColor: ink.groundDeep,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  resolvedNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
  },
  resolvedNoteSold: { backgroundColor: "rgba(99,232,92,0.12)", borderColor: "rgba(99,232,92,0.4)" },
  resolvedText: { ...typography.chipLabel, fontSize: 13, color: "rgba(255,255,255,0.6)" },
  resolvedTextSold: { color: "#8BF285" },
  editPriceButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(143,169,255,0.14)",
    borderWidth: 1.5,
    borderColor: "rgba(143,169,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  editPriceLabel: { ...typography.chipLabel, fontSize: 14, color: "#B8C6FF" },
  buyButton: {
    height: 60,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    overflow: "hidden",
  },
  buyLabel: { ...typography.buttonLabel, color: "#fff" },
  buyPricePill: { height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.22)", justifyContent: "center" },
  buyPriceText: { ...typography.chipLabel, fontSize: 14, color: "#fff" },
  delistButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(255,92,122,0.14)",
    borderWidth: 1.5,
    borderColor: "rgba(255,92,122,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  delistLabel: { ...typography.chipLabel, fontSize: 14, color: "#FF8DA1" },

  sheetOverlay: { flex: 1, backgroundColor: "rgba(6,3,14,0.72)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#171029",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderTopColor: "rgba(255,255,255,0.16)",
    padding: 22,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.24)",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: { ...typography.pageHeading, fontSize: 20, textAlign: "center" },
  editAskLabel: { ...typography.eyebrow, marginTop: 22 },
  editAskBox: {
    marginTop: 10,
    height: 84,
    borderRadius: 18,
    backgroundColor: "rgba(143,169,255,0.12)",
    borderWidth: 2,
    borderColor: "rgba(143,169,255,0.6)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  editAskDollar: { fontFamily: "Outfit_600SemiBold", fontSize: 22, color: "rgba(255,255,255,0.5)" },
  editAskInput: {
    fontFamily: "Outfit_900Black",
    fontSize: 40,
    letterSpacing: -0.5,
    color: "#fff",
    minWidth: 80,
    textAlign: "center",
    padding: 0,
  },
  editSplitCard: {
    marginTop: 18,
    padding: 15,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
  },
  editRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  editRowLabel: { ...typography.sectionSub },
  editRowLabelBig: { ...typography.body, color: colors.textPrimary },
  editRowValue: { ...typography.body },
  editRowValueBig: { ...typography.heroWordmark, fontSize: 24 },
  editHairline: { height: 1, backgroundColor: "rgba(255,255,255,0.14)", marginVertical: 12 },
  error: { ...typography.errorText, marginTop: 12, textAlign: "center" },
  editSaveButton: {
    marginTop: 20,
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.violetTop,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.5 },
  editSaveLabel: { ...typography.buttonLabel, color: "#fff" },
  editCancelLink: { marginTop: 14, alignItems: "center" },
  editCancelLabel: { ...typography.body, color: colors.textSecondary },
});
