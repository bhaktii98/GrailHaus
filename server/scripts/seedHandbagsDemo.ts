import "dotenv/config";
import { pool } from "../src/db/pool.js";

/**
 * Completes the handbags demo end to end — proves the packs_category_fkey /
 * rarity_tiers_category_fkey fix (see fixCategoryConstraints.ts) actually works, not just that
 * the constraint changed. Rarity tiers + one real, purchasable pack SKU with slot odds, same
 * shape any admin would create via the dashboard's Rarity Tiers / Packs pages now.
 */
async function main() {
  await pool.query(
    `insert into public.rarity_tiers (category, tier_level, name, color_hex, value_min_cents, value_max_cents)
     values
       ('handbags', 1, 'Signature', '#c98a52', 15000, 40000),
       ('handbags', 2, 'Atelier', '#e0b378', 60000, 150000),
       ('handbags', 3, 'Maison', '#f4d9a0', 300000, 900000)
     on conflict (category, tier_level) do update set
       name = excluded.name, color_hex = excluded.color_hex,
       value_min_cents = excluded.value_min_cents, value_max_cents = excluded.value_max_cents`
  );
  console.log("seeded handbags rarity tiers");

  const { rows } = await pool.query<{ id: string }>(
    `insert into public.packs (category, tier, name, price_cents, item_count, stock_remaining, max_stock)
     values ('handbags', 'atelier_drop', 'Atelier Drop', 20000, 1, 25, 25)
     returning id`
  );
  const packId = rows[0].id;
  console.log(`seeded handbags pack: ${packId}`);

  await pool.query(
    `insert into public.slot_probabilities (pack_id, slot_position, rarity_tier_level, probability_percent)
     values ($1, 1, 1, 82), ($1, 1, 2, 16), ($1, 1, 3, 2)
     on conflict (pack_id, slot_position, rarity_tier_level) do update set probability_percent = excluded.probability_percent`,
    [packId]
  );
  console.log("seeded handbags slot probabilities");

  await pool.end();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
