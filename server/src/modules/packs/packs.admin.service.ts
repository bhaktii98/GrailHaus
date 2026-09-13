import type { PackSku } from "@grailhaus/shared";
import { pool } from "../../db/pool.js";
import { BadRequestError, NotFoundError } from "../../lib/errors.js";
import { findPackById, updatePackCoreFields, upsertSlotProbability, type PackCoreUpdate } from "./packs.repository.js";
import { getPackSkuById } from "./packs.service.js";

export interface SlotProbabilityInput {
  slotPosition: number;
  rarityTierLevel: number;
  probabilityPercent: number;
}

export interface AdminUpdatePackInput {
  priceCents?: number;
  itemCount?: number;
  /** Present-but-null clears the field; omitted leaves it untouched. See
   * packs.repository.ts's updatePackCoreFields for why that distinction matters. */
  stockRemaining?: number | null;
  maxStock?: number | null;
  restockAmount?: number | null;
  restockIntervalSeconds?: number | null;
  goesLiveAt?: string | null;
  endsAt?: string | null;
  recurrenceWeekdays?: number[] | null;
  recurrenceTimeUtc?: string | null;
  recurrenceDurationMinutes?: number | null;
  slotProbabilities?: SlotProbabilityInput[];
}

const VALID_TIER_LEVELS = [1, 2, 3];
/** Floating-point tolerance for "sums to 100" — not a real money value, just a percentage
 * check, so plain arithmetic (not Decimal) is fine here. */
const SUM_TOLERANCE = 0.01;

