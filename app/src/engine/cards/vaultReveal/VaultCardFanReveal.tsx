// Vault Break's card-reveal step — the flat 2D screen that follows VaultTearStage. This tier's
// own adapter/art bound onto the shared press-and-hold reveal engine
// (../reveal/holdToOpen/HoldToOpenFanReveal.tsx — see that file's header for why the fan layout,
// per-card rendering, and inspect sheet now live there instead of being duplicated per tier).
//
// The per-card art (name, real tier label, real live value, real 7-day drift sparkline, serial)
// is baked directly into each card's raster by cardArt.ts's drawCardFaceImage — this file only
// adapts real pulled items into that art's VaultCardData shape and hands the pre-baked images to
// the shared reveal screen.
import { useMemo } from "react";
import type { PackSku, PulledOwnedItem } from "@grailhaus/shared";
import { vaultBreakPersonality } from "./config/vaultBreak.config";
import { adaptPulledItemsToVaultDeck } from "./engine/adaptRealDeck";
import { CARD_ASPECT, drawCardFaceImage, drawCardVersoImage } from "./art/cardArt";
import { HoldToOpenFanReveal } from "../reveal/holdToOpen/HoldToOpenFanReveal";

export function VaultCardFanReveal({
  items,
  sku,
  initialOpenedCount,
  onProgress,
  onDone,
}: {
  items: PulledOwnedItem[];
  sku: PackSku;
  /** Passed straight through — see HoldToOpenFanReveal's own doc comment. */
  initialOpenedCount?: number;
  onProgress?: (pulledCount: number) => void;
  onDone: () => void;
}) {
  const deck = useMemo(() => adaptPulledItemsToVaultDeck(items, sku), [items, sku]);
  const verso = useMemo(() => drawCardVersoImage(), []);
  // Only ever actually shown for an item with no real catalog photo (rare) — every card with one
  // shows that instead, full-bleed, no chrome.
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
        kicker: vaultBreakPersonality.copy.kicker,
        accentHex: "#e8cf9a",
        // #e8cf9a — the two must describe the same colour (this triple read 232,207,162 and so
        // tinted every rgba() built from it slightly greener than the hex-driven chrome beside it).
        accentRGB: "232,207,154",
        vignetteGlow: "rgba(92,52,158,0.20)",
      }}
      initialOpenedCount={initialOpenedCount}
      onProgress={onProgress}
      onDone={onDone}
    />
  );
}
