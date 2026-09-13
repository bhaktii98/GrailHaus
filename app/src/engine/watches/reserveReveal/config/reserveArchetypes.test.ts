// Guards the Reserve's own catalog -> archetype mapping, the same way the Archive's test guards
// its resolver. Different vocabulary, same failure mode: this decides the entire silhouette shown
// for a paid pull, it matches free text by substring, and the catalog is a spreadsheet import — so
// a slightly different style string is a realistic future event and the failure (everything
// rendering as a plain dress watch) is invisible without a test.
//
// Every style string asserted below was read out of GrailHaus_Luxury_Watch_Catalog.xlsx across all
// three rarity sheets, not invented. A Reserve pack can contain Icon and Apex watches (PRD §16:
// 75% / 22% / 3%), so the Icon- and Apex-sheet styles matter here too — this is precisely where
// the design prototype's own table fell short, since it only ever displayed the 14 Heritage rows.
import { describe, expect, it } from "vitest";
import { resolveReserveArchetype, resolveReserveSpec } from "./reserveArchetypes";

describe("resolveReserveArchetype", () => {
  it("maps the Heritage-sheet styles the design itself specified", () => {
    // These nine assertions are the source's own ARCHETYPE_BY_STYLE table, verbatim — if any of
// them changes, this port has diverged from the design rather than extended it.
    const cases: [string, string][] = [
      ["Diver", "diver"],
      ["Professional Diver", "diver"],
      ["Chronograph", "chronograph"],
      ["Dress", "rectangular"],
      ["Classic Dress", "dress"],
      ["Everyday Luxury", "dress"],
      ["Dress / Sport", "dress"],
      ["Luxury Sport", "integrated"],
      ["Tool / Explorer", "dress"],
    ];
    for (const [style, expected] of cases) {
      expect(resolveReserveArchetype(style), style).toBe(expected);
    }
  });

  it("maps the Icon- and Apex-sheet styles the design's own table missed", () => {
    const cases: [string, string][] = [
      ["Luxury Diver", "diver"],
      ["Statement Chronograph", "chronograph"],
      ["High-Performance Chronograph", "chronograph"],
      ["GMT / Travel", "diver"],
      ["GMT / Luxury Sport", "diver"],
      ["Dress / Dual Time", "rectangular"],
      ["Grand Complication", "dress"],
      ["Astronomical Complication", "dress"],
      ["Ultra-Light Sport", "integrated"],
    ];
    for (const [style, expected] of cases) {
      expect(resolveReserveArchetype(style), style).toBe(expected);
    }
  });

  it("orders its rules so compound styles beat the bare substrings they contain", () => {
    // The three precedence hazards, asserted directly rather than left implicit:
    // "Luxury Diver" contains "sport"-adjacent luxury wording but must be a diver;
    // "Classic Dress" contains "dress" but must not reach the rectangular case;
    // "Dress / Sport" contains both "dress" and "sport".
    expect(resolveReserveArchetype("Luxury Diver")).toBe("diver");
    expect(resolveReserveArchetype("Classic Dress")).toBe("dress");
    expect(resolveReserveArchetype("Dress / Sport")).toBe("dress");
    expect(resolveReserveArchetype("Dress")).toBe("rectangular");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(resolveReserveArchetype("  PROFESSIONAL DIVER ")).toBe("diver");
    expect(resolveReserveArchetype("luxury sport")).toBe("integrated");
  });

  it("falls back to dress rather than throwing on unknown or missing data", () => {
    expect(resolveReserveArchetype(null)).toBe("dress");
    expect(resolveReserveArchetype(undefined)).toBe("dress");
    expect(resolveReserveArchetype("")).toBe("dress");
    expect(resolveReserveArchetype("Perpetual Calendar Moonphase")).toBe("dress");
  });

  it("reaches all five constructions across the real catalog", () => {
    const reached = new Set(
      ["Diver", "Chronograph", "Dress", "Classic Dress", "Luxury Sport"].map((s) =>
        resolveReserveArchetype(s)
      )
    );
    expect(reached).toEqual(new Set(["diver", "chronograph", "rectangular", "dress", "integrated"]));
  });
});

