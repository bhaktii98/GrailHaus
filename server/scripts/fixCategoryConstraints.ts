import "dotenv/config";
import { pool } from "../src/db/pool.js";

/**
 * `packs`, `rarity_tiers`, and `marketplace_fee_tiers` each had a hardcoded
 * `CHECK (category = ANY (ARRAY['cards','watches']))` — meaning even after the `categories`
 * table + admin dashboard made a new category's *reveal personality* fully data-driven, the
 * database itself would still reject a pack or rarity-tier row for anything but those two
 * literal strings. Replaced with a real foreign key to `categories(id)` instead: strictly
 * better than just dropping the check — still impossible to create a pack for a category that
 * doesn't exist (a typo, a deleted category), but any category that's actually in the table
 * (cards, watches, handbags, or whatever's added next) now works.
 */
async function main() {
  await pool.query(`
    alter table public.packs drop constraint if exists packs_category_check;
    alter table public.packs
      add constraint packs_category_fkey foreign key (category) references public.categories(id);

    alter table public.rarity_tiers drop constraint if exists rarity_tiers_category_check;
    alter table public.rarity_tiers
      add constraint rarity_tiers_category_fkey foreign key (category) references public.categories(id);

    alter table public.marketplace_fee_tiers drop constraint if exists marketplace_fee_tiers_category_check;
    alter table public.marketplace_fee_tiers
      add constraint marketplace_fee_tiers_category_fkey foreign key (category) references public.categories(id);
  `);
  console.log("done — packs/rarity_tiers/marketplace_fee_tiers.category now FK to categories(id)");
  await pool.end();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
