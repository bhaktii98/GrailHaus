// Guards the Obsidian Vault's catalog -> reference mapping.
//
// Third tier, third resolver, and the same reasoning each time: this decides what a $7,500 pull
// actually looks like, it matches free text by substring, and the catalog is a spreadsheet import.
// What is different here is the fallback — this tier hashes the item id rather than defaulting to a
// fixed reference, and the *stability* of that hash is a correctness property, not a nicety: an
// owned watch that presented as Glacier Platine on the reveal and Sang Royale on its detail screen
// would read as a bug in the collection, not as variety.
//
// Every case material and dial colour asserted below was read out of the Apex sheet of
// GrailHaus_Luxury_Watch_Catalog.xlsx.
import { describe, expect, it } from "vitest";
import {
  OBSIDIAN_REFERENCES,
  referenceById,
  resolveReference,
} from "./obsidianReferences";

describe("OBSIDIAN_REFERENCES", () => {
  it("carries the design's five executions verbatim", () => {
    expect(OBSIDIAN_REFERENCES.map((r) => r.id)).toEqual([
      "nocturne",
      "meridian",
      "glacier",
      "sang",
      "imperial",
    ]);
  });

  it("gives every reference a distinct metal and dial", () => {
    // The tier's entire variety is material (the design: "same vault, same architecture, different
    // metal and dial"), so two references sharing both would be a duplicate execution rather than
    // a fifth option. Metal alone legitimately repeats — Meridian and Impérial are both champagne
    // gold — so the pair is what must be unique.
    const pairs = OBSIDIAN_REFERENCES.map((r) => `${r.metal.color}:${r.dial.color}`);
    expect(new Set(pairs).size).toBe(OBSIDIAN_REFERENCES.length);
  });

  it("uses only accent and ring values the material factory understands", () => {
    for (const r of OBSIDIAN_REFERENCES) {
      expect(["gold", "noir", "rhodium"], r.id).toContain(r.accent);
      expect(["gold", "steel", "none"], r.id).toContain(r.ring);
      expect(["bar", "dot"], r.id).toContain(r.index);
    }
  });
});

describe("resolveReference", () => {
  it("prefers the dial colour over the case material", () => {
    // The case says platinum, which alone would pick Glacier; the green dial must win, because an
    // Apex row in white gold with a green dial is Vert Impérial.
    const out = resolveReference({ id: "x", caseMaterial: "Platinum", dialColor: "Imperial Green" });
    expect(out.id).toBe("imperial");
  });

  it("maps the Apex sheet's dial colours", () => {
    const cases: [string, string][] = [
      ["Black", "nocturne"],
      ["Onyx", "nocturne"],
      ["Skeleton", "nocturne"],
      ["Burgundy", "sang"],
      ["Silver", "glacier"],
      ["Slate Grey", "glacier"],
      ["Champagne", "meridian"],
      ["Imperial Green", "imperial"],
    ];
    for (const [dial, id] of cases) {
      expect(resolveReference({ id: "x", dialColor: dial }).id, dial).toBe(id);
    }
  });

  it("falls back to the case material when the dial is unrecognised", () => {
    const cases: [string, string][] = [
      ["18K Gold", "meridian"],
      ["White Gold", "glacier"],
      ["Platinum", "glacier"],
      ["Titanium", "nocturne"],
      ["Carbon Composite", "nocturne"],
      ["Stainless Steel", "sang"],
    ];
    for (const [metal, id] of cases) {
      expect(resolveReference({ id: "x", caseMaterial: metal, dialColor: "Iridescent Fumé" }).id, metal).toBe(id);
    }
  });

  it("is case- and whitespace-insensitive", () => {
    expect(resolveReference({ id: "x", dialColor: "  IMPERIAL GREEN " }).id).toBe("imperial");
    expect(resolveReference({ id: "x", caseMaterial: " platinum " }).id).toBe("glacier");
  });

  it("returns the same reference every time for the same item", () => {
    // The stability property. Called repeatedly with no recognisable catalog data, the hash must
    // land on one execution and stay there.
    const item = { id: "owned-item-abc123" };
    const first = resolveReference(item).id;
    for (let i = 0; i < 20; i++) expect(resolveReference(item).id).toBe(first);
  });

  it("spreads unrecognised items across all five executions", () => {
    // A fixed default would make a tier that yields Apex a quarter of the time look repetitive.
    // Asserted over a spread of synthetic ids rather than a single one.
    const reached = new Set<string>();
    for (let i = 0; i < 200; i++) reached.add(resolveReference({ id: `item-${i}` }).id);
    expect(reached.size).toBe(OBSIDIAN_REFERENCES.length);
  });

  it("produces a valid reference from entirely empty catalog data", () => {
    // The realistic worst case: every optional column blank must still yield something buildable,
    // because the alternative is a crash on the most expensive purchase in the product.
    const out = resolveReference({});
    expect(OBSIDIAN_REFERENCES).toContain(out);
    expect(referenceById(out.id)).toBe(out);
  });
});
