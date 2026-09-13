import { describe, expect, it } from "vitest";
import type { PackSku, PulledOwnedItem, RarityTierLevel } from "./types.js";
import {
  compareGrailsForReveal,
  grailIntensity,
  groupBulkRun,
  initialBatchRevealState,
  nextStage,
  presentationStrategyFor,
  summarizeBulkRun,
  withPackCoordinates,
} from "./bulkPresentation.js";

/**
 * Tests for the bulk run's presentation layer.
 *
 * The thing genuinely worth asserting here is the boundary the whole feature rests on: the
 * presentation may reorder freely, and the authoritative results must survive that completely
 * intact. So alongside the ordering/grouping/summary rules, several of these tests exist purely
 * to prove that nothing in this module mutates, drops, duplicates or re-attributes a single
 * pulled item.
 */

let idCounter = 0;

function item(overrides: Partial<PulledOwnedItem> & { rarityTierLevel: RarityTierLevel }): PulledOwnedItem {
  const n = ++idCounter;
  return {
    id: `item-${n}`,
    name: `Item ${n}`,
    rarityTierLevel: overrides.rarityTierLevel,
    textureUrl: null,
    baseValueCents: 1000,
    category: "cards",
    collection: null,
    tagline: null,
    traits: null,
    pokemonName: null,
    cardTitle: null,
    pokemonType: null,
    generation: null,
    pokedexNumber: null,
    watchName: null,
    modelName: null,
    brand: null,
    style: null,
    caseMaterial: null,
    dialColor: null,
    movement: null,
    caseSize: null,
    currentValueCents: overrides.baseValueCents ?? 1000,
    minValueCents: 0,
    maxValueCents: 100000,
    ownedItemId: `owned-${n}`,
    ...overrides,
  };
}

const core = (v = 500) => item({ rarityTierLevel: 1, baseValueCents: v, currentValueCents: v });
const prime = (v = 5000) => item({ rarityTierLevel: 2, baseValueCents: v, currentValueCents: v });
const grail = (v = 50000) => item({ rarityTierLevel: 3, baseValueCents: v, currentValueCents: v });

