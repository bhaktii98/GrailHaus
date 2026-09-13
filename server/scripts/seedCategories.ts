import "dotenv/config";
import { pool } from "../src/db/pool.js";

/**
 * One-off schema + seed script for the new `categories` table — this repo has no migrations
 * folder (schema changes here have always been applied by hand against the live Postgres
 * instance, same as every other table), so this follows that same established pattern rather
 * than introducing a new migration tool for one table.
 *
 * `categories` is what makes a reveal's *personality* (palette, camera, lighting, gesture feel,
 * timing, haptics) genuinely backend/admin-driven instead of hardcoded per-category TS files
 * (cards.config.tsx / watches.config.tsx) — the app now fetches this at runtime and resolves
 * `mesh_archetype` through a small, fixed registry of geometry-builder functions (see
 * app/src/engine/core/meshArchetypes.tsx). That registry is the one piece that stays code, not
 * data — no config system invents new 3D topology from numbers alone — but everything else
 * about a category, including a brand new one, is a row here plus picking (or, for a genuinely
 * novel silhouette, writing) one archetype.
 *
 * Seeded with the *exact* current values from cards.config.tsx / watches.config.tsx, so
 * switching the app to read from this table changes nothing about how either reveal looks or
 * feels — plus a `handbags` row as a live demonstration that a third category really is just
 * data (using the `flap-bag` archetype built alongside this script).
 */
async function main() {
  await pool.query(`
    create table if not exists public.categories (
      id text primary key,
      label text not null,
      mesh_archetype text not null,
      palette_background text not null,
      palette_accent text not null,
      camera_position jsonb not null,
      camera_fov numeric not null,
      lighting jsonb not null,
      gesture_mode text not null,
      gesture_velocity_threshold numeric not null,
      gesture_travel_distance numeric not null,
      common_beat_ms integer not null,
      rare_hold_ms integer not null,
      haptic_common jsonb not null,
      haptic_rare jsonb not null,
      opening_beats_common jsonb,
      opening_beats_rare jsonb,
      sort_order integer not null default 0,
      created_at timestamptz not null default now()
    )
  `);

  const rows = [
    {
      id: "cards",
      label: "Trading Cards",
      mesh_archetype: "tear-pack",
      palette_background: "#151226",
      palette_accent: "#f4c94f",
      camera_position: [0, 0, 4],
      camera_fov: 50,
      lighting: [
        { kind: "ambient", intensity: 0.5 },
        { kind: "directional", position: [3, 4, 5], intensity: 1.2 },
        { kind: "directional", position: [-4, -2, -3], intensity: 0.3, color: "#7dd3fc" },
      ],
      gesture_mode: "tear",
      gesture_velocity_threshold: 800,
      gesture_travel_distance: 180,
      common_beat_ms: 900,
      rare_hold_ms: 2200,
      haptic_common: [
        { atMs: 0, kind: "light" },
        { atMs: 200, kind: "medium" },
      ],
      haptic_rare: [
        { atMs: 0, kind: "light" },
        { atMs: 250, kind: "medium" },
        { atMs: 600, kind: "heavy" },
        { atMs: 1200, kind: "heavy" },
        { atMs: 1900, kind: "success" },
      ],
      opening_beats_common: null,
      opening_beats_rare: null,
      sort_order: 1,
    },
    {
      id: "watches",
      label: "Watches",
      mesh_archetype: "lift-lid-box",
      palette_background: "#0a0908",
      palette_accent: "#c9a24b",
      camera_position: [0, 0.4, 3.2],
      camera_fov: 40,
      lighting: [
        { kind: "ambient", intensity: 0.2 },
        { kind: "directional", position: [2, 3, 4], intensity: 0.9, color: "#fff4dd" },
      ],
      gesture_mode: "lift-lid",
      gesture_velocity_threshold: 500,
      gesture_travel_distance: 140,
      common_beat_ms: 1400,
      rare_hold_ms: 3000,
      haptic_common: [
        { atMs: 0, kind: "light" },
        { atMs: 400, kind: "medium" },
      ],
      haptic_rare: [
        { atMs: 0, kind: "light" },
        { atMs: 500, kind: "medium" },
        { atMs: 1400, kind: "heavy" },
        { atMs: 2600, kind: "success" },
      ],
      opening_beats_common: [
        { atMs: 0, label: "VAULT DOOR OPENING" },
        { atMs: 500, label: "LIGHT SPILLING IN" },
        { atMs: 900, label: "SILHOUETTE VISIBLE" },
      ],
      opening_beats_rare: [
        { atMs: 0, label: "VAULT DOOR OPENING" },
        { atMs: 700, label: "BUILDING PRESSURE" },
        { atMs: 1500, label: "SILHOUETTE VISIBLE" },
        { atMs: 2300, label: "RARITY LOCKING IN" },
      ],
      sort_order: 2,
    },
    {
      // Live demonstration row — proves a third category really is config, not a rewrite. Uses
      // the new `flap-bag` archetype (structured body + a flap that swings open on drag, a
      // handle loop) built specifically because no existing archetype's silhouette fits a
      // handbag — see meshArchetypes.tsx's own header for why that's the one piece that had to
      // be code.
      id: "handbags",
      label: "Handbags",
      mesh_archetype: "flap-bag",
      palette_background: "#1a1210",
      palette_accent: "#d99b6c",
      camera_position: [0, 0.2, 3.6],
      camera_fov: 42,
      lighting: [
        { kind: "ambient", intensity: 0.3 },
        { kind: "directional", position: [2, 4, 3], intensity: 1.1, color: "#ffe8d1" },
        { kind: "directional", position: [-3, 1, -2], intensity: 0.35, color: "#c98a52" },
      ],
      gesture_mode: "lift-lid",
      gesture_velocity_threshold: 550,
      gesture_travel_distance: 150,
      common_beat_ms: 1100,
      rare_hold_ms: 2600,
      haptic_common: [
        { atMs: 0, kind: "light" },
        { atMs: 350, kind: "medium" },
      ],
      haptic_rare: [
        { atMs: 0, kind: "light" },
        { atMs: 450, kind: "medium" },
        { atMs: 1100, kind: "heavy" },
        { atMs: 2100, kind: "success" },
      ],
      opening_beats_common: null,
      opening_beats_rare: null,
      sort_order: 3,
    },
  ];

  for (const r of rows) {
    await pool.query(
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
         sort_order = excluded.sort_order`,
      [
        r.id, r.label, r.mesh_archetype, r.palette_background, r.palette_accent,
        JSON.stringify(r.camera_position), r.camera_fov, JSON.stringify(r.lighting),
        r.gesture_mode, r.gesture_velocity_threshold, r.gesture_travel_distance,
        r.common_beat_ms, r.rare_hold_ms, JSON.stringify(r.haptic_common), JSON.stringify(r.haptic_rare),
        r.opening_beats_common ? JSON.stringify(r.opening_beats_common) : null,
        r.opening_beats_rare ? JSON.stringify(r.opening_beats_rare) : null,
        r.sort_order,
      ]
    );
    console.log(`seeded category: ${r.id}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
