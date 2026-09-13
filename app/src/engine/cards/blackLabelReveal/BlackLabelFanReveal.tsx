// Black Label's card-reveal step — the same shared press-and-hold reveal screen as
// ../vaultReveal/VaultCardFanReveal.tsx (see ../reveal/holdToOpen/HoldToOpenFanReveal.tsx's
// header for why it's shared rather than duplicated), bound to this tier's own
// personality/adapter/art instead of Vault Break's. Six cards fan here instead of five — the fan
// layout math already scales off the deck length, so that's data, not a code change.
//
// The per-card art is baked by art/blackLabelCardArt.ts's drawCardFaceImage — this file only
// adapts real pulled items and hands the pre-baked images to the shared reveal screen.
import { useMemo } from "react";
import type { PackSku, PulledOwnedItem } from "@grailhaus/shared";
import { blackLabelPersonality } from "./config/blackLabel.config";
import { adaptPulledItemsToBlackLabelDeck } from "./engine/adaptBlackLabelDeck";
import { CARD_ASPECT, drawCardFaceImage, drawCardVersoImage } from "./art/blackLabelCardArt";
import { HoldToOpenFanReveal } from "../reveal/holdToOpen/HoldToOpenFanReveal";

export function BlackLabelFanReveal({
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
  const deck = useMemo(() => adaptPulledItemsToBlackLabelDeck(items, sku), [items, sku]);
  const verso = useMemo(() => drawCardVersoImage(), []);
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
        kicker: blackLabelPersonality.copy.kicker,
        accentHex: "#c9a24a",
        accentRGB: "201,162,74",
        vignetteGlow: "rgba(180,140,60,0.20)",
      }}
      initialOpenedCount={initialOpenedCount}
      onProgress={onProgress}
      onDone={onDone}
    />
  );
}
