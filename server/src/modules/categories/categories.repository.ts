import { pool } from "../../db/pool.js";
import type { CategoryRow } from "./categories.types.js";

const CATEGORY_COLUMNS =
  "id, label, mesh_archetype, palette_background, palette_accent, camera_position, camera_fov, lighting, " +
  "gesture_mode, gesture_velocity_threshold, gesture_travel_distance, common_beat_ms, rare_hold_ms, " +
  "haptic_common, haptic_rare, opening_beats_common, opening_beats_rare, sort_order";

export async function findCategories(): Promise<CategoryRow[]> {
  const { rows } = await pool.query<CategoryRow>(
    `select ${CATEGORY_COLUMNS} from public.categories order by sort_order, id`
  );
  return rows;
}

export async function findCategoryById(id: string): Promise<CategoryRow | null> {
  const { rows } = await pool.query<CategoryRow>(
    `select ${CATEGORY_COLUMNS} from public.categories where id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export interface UpsertCategoryInput {
  id: string;
  label: string;
  meshArchetype: string;
  paletteBackground: string;
  paletteAccent: string;
  cameraPosition: [number, number, number];
  cameraFov: number;
  lighting: unknown;
  gestureMode: string;
  gestureVelocityThreshold: number;
  gestureTravelDistance: number;
  commonBeatMs: number;
  rareHoldMs: number;
  hapticCommon: unknown;
  hapticRare: unknown;
  openingBeatsCommon: unknown | null;
  openingBeatsRare: unknown | null;
  sortOrder: number;
}

/** One statement for both create and edit — `id` is a user-chosen slug (the admin form's
 * "new category" and "edit category" are the same form), so `insert ... on conflict` is simpler
 * and just as correct as branching on whether the row already exists. */
export async function upsertCategory(input: UpsertCategoryInput): Promise<CategoryRow> {
  const { rows } = await pool.query<CategoryRow>(
    `insert into public.categories
       (id, label, mesh_archetype, palette_background, palette_accent, camera_position, camera_fov,
        lighting, gesture_mode, gesture_velocity_threshold, gesture_travel_distance, common_beat_ms,
        rare_hold_ms, haptic_common, haptic_rare, opening_beats_common, opening_beats_rare, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     on conflict (id) do update set
       label = excluded.label,
       mesh_archetype = excluded.mesh_archetype,
       palette_background = excluded.palette_background,
       palette_accent = excluded.palette_accent,
       camera_position = excluded.camera_position,
       camera_fov = excluded.camera_fov,
       lighting = excluded.lighting,
       gesture_mode = excluded.gesture_mode,
       gesture_velocity_threshold = excluded.gesture_velocity_threshold,
       gesture_travel_distance = excluded.gesture_travel_distance,
       common_beat_ms = excluded.common_beat_ms,
       rare_hold_ms = excluded.rare_hold_ms,
       haptic_common = excluded.haptic_common,
       haptic_rare = excluded.haptic_rare,
       opening_beats_common = excluded.opening_beats_common,
       opening_beats_rare = excluded.opening_beats_rare,
       sort_order = excluded.sort_order
     returning ${CATEGORY_COLUMNS}`,
    [
      input.id, input.label, input.meshArchetype, input.paletteBackground, input.paletteAccent,
      JSON.stringify(input.cameraPosition), input.cameraFov, JSON.stringify(input.lighting),
      input.gestureMode, input.gestureVelocityThreshold, input.gestureTravelDistance,
      input.commonBeatMs, input.rareHoldMs, JSON.stringify(input.hapticCommon), JSON.stringify(input.hapticRare),
      input.openingBeatsCommon ? JSON.stringify(input.openingBeatsCommon) : null,
      input.openingBeatsRare ? JSON.stringify(input.openingBeatsRare) : null,
      input.sortOrder,
    ]
  );
  return rows[0];
}
