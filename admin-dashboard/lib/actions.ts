"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "./db";

function numberOrNull(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (!raw || raw === "") return null;
  return Number(raw);
}

function isoOrNull(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (!raw || raw === "") return null;
  return new Date(raw as string).toISOString();
}

export async function updatePack(packId: string, formData: FormData) {
  const priceCents = Math.round(Number(formData.get("priceDollars")) * 100);
  const itemCount = Number(formData.get("itemCount"));
  const stockRemaining = numberOrNull(formData, "stockRemaining");
  const maxStock = numberOrNull(formData, "maxStock");
  const restockAmount = numberOrNull(formData, "restockAmount");
  const restockIntervalSeconds = numberOrNull(formData, "restockIntervalSeconds");
  const goesLiveAt = isoOrNull(formData, "goesLiveAt");
  const endsAt = isoOrNull(formData, "endsAt");

  // A recurring drop needs all three set together (see packs.service.ts's server-side
  // resolveDropWindow, which requires the same) — if the duration or time was cleared, the
  // weekday checkboxes are ignored too rather than saving a half-configured schedule that would
  // silently behave as "not recurring."
  const recurrenceWeekdaysRaw = [0, 1, 2, 3, 4, 5, 6].filter((day) => formData.get(`recurrenceDay_${day}`) === "on");
  const recurrenceTimeUtcRaw = formData.get("recurrenceTimeUtc");
  const recurrenceTimeUtc = recurrenceTimeUtcRaw && recurrenceTimeUtcRaw !== "" ? String(recurrenceTimeUtcRaw) : null;
  const recurrenceDurationMinutes = numberOrNull(formData, "recurrenceDurationMinutes");
  const recurrenceEnabled = recurrenceWeekdaysRaw.length > 0 && recurrenceTimeUtc != null && recurrenceDurationMinutes != null;
  const recurrenceWeekdays = recurrenceEnabled ? recurrenceWeekdaysRaw : null;

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `update public.packs
       set price_cents = $1, item_count = $2, stock_remaining = $3, max_stock = $4,
           restock_amount = $5, restock_interval_seconds = $6, goes_live_at = $7, ends_at = $8,
           recurrence_weekdays = $9, recurrence_time_utc = $10, recurrence_duration_minutes = $11,
           recurrence_last_reset_at = null
       where id = $12`,
      [
        priceCents,
        itemCount,
        stockRemaining,
        maxStock,
        restockAmount,
        restockIntervalSeconds,
        goesLiveAt,
        endsAt,
        recurrenceWeekdays,
        recurrenceEnabled ? recurrenceTimeUtc : null,
        recurrenceEnabled ? recurrenceDurationMinutes : null,
        packId,
      ]
    );

    for (const [key, value] of formData.entries()) {
      const match = /^slot_(\d+)_tier_(\d)$/.exec(key);
      if (!match) continue;
      const [, slotPosition, tierLevel] = match;
      await client.query(
        `insert into public.slot_probabilities (pack_id, slot_position, rarity_tier_level, probability_percent)
         values ($1, $2, $3, $4)
         on conflict (pack_id, slot_position, rarity_tier_level)
         do update set probability_percent = excluded.probability_percent`,
        [packId, Number(slotPosition), Number(tierLevel), Number(value)]
      );
    }

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  revalidatePath("/");
  revalidatePath(`/packs/${packId}`);
}

