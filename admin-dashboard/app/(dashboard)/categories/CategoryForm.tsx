import { upsertCategory } from "@/lib/actions";
import { Button, Field, Info, Input, SectionLabel } from "@/components/ui";
import { HapticEditor, LightingEditor, OpeningBeatsEditor, type BeatRow, type HapticRow, type LightRow } from "@/components/RevealConfigEditors";

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

/** The archetypes actually implemented in the app's meshArchetypes.tsx registry — picking one
 * here that isn't in that list would make the app fall back to `tear-pack` at render time (see
 * that file's own resolveMeshArchetype), not crash, but it's still worth keeping this list in
 * sync by hand since there's no way to read the app's own registry from here. */
const MESH_ARCHETYPES = ["tear-pack", "lift-lid-box", "flap-bag"];

const selectClass =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent";

/** The create/edit form for a category's whole reveal personality. Shared between
 * /categories/new (category=null) and /categories/[id]/edit (category set) — same fields,
 * upsertCategory tells the two cases apart by whether `id` is already in the table. */
export function CategoryForm({ category }: { category: CategoryRow | null }) {
  const isNew = category === null;
  const c = category;
  return (
    <form action={upsertCategory} className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <SectionLabel className="col-span-2 sm:col-span-3">Identity</SectionLabel>
        <Field label="Id (slug)">
          <Input name="id" defaultValue={c?.id ?? ""} readOnly={!isNew} required pattern="[a-z][a-z0-9_]*" />
        </Field>
        <Field label="Label">
          <Input name="label" defaultValue={c?.label ?? ""} required />
        </Field>
        <Field label="Sort order" info="Where this sits in lists (Shelf's switch, Home's doors) — lower first.">
          <Input name="sortOrder" type="number" defaultValue={c?.sort_order ?? 0} />
        </Field>
        <Field
          label="Mesh archetype"
          info="Which geometry-builder function (app's meshArchetypes.tsx) draws this category's pack/box/case. A silhouette none of these fit needs one new small function added there — everything else on this page is pure data."
        >
          <select name="meshArchetype" defaultValue={c?.mesh_archetype ?? "tear-pack"} className={selectClass}>
            {MESH_ARCHETYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Background color">
          <Input name="paletteBackground" type="text" defaultValue={c?.palette_background ?? "#151226"} />
        </Field>
        <Field label="Accent color">
          <Input name="paletteAccent" type="text" defaultValue={c?.palette_accent ?? "#f4c94f"} />
        </Field>
      </section>

      <section className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <SectionLabel className="col-span-2 sm:col-span-4">Camera</SectionLabel>
        <Field label="Position X">
          <Input name="cameraX" type="number" step="0.01" defaultValue={c?.camera_position?.[0] ?? 0} />
        </Field>
        <Field label="Position Y">
          <Input name="cameraY" type="number" step="0.01" defaultValue={c?.camera_position?.[1] ?? 0} />
        </Field>
        <Field label="Position Z">
          <Input name="cameraZ" type="number" step="0.01" defaultValue={c?.camera_position?.[2] ?? 4} />
        </Field>
        <Field label="FOV">
          <Input name="cameraFov" type="number" defaultValue={c?.camera_fov ?? 50} />
        </Field>
      </section>

      <section className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <SectionLabel className="col-span-2 sm:col-span-4">Gesture &amp; timing</SectionLabel>
        <Field label="Gesture mode" info="'tear' = swipe-up-to-tear a seal. 'lift-lid' = swipe-up-to-lift a hinged lid/flap.">
          <select name="gestureMode" defaultValue={c?.gesture_mode ?? "tear"} className={selectClass}>
            <option value="tear">tear</option>
            <option value="lift-lid">lift-lid</option>
          </select>
        </Field>
        <Field label="Velocity threshold" info="px/ms above which a partial drag still counts as a completed gesture.">
          <Input name="gestureVelocityThreshold" type="number" defaultValue={c?.gesture_velocity_threshold ?? 800} />
        </Field>
        <Field label="Travel distance" info="px of travel that counts as a full gesture at zero velocity.">
          <Input name="gestureTravelDistance" type="number" defaultValue={c?.gesture_travel_distance ?? 180} />
        </Field>
        <Field label="Common beat (ms)" info="How long a non-rare item's reveal beat holds.">
          <Input name="commonBeatMs" type="number" defaultValue={c?.common_beat_ms ?? 900} />
        </Field>
        <Field label="Rare hold (ms)" info="How long the rare-pull slow-burn hold lasts.">
          <Input name="rareHoldMs" type="number" defaultValue={c?.rare_hold_ms ?? 2200} />
        </Field>
      </section>

      <section className="grid grid-cols-1 gap-y-6">
        <SectionLabel>
          Reveal choreography
          <Info>
            Lighting rig, haptic tracks, and narrated opening beats for this category's reveal. Each row here is one
            entry in the array the app engine actually reads (app/src/engine/core/types.ts) — add or remove rows
            instead of hand-editing JSON.
          </Info>
        </SectionLabel>
        <Field label="Lighting" info="At least one light — ambient sets a flat fill, directional adds a positioned/colored beam.">
          <LightingEditor name="lighting" defaultValue={(c?.lighting as LightRow[]) ?? []} />
        </Field>
        <Field label="Haptic — common" info="Vibration beats for a non-rare pull, in order.">
          <HapticEditor name="hapticCommon" defaultValue={(c?.haptic_common as HapticRow[]) ?? []} />
        </Field>
        <Field label="Haptic — rare" info="Vibration beats for a rare pull — usually longer, ending in 'success'.">
          <HapticEditor name="hapticRare" defaultValue={(c?.haptic_rare as HapticRow[]) ?? [{ atMs: 0, kind: "light" }, { atMs: 600, kind: "success" }]} />
        </Field>
        <Field label="Opening beats — common" info="Optional on-screen labels narrating a non-rare reveal (e.g. 'LID OPENING'). Leave empty for none.">
          <OpeningBeatsEditor name="openingBeatsCommon" defaultValue={(c?.opening_beats_common as BeatRow[] | null) ?? null} />
        </Field>
        <Field label="Opening beats — rare" info="Optional on-screen labels narrating a rare reveal. Leave empty for none.">
          <OpeningBeatsEditor name="openingBeatsRare" defaultValue={(c?.opening_beats_rare as BeatRow[] | null) ?? null} />
        </Field>
      </section>

      <div>
        <Button type="submit">{isNew ? "Create category" : "Save"}</Button>
      </div>
    </form>
  );
}
