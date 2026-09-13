// Tier 1's own adapter onto VaultCardData — same idea and same real/derived-data discipline as
// vaultReveal/engine/adaptRealDeck.ts (see that file's header), just built against `ItemDetail[]`
// instead of `PulledOwnedItem[]`: CardFlowEngine's pulled items never carry `ownedItemId` (that
// field is exclusive to the post-purchase `PulledOwnedItem`), so the serial is hashed off the
// catalog item's own `id` instead. Everything else — rarity mapping, per-rarity finish/tint/glow,
// the 7-day drift sparkline/delta — is identical.
import { computePriceDriftHistory } from "@grailhaus/shared";
import type { ItemDetail, PackSku, RarityTierLevel } from "@grailhaus/shared";
import type { CardRarity, VaultCardData } from "../../vaultReveal/config/types";

const RARITY_BY_LEVEL: Record<RarityTierLevel, CardRarity> = { 1: "CORE", 2: "PRIME", 3: "GRAIL" };

const FINISH_BY_RARITY: Record<CardRarity, string> = {
  CORE: "Standard Finish",
  PRIME: "Foil Finish",
  GRAIL: "Prismatic Finish",
};

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

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) || 1;
}

function serialFromId(id: string): string {
  const compact = id.replace(/-/g, "").toUpperCase();
  return `GH-${compact.slice(0, 8)}`;
}

export function adaptItemDetailsToCardPackDeck(items: ItemDetail[], sku: PackSku): VaultCardData[] {
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
      seed: hashSeed(item.id),
      serial: serialFromId(item.id),
      held: "ACQUIRED TODAY",
      spark,
    };
  });
}
