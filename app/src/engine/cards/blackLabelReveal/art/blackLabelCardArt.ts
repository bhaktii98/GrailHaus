// Black Label's card faces reuse ../../vaultReveal/art/cardArt.ts's drawCardFace/
// drawCardFaceImage directly — the theme hooks that file's header describes (stock/ribbon/
// accent/windowArt on VaultCardData, set by ../engine/adaptBlackLabelDeck.ts) are what give the
// card its obsidian-and-fire frame, so this file only needs to bind the *verso* (which has no
// per-card data to carry a theme on) to this tier's own APEX_VERSO theme — the design's own
// card-art.js keeps the same shape (a shared drawCardVerso(theme) with a per-tier constant).
import type { SkImage } from "@shopify/react-native-skia";
import {
  CARD_ASPECT,
  drawCardFace,
  drawCardFaceImage,
  drawCardVerso as drawCardVersoThemed,
  drawCardVersoImage as drawCardVersoImageThemed,
  type PixelImage,
  type CardVersoTheme,
} from "../../vaultReveal/art/cardArt";

export { CARD_ASPECT, drawCardFace, drawCardFaceImage };

export const APEX_VERSO: CardVersoTheme = {
  stock: ["#0a090f", "#181519", "#030305"],
  band: "#6b5326",
  accRGB: "216,184,119",
  second: "255,120,40",
  line1: "BLACK LABEL · SERIES I",
  line2: "THE ELEMENTAL SERIES",
};

export function drawCardVerso(): PixelImage {
  return drawCardVersoThemed(APEX_VERSO);
}

export function drawCardVersoImage(): SkImage {
  return drawCardVersoImageThemed(APEX_VERSO);
}
