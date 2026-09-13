import { upsertCategory } from "@/lib/actions";
import { Button, Field, Info, Input, SectionLabel } from "@/components/ui";

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
const textareaClass =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-text outline-none focus:border-accent";

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

      <section className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <SectionLabel className="col-span-1 sm:col-span-2">
          Advanced (raw JSON)
          <Info>
            Lighting rig, haptic tracks, and narrated opening beats — arrays, edited as raw JSON rather than a bespoke
            sub-form for each. Leave a field empty to keep it unset/empty.
          </Info>
        </SectionLabel>
        <Field label="Lighting (JSON array of {kind, position?, intensity, color?})">
          <textarea
            name="lighting"
            rows={3}
            defaultValue={c ? JSON.stringify(c.lighting) : '[{"kind":"ambient","intensity":0.5}]'}
            className={textareaClass}
          />
        </Field>
        <div />
        <Field label="Haptic — common (JSON array of {atMs, kind})">
          <textarea
            name="hapticCommon"
            rows={3}
            defaultValue={c ? JSON.stringify(c.haptic_common) : '[{"atMs":0,"kind":"light"}]'}
            className={textareaClass}
          />
        </Field>
        <Field label="Haptic — rare (JSON array of {atMs, kind})">
          <textarea
            name="hapticRare"
            rows={3}
            defaultValue={c ? JSON.stringify(c.haptic_rare) : '[{"atMs":0,"kind":"light"},{"atMs":600,"kind":"success"}]'}
            className={textareaClass}
          />
        </Field>
        <Field label="Opening beats — common (optional, JSON array of {atMs, label}, or blank)">
          <textarea
            name="openingBeatsCommon"
            rows={2}
            defaultValue={c?.opening_beats_common ? JSON.stringify(c.opening_beats_common) : ""}
            className={textareaClass}
          />
        </Field>
        <Field label="Opening beats — rare (optional, JSON array of {atMs, label}, or blank)">
          <textarea
            name="openingBeatsRare"
            rows={2}
            defaultValue={c?.opening_beats_rare ? JSON.stringify(c.opening_beats_rare) : ""}
            className={textareaClass}
          />
        </Field>
      </section>

      <div>
        <Button type="submit">{isNew ? "Create category" : "Save"}</Button>
      </div>
    </form>
  );
}