function isNonNegativeInt(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

const TIME_UTC_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function isValidTimeUtc(value: string): boolean {
  return TIME_UTC_PATTERN.test(value);
}

/**
 * The REST counterpart to the admin dashboard's own pack-editing page (same fields: price,
 * item count, stock/restock/scheduling, slot probabilities) — for programmatic/external admin
 * access, not just the dashboard UI. Gated on `app.requireAdmin`.
 *
 * Stricter than the dashboard form on purpose: the dashboard just prints hints next to inputs a
 * human can see and second-guess; a caller hitting this directly has no such feedback loop, so
 * an incomplete or inconsistent update is a hard 400, not a silently-saved inconsistency the
 * purchase transaction would later trip over.
 */
export async function adminUpdatePack(packId: string, input: AdminUpdatePackInput): Promise<PackSku> {
  const existing = await findPackById(packId);
  if (!existing) throw new NotFoundError("Pack not found");

  if (input.priceCents != null && !isPositiveInt(input.priceCents)) {
    throw new BadRequestError("priceCents must be a positive integer");
  }
  if (input.itemCount != null && !isPositiveInt(input.itemCount)) {
    throw new BadRequestError("itemCount must be a positive integer");
  }
  if (input.stockRemaining != null && !isNonNegativeInt(input.stockRemaining)) {
    throw new BadRequestError("stockRemaining must be a non-negative integer, or null");
  }
  if (input.maxStock != null && !isNonNegativeInt(input.maxStock)) {
    throw new BadRequestError("maxStock must be a non-negative integer, or null");
  }
  if (input.restockAmount != null && !isPositiveInt(input.restockAmount)) {
    throw new BadRequestError("restockAmount must be a positive integer, or null to stop restocking");
  }
  if (input.restockIntervalSeconds != null && !isPositiveInt(input.restockIntervalSeconds)) {
    throw new BadRequestError("restockIntervalSeconds must be a positive integer, or null");
  }
  if (input.goesLiveAt != null && !isValidDate(input.goesLiveAt)) {
    throw new BadRequestError("goesLiveAt must be a valid ISO date string, or null for evergreen");
  }
  if (input.endsAt != null && !isValidDate(input.endsAt)) {
    throw new BadRequestError("endsAt must be a valid ISO date string, or null");
  }
  if (
    input.goesLiveAt != null &&
    input.endsAt != null &&
    new Date(input.endsAt).getTime() <= new Date(input.goesLiveAt).getTime()
  ) {
    throw new BadRequestError("endsAt must be after goesLiveAt");
  }
  if (input.recurrenceWeekdays != null) {
    for (const day of input.recurrenceWeekdays) {
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        throw new BadRequestError("recurrenceWeekdays entries must be integers 0 (Sunday) through 6 (Saturday)");
      }
    }
  }
  if (input.recurrenceTimeUtc != null && !isValidTimeUtc(input.recurrenceTimeUtc)) {
    throw new BadRequestError("recurrenceTimeUtc must be \"HH:MM\" (UTC), or null");
  }
  if (input.recurrenceDurationMinutes != null && !isPositiveInt(input.recurrenceDurationMinutes)) {
    throw new BadRequestError("recurrenceDurationMinutes must be a positive integer, or null");
  }
  // A recurring drop needs all three set together — a partial rule (e.g. weekdays with no time)
  // can't be computed into an occurrence at all, and would silently behave like "not recurring"
  // (see packs.service.ts's resolveDropWindow) rather than the schedule the admin thought they
  // just saved.
  const recurrenceFieldsTouched = ["recurrenceWeekdays", "recurrenceTimeUtc", "recurrenceDurationMinutes"] as const;
  const touchedCount = recurrenceFieldsTouched.filter((key) => input[key] != null).length;
  if (touchedCount > 0 && touchedCount < recurrenceFieldsTouched.length) {
    throw new BadRequestError(
      "recurrenceWeekdays, recurrenceTimeUtc, and recurrenceDurationMinutes must all be set together to configure a recurring drop (or all left null/empty to clear one)"
    );
  }
  if (input.recurrenceWeekdays != null && input.recurrenceWeekdays.length === 0 && touchedCount === recurrenceFieldsTouched.length) {
    throw new BadRequestError("recurrenceWeekdays must include at least one day when recurrenceTimeUtc/recurrenceDurationMinutes are set");
  }

  if (input.slotProbabilities && input.slotProbabilities.length > 0) {
    for (const row of input.slotProbabilities) {
      if (!VALID_TIER_LEVELS.includes(row.rarityTierLevel)) {
        throw new BadRequestError(`rarityTierLevel must be one of ${VALID_TIER_LEVELS.join(", ")}`);
      }
      if (row.probabilityPercent < 0 || row.probabilityPercent > 100) {
        throw new BadRequestError("probabilityPercent must be between 0 and 100");
      }
    }

    const bySlot = new Map<number, SlotProbabilityInput[]>();
    for (const row of input.slotProbabilities) {
      const list = bySlot.get(row.slotPosition) ?? [];
      list.push(row);
      bySlot.set(row.slotPosition, list);
    }
    for (const [slotPosition, rows] of bySlot) {
      const tiersPresent = new Set(rows.map((r) => r.rarityTierLevel));
      if (tiersPresent.size !== VALID_TIER_LEVELS.length) {
        throw new BadRequestError(
          `slot ${slotPosition}: must include all of tiers ${VALID_TIER_LEVELS.join(", ")} together — partial updates to one tier of a slot aren't allowed, since the row's sum couldn't be validated`
        );
      }
      const sum = rows.reduce((total, r) => total + r.probabilityPercent, 0);
      if (Math.abs(sum - 100) > SUM_TOLERANCE) {
        throw new BadRequestError(`slot ${slotPosition}: probabilities must sum to 100, got ${sum}`);
      }
    }
  }

  const coreUpdate: PackCoreUpdate = {};
  for (const key of [
    "priceCents",
    "itemCount",
    "stockRemaining",
    "maxStock",
    "restockAmount",
    "restockIntervalSeconds",
    "goesLiveAt",
    "endsAt",
    "recurrenceWeekdays",
    "recurrenceTimeUtc",
    "recurrenceDurationMinutes",
  ] as const) {
    if (key in input) coreUpdate[key] = input[key] as never;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await updatePackCoreFields(client, packId, coreUpdate);
    if (input.slotProbabilities) {
      for (const row of input.slotProbabilities) {
        await upsertSlotProbability(client, packId, row.slotPosition, row.rarityTierLevel, row.probabilityPercent);
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const updated = await getPackSkuById(packId);
  if (!updated) throw new NotFoundError("Pack not found after update");
  return updated;
}
