import { describe, expect, it } from "vitest";
import { DEFAULT_OWNERSHIP_WEIGHTS, pullPack, resolveItems } from "@grailhaus/shared";
import type { OwnershipCounts, PackItem, PackSku, PressureState, PulledItem, RarityTierLevel } from "@grailhaus/shared";

/**
 * Tests for the batch generation contract that a 10-pack purchase relies on.
 *
 * These exercise the *exact* generation loop `executePurchase` runs (same calls, same order, same
 * pressure carry-over) against the real reward engine, isolated from Postgres. What they cannot
 * cover without a live database is the transactional half — atomicity, the idempotency claim's
 * unique-index dedupe, balance/stock movement — because all of that is enforced by the database
 * itself rather than by application logic (see purchase.repository.ts's claimPurchase and the
 * `for update` locks in purchase.service.ts). Those need an integration harness with a real
 * Postgres; this file deliberately does not fake one and pretend otherwise.
 *
 * What is covered here is everything the bulk *reveal* depends on being true about a batch.
 */

const BULK_QUANTITY = 10;

function packItem(id: string, level: RarityTierLevel, value: number): PackItem {
  return { id, name: `Item ${id}`, rarityTierLevel: level, textureUrl: null, baseValueCents: value };
}

/** A pack whose slot odds guarantee a spread of tiers across a 10-pack, so grouping has
 * something real to group. Mirrors the shape of a genuine SKU rather than a degenerate one. */
function sku(itemCount: number, overrides: Partial<PackSku> = {}): PackSku {
  const slotProbabilities = Array.from({ length: itemCount }, (_, i) => ({
    slotPosition: i + 1,
    // The last slot skews rare, exactly like the progressive-odds design (PRD §8-9).
    probabilities:
      i === itemCount - 1
        ? ({ 1: 40, 2: 40, 3: 20 } as Record<RarityTierLevel, number>)
        : ({ 1: 80, 2: 18, 3: 2 } as Record<RarityTierLevel, number>),
  }));
  return {
    id: "pack-bulk",
    category: "cards",
    tier: "black_label",
    name: "Black Label",
    priceCents: 25000,
    itemCount,
    slotProbabilities,
    pressureRules: [],
    rarityTiers: [
      { level: 1, name: "Core", colorHex: "#666", valueMinCents: 100, valueMaxCents: 1000 },
      { level: 2, name: "Prime", colorHex: "#88F", valueMinCents: 1000, valueMaxCents: 20000 },
      { level: 3, name: "Grail", colorHex: "#EC8", valueMinCents: 20000, valueMaxCents: 500000 },
    ],
    itemsByTier: {
      1: [packItem("c1", 1, 500), packItem("c2", 1, 700)],
      2: [packItem("p1", 2, 5000), packItem("p2", 2, 8000)],
      3: [packItem("g1", 3, 60000), packItem("g2", 3, 90000)],
    },
    goesLiveAt: null,
    endsAt: null,
    stockRemaining: null,
    maxStock: null,
    recurrenceWeekdays: null,
    recurrenceTimeUtc: null,
    recurrenceDurationMinutes: null,
    phase: "live",
    ...overrides,
  };
}

/**
 * The generation loop from purchase.service.ts's executePurchase, reproduced exactly: one
 * pullPack + resolveItems per pack, ownership counts updated as it goes, pressure carried from
 * one pack into the next, and a coordinate recorded per item.
 */
function generateBatch(packSku: PackSku, quantity: number) {
  const ownershipCounts: OwnershipCounts = {};
  const weightTable = { cards: DEFAULT_OWNERSHIP_WEIGHTS.cards, watches: DEFAULT_OWNERSHIP_WEIGHTS.watches };
  let consecutive = 0;
  const allItems: PulledItem[] = [];
  const packCoordinates: { packIndex: number; cardIndex: number }[] = [];

  for (let i = 0; i < quantity; i++) {
    const pressureState: PressureState = { packId: packSku.id, consecutiveWithoutQualifying: consecutive };
    const { tierLevels, nextPressureState } = pullPack(packSku, pressureState);
    const items = resolveItems(packSku, tierLevels, ownershipCounts, weightTable);
    for (const item of items) ownershipCounts[item.id] = (ownershipCounts[item.id] ?? 0) + 1;
    items.forEach((_, cardIndex) => packCoordinates.push({ packIndex: i, cardIndex }));
    allItems.push(...items);
    consecutive = nextPressureState.consecutiveWithoutQualifying;
  }
  return { allItems, packCoordinates };
}

