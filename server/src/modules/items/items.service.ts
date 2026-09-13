import { computePriceDrift } from "@grailhaus/shared";
import type { Category, ItemDetail, RarityTierLevel } from "@grailhaus/shared";
import { NotFoundError } from "../../lib/errors.js";
import { findAllItemDetails, findItemDetailById } from "./items.repository.js";
import type { ItemDetailRow } from "./items.types.js";

export function toItemDetail(row: ItemDetailRow): ItemDetail {
  const baseValueCents = Number(row.base_value_cents);
  const category = row.category as Category;
  const drift = computePriceDrift({ id: row.id, category, baseValueCents });

  return {
    id: row.id,
    name: row.name,
    rarityTierLevel: row.rarity_tier_level as RarityTierLevel,
    textureUrl: row.texture_url,
    baseValueCents,
    currentValueCents: drift.currentValueCents,
    minValueCents: drift.minValueCents,
    maxValueCents: drift.maxValueCents,
    category,
    collection: row.collection,
    tagline: row.tagline,
    traits: row.traits,
    pokemonName: row.pokemon_name,
    cardTitle: row.card_title,
    pokemonType: row.pokemon_type,
    generation: row.generation,
    pokedexNumber: row.pokedex_number,
    watchName: row.watch_name,
    modelName: row.model_name,
    brand: row.brand,
    style: row.style,
    caseMaterial: row.case_material,
    dialColor: row.dial_color,
    movement: row.movement,
    caseSize: row.case_size,
  };
}

export async function getItemDetail(itemId: string): Promise<ItemDetail> {
  const row = await findItemDetailById(itemId);
  if (!row) throw new NotFoundError("Item not found");
  return toItemDetail(row);
}

export async function listItemDetails(category?: Category): Promise<ItemDetail[]> {
  const rows = await findAllItemDetails(category);
  return rows.map(toItemDetail);
}
