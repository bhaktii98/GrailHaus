import type { ReactNode } from "react";
import type { SharedValue } from "react-native-reanimated";
import type { Category, ItemDetail, PulledItem } from "@grailhaus/shared";

export type RevealPhase = "idle" | "gesture" | "opening" | "settled" | "summary";

export interface HapticStep {
  /** Milliseconds after the phase starts. */
  atMs: number;
  kind: "light" | "medium" | "heavy" | "success";
}

export interface LightDef {
  kind: "ambient" | "directional";
  position?: [number, number, number];
  intensity: number;
  color?: string;
}

/**
 * One opening gesture in a multi-stage reveal (see `RevealChoreography.gestureStages`).
 *
 * A stage owns a slice of the timeline and one drag axis. The engine activates stages strictly in
 * order, and only the active stage's axis is read — which is what keeps two sequential gestures
 * from fighting each other for the same touch, and what lets the second one have a different feel
 * from the first.
 */
export interface GestureStage {
  /** Short identifier, for logs and for the engine's own phase reporting. */
  id: string;
  /** Which drag direction advances this stage. A ribbon drawn sideways is "x"; a lid lifted is "y". */
  axis: "x" | "y";
  /** Timeline seconds this stage scrubs across: the drag maps 0..1 of its travel onto this span. */
  fromS: number;
  toS: number;
  /**
   * How far through this stage's own span a release must reach to commit. Below it the stage
   * springs back to `fromS` and remains active — the gesture is reversible, like every other in
   * this app.
   */
  commitS: number;
  /** Pixels of travel that count as the full stage at zero velocity. */
  travelDistance: number;
  /** px/ms above which a partial drag still commits. */
  velocityThreshold: number;
  /**
   * When set, the stage needs no gesture at all: on reaching `fromS` the engine simply plays
   * forward for this many seconds, then activates the next stage. This is how the design's pause
   * between the ribbon falling and the lid becoming grabbable is expressed — a beat the user
   * watches rather than drives.
   */
  autoAdvanceAfterS?: number;
  /** Optional prompt copy for this stage, shown by the engine's HUD. */
  prompt?: string;
}

/**
 * A named stretch of a timeline reveal, for the on-screen sequence label ("03 · Lid Opening").
 * `fromS`/`toS` are absolute seconds on the choreography's own clock, so a phase list doubles as
 * documentation of the whole reveal's shape.
 */
export interface ChoreographyPhase {
  label: string;
  fromS: number;
  toS: number;
}

/**
 * What a category hands the engine to run a timeline reveal: one call that builds the scene and
 * returns it already bound to its own choreography.
 *
 * The binding is the whole point. `RevealChoreography<TScene>` below is generic because a
 * category's `pose`/`lights` naturally take that category's own scene type — but
 * `CategoryRevealConfig` is a single non-generic interface shared by every category, so a generic
 * parameter cannot survive at that boundary. Rather than erase it to `unknown` and force the
 * engine to cast on every frame (which would make the seam typed in name only), `mount` closes
 * over the concrete scene *inside the category's own module* and returns plain `pose(t)`/
 * `lights(t)` closures. The engine then drives a fully-typed timeline while never knowing or
 * naming what a "vault scene" is — which is exactly the property that lets a third category with
 * a completely different scene shape drop in without touching the engine.
 */
export interface ChoreographyMode {
  /**
   * Builds the scene for one pulled item and binds it to its choreography. Called once per mount;
   * `dispose` runs on unmount — a timeline scene holds real GPU resources (a prefiltered
   * environment, a few hundred meshes) and this app remounts reveal Canvases repeatedly within a
   * session (a 10-pack batch remounts per pack).
   *
   * `node` is the R3F subtree to render, kept separate from the bound functions so the engine can
   * mount the visuals and drive the clock without the two knowing about each other.
   */
  mount: (
    item: ItemDetail,
    opts: { tierColor: string }
  ) => {
    node: ReactNode;
    pose: (t: number) => void;
    lights: (t: number) => void;
    dispose: () => void;
  };
  /** Timing, phases, gesture hand-off points, scripted camera and haptic beats — the parts of a
   * choreography that are plain data and need no scene to be read. */
  timing: Omit<RevealChoreography, "pose" | "lights">;
}

