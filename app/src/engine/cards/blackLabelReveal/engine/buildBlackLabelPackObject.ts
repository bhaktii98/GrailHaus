// Black Label reuses Vault Break's engine (../../vaultReveal/engine/buildVaultPackObject.ts)
// unchanged — the geometry, tear/peel/gape deformation, liner, and staged reveal wiring are
// identical between the two tiers; only the baked art differs. This file exists purely to bind
// that shared function to Black Label's own art modules (art/blackLabelArt.ts,
// art/blackLabelCardArt.ts) so call sites don't have to remember to pass them.
import type { SkImage } from "@shopify/react-native-skia";
import { buildVaultPackObject, type BuiltVaultPack } from "../../vaultReveal/engine/buildVaultPackObject";
import type { VaultBreakPersonality, VaultCardData } from "../../vaultReveal/config/types";
import * as blackLabelArt from "../art/blackLabelArt";
import * as blackLabelCardArt from "../art/blackLabelCardArt";

export function buildBlackLabelPackObject(
  personality: VaultBreakPersonality,
  deck: VaultCardData[],
  logo: SkImage | null
): BuiltVaultPack {
  return buildVaultPackObject(personality, deck, logo, blackLabelArt, blackLabelCardArt);
}
