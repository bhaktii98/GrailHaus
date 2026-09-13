import { pool } from "../../db/pool.js";
import type { RecentPullRow } from "./activity.types.js";

/** Real pack pulls only (`purchase_id is not null`) — a marketplace acquisition also touches
 * `owned_items`, but "Recently Revealed" means someone tore a pack open, not that ownership
 * changed hands. Filtering to one `packId` is what backs a single drop's own live claims feed
 * (see activity.service.ts) — same query, same real rows, just scoped to that pack. */
export async function findRecentPulls(limit: number, packId?: string): Promise<RecentPullRow[]> {
  const { rows } = await pool.query<RecentPullRow>(
    `select
       oi.id as owned_item_id, oi.acquired_at, puller.username,
       i.id, i.pack_id, p.category, i.name, i.rarity_tier_level, i.texture_url, i.base_value_cents,
       i.collection, i.tagline, i.traits,
       i.pokemon_name, i.card_title, i.pokemon_type, i.generation, i.pokedex_number,
       i.watch_name, i.model_name, i.brand, i.style, i.case_material, i.dial_color, i.movement, i.case_size
     from public.owned_items oi
     join public.profiles puller on puller.id = oi.user_id
     join public.items i on i.id = oi.item_id
     join public.packs p on p.id = i.pack_id
     where oi.purchase_id is not null
       and ($2::uuid is null or i.pack_id = $2)
     order by oi.acquired_at desc
     limit $1`,
    [limit, packId ?? null]
  );
  return rows;
}