/**
 * Everything a timeline-driven reveal needs to pose itself at an arbitrary instant.
 *
 * The seam exists because `buildMesh` alone cannot express this class of reveal. `buildMesh`
 * receives the gesture's `openProgress` — a clamped 0..1 that the engine drives to 1 once and
 * then leaves there — which is exactly right for a reveal whose *entire* motion is the gesture
 * (a pack tearing, a lid lifting). It cannot express a reveal that keeps going after the gesture
 * ends: locks retracting, a lid rising and tilting, a platform elevating, the piece floating free
 * and presenting itself, lights escalating across the whole sequence. That needs an absolute
 * clock, and a single 0..1 progress value has nowhere to put one.
 *
 * So a category supplies `choreography` instead of (or alongside) `buildMesh`, and the engine
 * runs a clock for it. Crucially this stays *configuration*: the engine owns the clock, the
 * gesture hand-off, the phase labels, the haptics and the time-scaling; a category owns only the
 * pure functions that say what its own scene looks like at time `t`. Adding a third category with
 * a timeline reveal means writing one of these, not touching the engine.
 *
 * `pose` and `lights` are deliberately separate and both pure-by-convention (they mutate the
 * scene they were handed and return nothing, and must not allocate per call — they run every
 * frame). Keeping them apart is what lets the engine scrub the timeline for a drag-to-open
 * gesture (pose only, so a drag stays 1:1 with the finger and never triggers a lighting
 * animation) and then play it forward for real (pose + lights together).
 */
export interface RevealChoreography<TScene = unknown> {
  /** Total duration in seconds at normal pacing. */
  durationS: number;
  /** Named stretches, in order, for the sequence label. */
  phases: ChoreographyPhase[];
  /**
   * How far into the timeline the opening gesture itself scrubs. A drag maps 0..1 of its own
   * travel onto 0..`gestureEndS`; releasing past `gestureCommitS` hands off to the engine's clock,
   * which plays the remainder. Below it, the timeline springs back to 0 — the reveal is
   * genuinely reversible mid-drag, same physics bar as every other gesture in this app.
   *
   * For a multi-stage reveal (see `gestureStages`) these describe the *first* stage only, so a
   * single-stage category needs no knowledge of stages at all.
   */
  gestureEndS: number;
  gestureCommitS: number;
  /**
   * Sequential opening gestures, for a reveal that asks for more than one.
   *
   * Most reveals open with a single motion: a pack tears, a lid lifts. The Obsidian Vault asks for
   * two in sequence — draw a silk ribbon sideways to break the seal, then lift the lid upward —
   * and they are genuinely different gestures, not one long drag: different axes, different
   * resistance, and a deliberate pause between them where the ribbon settles on the floor.
   *
   * Omitted means "one stage", which is what every other category is, and the engine's behaviour
   * for those is unchanged. When present, the engine walks the stages in order: each scrubs its own
   * slice of the timeline on its own axis, and committing the last one hands off to the clock.
   *
   * `autoAdvanceAfterS` covers the design's own pause between the ribbon falling and the lid
   * becoming grabbable — the timeline keeps playing through that window with no gesture active, so
   * the ribbon's fall is watched rather than raced past.
   */
  gestureStages?: GestureStage[];
  /** Poses every animated node for absolute time `t`. Called every frame, including while
   * scrubbing — must be a pure function of `t` with no internal state, so scrubbing backwards
   * lands on exactly the pose the forward play would have shown. */
  pose(scene: TScene, t: number): void;
  /** Drives light intensities, emissive levels and environment exposure for absolute time `t`.
   * Separate from `pose` so a scrub can move geometry without animating the lighting. */
  lights(scene: TScene, t: number): void;
  /** Optional scripted camera. Returning null (or omitting this) leaves the camera alone, which
   * is what a category wants if its reveal is framed by a fixed shot. `lerpFactor` is the
   * per-frame approach rate the engine applies — a category returns *where the camera wants to
   * be*, never how fast to get there, so the engine can snap instantly when scrubbing and ease
   * when playing. */
  camera?(t: number): { position: [number, number, number]; target: [number, number, number] } | null;
  /** Haptic beats keyed to absolute timeline seconds, fired once each as the clock passes them.
   * Distinct from `CategoryRevealConfig.hapticTrack`, which is keyed to a phase's own start —
   * a timeline reveal needs its beats pinned to the motion they accompany (the lock releasing,
   * the lid seating, the piece settling), not to a phase boundary. */
  haptics?: { atS: number; kind: HapticStep["kind"] }[];
}

