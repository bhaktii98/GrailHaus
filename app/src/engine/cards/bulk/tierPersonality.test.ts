import { describe, expect, it } from "vitest";
import { tierRevealIdentity } from "./tierPersonality";
import { vaultBreakPersonality } from "../vaultReveal/config/vaultBreak.config";
import { cardPackPersonality } from "../reveal/config/cardPack.config";
import { BLACK_LABEL_PALETTE, BLACK_LABEL_KICKER } from "../blackLabelReveal/config/blackLabel.palette";

/**
 * Tests for the bulk run's tier identity lookup.
 *
 * The property that matters is that the bulk run genuinely *derives* from each tier's existing
 * single-pack personality rather than re-typing values that can silently drift apart. Several of
 * these assert the derivation directly against the source configs, so a palette change in a tier's
 * own reveal either flows through here or fails the build — which is the whole point of the
 * consistency pass.
 */

const TIERS = ["street_rip", "vault_break", "black_label"] as const;

describe("tierRevealIdentity", () => {
  it("gives every card tier its own distinct identity", () => {
    const accents = TIERS.map((t) => tierRevealIdentity(t).accentHex);
    expect(new Set(accents).size).toBe(TIERS.length);
  });

  it("assigns each tier its own ambience treatment", () => {
    expect(tierRevealIdentity("black_label").ambience).toBe("ember");
    expect(tierRevealIdentity("vault_break").ambience).toBe("vault");
    expect(tierRevealIdentity("street_rip").ambience).toBe("foil");
  });

  it("falls back to the base tier for an unknown SKU rather than rendering colourless", () => {
    const unknown = tierRevealIdentity("some_new_tier_added_in_admin");
    expect(unknown).toEqual(tierRevealIdentity("street_rip"));
  });

  it("keeps accentHex and accentRGB describing the same colour", () => {
    for (const tier of TIERS) {
      const { accentHex, accentRGB } = tierRevealIdentity(tier);
      const [r, g, b] = accentRGB.split(",").map((n) => Number(n.trim()));
      const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
      expect(hex.toLowerCase()).toBe(accentHex.toLowerCase());
    }
  });
});

describe("derivation from each tier's single-pack personality", () => {
  it("takes Black Label's card back from its own sealed-pack palette", () => {
    const { cardBackGradient } = tierRevealIdentity("black_label");
    expect(cardBackGradient).toEqual([BLACK_LABEL_PALETTE.graphite, BLACK_LABEL_PALETTE.ink]);
  });

  it("takes Vault Break's card back from its own sealed-pack palette", () => {
    const { cardBackGradient } = tierRevealIdentity("vault_break");
    expect(cardBackGradient).toEqual([
      vaultBreakPersonality.palette.violet,
      vaultBreakPersonality.palette.plum,
    ]);
  });

  it("takes Street Rip's card back from the base pack palette", () => {
    const { cardBackGradient } = tierRevealIdentity("street_rip");
    expect(cardBackGradient).toEqual([
      cardPackPersonality.palette.violet,
      cardPackPersonality.palette.violetDeep,
    ]);
  });

  it("carries each tier's own sealed kicker", () => {
    expect(tierRevealIdentity("black_label").kicker).toBe(BLACK_LABEL_KICKER);
    expect(tierRevealIdentity("vault_break").kicker).toBe(vaultBreakPersonality.copy.kicker);
  });

  it("uses Black Label's fire palette for its hot core", () => {
    // fire.ts documents HOT as 0xfff1cf — champagne-white at the core of the flame.
    expect(tierRevealIdentity("black_label").hotHex.toLowerCase()).toBe("#fff1cf");
  });
});

describe("haptic character", () => {
  it("makes Black Label the heaviest tier under the thumb", () => {
    const bl = tierRevealIdentity("black_label").haptics;
    const sr = tierRevealIdentity("street_rip").haptics;
    // Its foil is a heavier gauge (tear.stretch 0.07 vs the base pack's), so it resists longer
    // and gives harder.
    expect(bl.land).toBe("heavy");
    expect(bl.buildSteps).toBeGreaterThan(sr.buildSteps);
  });

  it("escalates build steps from base tier upward", () => {
    const steps = TIERS.map((t) => tierRevealIdentity(t).haptics.buildSteps);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });

  it("reserves the doubled climax for the two premium tiers", () => {
    expect(tierRevealIdentity("black_label").haptics.climaxDouble).toBe(true);
    expect(tierRevealIdentity("vault_break").haptics.climaxDouble).toBe(true);
    expect(tierRevealIdentity("street_rip").haptics.climaxDouble).toBe(false);
  });
});

describe("backgrounds", () => {
  it("gives every tier a two-stop backdrop landing on its own ground colour", () => {
    for (const tier of TIERS) {
      const { backdropGradient, backgroundHex } = tierRevealIdentity(tier);
      expect(backdropGradient).toHaveLength(2);
      expect(backdropGradient[1]).toBe(backgroundHex);
    }
  });

  it("makes Black Label the darkest ground so its embers carry", () => {
    const luminance = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    const bl = luminance(tierRevealIdentity("black_label").backgroundHex);
    const sr = luminance(tierRevealIdentity("street_rip").backgroundHex);
    expect(bl).toBeLessThan(sr);
  });
});
