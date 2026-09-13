import "dotenv/config";
import { pool } from "../src/db/pool.js";

/**
 * Stocks the "Atelier Drop" handbags pack with real items — same insert shape the admin
 * dashboard's createItem server action uses (generic fields only: name, rarity_tier_level,
 * base_value_cents, texture_url). Without this the pack exists and has slot odds, but
 * itemsByTier is empty for all 3 levels, so it can't actually be purchased.
 */
async function main() {
  const { rows } = await pool.query<{ id: string }>(
    "select id from public.packs where category = 'handbags' and tier = 'atelier_drop'"
  );
  if (!rows.length) throw new Error("Atelier Drop pack not found — run seedHandbagsDemo.ts first.");
  const packId = rows[0].id;

  const items: [string, number, number][] = [
    ["Quilted Flap — Caramel", 1, 22000],
    ["Quilted Flap — Noir", 1, 24000],
    ["Structured Tote — Camel", 1, 21000],
    ["Top Handle — Bordeaux", 2, 78000],
    ["Top Handle — Ivory", 2, 82000],
    ["Mini Flap — Gold Hardware", 2, 95000],
    ["Heritage Trunk — Limited", 3, 480000],
    ["Atelier Exclusive — Masterpiece", 3, 720000],
  ];

  for (const [name, rarityTierLevel, baseValueCents] of items) {
    await pool.query(
      `insert into public.items (pack_id, name, rarity_tier_level, base_value_cents)
       values ($1, $2, $3, $4)`,
      [packId, name, rarityTierLevel, baseValueCents]
    );
  }
  console.log(`seeded ${items.length} handbags items into pack ${packId}`);
  await pool.end();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
