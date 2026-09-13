import { beforeEach, describe, expect, it } from "vitest";
import type { PackSku, PulledOwnedItem, RarityTierLevel } from "@grailhaus/shared";
import { usePackFlowStore } from "./packFlowStore";

/**
 * Tests for the bulk run's client-side state machine.
 *
 * The properties worth pinning down here are the ones an interruption can violate: that a bulk
 * run's stage progress advances and persists correctly, that grail completion can't double-count,
 * and — most importantly — that none of this leaks into the single-pack flow, which must behave
 * exactly as it did before this feature existed.
 *
 * This tests the store directly rather than through React. The store is plain Zustand with no
 * component dependency, so it can be driven as pure state; asserting on rendered stages would
 * need @testing-library/react-native, which this project doesn't currently set up.
 */

let counter = 0;

function item(level: RarityTierLevel = 1): PulledOwnedItem {
  const n = ++counter;
  return {
    id: `item-${n}`,
    name: `Item ${n}`,
    rarityTierLevel: level,
    textureUrl: null,
    baseValueCents: 1000 * level,
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
    currentValueCents: 1000 * level,
    minValueCents: 0,
    maxValueCents: 100000,
    ownedItemId: `owned-${n}`,
  };
}

function sku(): PackSku {
  return {
    id: "pack-1",
    category: "cards",
    tier: "black_label",
    name: "Black Label",
    priceCents: 25000,
    itemCount: 3,
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
  };
}

const bulkPacks = () => [
  [item(1), item(2), item(3)],
  [item(1), item(1), item(2)],
  [item(3), item(1), item(1)],
];

beforeEach(() => {
  usePackFlowStore.getState().clear();
});

describe("single pack flow (regression guard)", () => {
  it("never creates bulk stage state for a single pack", () => {
    usePackFlowStore.getState().start(sku(), "purchase-1", [[item(), item(), item()]]);
    expect(usePackFlowStore.getState().bulkReveal).toBeNull();
  });

  it("still starts a single pack at the processing beat", () => {
    usePackFlowStore.getState().start(sku(), "purchase-1", [[item()]]);
    const s = usePackFlowStore.getState();
    expect(s.phase).toBe("processing");
    expect(s.currentPackIndex).toBe(0);
    expect(s.isBatchSummary).toBe(false);
  });

  it("ignores bulk stage transitions entirely for a single pack", () => {
    usePackFlowStore.getState().start(sku(), "purchase-1", [[item()]]);
    usePackFlowStore.getState().setBulkStage("core");
    const s = usePackFlowStore.getState();
    expect(s.bulkReveal).toBeNull();
    expect(s.phase).toBe("processing");
  });

  it("advances a single pack straight to its terminal summary", () => {
    usePackFlowStore.getState().start(sku(), "purchase-1", [[item()]]);
    usePackFlowStore.getState().advancePack();
    expect(usePackFlowStore.getState().isBatchSummary).toBe(true);
  });
});