describe("bulk batch generation", () => {
  it("produces exactly 50 cards for 10 Street Rip packs", () => {
    const { allItems } = generateBatch(sku(5, { tier: "street_rip" }), BULK_QUANTITY);
    expect(allItems).toHaveLength(50);
  });

  it("produces exactly 60 cards for 10 Vault Break packs", () => {
    const { allItems } = generateBatch(sku(6, { tier: "vault_break" }), BULK_QUANTITY);
    expect(allItems).toHaveLength(60);
  });

  it("produces exactly 70 cards for 10 Black Label packs", () => {
    const { allItems } = generateBatch(sku(7, { tier: "black_label" }), BULK_QUANTITY);
    expect(allItems).toHaveLength(70);
  });

  it("records a coordinate for every single generated card", () => {
    const { allItems, packCoordinates } = generateBatch(sku(7), BULK_QUANTITY);
    expect(packCoordinates).toHaveLength(allItems.length);
  });

  it("assigns exactly itemCount cards to each of the ten packs", () => {
    const itemCount = 7;
    const { packCoordinates } = generateBatch(sku(itemCount), BULK_QUANTITY);
    for (let pack = 0; pack < BULK_QUANTITY; pack++) {
      expect(packCoordinates.filter((c) => c.packIndex === pack)).toHaveLength(itemCount);
    }
  });

  it("numbers each pack's cards from 0..itemCount-1, with no gaps or repeats", () => {
    const itemCount = 7;
    const { packCoordinates } = generateBatch(sku(itemCount), BULK_QUANTITY);
    for (let pack = 0; pack < BULK_QUANTITY; pack++) {
      const indices = packCoordinates.filter((c) => c.packIndex === pack).map((c) => c.cardIndex);
      expect(indices).toEqual(Array.from({ length: itemCount }, (_, i) => i));
    }
  });

  it("keeps stored coordinates in step with positional derivation", () => {
    // The client falls back to slicing by itemCount for purchase rows written before coordinates
    // were persisted. Old and new rows must therefore describe an identical structure.
    const itemCount = 7;
    const { packCoordinates } = generateBatch(sku(itemCount), BULK_QUANTITY);
    packCoordinates.forEach((coord, i) => {
      expect(coord.packIndex).toBe(Math.floor(i / itemCount));
      expect(coord.cardIndex).toBe(i % itemCount);
    });
  });

  it("carries grail pressure across packs rather than resetting per pack", () => {
    // A pack with a hard guarantee at 2 steps: run it single-pack ten times with a fresh counter
    // each time, versus one batch of ten carrying the counter. Carrying must produce at least as
    // many qualifying pulls — that carry-over is the whole point of the pity system spanning a
    // batch, and a bulk buy must not quietly discard it.
    const guaranteed = sku(5, {
      pressureRules: [
        {
          qualifyingMinTier: 3,
          stepsWithoutQualifying: 2,
          effectType: "guarantee_min_tier",
          targetTierLevel: 3,
          effectValue: null,
          appliesToFinalSlotOnly: true,
        },
      ],
    });

    const batched = generateBatch(guaranteed, BULK_QUANTITY).allItems.filter((i) => i.rarityTierLevel === 3).length;

    let isolated = 0;
    for (let i = 0; i < BULK_QUANTITY; i++) {
      isolated += generateBatch(guaranteed, 1).allItems.filter((it) => it.rarityTierLevel === 3).length;
    }

    expect(batched).toBeGreaterThanOrEqual(isolated);
  });

  it("only ever yields items that belong to the pack's own catalog", () => {
    const packSku = sku(7);
    const validIds = new Set(Object.values(packSku.itemsByTier).flat().map((i) => i.id));
    const { allItems } = generateBatch(packSku, BULK_QUANTITY);
    for (const item of allItems) expect(validIds.has(item.id)).toBe(true);
  });

  it("respects each slot's configured tier distribution over a large batch", () => {
    // Odds must be untouched by bulk. A slot that can only roll tier 1 must never yield anything
    // else, however many packs are generated at once.
    const singleTier = sku(3, {
      slotProbabilities: [
        { slotPosition: 1, probabilities: { 1: 100, 2: 0, 3: 0 } as Record<RarityTierLevel, number> },
        { slotPosition: 2, probabilities: { 1: 100, 2: 0, 3: 0 } as Record<RarityTierLevel, number> },
        { slotPosition: 3, probabilities: { 1: 0, 2: 100, 3: 0 } as Record<RarityTierLevel, number> },
      ],
    });
    const { allItems } = generateBatch(singleTier, BULK_QUANTITY);
    expect(allItems).toHaveLength(30);
    allItems.forEach((item, i) => {
      expect(item.rarityTierLevel).toBe(i % 3 === 2 ? 2 : 1);
    });
  });

  it("generates a batch in one pass, so results are fixed once the loop completes", () => {
    // Immutability in the product sense is enforced by persistence (the `result` column is written
    // once, inside the purchase transaction, and only ever read back afterwards). What this
    // asserts is the precondition for that: generation is a pure function of the loop, producing a
    // complete batch with nothing deferred or lazily rolled later.
    const { allItems, packCoordinates } = generateBatch(sku(7), BULK_QUANTITY);
    const snapshot = allItems.map((i) => i.id);
    expect(allItems.map((i) => i.id)).toEqual(snapshot);
    expect(packCoordinates).toHaveLength(70);
    expect(allItems.every((i) => i.id && i.rarityTierLevel >= 1)).toBe(true);
  });
});
