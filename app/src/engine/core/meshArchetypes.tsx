import type { ReactNode } from "react";
import type { SharedValue } from "react-native-reanimated";
import type { ItemDetail } from "@grailhaus/shared";
import { CardMesh } from "../components/CardMesh";
import { WatchMesh } from "../components/WatchMesh";
import { HandbagMesh } from "../components/HandbagMesh";

export interface MeshArchetypeOpts {
  openProgress: SharedValue<number>;
  tierColor: string;
}

export type MeshArchetype = (item: ItemDetail, opts: MeshArchetypeOpts) => ReactNode;

/**
 * The one piece of a category's reveal that stays code, not a `categories` table row — no
 * config system invents new 3D topology from numbers alone, so a category's `meshArchetype`
 * field (backend-driven, see categoriesService.ts) selects one of these instead. Everything
 * else about a category (palette, camera, lighting, gesture, timing, haptics) is genuinely
 * data; adding a category whose silhouette an existing archetype already fits needs *zero*
 * app code, only an admin-dashboard row. Only a genuinely novel silhouette (like `flap-bag` was
 * for handbags — see HandbagMesh's own header) needs one new small function added here.
 */
export const meshArchetypes: Record<string, MeshArchetype> = {
  "tear-pack": (_item, { openProgress, tierColor }) => (
    <CardMesh tierColor={tierColor} openProgress={openProgress} />
  ),
  "lift-lid-box": (item, { openProgress, tierColor }) => (
    <WatchMesh
      tierColor={tierColor}
      openProgress={openProgress}
      dialColorName={item.dialColor}
      caseMaterialName={item.caseMaterial}
      watchName={item.watchName}
    />
  ),
  "flap-bag": (_item, { openProgress, tierColor }) => (
    <HandbagMesh tierColor={tierColor} openProgress={openProgress} />
  ),
};

/** Falls back to `tear-pack` for an archetype name that doesn't exist (e.g. a typo in the
 * admin form) — a mismatched-but-visible reveal beats a blank screen or a thrown error. */
export function resolveMeshArchetype(name: string): MeshArchetype {
  return meshArchetypes[name] ?? meshArchetypes["tear-pack"];
}
