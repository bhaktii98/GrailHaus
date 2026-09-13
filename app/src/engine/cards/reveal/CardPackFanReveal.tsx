// Tier 1's card-reveal step — the same shared press-and-hold reveal screen the premium tiers use
// (holdToOpen/HoldToOpenFanReveal.tsx), bound to this tier's own adapter (engine/
// adaptCardPackDeck.ts) and the base collector-card art (vaultReveal/art/cardArt.ts, undecorated
// — no stock/ribbon/windowArt theme overrides, the look every tier started from before Vault
// Break and Black Label got their own). Replaces CardFlowEngine's old swipe-through-cards +
// hold-on-the-last-card flow: every card here is now revealed the same deliberate way, not just
// the rarest one. The pack tear itself (CardFlowEngine's IntroductionView) is unchanged.
import { useMemo } from "react";
import type { ItemDetail, PackSku } from "@grailhaus/shared";
import { adaptItemDetailsToCardPackDeck } from "./engine/adaptCardPackDeck";
import { CARD_ASPECT, drawCardFaceImage, drawCardVersoImage } from "../vaultReveal/art/cardArt";
import { HoldToOpenFanReveal } from "./holdToOpen/HoldToOpenFanReveal";

const VERSO_THEME = {
  line1: "GRAILHAUS · SERIES I",
  line2: "COLLECTOR CARD GAME",
};

export function CardPackFanReveal({
  items,
  sku,
  compressed,
  autoAdvance,
  initialOpenedCount,
  onProgress,
  onDone,
}: {
  items: ItemDetail[];
  sku: PackSku;
  /** Bulk-batch pacing only — set by CardFlowEngine to true for pack 2+ of a 10-pack batch, never
   * for a standalone purchase. Passed straight through to HoldToOpenFanReveal, which is the one
   * place the actual timing lives — see that prop's own doc comment. */
  compressed?: boolean;
  /** Bulk-batch only — true for every pack of a batch (including pack 1), never for a standalone
   * purchase. See HoldToOpenFanReveal's own doc comment — this is what makes 50 cards across 10
   * packs practical without requiring 50 taps. */
  autoAdvance?: boolean;
  /** Passed straight through — see HoldToOpenFanReveal's own doc comment. */
  initialOpenedCount?: number;
  onProgress?: (pulledCount: number) => void;
  onDone: () => void;
}) {
  const deck = useMemo(() => adaptItemDetailsToCardPackDeck(items, sku), [items, sku]);
  const verso = useMemo(() => drawCardVersoImage(VERSO_THEME), []);
  const faces = useMemo(() => deck.map((card) => drawCardFaceImage(card)), [deck]);

  return (
    <HoldToOpenFanReveal
      items={items}
      sku={sku}
      deck={deck}
      faces={faces}
      verso={verso}
      cardAspect={CARD_ASPECT}
      palette={{
        kicker: "Sealed · Series I",
        accentHex: "#d8a93f",
        accentRGB: "216,169,63",
        vignetteGlow: "rgba(177,75,255,0.18)",
      }}
      compressed={compressed}
      autoAdvance={autoAdvance}
      initialOpenedCount={initialOpenedCount}
      onProgress={onProgress}
      onDone={onDone}
    />
  );
}