function sku(overrides: Partial<PackSku> = {}): PackSku {
  return {
    id: "pack-1",
    category: "cards",
    tier: "black_label",
    name: "Black Label",
    priceCents: 25000,
    itemCount: 7,
    slotProbabilities: [],
    pressureRules: [],
    rarityTiers: [
      { level: 1, name: "Core", colorHex: "#666", valueMinCents: 100, valueMaxCents: 1000 },
      { level: 2, name: "Prime", colorHex: "#88F", valueMinCents: 1000, valueMaxCents: 20000 },
      { level: 3, name: "Grail", colorHex: "#EC8", valueMinCents: 20000, valueMaxCents: 500000 },
    ],
    itemsByTier: { 1: [], 2: [], 3: [] },
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

describe("presentationStrategyFor", () => {
  it("keeps a single pack on the traditional sequential rip", () => {
    expect(presentationStrategyFor(1)).toBe("SINGLE_PACK");
  });

  it("routes a bulk buy to the grail hunt", () => {
    expect(presentationStrategyFor(10)).toBe("BULK_GRAIL_HUNT");
  });
});

describe("compareGrailsForReveal", () => {
  it("orders weakest first so the run escalates to a climax", () => {
    const a = grail(18000);
    const b = grail(32000);
    const c = grail(64000);
    const d = grail(95000);
    const sorted = [c, a, d, b].sort(compareGrailsForReveal);
    expect(sorted.map((g) => g.baseValueCents)).toEqual([18000, 32000, 64000, 95000]);
  });

  it("is deterministic for equal values, so a resume never reshuffles the hunt", () => {
    const a = { ...grail(50000), ownedItemId: "owned-bbb" };
    const b = { ...grail(50000), ownedItemId: "owned-aaa" };
    expect([a, b].sort(compareGrailsForReveal).map((g) => g.ownedItemId)).toEqual(["owned-aaa", "owned-bbb"]);
    expect([b, a].sort(compareGrailsForReveal).map((g) => g.ownedItemId)).toEqual(["owned-aaa", "owned-bbb"]);
  });

  it("ranks on base value, not the drifting current value, so ordering is stable for the batch", () => {
    // Same base value, wildly different live values: ordering must ignore the drift entirely.
    const a = { ...grail(40000), currentValueCents: 99999, ownedItemId: "owned-a" };
    const b = { ...grail(40000), currentValueCents: 1, ownedItemId: "owned-b" };
    expect([a, b].sort(compareGrailsForReveal).map((g) => g.ownedItemId)).toEqual(["owned-a", "owned-b"]);
  });
});

describe("grailIntensity", () => {
  it("gives a lone grail the full hero treatment", () => {
    expect(grailIntensity(0, 1)).toBe(1);
  });

  it("always peaks at the final grail", () => {
    expect(grailIntensity(3, 4)).toBe(1);
    expect(grailIntensity(9, 10)).toBe(1);
  });

  it("escalates monotonically across the run", () => {
    const values = [0, 1, 2, 3].map((i) => grailIntensity(i, 4));
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(4);
  });

  it("starts the first reveal well above zero so it still feels substantial", () => {
    expect(grailIntensity(0, 4)).toBeGreaterThan(0.4);
  });
});

describe("groupBulkRun", () => {
  it("extracts grails from every pack, in escalation order", () => {
    const packs = [
      [core(), core(), grail(30000), prime()],
      [core(), grail(90000), core(), prime()],
      [core(), core(), core(), grail(60000)],
    ];
    const { grails } = groupBulkRun(packs);
    expect(grails.map((g) => g.baseValueCents)).toEqual([30000, 60000, 90000]);
  });

  it("splits every pulled card into exactly one group, losing none", () => {
    const packs = [
      [core(), core(), prime(), grail()],
      [core(), prime(), core(), core()],
    ];
    const { grails, primes, cores } = groupBulkRun(packs);
    expect(grails.length + primes.length + cores.length).toBe(8);
    const groupedIds = [...grails, ...primes, ...cores].map((i) => i.ownedItemId).sort();
    const originalIds = packs.flat().map((i) => i.ownedItemId).sort();
    expect(groupedIds).toEqual(originalIds);
  });

  it("does not mutate the authoritative pack structure it was handed", () => {
    const packs = [
      [core(), grail(70000), prime()],
      [grail(20000), core(), core()],
    ];
    const before = packs.map((p) => p.map((i) => i.ownedItemId));
    groupBulkRun(packs);
    expect(packs.map((p) => p.map((i) => i.ownedItemId))).toEqual(before);
  });

  it("returns the same item references, never copies", () => {
    const g = grail();
    const { grails } = groupBulkRun([[core(), g]]);
    expect(grails[0]).toBe(g);
  });

  it("handles a run with no grails at all", () => {
    const { grails, primes, cores } = groupBulkRun([[core(), core(), prime()]]);
    expect(grails).toEqual([]);
    expect(primes).toHaveLength(1);
    expect(cores).toHaveLength(2);
  });
});

describe("withPackCoordinates", () => {
  it("derives pack and card position for results that lack them", () => {
    const packs = [
      [core(), core(), core()],
      [core(), core(), core()],
    ];
    const tagged = withPackCoordinates(packs);
    expect(tagged[0].map((i) => i.packIndex)).toEqual([0, 0, 0]);
    expect(tagged[1].map((i) => i.packIndex)).toEqual([1, 1, 1]);
    expect(tagged[1].map((i) => i.cardIndex)).toEqual([0, 1, 2]);
  });

  it("never overwrites authoritative coordinates the server already sent", () => {
    const packs = [[{ ...core(), packIndex: 7, cardIndex: 3 }]];
    const tagged = withPackCoordinates(packs);
    expect(tagged[0][0].packIndex).toBe(7);
    expect(tagged[0][0].cardIndex).toBe(3);
  });

  it("keeps pack association intact through the reordering the hunt performs", () => {
    // The point of the whole exercise: a grail pulled from pack 2 must still say "pack 2" after
    // the presentation layer has yanked it out of its pack and put it first.
    const packs = withPackCoordinates([
      [core(), core(), core()],
      [core(), grail(80000), core()],
    ]);
    const { grails } = groupBulkRun(packs);
    expect(grails[0].packIndex).toBe(1);
    expect(grails[0].cardIndex).toBe(1);
  });
});

describe("summarizeBulkRun", () => {
  it("counts each rarity and the full card total", () => {
    const packs = [
      [core(), core(), prime(), grail()],
      [core(), prime(), core(), grail()],
    ];
    const s = summarizeBulkRun(sku(), packs);
    expect(s.totalCards).toBe(8);
    expect(s.grailCount).toBe(2);
    expect(s.primeCount).toBe(2);
    expect(s.coreCount).toBe(4);
    expect(s.packCount).toBe(2);
  });

  it("charges the pack price once per pack", () => {
    const packs = [[core()], [core()], [core()]];
    expect(summarizeBulkRun(sku({ priceCents: 25000 }), packs).totalSpendCents).toBe(75000);
  });

  it("values the run mark-to-market and reports profit honestly", () => {
    const packs = [[core(40000)], [core(40000)]];
    const s = summarizeBulkRun(sku({ priceCents: 25000 }), packs);
    expect(s.estimatedValueCents).toBe(80000);
    expect(s.estimatedPnlCents).toBe(30000);
  });

  it("reports a loss as a negative, never hidden or floored at zero", () => {
    const packs = [[core(100)], [core(100)]];
    const s = summarizeBulkRun(sku({ priceCents: 25000 }), packs);
    expect(s.estimatedPnlCents).toBe(200 - 50000);
    expect(s.estimatedPnlCents).toBeLessThan(0);
  });

  it("surfaces the final grail as the best pull, matching what the hunt revealed last", () => {
    const packs = [
      [core(), grail(30000)],
      [prime(), grail(90000)],
    ];
    const s = summarizeBulkRun(sku(), packs);
    const { grails } = groupBulkRun(packs);
    expect(s.bestPull?.ownedItemId).toBe(grails[grails.length - 1].ownedItemId);
    expect(s.bestPull?.baseValueCents).toBe(90000);
  });

  it("still names a best pull when the run produced no grail", () => {
    const packs = [[core(300), prime(9000), core(100)]];
    const s = summarizeBulkRun(sku(), packs);
    expect(s.grailCount).toBe(0);
    expect(s.bestPull?.baseValueCents).toBe(9000);
  });

  it("returns no best pull for an empty batch rather than throwing", () => {
    const s = summarizeBulkRun(sku(), []);
    expect(s.bestPull).toBeNull();
    expect(s.totalCards).toBe(0);
  });
});

describe("nextStage", () => {
  const full = groupBulkRun([[core(), prime(), grail()]]);

  it("opens on the hunt", () => {
    expect(nextStage("intro", full)).toBe("grail_hunt");
  });

  it("runs hunt → prime → core → summary when every stage has content", () => {
    expect(nextStage("grail_hunt", full)).toBe("prime");
    expect(nextStage("prime", full)).toBe("core");
    expect(nextStage("core", full)).toBe("summary");
  });

  it("skips the prime stage when the run pulled none", () => {
    const groups = groupBulkRun([[core(), grail()]]);
    expect(nextStage("grail_hunt", groups)).toBe("core");
  });

  it("skips straight to the summary when only grails were pulled", () => {
    const groups = groupBulkRun([[grail()]]);
    expect(nextStage("grail_hunt", groups)).toBe("summary");
  });

  it("still routes a zero-grail run through the hunt, which owns that beat", () => {
    // The hunt stage renders its own honest "no grail this run" moment; skipping the stage the
    // feature is named after would read as the feature being broken.
    const groups = groupBulkRun([[core(), prime()]]);
    expect(nextStage("intro", groups)).toBe("grail_hunt");
    expect(nextStage("grail_hunt", groups)).toBe("prime");
  });

  it("terminates at the summary", () => {
    expect(nextStage("summary", full)).toBe("summary");
  });
});

describe("initialBatchRevealState", () => {
  it("starts a fresh run at the intro with nothing revealed", () => {
    const s = initialBatchRevealState();
    expect(s.stage).toBe("intro");
    expect(s.currentGrailIndex).toBe(0);
    expect(s.completedGrailIds).toEqual([]);
    expect(s.summaryViewed).toBe(false);
  });
});
