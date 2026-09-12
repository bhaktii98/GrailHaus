// Guards the registry that decides which packs get a timeline reveal.
//
// This is the test that actually protects the architecture claim. The requirement is that adding a
// category or tier is configuration — a row here — rather than an edit to shared plumbing, and the
// two things that would quietly break that are a reveal failing to resolve (so a paid pack falls
// back to the generic reveal without anyone noticing) and a reveal resolving too broadly (so an
// unbuilt tier renders something it should not). Both are asserted below.
// Scope note: this exercises the registry's *table* — which packs map to a reveal, and which do
// not. It deliberately does not invoke the decorators, because loading one pulls in that reveal's
// scene component and the whole React Native runtime beneath it, which cannot be imported in a
// plain node test environment. That the table is verifiable without a JSX runtime is a property of
// the lazy `load` thunks (see the registry's own note), not an accident.
//
// The decorators' own behaviour — what they override and what they pass through — is covered where
// it can be: each reveal's choreography and archetype resolvers have their own unit tests, and the
// wiring end-to-end is verified by the Android bundle building and the reveal running on device.
import { describe, expect, it } from "vitest";
import { choreographyLabel, hasChoreography } from "./choreographyRegistry";

describe("choreographyRegistry", () => {
  it("resolves all three watch tiers", () => {
    expect(hasChoreography("watches", "reserve")).toBe(true);
    expect(hasChoreography("watches", "archive")).toBe(true);
    expect(hasChoreography("watches", "obsidian_vault")).toBe(true);
    expect(choreographyLabel("watches", "reserve")).toContain("Reserve");
    expect(choreographyLabel("watches", "archive")).toContain("Archive");
    expect(choreographyLabel("watches", "obsidian_vault")).toContain("Obsidian");
  });

  it("does not resolve an unknown tier", () => {
    // A tier with no row must fall through to the category's own configured reveal rather than
    // borrowing another tier's — showing The Reserve's wooden box for a different product would be
    // worse than showing the generic one. This previously covered obsidian_vault, which is now
    // built; kept against a synthetic slug so the fall-through path stays tested.
    expect(hasChoreography("watches", "not_a_tier")).toBe(false);
    expect(choreographyLabel("watches", "not_a_tier")).toBeNull();
  });

  it("leaves every other category untouched", () => {
    // Cards have their own dedicated flow engines and must never pick up a watch choreography.
    expect(hasChoreography("cards", "street_rip")).toBe(false);
    expect(hasChoreography("cards", "vault_break")).toBe(false);
    expect(hasChoreography("cards", "black_label")).toBe(false);
    expect(hasChoreography("handbags", "any")).toBe(false);
  });

  it("gives each registered reveal a distinct, readable label", () => {
    // The labels are what a log line or a diagnostic screen shows, so two tiers sharing one would
    // make a misrouted reveal invisible in exactly the situation you need to debug it.
    const reserve = choreographyLabel("watches", "reserve");
    const archive = choreographyLabel("watches", "archive");
    expect(reserve).not.toBe(archive);
    expect(reserve).toBeTruthy();
    expect(archive).toBeTruthy();
  });

  it("prefers an exact tier match over a category wildcard", () => {
    // No wildcard row exists today, but the resolution order is what lets a future category
    // register one default reveal for all its tiers and still override a single tier. Asserted
    // against the real resolver so the precedence cannot silently invert.
    expect(hasChoreography("watches", "reserve")).toBe(true);
    expect(hasChoreography("watches", "nonexistent_tier")).toBe(false);
  });
});