describe("bulk run stage state", () => {
  it("starts a fresh bulk run at the intro beat with nothing revealed", () => {
    usePackFlowStore.getState().start(sku(), "purchase-1", bulkPacks());
    const s = usePackFlowStore.getState().bulkReveal;
    expect(s?.stage).toBe("intro");
    expect(s?.currentGrailIndex).toBe(0);
    expect(s?.completedGrailIds).toEqual([]);
  });

  it("moves through stages and marks the earlier ones complete", () => {
    const store = usePackFlowStore.getState();
    store.start(sku(), "purchase-1", bulkPacks());
    store.setBulkStage("grail_hunt");
    store.setBulkStage("prime");
    store.setBulkStage("core");
    const s = usePackFlowStore.getState().bulkReveal;
    expect(s?.stage).toBe("core");
    expect(s?.primeStageCompleted).toBe(true);
    expect(s?.coreStageCompleted).toBe(false);
  });

  it("flips the shared batch-summary flag when the run reaches its summary", () => {
    const store = usePackFlowStore.getState();
    store.start(sku(), "purchase-1", bulkPacks());
    store.setBulkStage("summary");
    const s = usePackFlowStore.getState();
    // The terminal screen is the same BatchSummaryScreen both paths route to, so the existing
    // flag must be kept in step rather than the bulk path needing its own summary branch.
    expect(s.isBatchSummary).toBe(true);
    expect(s.phase).toBe("summary");
    expect(s.bulkReveal?.summaryViewed).toBe(true);
  });

  it("counts each grail once, however many times the reveal callback fires", () => {
    const store = usePackFlowStore.getState();
    store.start(sku(), "purchase-1", bulkPacks());
    store.completeGrail("owned-grail-a");
    store.completeGrail("owned-grail-a");
    store.completeGrail("owned-grail-b");
    const s = usePackFlowStore.getState().bulkReveal;
    expect(s?.currentGrailIndex).toBe(2);
    expect(s?.completedGrailIds).toEqual(["owned-grail-a", "owned-grail-b"]);
  });

  it("collapses the whole run when the user skips to results", () => {
    const store = usePackFlowStore.getState();
    store.start(sku(), "purchase-1", bulkPacks());
    store.setBulkStage("grail_hunt");
    store.skipToBatchSummary();
    const s = usePackFlowStore.getState();
    expect(s.isBatchSummary).toBe(true);
    expect(s.bulkReveal?.stage).toBe("summary");
    // Skipping drops remaining animations, never remaining content.
    expect(s.packs.flat()).toHaveLength(9);
  });
});

describe("resume after interruption", () => {
  it("resumes a bulk run mid-hunt instead of restarting the chase", () => {
    const restored = {
      stage: "grail_hunt" as const,
      currentGrailIndex: 2,
      completedGrailIds: ["owned-a", "owned-b"],
      primeStageCompleted: false,
      coreStageCompleted: false,
      summaryViewed: false,
    };
    usePackFlowStore.getState().start(sku(), "purchase-1", bulkPacks(), { bulkReveal: restored });
    const s = usePackFlowStore.getState().bulkReveal;
    expect(s?.stage).toBe("grail_hunt");
    expect(s?.currentGrailIndex).toBe(2);
  });

  it("resumes a bulk run at a later stage when that is where it died", () => {
    usePackFlowStore.getState().start(sku(), "purchase-1", bulkPacks(), {
      bulkReveal: {
        stage: "core",
        currentGrailIndex: 3,
        completedGrailIds: ["a", "b", "c"],
        primeStageCompleted: true,
        coreStageCompleted: false,
        summaryViewed: false,
      },
    });
    expect(usePackFlowStore.getState().bulkReveal?.stage).toBe("core");
  });

  it("restores every pack's contents in full regardless of where it resumes", () => {
    const packs = bulkPacks();
    const ids = packs.flat().map((i) => i.ownedItemId);
    usePackFlowStore.getState().start(sku(), "purchase-1", packs, {
      bulkReveal: {
        stage: "prime",
        currentGrailIndex: 1,
        completedGrailIds: ["a"],
        primeStageCompleted: false,
        coreStageCompleted: false,
        summaryViewed: false,
      },
    });
    // Nothing about a resume may change what was pulled — contents are server-side and immutable.
    expect(usePackFlowStore.getState().packs.flat().map((i) => i.ownedItemId)).toEqual(ids);
  });

  it("falls back to a fresh run when a bulk purchase has no persisted stage yet", () => {
    usePackFlowStore.getState().start(sku(), "purchase-1", bulkPacks(), { bulkReveal: null });
    expect(usePackFlowStore.getState().bulkReveal?.stage).toBe("intro");
  });

  it("clears all bulk state when the flow finishes", () => {
    const store = usePackFlowStore.getState();
    store.start(sku(), "purchase-1", bulkPacks());
    store.setBulkStage("core");
    store.clear();
    const s = usePackFlowStore.getState();
    expect(s.bulkReveal).toBeNull();
    expect(s.packs).toEqual([]);
    expect(s.isBatchSummary).toBe(false);
  });
});