describe("resolveReserveSpec", () => {
  it("derives a case radius from the catalog's size column", () => {
    // 41mm case -> 0.0205m radius, the same true-scale convention the design models at.
    expect(resolveReserveSpec({ caseSize: "41mm" }).caseR).toBeCloseTo(0.0205, 5);
    expect(resolveReserveSpec({ caseSize: "39mm" }).caseR).toBeCloseTo(0.0195, 5);
    // The catalog uses words for some sizes — the design's own aliases.
    expect(resolveReserveSpec({ caseSize: "Medium" }).caseR).toBeCloseTo(0.0185, 5);
    expect(resolveReserveSpec({ caseSize: "Large" }).caseR).toBeCloseTo(0.02, 5);
    // Missing or unparseable falls back to a plausible 40mm rather than collapsing to zero, which
    // would build a watch with no case at all.
    expect(resolveReserveSpec({ caseSize: null }).caseR).toBeCloseTo(0.02, 5);
    expect(resolveReserveSpec({ caseSize: "one size" }).caseR).toBeCloseTo(0.02, 5);
  });

  it("splits a two-token dial column into dial and accent", () => {
    const spec = resolveReserveSpec({ dialColor: "Black / Burgundy Bezel" });
    expect(spec.dialHex).toBe("#14161a");
    expect(spec.accentHex).toBe("#4e1520");
  });

  it("leaves accent null for a single-colour dial", () => {
    expect(resolveReserveSpec({ dialColor: "Blue" }).accentHex).toBeNull();
  });

  it("judges dial lightness by luminance, not by integer magnitude", () => {
    // The design's own test is `dialColor > 0x999999`, which calls a saturated blue "light"
    // purely because of where its bits fall — and then draws its dial furniture dark on a dark
    // dial, making it illegible. These four are the cases that distinguish the two approaches.
    expect(resolveReserveSpec({ dialColor: "White" }).lightDial).toBe(true);
    expect(resolveReserveSpec({ dialColor: "Silver" }).lightDial).toBe(true);
    expect(resolveReserveSpec({ dialColor: "Blue" }).lightDial).toBe(false);
    expect(resolveReserveSpec({ dialColor: "Black" }).lightDial).toBe(false);
  });

  it("derives complications and finishes from the archetype and model name", () => {
    const diver = resolveReserveSpec({ style: "Diver", watchName: "Seamaster" });
    expect(diver.lume).toBe(true);
    expect(diver.dateWindow).toBe(true);
    expect(diver.strap).toBe("link");
    expect(diver.dialVariant).toBe("sunburst");

    const chrono = resolveReserveSpec({ style: "Chronograph", watchName: "Carrera" });
    expect(chrono.subdials).toBe(true);
    // A chronograph dial is matte in the design, not sunburst — the registers need a quiet ground.
    expect(chrono.dialVariant).toBe("matte");

    const rect = resolveReserveSpec({ style: "Dress", watchName: "Tank" });
    expect(rect.romanIndices).toBe(true);
    expect(rect.strap).toBe("leather");

    const integrated = resolveReserveSpec({ style: "Luxury Sport", watchName: "Santos" });
    expect(integrated.strap).toBe("integrated");
  });

  it("detects the model-specific case shapes the app catalog has no column for", () => {
    expect(resolveReserveSpec({ watchName: "Monaco", style: "Chronograph" }).squareCase).toBe(true);
    expect(resolveReserveSpec({ watchName: "Reverso", style: "Dress" }).godrons).toBe(true);
    expect(resolveReserveSpec({ watchName: "Explorer", style: "Tool / Explorer" }).squareCase).toBe(false);
    // A square-cased chronograph wears a strap rather than a bracelet, per the design's own rule.
    expect(resolveReserveSpec({ watchName: "Monaco", style: "Chronograph" }).strap).toBe("leather");
  });

  it("picks the birch dial finish for the models that have one", () => {
    expect(resolveReserveSpec({ watchName: "Grand Seiko", dialColor: "Silver White" }).dialVariant).toBe("birch");
  });

  it("maps the catalog's two non-metal case materials to plausible finishes", () => {
    // Ceramic and Carbon Composite are absent from the design's METALS table, where they would
    // have silently inherited stainless steel's polish.
    const ceramic = resolveReserveSpec({ caseMaterial: "Ceramic" });
    const carbon = resolveReserveSpec({ caseMaterial: "Carbon Composite" });
    expect(ceramic.brushed).toBeGreaterThan(0.3);
    expect(carbon.brushed).toBeGreaterThan(ceramic.brushed);
  });

  it("produces a complete spec from entirely empty catalog data", () => {
    // The realistic worst case: a row with every optional column blank must still yield a
    // buildable watch, because the alternative is a crash on a purchase.
    const spec = resolveReserveSpec({});
    expect(spec.archetype).toBe("dress");
    expect(spec.caseR).toBeGreaterThan(0);
    expect(spec.metalHex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(spec.dialHex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(spec.strap).toBe("link");
  });
});
