import "dotenv/config";
import { pool } from "../src/db/pool.js";

/**
 * `ownership_weight_tiers.category` had no CHECK constraint (so it was never blocked from
 * accepting a new category like the other three tables were), but it also had no FK — meaning a
 * typo'd category string would silently sit there doing nothing rather than being rejected.
 * Bringing it in line with packs/rarity_tiers/marketplace_fee_tiers for consistency.
 */
async function main() {
  await pool.query(`
    alter table public.ownership_weight_tiers
      add constraint ownership_weight_tiers_category_fkey foreign key (category) references public.categories(id);
  `);
  console.log("done — ownership_weight_tiers.category now FK to categories(id)");
  await pool.end();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
