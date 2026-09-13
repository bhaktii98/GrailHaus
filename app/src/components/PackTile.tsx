import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { PackSku } from "@grailhaus/shared";
import { accents, fonts, typography } from "../theme/tokens";
import { packTile as packTileCopy } from "../content/copy";
import { WatchDial } from "./WatchDial";
import { StockBar } from "./StockBar";
import { Crown } from "./Crown";
import { PACK_RENDER } from "../content/localArt";

/** Display-only labels/art — matches the mockup's own tier vocabulary
 * (CASUAL/MID/HIGH-STAKES, ENTRY/SIGNATURE/GRAIL). Not admin-configurable:
 * only the economics (price, odds, rarity) are meant to be data-driven —
 * this is just how a fixed set of six SKUs is captioned. Exported so other
 * screens (ConfirmPurchaseSheet, ShelfScreen's tier rows, ...) can render the
 * same tier chip/art without re-deriving them. */
export const TIER_LABEL: Record<string, string> = {
  street_rip: "CASUAL",
  vault_break: "MID",
  black_label: "HIGH-STAKES",
  reserve: "ENTRY",
  archive: "SIGNATURE",
  obsidian_vault: "GRAIL",
};

/** A pack SKU whose `tier` slug isn't one of the six curated ones above (any pack created for a
 * new category via the admin dashboard, e.g. "atelier_drop") used to fall back to the raw slug
 * uppercased with its underscore intact ("ATELIER_DROP") — every call site duplicated that same
 * `tierLabel(sku)` fallback, so it's centralized here once, with
 * the fallback itself prettified (spaces instead of underscores) instead of showing the raw slug. */
export function tierLabel(sku: { tier: string }): string {
  return TIER_LABEL[sku.tier] ?? sku.tier.replace(/_/g, " ").toUpperCase();
}

/** The middle-priced tier per category gets the "MOST POPULAR" badge treatment — GrailhausPacks.js
 * marks Vault Break (cards) and Archive (watches) exactly this way, one per category. */
export const HERO_TIER = new Set(["vault_break", "archive"]);

export const ART_GRADIENT: Record<string, [string, string]> = {
  street_rip: ["#E4FBFF", "#1668D8"],
  vault_break: ["#FFB3F0", "#6420C8"],
  black_label: ["#FFF0CC", "#5C4520"],
  reserve: ["#F4EFE4", "#3A342B"],
  archive: ["#FFF3D6", "#6B4E1E"],
  obsidian_vault: ["#FFF8E4", "#7A5A22"],
};

export function PackTile({
  sku,
  onBuy,
  disabled,
}: {
  sku: PackSku;
  onBuy: (quantity: 1 | 10) => void;
  disabled?: boolean;
}) {
  // Cards is the only multi-item, buy-1-or-×10 category — every other category (watches,
  // handbags, and anything added later) is one item per pack, one at a time, so it gets the
  // same single-item pack row regardless of which category it is. Matching this by exclusion
  // (not `=== "watches"`) is what makes a newly added category (e.g. handbags, which today has
  // only a single drop-style pack, no evergreen tiers yet) render correctly the instant it has
  // real evergreen SKUs, with no code change here.
  if (sku.category !== "cards") return <WatchTileRow sku={sku} onPress={() => onBuy(1)} disabled={disabled} />;
  return <CardTile sku={sku} onBuy={onBuy} disabled={disabled} />;
}

/** Cards: a violet-glowing hero or a compact row, chunky pack art, a stock
 * bar, and a BUY 1 / ×10 button pair right on the tile — matches the
 * mockup's dense, gamified "shop" register for Card World. Bulk (×10) is
 * only offered on Casual/Mid, per the mockup's own footnote and the
 * backend's bulk-purchase rules. */
