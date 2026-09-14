import { cardPackPersonality } from "../reveal/config/cardPack.config";
import { vaultBreakPersonality } from "../vaultReveal/config/vaultBreak.config";
import { BLACK_LABEL_PALETTE } from "../blackLabelReveal/config/blackLabel.palette";
import type { CategoryPersonality } from "../reveal/config/types";
import { tierRevealIdentity } from "./tierPersonality";

/**
 * A tier-recoloured variant of the generic pack-tear mesh (`PackTearMesh`/`buildPackObject`),
 * used only by the bulk run's intro tear (`RunIntroStage`).
 *
 * Vault Break and Black Label's *real* single-pack tears run their own bespoke vault-door scene
 * (`VaultScene`/`BlackLabelScene`, with its own gesture rig, deck-aware geometry and logo
 * texture) — the bulk intro's tear deliberately doesn't reproduce that: one tear stands for the
 * whole run, not a specific pack, so it doesn't need that scene's own interaction/deck machinery.
 * What it does need is to stop looking like Street Rip regardless of which tier the run actually
 * is. `buildPackObject` only cares about the shape of the `CategoryPersonality` it's handed, not
 * which tier it's nominally "for" — so this reuses Street Rip's proven geometry/material/copy
 * wholesale and swaps in each tier's own colours, sourced from the same `tierRevealIdentity`
 * every other bulk-run screen already reads (so a palette change there follows through here too).
 */
export function tearPersonalityFor(tier: string): CategoryPersonality {
  if (tier === "vault_break") {
    const identity = tierRevealIdentity("vault_break");
    return {
      ...cardPackPersonality,
      palette: {
        ink: cardPackPersonality.palette.ink,
        gold: identity.accentHex,
        goldHi: identity.hotHex,
        goldDark: vaultBreakPersonality.palette.champagneDark,
        bone: vaultBreakPersonality.palette.ivory,
        violet: identity.cardBackGradient[0],
        violetDeep: identity.cardBackGradient[1],
      },
      copy: { ...cardPackPersonality.copy, kicker: identity.kicker },
    };
  }
  if (tier === "black_label") {
    const identity = tierRevealIdentity("black_label");
    return {
      ...cardPackPersonality,
      palette: {
        ink: BLACK_LABEL_PALETTE.ink,
        gold: identity.accentHex,
        goldHi: identity.hotHex,
        goldDark: BLACK_LABEL_PALETTE.champagneDark,
        bone: BLACK_LABEL_PALETTE.ivory,
        violet: identity.cardBackGradient[0],
        violetDeep: identity.cardBackGradient[1],
      },
      copy: { ...cardPackPersonality.copy, kicker: identity.kicker },
    };
  }
  return cardPackPersonality;
}
