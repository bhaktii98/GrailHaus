// Guards the one piece of this reveal that real catalog data flows through: the mapping from a
// pulled watch's free-text `style` column onto one of the design's five archetypes.
//
// This matters more than it looks. The archetype decides the entire silhouette shown for a paid
// pull, the mapping is substring-based over free text, and the catalog is a spreadsheet import —
// so a new row with a slightly different style string is a realistic future event, and the failure
// mode (every watch silently rendering as Monolith) is invisible without a test. Every style
// string asserted below was read out of GrailHaus_Luxury_Watch_Catalog.xlsx rather than invented.
import { describe, expect, it } from "vitest";
import { resolveArchetype, resolveCaseMaterialKey, resolveDialOverride, archetypeById } from "./watchArchetypes";

describe("resolveArchetype", () => {
  it("maps every Heritage-sheet style to an archetype", () => {
    // 14 rows, verbatim from the Heritage sheet's Style column.
    const cases: [string, string][] = [
      ["Everyday Luxury", "aurum"],
      ["Classic Dress", "aurum"],
      ["Tool / Explorer", "monolith"],
      ["Diver", "abyss"],
      ["Chronograph", "meridian"],
      ["Dress", "aurum"],
      ["Luxury Sport", "monolith"],
      ["Professional Diver", "abyss"],
      ["Dress / Sport", "aurum"],
    ];
    for (const [style, expected] of cases) {
      expect(resolveArchetype(style).id, style).toBe(expected);
    }
  });

  it("maps every Icon-sheet style to an archetype", () => {
    // 13 rows. These are the ones that motivated the ordered-rules approach: "Luxury Diver" must
    // reach the diver archetype rather than falling through to "luxury sport", and the two GMT
    // variants must not be read as plain sport watches.
    const cases: [string, string][] = [
      ["Luxury Diver", "abyss"],
      ["GMT / Travel", "meridian"],
      ["Chronograph", "meridian"],
      ["Luxury Sport", "monolith"],
      ["Statement Chronograph", "meridian"],
      ["GMT / Luxury Sport", "meridian"],
      ["Dress / Dual Time", "aurum"],
    ];
    for (const [style, expected] of cases) {
      expect(resolveArchetype(style).id, style).toBe(expected);
    }
  });

  it("maps every Apex-sheet style to an archetype", () => {
    // 9 rows. Grand Complication is the Cathedral trigger, and it must win over the "sport" that
    // also appears in some Apex style strings.
    const cases: [string, string][] = [
      ["Luxury Sport", "monolith"],
      ["Grand Complication", "cathedral"],
      ["Astronomical Complication", "cathedral"],
      ["High-Performance Chronograph", "meridian"],
      ["Ultra-Light Sport", "monolith"],
    ];
    for (const [style, expected] of cases) {
      expect(resolveArchetype(style).id, style).toBe(expected);
    }
  });

  it("is case- and whitespace-insensitive", () => {
    expect(resolveArchetype("  LUXURY DIVER  ").id).toBe("abyss");
    expect(resolveArchetype("grand complication").id).toBe("cathedral");
  });

  it("falls back to monolith rather than throwing on unknown or missing data", () => {
    // The whole point of the fallback: a catalog row with a style this build has never seen must
    // still produce a watch, because the alternative is a blank screen on a purchase.
    expect(resolveArchetype(null).id).toBe("monolith");
    expect(resolveArchetype(undefined).id).toBe("monolith");
    expect(resolveArchetype("").id).toBe("monolith");
    expect(resolveArchetype("   ").id).toBe("monolith");
    expect(resolveArchetype("Perpetual Calendar Moonphase").id).toBe("monolith");
  });

  it("covers all five archetypes across the real catalog", () => {
    // If a future edit collapsed two rules together, the reveal would quietly lose a whole
    // archetype's worth of variety — this asserts the catalog actually reaches all five.
    const reached = new Set(
      [
        "Luxury Sport",
        "Luxury Diver",
        "Dress",
        "Grand Complication",
        "Chronograph",
      ].map((s) => resolveArchetype(s).id)
    );
    expect(reached).toEqual(new Set(["monolith", "abyss", "aurum", "cathedral", "meridian"]));
  });
});

describe("resolveCaseMaterialKey", () => {
  it("re-tints the construction-identity archetypes from the catalog row", () => {
    const monolith = archetypeById("monolith")!;
    expect(resolveCaseMaterialKey(monolith, "Titanium")).toBe("titanium");
    expect(resolveCaseMaterialKey(monolith, "Oystersteel")).toBe("steel");
    // Two catalog materials that are not metals at all, mapped to the closest honest finish.
    expect(resolveCaseMaterialKey(monolith, "Ceramic")).toBe("forged");
    expect(resolveCaseMaterialKey(monolith, "Carbon Composite")).toBe("dlc");
  });

  it("preserves a signature metal against the catalog row", () => {
    // Aurum IS rose gold and Cathedral IS platinum — that is the archetype's identity, so a row
    // saying "Stainless Steel" must not erase it.
    const aurum = archetypeById("aurum")!;
    const cathedral = archetypeById("cathedral")!;
    expect(resolveCaseMaterialKey(aurum, "Stainless Steel")).toBe("roseGold");
    expect(resolveCaseMaterialKey(cathedral, "Oystersteel")).toBe("platinum");
  });

  it("keeps the archetype default for missing or unrecognised materials", () => {
    const meridian = archetypeById("meridian")!;
    expect(resolveCaseMaterialKey(meridian, null)).toBe(meridian.caseMat);
    expect(resolveCaseMaterialKey(meridian, "Unobtainium")).toBe(meridian.caseMat);
  });
});

describe("resolveDialOverride", () => {
  it("resolves a recognised catalog dial colour", () => {
    const monolith = archetypeById("monolith")!;
    const blue = resolveDialOverride(monolith, "Blue");
    expect(blue).not.toBeNull();
    // watchCatalogColors maps "blue" to #1b3a63.
    expect(blue!.getHexString()).toBe("1b3a63");
  });

  it("reads only the dial half of a two-token catalog value", () => {
    const monolith = archetypeById("monolith")!;
    const black = resolveDialOverride(monolith, "Black / Burgundy Bezel");
    expect(black).not.toBeNull();
    expect(black!.getHexString()).toBe("14161a");
  });

  it("returns null rather than a fallback when the row says nothing useful", () => {
    // Null means "keep the archetype's designed dial" — flattening Aurum's grained silver to a
    // solid tint on an unrecognised string would be a downgrade, not a personalisation.
    const monolith = archetypeById("monolith")!;
    expect(resolveDialOverride(monolith, null)).toBeNull();
    expect(resolveDialOverride(monolith, "Iridescent Fumé")).toBeNull();
  });

  it("never overrides an openworked dial", () => {
    // Cathedral has no solid dial plate to tint; forcing one would hide the tourbillon that is the
    // entire reason that archetype exists.
    const cathedral = archetypeById("cathedral")!;
    expect(resolveDialOverride(cathedral, "Black")).toBeNull();
  });
});
