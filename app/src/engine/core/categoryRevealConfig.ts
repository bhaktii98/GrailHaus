import type { CategoryReveal } from "@grailhaus/shared";
import type { CategoryRevealConfig } from "./types";
import { resolveMeshArchetype } from "./meshArchetypes";

/**
 * Turns a backend `CategoryReveal` row (see categoriesService.ts) into the shape
 * `RevealEngine`/`CardFlowEngine` actually consume — the one seam between "data fetched from
 * the `categories` table" and "the existing, unmodified reveal engine". `buildMesh` is the only
 * field that isn't a direct copy: it's resolved through the fixed archetype registry
 * (meshArchetypes.tsx) keyed by the row's `meshArchetype` string. `hapticTrack`/`revealOrder`/
 * `openingBeats` become small closures over the row's own data arrays instead of hardcoded
 * per-category functions — same behavior as the old `cards.config.tsx`/`watches.config.tsx`,
 * now driven by whatever an admin actually configured.
 */
export function toCategoryRevealConfig(row: CategoryReveal): CategoryRevealConfig {
  const buildMesh = resolveMeshArchetype(row.meshArchetype);

  return {
    id: row.id,
    label: row.label,
    palette: { background: row.paletteBackground, accent: row.paletteAccent },
    lighting: row.lighting,
    camera: { position: row.cameraPosition, fov: row.cameraFov },
    buildMesh: (item, opts) => buildMesh(item, opts),
    gesture: {
      mode: row.gestureMode,
      velocityThreshold: row.gestureVelocityThreshold,
      travelDistance: row.gestureTravelDistance,
    },
    timing: { commonBeatMs: row.commonBeatMs, rareHoldMs: row.rareHoldMs },
    hapticTrack: (phase, isRare) => {
      if (phase !== "opening") return [];
      return isRare ? row.hapticRare : row.hapticCommon;
    },
    openingBeats: row.openingBeatsCommon || row.openingBeatsRare
      ? (isRare) => (isRare ? row.openingBeatsRare ?? [] : row.openingBeatsCommon ?? [])
      : undefined,
    // Commons-first, rarest-last — every category currently wants the same ordering, and
    // nothing about a reveal's *personality* (what this table drives) should change that; it's
    // a property of the tension-choreography requirement itself, not a per-category style.
    revealOrder: (items) => [...items].sort((a, b) => a.rarityTierLevel - b.rarityTierLevel),
  };
}