function CardTile({
  sku,
  onBuy,
  disabled,
}: {
  sku: PackSku;
  onBuy: (quantity: 1 | 10) => void;
  disabled?: boolean;
}) {
  const accent = accents.cards;
  const isHero = HERO_TIER.has(sku.tier);
  const art = ART_GRADIENT[sku.tier] ?? ART_GRADIENT.street_rip;
  const countLabel = packTileCopy.countLabel(sku.category, sku.itemCount);
  // Every card tier can batch now that a bulk buy runs the Grail Hunt presentation rather than
  // replaying a per-pack reveal ten times (see engine/cards/bulk/ and PackDetailScreen's own
  // `bulkEligible`); the only remaining gate is having the stock to actually sell ten.
  const canBulk = sku.stockRemaining == null || sku.stockRemaining >= 10;

  return (
    <View
      style={[
        styles.card,
        isHero ? styles.cardHero : styles.cardRow,
        isHero && { borderColor: `${accent.top}99`, shadowColor: accent.top },
        disabled && styles.cardDisabled,
      ]}
    >
      <View style={[styles.art, isHero ? styles.artHero : styles.artRow]}>
        <LinearGradient colors={art} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.artStrip} />
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.36)", "transparent"]}
          locations={[0.3, 0.46, 0.58]}
          start={{ x: 0.05, y: 0.28 }}
          end={{ x: 0.95, y: 0.72 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.info}>
        <View style={styles.tierPill}>
          <Text style={styles.tierPillText}>{tierLabel(sku)}</Text>
        </View>
        <Text style={[styles.name, isHero && styles.nameHero]} numberOfLines={1}>
          {sku.name}
        </Text>
        <Text style={styles.sub}>{countLabel}</Text>
        <StockBar remaining={sku.stockRemaining} max={sku.maxStock} fillColor={accent.top} />

        <View style={styles.buyRow}>
          <Pressable onPress={() => onBuy(1)} disabled={disabled} style={styles.buyBtnWrap}>
            <LinearGradient colors={[accent.top, accent.bottom]} style={styles.buyBtn}>
              <Text style={styles.buyLabel}>{packTileCopy.buyOne}</Text>
              <LinearGradient colors={["#FFE27A", "#E0A016"]} style={styles.coin} />
              <Text style={styles.buyPrice}>{Math.round(sku.priceCents / 100)}</Text>
            </LinearGradient>
          </Pressable>
          {canBulk && (
            <Pressable onPress={() => onBuy(10)} disabled={disabled} style={styles.buyTenBtn}>
              <Text style={styles.buyTenLabel}>{packTileCopy.buyTen}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Same real-pack-box-and-tier-chip treatment as Shelf's cards TierRow, per GrailhausPacks.js —
 * the reference's own WATCH_TIERS chips are just bigger (30x30, crown + name inside) than the
 * cards ones (18x25, crown only, name below); everything else is the identical `.pack` box. */
function WatchTileRow({ sku, onPress, disabled }: { sku: PackSku; onPress: () => void; disabled?: boolean }) {
  const art = ART_GRADIENT[sku.tier] ?? ART_GRADIENT.reserve;
  const render = PACK_RENDER[sku.tier];
  const isFeatured = HERO_TIER.has(sku.tier);

  return (
    <View style={[styles.watchPack, isFeatured && styles.watchPackPopular]}>
      {isFeatured && (
        <LinearGradient colors={["#3a1263", "#22093f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
          <Crown />
          <Text style={styles.badgeText}>{packTileCopy.mostPopular}</Text>
        </LinearGradient>
      )}

      {/* GrailhausPacks.js's own real box render, bled off the row's edges — falls back to the
          plain circular dial for any tier with no render yet. */}
      <View style={styles.watchPhotoWrap}>
        {render ? (
          <Image source={render} style={styles.watchPhoto} resizeMode="contain" />
        ) : (
          <WatchDial art={art} size={62} />
        )}
      </View>

      <Pressable onPress={onPress} disabled={disabled} style={[styles.watchBody, disabled && styles.cardDisabled]}>
        <View style={styles.packTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.watchTier}>{tierLabel(sku)}</Text>
            <Text style={styles.watchName} numberOfLines={1}>
              {sku.name}
            </Text>
          </View>
          <Text style={typography.priceWatches}>${(sku.priceCents / 100).toLocaleString()}</Text>
        </View>

        <Text style={styles.watchSub}>{packTileCopy.countLabel(sku.category, sku.itemCount)}</Text>
        <StockBar remaining={sku.stockRemaining} max={sku.maxStock} />

        {/* Real rarity tiers this SKU draws from — reference's own WATCH_TIERS chip shape (crown
            + name inside a taller chip), colored from the tier's real admin-configured hex. */}
        <View style={styles.tierGroup}>
          {sku.rarityTiers.map((t) => (
            <LinearGradient
              key={t.level}
              colors={[t.colorHex, darken(t.colorHex, 0.55)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.watchChip, { borderColor: `${t.colorHex}b0` }]}
            >
              <Crown w={13} h={8} fill="#fff" />
              <Text style={styles.watchChipLabel} numberOfLines={1}>
                {t.name}
              </Text>
            </LinearGradient>
          ))}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 14,
    gap: 14,
  },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardDisabled: { opacity: 0.5 },
  cardHero: {
    flexDirection: "column",
    alignItems: "stretch",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 44,
    elevation: 10,
  },
  art: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.34)",
    overflow: "hidden",
  },
  artRow: { width: 80, height: 108, flexShrink: 0, alignSelf: "center" },
  artHero: { width: 142, height: 194, alignSelf: "center" },
  artStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "16%",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderBottomWidth: 2,
    borderBottomColor: "rgba(255,255,255,0.44)",
    borderStyle: "dashed",
  },
  info: { flex: 1, minWidth: 0 },
  tierPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  tierPillText: typography.tierPill,
  name: { ...typography.packName, marginTop: 8 },
  nameHero: { fontSize: typography.packNameHero.fontSize, lineHeight: typography.packNameHero.lineHeight },
  sub: { ...typography.packSub, marginTop: 4 },
  buyRow: { flexDirection: "row", gap: 9, marginTop: 12 },
  buyBtnWrap: { flex: 1 },
  buyBtn: {
    height: 46,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.26)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  buyLabel: {
    ...typography.ripLabel,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  buyPrice: { fontFamily: fonts.extrabold, fontSize: 13.5, color: "#FFFFFF" },
  coin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFE27A",
  },
  buyTenBtn: {
    width: 58,
    height: 46,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  buyTenLabel: { fontFamily: fonts.black, fontSize: 13.5, color: "#FFFFFF" },

  // Same exact `.pack`/`.packImgWrap`/`.badge` box as Shelf's cards TierRow, per
  // GrailhausPacks.js — watches use the identical box, just the "watch" tier-chip variant.
  watchPack: {
    minHeight: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  watchPackPopular: {
    borderColor: "#a855f7",
    backgroundColor: "rgba(40,16,66,0.9)",
    shadowColor: "#a855f7",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  badge: {
    position: "absolute",
    right: -8,
    top: -15,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#b26bf5",
    zIndex: 2,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  watchPhotoWrap: { position: "absolute", left: -4, top: -10, bottom: -10, width: 150, borderRadius: 10, overflow: "hidden" },
  watchPhoto: { width: "100%", height: "100%" },
  watchBody: { flex: 1, paddingLeft: 158, paddingRight: 10, paddingTop: 14, paddingBottom: 16 },
  packTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  watchTier: typography.tierPillWatches,
  watchName: { ...typography.packNameWatches, marginTop: 5 },
  watchSub: { ...typography.packSubWatches, marginTop: 8 },
  // Reference's WATCH_TIERS chip: bigger than the cards one, crown + tier name inside.
  tierGroup: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  watchChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
  },
  watchChipLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3, color: "#fff" },
});