/**
 * The whole extension point. A category's personality — model, materials,
 * lighting, camera, timing, haptics, gesture feel, pacing order — is this
 * one object. RevealEngine.tsx is written once against this interface;
 * adding a new category (e.g. handbags) means writing one of these plus a
 * registry entry, never touching the engine, gesture layer, or haptics
 * track.
 */
export interface CategoryRevealConfig {
  id: Category;
  label: string;
  palette: { background: string; accent: string };
  lighting: LightDef[];
  /**
   * `near`/`far` are optional and default to r3f's own values. A category that models at true
   * real-world scale needs them: the vault is 0.26m wide and inspected from ~0.2m, so the default
   * 0.1 near plane slices the subject in half the moment a pinch brings it closer.
   */
  camera: { position: [number, number, number]; fov: number; near?: number; far?: number };
  /**
   * Builds the category-specific R3F mesh subtree for one pulled item.
   * `openProgress` is a reanimated shared value (0 = sealed, 1 = fully
   * open/torn) — implementations read `.value` inside their own
   * `useFrame`, they don't receive a plain number as a prop, so the mesh
   * updates every GPU frame without round-tripping through React state.
   * `tierColor` is resolved by the engine from the pack's admin-configurable
   * rarity_tiers data for this pull's tier level — never hardcoded here.
   *
   * `item` is typed `ItemDetail`, not the narrower `PulledItem` the reward engine itself deals
   * in — every real call site (RevealEngine.tsx) actually has a `PulledOwnedItem`, which already
   * extends `ItemDetail` (dialColor/caseMaterial/pokemonType/etc., all real catalog columns, not
   * admin-configurable data). Watches used to render an identical dial/case for every single
   * pull, differing only by rarity-tier color, because this field's type stopped an archetype
   * from ever reading `item.dialColor` even though the value was already sitting on the object at
   * runtime — see WatchMesh's own header for how it's used now.
   */
  buildMesh: (
    item: ItemDetail,
    opts: { openProgress: SharedValue<number>; tierColor: string }
  ) => ReactNode;
  gesture: {
    mode: "tear" | "lift-lid";
    /** px/ms above which a partial drag still counts as a completed gesture. */
    velocityThreshold: number;
    /** px of travel that counts as a full gesture at zero velocity. */
    travelDistance: number;
  };
  timing: { commonBeatMs: number; rareHoldMs: number };
  hapticTrack: (phase: RevealPhase, isRare: boolean) => HapticStep[];
  /**
   * Optional labeled sub-beats shown in sequence during the `"opening"` phase — e.g. watches'
   * "VAULT DOOR OPENING" → "BUILDING PRESSURE" → "SILHOUETTE VISIBLE" → "RARITY LOCKING IN".
   * Purely a slower, narrated version of the *same* gesture/hold `RevealEngine` already runs —
   * not a new phase state machine, just labels + pacing layered onto the existing `opening`
   * duration (`timing.rareHoldMs`/`commonBeatMs`). Omit for a category with no such narration
   * (e.g. cards, which has its own dedicated `CardFlowEngine` instead of using this at all).
   */
  openingBeats?: (isRare: boolean) => { atMs: number; label: string }[];
  /** Commons first, rare last — but each category can weight this differently. Generic so a
   * caller passing the richer `PulledOwnedItem[]` (real pulls, with `ownedItemId`) gets that
   * same richer type back, not narrowed down to the reward engine's minimal `PulledItem`. */
  revealOrder: <T extends PulledItem>(items: T[]) => T[];
  /**
   * Optional timeline-driven reveal (see RevealChoreography). Present for a category whose motion
   * outlives its opening gesture — locks retracting, a platform elevating, the piece presenting
   * itself — absent for one whose whole reveal *is* the gesture, which keeps using `buildMesh`
   * against `openProgress`.
   *
   * Optional on purpose: every category that existed before this seam (cards, watches tier 1,
   * handbags) is untouched by its addition, and `RevealEngine` only starts a clock when it finds
   * one. A category supplies the scene factory alongside it so the engine knows what to hand to
   * `pose`/`lights` — kept as one field rather than two so a config can't half-declare a
   * timeline reveal.
   */
  choreographyMode?: ChoreographyMode;
}
