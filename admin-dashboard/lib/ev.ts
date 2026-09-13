import { pool } from "./db";

/**
 * Real expected value: probability × the actual average of this pack's own
 * catalog items at that tier — not the category-wide rarity-tier value
 * range midpoint. That approximation (shared/src/economics.ts) badly
 * overstates cheap packs and understates expensive ones whenever a
 * category's packs deliberately use different value sub-ranges per tier
 * (a Street Rip Grail vs. a Black Label Grail), which is exactly our case.
 */
export async function computeRealEvCents(packId: string): Promise<number> {
  const [items, slots] = await Promise.all([
    pool.query<{ rarity_tier_level: number; avg_cents: string }>(
      "select rarity_tier_level, avg(base_value_cents) as avg_cents from public.items where pack_id = $1 group by rarity_tier_level",
      [packId]
    ),
    pool.query<{ rarity_tier_level: number; probability_percent: string }>(
      "select rarity_tier_level, probability_percent from public.slot_probabilities where pack_id = $1",
      [packId]
    ),
  ]);

  const avgByTier = new Map<number, number>(items.rows.map((r) => [r.rarity_tier_level, Number(r.avg_cents)]));

  let evCents = 0;
  for (const row of slots.rows) {
    evCents += (Number(row.probability_percent) / 100) * (avgByTier.get(row.rarity_tier_level) ?? 0);
  }
  return Math.round(evCents);
}

export async function computeRealEvForAllPacks(): Promise<Map<string, number>> {
  const [items, slots] = await Promise.all([
    pool.query<{ pack_id: string; rarity_tier_level: number; avg_cents: string }>(
      "select pack_id, rarity_tier_level, avg(base_value_cents) as avg_cents from public.items group by pack_id, rarity_tier_level"
    ),
    pool.query<{ pack_id: string; rarity_tier_level: number; probability_percent: string }>(
      "select pack_id, rarity_tier_level, probability_percent from public.slot_probabilities"
    ),
  ]);

  const avgByPackTier = new Map<string, number>();
  for (const row of items.rows) {
    avgByPackTier.set(`${row.pack_id}_${row.rarity_tier_level}`, Number(row.avg_cents));
  }

  const evByPack = new Map<string, number>();
  for (const row of slots.rows) {
    const avg = avgByPackTier.get(`${row.pack_id}_${row.rarity_tier_level}`) ?? 0;
    const contribution = (Number(row.probability_percent) / 100) * avg;
    evByPack.set(row.pack_id, (evByPack.get(row.pack_id) ?? 0) + contribution);
  }

  for (const [id, cents] of evByPack) evByPack.set(id, Math.round(cents));
  return evByPack;
}
