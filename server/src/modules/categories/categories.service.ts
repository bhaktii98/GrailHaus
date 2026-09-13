import type { CategoryReveal } from "@grailhaus/shared";
import { findCategories, findCategoryById, upsertCategory, type UpsertCategoryInput } from "./categories.repository.js";
import type { CategoryRow } from "./categories.types.js";

function toCategoryReveal(row: CategoryRow): CategoryReveal {
  return {
    id: row.id,
    label: row.label,
    meshArchetype: row.mesh_archetype,
    paletteBackground: row.palette_background,
    paletteAccent: row.palette_accent,
    cameraPosition: row.camera_position,
    cameraFov: Number(row.camera_fov),
    lighting: row.lighting as CategoryReveal["lighting"],
    gestureMode: row.gesture_mode as CategoryReveal["gestureMode"],
    gestureVelocityThreshold: Number(row.gesture_velocity_threshold),
    gestureTravelDistance: Number(row.gesture_travel_distance),
    commonBeatMs: row.common_beat_ms,
    rareHoldMs: row.rare_hold_ms,
    hapticCommon: row.haptic_common as CategoryReveal["hapticCommon"],
    hapticRare: row.haptic_rare as CategoryReveal["hapticRare"],
    openingBeatsCommon: row.opening_beats_common as CategoryReveal["openingBeatsCommon"],
    openingBeatsRare: row.opening_beats_rare as CategoryReveal["openingBeatsRare"],
    sortOrder: row.sort_order,
  };
}

export async function listCategories(): Promise<CategoryReveal[]> {
  const rows = await findCategories();
  return rows.map(toCategoryReveal);
}

export async function getCategory(id: string): Promise<CategoryReveal | null> {
  const row = await findCategoryById(id);
  return row ? toCategoryReveal(row) : null;
}

export async function saveCategory(input: UpsertCategoryInput): Promise<CategoryReveal> {
  const row = await upsertCategory(input);
  return toCategoryReveal(row);
}