export async function updateRarityTiers(formData: FormData) {
  // Collects each (category, tierLevel)'s 4 fields together first — an upsert needs all of
  // name/color/min/max in one statement (an update-only, one-column-at-a-time approach, which is
  // what this used to be, can't also *create* a brand-new category's first rows, since there's
  // nothing to update yet).
  const rowsByKey = new Map<string, { category: string; tierLevel: number; name?: string; color?: string; min?: string; max?: string }>();
  for (const [key, value] of formData.entries()) {
    // Category is any backend-driven slug now (categories.id), not a hardcoded cards|watches
    // pair — .+ greedily backtracks to the right split even if the category itself has
    // underscores in it.
    const match = /^(.+)_(\d)_(name|color|min|max)$/.exec(key);
    if (!match) continue;
    const [, category, tierLevel, field] = match;
    const mapKey = `${category}_${tierLevel}`;
    const row = rowsByKey.get(mapKey) ?? { category, tierLevel: Number(tierLevel) };
    (row as Record<string, unknown>)[field] = value;
    rowsByKey.set(mapKey, row);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const row of rowsByKey.values()) {
      if (!row.name || !row.color) continue; // incomplete row (shouldn't happen — every rendered row has all 4 fields)
      await client.query(
        `insert into public.rarity_tiers (category, tier_level, name, color_hex, value_min_cents, value_max_cents)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (category, tier_level) do update set
           name = excluded.name, color_hex = excluded.color_hex,
           value_min_cents = excluded.value_min_cents, value_max_cents = excluded.value_max_cents`,
        [
          row.category, row.tierLevel, row.name, row.color,
          Math.round(Number(row.min ?? 0) * 100), Math.round(Number(row.max ?? 0) * 100),
        ]
      );
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  revalidatePath("/");
  revalidatePath("/rarity-tiers");
}

export async function updatePlatformConfig(formData: FormData) {
  await pool.query(
    `update public.platform_config set
       starting_balance_cents = $1,
       price_drift_interval_seconds = $2,
       cards_drift_min_pct = $3,
       cards_drift_max_pct = $4,
       watches_drift_min_pct = $5,
       watches_drift_max_pct = $6
     where id = true`,
    [
      Math.round(Number(formData.get("startingBalanceDollars")) * 100),
      Number(formData.get("driftIntervalSeconds")),
      Number(formData.get("cardsDriftMin")),
      Number(formData.get("cardsDriftMax")),
      Number(formData.get("watchesDriftMin")),
      Number(formData.get("watchesDriftMax")),
    ]
  );
  revalidatePath("/platform-config");
}

export async function updateMarketplaceFees(formData: FormData) {
  // Widened from a hardcoded cards|watches pair, and changed from update-only to an upsert — same
  // reasoning as updateRarityTiers: a brand-new category has no marketplace_fee_tiers rows yet, so
  // an UPDATE would silently do nothing for it.
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const [key, value] of formData.entries()) {
      const match = /^(.+)_(\d)$/.exec(key);
      if (!match) continue;
      const [, category, tierLevel] = match;
      await client.query(
        `insert into public.marketplace_fee_tiers (category, rarity_tier_level, fee_percent)
         values ($1, $2, $3)
         on conflict (category, rarity_tier_level) do update set fee_percent = excluded.fee_percent`,
        [category, Number(tierLevel), Number(value)]
      );
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
  revalidatePath("/marketplace-fees");
}

export async function updatePressureRule(ruleId: string, formData: FormData) {
  await pool.query(
    `update public.pressure_rules set
       steps_without_qualifying = $1,
       effect_value = $2
     where id = $3`,
    [Number(formData.get("steps")), formData.get("effectValue") ? Number(formData.get("effectValue")) : null, ruleId]
  );
  revalidatePath("/pressure-rules");
}

export async function updateOwnershipWeights(formData: FormData) {
  // Same widened-regex + upsert treatment as updateMarketplaceFees/updateRarityTiers.
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const [key, value] of formData.entries()) {
      const match = /^(.+)_(\d)$/.exec(key);
      if (!match) continue;
      const [, category, copiesOwned] = match;
      await client.query(
        `insert into public.ownership_weight_tiers (category, copies_owned, weight_percent)
         values ($1, $2, $3)
         on conflict (category, copies_owned) do update set weight_percent = excluded.weight_percent`,
        [category, Number(copiesOwned), Number(value)]
      );
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
  revalidatePath("/ownership-weights");
}

/** Create or edit a category's whole reveal personality — palette, camera, lighting, gesture,
 * timing, haptics, and which mesh archetype (see app's engine/core/meshArchetypes.tsx) it uses.
 * `id` is the slug new packs reference as their `category` column — one insert-or-update, since
 * the "new category" and "edit category" forms on the Categories page are the same form. The
 * mobile app reads this via GET /categories (server's categories module), not this admin
 * dashboard directly — this table is the shared source of truth for both.
 */
export async function upsertCategory(formData: FormData) {
  const id = String(formData.get("id")).trim();
  if (!/^[a-z][a-z0-9_]*$/.test(id)) {
    throw new Error("Category id must be lowercase letters/numbers/underscores, starting with a letter.");
  }

  function jsonField(key: string, fallback: unknown) {
    const raw = formData.get(key);
    if (!raw || String(raw).trim() === "") return fallback;
    try {
      return JSON.parse(String(raw));
    } catch {
      throw new Error(`"${key}" isn't valid JSON.`);
    }
  }

  const cameraPosition = [
    Number(formData.get("cameraX")),
    Number(formData.get("cameraY")),
    Number(formData.get("cameraZ")),
  ];

  await pool.query(
    `insert into public.categories
       (id, label, mesh_archetype, palette_background, palette_accent, camera_position, camera_fov,
        lighting, gesture_mode, gesture_velocity_threshold, gesture_travel_distance, common_beat_ms,
        rare_hold_ms, haptic_common, haptic_rare, opening_beats_common, opening_beats_rare, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     on conflict (id) do update set
       label = excluded.label,
       mesh_archetype = excluded.mesh_archetype,
       palette_background = excluded.palette_background,
       palette_accent = excluded.palette_accent,
       camera_position = excluded.camera_position,
       camera_fov = excluded.camera_fov,
       lighting = excluded.lighting,
       gesture_mode = excluded.gesture_mode,
       gesture_velocity_threshold = excluded.gesture_velocity_threshold,
       gesture_travel_distance = excluded.gesture_travel_distance,
       common_beat_ms = excluded.common_beat_ms,
       rare_hold_ms = excluded.rare_hold_ms,
       haptic_common = excluded.haptic_common,
       haptic_rare = excluded.haptic_rare,
       opening_beats_common = excluded.opening_beats_common,
       opening_beats_rare = excluded.opening_beats_rare,
       sort_order = excluded.sort_order`,
    [
      id,
      String(formData.get("label")),
      String(formData.get("meshArchetype")),
      String(formData.get("paletteBackground")),
      String(formData.get("paletteAccent")),
      JSON.stringify(cameraPosition),
      Number(formData.get("cameraFov")),
      JSON.stringify(jsonField("lighting", [])),
      String(formData.get("gestureMode")),
      Number(formData.get("gestureVelocityThreshold")),
      Number(formData.get("gestureTravelDistance")),
      Number(formData.get("commonBeatMs")),
      Number(formData.get("rareHoldMs")),
      JSON.stringify(jsonField("hapticCommon", [])),
      JSON.stringify(jsonField("hapticRare", [])),
      JSON.stringify(jsonField("openingBeatsCommon", null)),
      JSON.stringify(jsonField("openingBeatsRare", null)),
      Number(formData.get("sortOrder") || 0),
    ]
  );
  revalidatePath("/categories");
  revalidatePath(`/categories/${id}`);
  revalidatePath(`/categories/${id}/edit`);
  redirect(`/categories/${id}`);
}

/** Deletes a category, auto-cleaning whatever safely can be: rarity tiers, marketplace fees,
 * and ownership weights are config rows nothing else references, so those always go; packs are
 * only auto-deleted if they have zero owned items and zero purchases (their own items/pressure
 * rules/slot probabilities cascade with them at the DB level). A pack with real owned items or
 * purchase history — an actual pull sitting in someone's portfolio, or a real transaction record
 * — is never auto-removed; the category delete is blocked until those are dealt with some other
 * way, with the specific blocking packs named instead of a generic "still referenced" message. */
export async function deleteCategory(formData: FormData) {
  const id = String(formData.get("id"));

  const packs = await pool.query<{ id: string; name: string }>(
    "select id, name from public.packs where category = $1",
    [id]
  );
  const packIds = packs.rows.map((r) => r.id);

  const blockedPacks: { name: string; ownedCount: number; purchaseCount: number }[] = [];
  const deletablePackIds: string[] = [];

  if (packIds.length > 0) {
    const [ownedCounts, purchaseCounts] = await Promise.all([
      pool.query<{ pack_id: string; count: string }>(
        "select pack_id, count(*)::text as count from public.owned_items where pack_id = any($1) group by pack_id",
        [packIds]
      ),
      pool.query<{ pack_id: string; count: string }>(
        "select pack_id, count(*)::text as count from public.purchases where pack_id = any($1) group by pack_id",
        [packIds]
      ),
    ]);
    const ownedByPack = new Map(ownedCounts.rows.map((r) => [r.pack_id, Number(r.count)]));
    const purchasesByPack = new Map(purchaseCounts.rows.map((r) => [r.pack_id, Number(r.count)]));

    for (const pack of packs.rows) {
      const ownedCount = ownedByPack.get(pack.id) ?? 0;
      const purchaseCount = purchasesByPack.get(pack.id) ?? 0;
      if (ownedCount > 0 || purchaseCount > 0) {
        blockedPacks.push({ name: pack.name, ownedCount, purchaseCount });
      } else {
        deletablePackIds.push(pack.id);
      }
    }
  }

  if (blockedPacks.length > 0) {
    const detail = blockedPacks.map((p) => `"${p.name}" (${p.ownedCount} owned, ${p.purchaseCount} purchased)`).join(", ");
    throw new Error(
      `Can't delete — ${blockedPacks.length} pack${blockedPacks.length > 1 ? "s" : ""} still ${blockedPacks.length > 1 ? "have" : "has"} real owned items or purchase history and can't be auto-removed: ${detail}. Deal with those first.`
    );
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    if (deletablePackIds.length > 0) {
      await client.query("delete from public.packs where id = any($1)", [deletablePackIds]);
    }
    await client.query("delete from public.rarity_tiers where category = $1", [id]);
    await client.query("delete from public.marketplace_fee_tiers where category = $1", [id]);
    await client.query("delete from public.ownership_weight_tiers where category = $1", [id]);
    await client.query("delete from public.categories where id = $1", [id]);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  revalidatePath("/categories");
  redirect("/categories");
}

/** Creates a brand-new pack SKU — the piece that was missing for "adding a category is fully
 * form-driven": the Categories page creates the category itself, this creates the actual
 * purchasable pack under it. `id` is DB-generated (uuid default on public.packs), not chosen
 * here, matching every existing pack row. Slot probabilities are optional at creation time (a
 * pack with none yet just can't be purchased until they're added — same validation
 * purchase.service.ts already enforces) — entered as the same raw-JSON pattern the Categories
 * page uses for its own array fields, rather than a dynamic-row form.
 */
export async function createPack(formData: FormData) {
  const category = String(formData.get("category")).trim();
  const tier = String(formData.get("tier")).trim();
  if (!/^[a-z][a-z0-9_]*$/.test(tier)) {
    throw new Error("Tier must be lowercase letters/numbers/underscores, starting with a letter.");
  }

  const priceCents = Math.round(Number(formData.get("priceDollars")) * 100);
  const itemCount = Number(formData.get("itemCount"));
  const stockRemaining = numberOrNull(formData, "stockRemaining");
  const maxStock = numberOrNull(formData, "maxStock");
  const restockAmount = numberOrNull(formData, "restockAmount");
  const restockIntervalSeconds = numberOrNull(formData, "restockIntervalSeconds");
  const goesLiveAt = isoOrNull(formData, "goesLiveAt");
  const endsAt = isoOrNull(formData, "endsAt");

  const rawSlots = String(formData.get("slotProbabilities") ?? "").trim();
  let slotProbabilities: { slotPosition: number; rarityTierLevel: number; probabilityPercent: number }[] = [];
  if (rawSlots) {
    try {
      slotProbabilities = JSON.parse(rawSlots);
    } catch {
      throw new Error('"Slot probabilities" isn\'t valid JSON.');
    }
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{ id: string }>(
      `insert into public.packs
         (category, tier, name, price_cents, item_count, stock_remaining, max_stock,
          restock_amount, restock_interval_seconds, goes_live_at, ends_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning id`,
      [
        category, tier, String(formData.get("name")), priceCents, itemCount,
        stockRemaining, maxStock, restockAmount, restockIntervalSeconds, goesLiveAt, endsAt,
      ]
    );
    const packId = rows[0].id;

    for (const slot of slotProbabilities) {
      await client.query(
        `insert into public.slot_probabilities (pack_id, slot_position, rarity_tier_level, probability_percent)
         values ($1, $2, $3, $4)
         on conflict (pack_id, slot_position, rarity_tier_level)
         do update set probability_percent = excluded.probability_percent`,
        [packId, slot.slotPosition, slot.rarityTierLevel, slot.probabilityPercent]
      );
    }

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  revalidatePath("/packs");
}

/** Adds a catalog item to a pack's reward pool — the piece that was still missing for "adding a
 * category is fully form-driven end to end": Categories creates the category, Packs creates the
 * SKU, Rarity Tiers creates its 3 levels, this creates what actually gets pulled. Only the
 * generic fields (name, rarity level, value, image) are writable here — those are all the
 * reveal/purchase engine itself ever reads (packs.repository.ts's item query). The rich
 * category-specific flavor columns (pokemon_name, watch brand/model, etc.) are display-only
 * extras the Catalog page already shows for existing cards/watches items; a new category works
 * fully without them.
 */
export async function createItem(formData: FormData) {
  const packId = String(formData.get("packId"));
  const name = String(formData.get("name")).trim();
  const rarityTierLevel = Number(formData.get("rarityTierLevel"));
  const baseValueCents = Math.round(Number(formData.get("valueDollars")) * 100);
  const textureUrl = String(formData.get("textureUrl") ?? "").trim() || null;

  if (!name) throw new Error("Name is required.");
  if (![1, 2, 3].includes(rarityTierLevel)) throw new Error("Rarity tier level must be 1, 2, or 3.");
  if (!Number.isFinite(baseValueCents) || baseValueCents < 0) throw new Error("Value must be a non-negative number.");

  await pool.query(
    `insert into public.items (pack_id, name, rarity_tier_level, base_value_cents, texture_url)
     values ($1, $2, $3, $4, $5)`,
    [packId, name, rarityTierLevel, baseValueCents, textureUrl]
  );
  revalidatePath("/catalog");
}

/** Bulk-saves every row of a pack's "manage items" table in one submit — same
 * collect-then-upsert shape as updateRarityTiers, but items are edited (not created) here, so
 * each field group is keyed by the item's existing uuid rather than a category/tier slug. */
export async function updateItems(formData: FormData) {
  const rowsById = new Map<string, { name?: string; rarityTierLevel?: string; value?: string; textureUrl?: string }>();
  for (const [key, value] of formData.entries()) {
    const match = /^item_(.+)_(name|rarityTierLevel|value|textureUrl)$/.exec(key);
    if (!match) continue;
    const [, id, field] = match;
    const row = rowsById.get(id) ?? {};
    (row as Record<string, unknown>)[field] = value;
    rowsById.set(id, row);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const [id, row] of rowsById.entries()) {
      const name = String(row.name ?? "").trim();
      const rarityTierLevel = Number(row.rarityTierLevel);
      const baseValueCents = Math.round(Number(row.value) * 100);
      const textureUrl = String(row.textureUrl ?? "").trim() || null;
      if (!name) throw new Error("Name is required.");
      if (![1, 2, 3].includes(rarityTierLevel)) throw new Error("Rarity tier level must be 1, 2, or 3.");
      if (!Number.isFinite(baseValueCents) || baseValueCents < 0) throw new Error("Value must be a non-negative number.");
      await client.query(
        "update public.items set name = $1, rarity_tier_level = $2, base_value_cents = $3, texture_url = $4 where id = $5",
        [name, rarityTierLevel, baseValueCents, textureUrl, id]
      );
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
  revalidatePath("/catalog");
}

/** Removes an item from circulation. Deliberately blocked if any owned_items row already
 * references it (someone actually pulled this item) — deleting it out from under a real owner
 * would corrupt their portfolio/history, not just the catalog; the fix for "this item shouldn't
 * be pullable anymore" is removing it from future slot odds, not erasing a past pull. */
export async function deleteItem(formData: FormData) {
  const id = String(formData.get("id"));
  const { rows } = await pool.query<{ count: string }>(
    "select count(*)::text as count from public.owned_items where item_id = $1",
    [id]
  );
  if (Number(rows[0].count) > 0) {
    throw new Error("Can't delete — this item has already been pulled by at least one user.");
  }
  await pool.query("delete from public.items where id = $1", [id]);
  revalidatePath("/catalog");
}
