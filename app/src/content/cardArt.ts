import type { ItemDetail, RarityTierLevel } from "@grailhaus/shared";

/**
 * Decorative art-only gradients — there is no real card image asset pipeline (PRD §catalog
 * allows "tasteful placeholders"), so every card face is a radial gradient. Keyed by the
 * catalog's own `pokemonType` where present, matching the mockup's type-tinted card art; falls
 * back to a rarity-tinted gradient (gold/violet/steel by tier) for watches or untyped items —
 * never a random/hashed color, so the same item always renders the same face.
 */
const TYPE_GRADIENTS: Record<string, [string, string, string]> = {
  Electric: ["#FFF6D8", "#FFC94A", "#7A2C06"],
  Fire: ["#FFD9C4", "#E0761A", "#5E3722"],
  Water: ["#E4FBFF", "#59D8FF", "#062E68"],
  Grass: ["#D6F5B4", "#6FB758", "#2C5A2A"],
  Psychic: ["#FFB3F0", "#C64BFF", "#2E0B63"],
  Metal: ["#DCE8FF", "#6C8BF5", "#2B2F86"],
  Steel: ["#DCE8FF", "#6C8BF5", "#2B2F86"],
  Dragon: ["#E0D4FF", "#8A2CE0", "#2E0B63"],
  Ground: ["#F2CDA8", "#B87A4E", "#5E3722"],
  Ice: ["#E4FBFF", "#8FA9FF", "#33455C"],
};

const TIER_FALLBACK: Record<RarityTierLevel, [string, string, string]> = {
  1: ["#F4EFE4", "#9C9184", "#3A342B"],
  2: ["#DCE8FF", "#6C8BF5", "#2B2F86"],
  3: ["#FFF6D8", "#FFC94A", "#7A2C06"],
};

export function itemArtGradient(item: Pick<ItemDetail, "pokemonType" | "rarityTierLevel">): [string, string, string] {
  if (item.pokemonType && TYPE_GRADIENTS[item.pokemonType]) return TYPE_GRADIENTS[item.pokemonType];
  return TIER_FALLBACK[item.rarityTierLevel] ?? TIER_FALLBACK[1];
}
