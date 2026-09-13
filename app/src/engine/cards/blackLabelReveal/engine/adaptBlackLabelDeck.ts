import type { PackSku, PulledOwnedItem } from "@grailhaus/shared";
import { adaptPulledItemsToVaultDeck } from "../../vaultReveal/engine/adaptRealDeck";
import type { VaultCardData } from "../../vaultReveal/config/types";

// Obsidian stock + gold ribbon/accent, per the design's own apexDeck() base object
// (design-handoff card-art.js) — a fixed per-tier styling choice, not derived from any item's
// data, same status as ../../vaultReveal/engine/adaptRealDeck.ts's own TINT_BY_RARITY/
// GLOW_RGB_BY_RARITY tables.
const OBSIDIAN: [string, string, string] = ["#0b0a10", "#17151c", "#040407"];
const GOLD_RIBBON: [string, string, string] = ["#2e1c08", "#c08b45", "#2e1c08"];

/** Same real-data mapping as Vault Break's adaptPulledItemsToVaultDeck — see that file's header
 * for what's real vs. a styling choice — with this tier's own "BL-" serial prefix instead of
 * "VB-", plus the theme hooks (art/cardArt.ts's header) that give the card its obsidian-and-fire
 * frame instead of Vault Break's violet-and-champagne one.
 *
 * `type` is the pulled item's own real `pokemonType` (falling back to "Fire" only for the rare
 * row with no catalog type recorded) — not hardcoded to "Fire" for every card. HoldToOpenFanReveal
 * reads this via ../../reveal/art/typeVisual.ts's `typeVisualOf` to color the glow, vignette,
 * mote motion, and word overlay when this tier's card opens, so a Water-type pull glows blue and
 * drifts, not orange and rising like Fire.
 *
 * `tagline` and `traits` are deliberately left unset here: the design's own apexDeck() carries a
 * tagline only on its one fictional Grail card ("Fire remembers what others forget") and no real
 * pulled item has an equivalent authored line to draw from; traits are already read straight off
 * the real `item.traits` field by the shared fan-reveal's own inspect sheet
 * (HoldToOpenFanReveal.tsx's DescriptionPanel), so duplicating them onto VaultCardData here would
 * just be a second, redundant copy of the same string. */
export function adaptPulledItemsToBlackLabelDeck(items: PulledOwnedItem[], sku: PackSku): VaultCardData[] {
  return adaptPulledItemsToVaultDeck(items, sku, "BL").map((card, i) => ({
    ...card,
    stock: OBSIDIAN,
    accent: "#d8b877",
    accentRGB: "216,184,119",
    windowArt: "pyro",
    type: items[i].pokemonType ?? "Fire",
    ...(card.rarity === "PRIME" || card.rarity === "GRAIL" ? { ribbon: GOLD_RIBBON } : {}),
  }));
}
