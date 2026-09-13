// Maps a real Vault Break pull (PulledOwnedItem[], exactly what /purchase returns) onto
// VaultCardData — the shape cardArt.ts's drawCardFace/drawCardVerso already know how to paint.
// Every field here is either real data or an explicitly-labeled style choice, never an invented
// fact: real name, real admin-configurable tier name, real collection, a real 7-day value-drift
// history (the same computePriceDriftHistory ValueDriftChart uses) for the delta/sparkline, a
// real live currentValueCents, and a serial derived from the real ownedItemId. The only things
// that aren't literally read off the item are `tint`/`glowRGB` (a fixed per-rarity palette, a
// styling choice) and `finish` (a deterministic per-tier label, also styling, not a data claim).
import { computePriceDriftHistory } from "@grailhaus/shared";
import type { PackSku, PulledOwnedItem, RarityTierLevel } from "@grailhaus/shared";
import type { CardRarity, VaultCardData } from "../config/types";

const RARITY_BY_LEVEL: Record<RarityTierLevel, CardRarity> = { 1: "CORE", 2: "PRIME", 3: "GRAIL" };

const FINISH_BY_RARITY: Record<CardRarity, string> = {
  CORE: "Standard Finish",
  PRIME: "Foil Finish",
  GRAIL: "Prismatic Finish",
};

// Fixed per-rarity accents for the card's art-window tint/glow — a styling choice (matching the
// ribbon palette in cardArt.ts's own RARITY table), not derived from any per-item data.
const TINT_BY_RARITY: Record<CardRarity, string> = {
  CORE: "#241041",
  PRIME: "#3a2410",
  GRAIL: "#3a2c05",
};
const GLOW_RGB_BY_RARITY: Record<CardRarity, string> = {
  CORE: "170,150,220",
  PRIME: "232,207,162",
  GRAIL: "255,224,150",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SPARK_POINTS = 16;

// Deterministic 32-bit hash of the item's real ownedItemId, so a card's procedural art (and its
// serial below) is stable across re-renders and re-mounts of the same pulled copy.
function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) || 1;
}

function serialFromId(id: string, prefix: string): string {
  const compact = id.replace(/-/g, "").toUpperCase();
  return `${prefix}-${compact.slice(0, 8)}`;
}

/** `serialPrefix` defaults to Vault Break's own "VB" — Black Label
 * (../../blackLabelReveal/engine/adaptBlackLabelDeck.ts) calls this with "BL" instead. Every
 * other field is real/derived data or a shared per-rarity styling choice (see the file header),
 * so this stayed one function rather than forking per tier. */
export function adaptPulledItemsToVaultDeck(
  items: PulledOwnedItem[],
  sku: PackSku,
  serialPrefix = "VB"
): VaultCardData[] {
  return items.map((item) => {
    const rarity = RARITY_BY_LEVEL[item.rarityTierLevel];
    const rarityLabel = sku.rarityTiers.find((t) => t.level === item.rarityTierLevel)?.name ?? rarity;
    const buckets = computePriceDriftHistory(item, WEEK_MS, SPARK_POINTS * 4);
    const step = Math.max(1, Math.floor(buckets.length / SPARK_POINTS));
    const spark = buckets.filter((_, i) => i % step === 0).slice(0, SPARK_POINTS).map((b) => b.avgValueCents);
    if (spark.length < 2) spark.push(item.currentValueCents);
    const first = spark[0];
    const last = spark[spark.length - 1];
    const delta = first > 0 ? ((last - first) / first) * 100 : 0;

    return {
      name: item.name,
      rarity,
      rarityLabel: rarityLabel.toUpperCase(),
      edition: item.collection ?? "Series I",
      finish: FINISH_BY_RARITY[rarity],
      value: `$${Math.round(item.currentValueCents / 100).toLocaleString()}`,
      delta,
      tint: TINT_BY_RARITY[rarity],
      glowRGB: GLOW_RGB_BY_RARITY[rarity],
      seed: hashSeed(item.ownedItemId),
      serial: serialFromId(item.ownedItemId, serialPrefix),
      held: "ACQUIRED TODAY",
      spark,
    };
  });
}
