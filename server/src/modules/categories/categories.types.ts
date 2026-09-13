export interface CategoryRow {
  id: string;
  label: string;
  mesh_archetype: string;
  palette_background: string;
  palette_accent: string;
  camera_position: [number, number, number];
  camera_fov: string;
  lighting: unknown;
  gesture_mode: string;
  gesture_velocity_threshold: string;
  gesture_travel_distance: string;
  common_beat_ms: number;
  rare_hold_ms: number;
  haptic_common: unknown;
  haptic_rare: unknown;
  opening_beats_common: unknown;
  opening_beats_rare: unknown;
  sort_order: number;
}
