"use client";

import { useState } from "react";

/**
 * Friendlier editors for the reveal-choreography fields a category's form used to expose as raw
 * JSON textareas (lighting rig, haptic tracks, narrated opening beats). Each editor still submits
 * under the exact same form field name the server action (`upsertCategory` in lib/actions.ts)
 * already reads via `formData.get(name)` — it just builds that JSON string from real inputs
 * instead of asking someone to hand-type it, via one hidden `<input type="hidden">` kept in sync
 * with local row state. The server action itself needed no changes.
 *
 * Shapes mirror the app engine's own types exactly (app/src/engine/core/types.ts):
 * `LightDef` (kind/position?/intensity/color?) and `HapticStep` (atMs/kind: light|medium|heavy|
 * success) — the two `kind` selects below only ever offer the values the engine actually reads,
 * so this UI can't produce a value the app would silently ignore.
 */

type LightKind = "ambient" | "directional";
export interface LightRow {
  kind: LightKind;
  intensity: number;
  color?: string;
  position?: [number, number, number];
}

type HapticKind = "light" | "medium" | "heavy" | "success";
export interface HapticRow {
  atMs: number;
  kind: HapticKind;
}

export interface BeatRow {
  atMs: number;
  label: string;
}

const rowCardClass = "flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-2 p-3";
const miniInputClass = "rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text outline-none focus:border-accent";
const miniLabelClass = "flex flex-col gap-1 text-xs font-medium text-text-soft";
const addButtonClass =
  "self-start rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-text-soft transition-colors hover:border-accent hover:text-accent";
const removeButtonClass = "ml-auto text-xs font-semibold text-danger hover:underline";

/** A small segmented toggle — a friendlier stand-in for a <select> when there are only a
 * handful of fixed options, used here for both light kind and haptic kind. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            value === o.value ? "bg-accent text-white" : "bg-surface text-text-soft hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const DEFAULT_LIGHT: LightRow = { kind: "ambient", intensity: 0.5 };

export function LightingEditor({ name, defaultValue }: { name: string; defaultValue: LightRow[] }) {
  const [rows, setRows] = useState<LightRow[]>(defaultValue.length ? defaultValue : [DEFAULT_LIGHT]);

  function update(i: number, patch: Partial<LightRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function setKind(i: number, kind: LightKind) {
    update(i, kind === "directional" ? { kind, position: rows[i].position ?? [2, 3, 4], color: rows[i].color ?? "#ffffff" } : { kind });
  }
  function setPositionAxis(i: number, axis: 0 | 1 | 2, value: number) {
    const pos = [...(rows[i].position ?? [0, 0, 0])] as [number, number, number];
    pos[axis] = value;
    update(i, { position: pos });
  }
  function add() {
    setRows((prev) => [...prev, { kind: "directional", intensity: 0.8, position: [2, 3, 4], color: "#ffffff" }]);
  }
  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((row, i) => (
        <div key={i} className={rowCardClass}>
          <label className={miniLabelClass}>
            Kind
            <Segmented
              value={row.kind}
              onChange={(v) => setKind(i, v)}
              options={[
                { value: "ambient", label: "Ambient" },
                { value: "directional", label: "Directional" },
              ]}
            />
          </label>
          <label className={miniLabelClass}>
            Intensity
            <input
              type="number"
              step="0.05"
              min={0}
              max={3}
              value={row.intensity}
              onChange={(e) => update(i, { intensity: Number(e.target.value) })}
              className={`w-24 ${miniInputClass}`}
            />
          </label>
          {row.kind === "directional" && (
            <>
              <label className={miniLabelClass}>
                Color
                <input
                  type="color"
                  value={row.color ?? "#ffffff"}
                  onChange={(e) => update(i, { color: e.target.value })}
                  className="h-[34px] w-14 rounded-md border border-border bg-surface p-1"
                />
              </label>
              {(["X", "Y", "Z"] as const).map((axisLabel, axis) => (
                <label key={axisLabel} className={miniLabelClass}>
                  Pos {axisLabel}
                  <input
                    type="number"
                    step="0.1"
                    value={row.position?.[axis] ?? 0}
                    onChange={(e) => setPositionAxis(i, axis as 0 | 1 | 2, Number(e.target.value))}
                    className={`w-20 ${miniInputClass}`}
                  />
                </label>
              ))}
            </>
          )}
          <button type="button" onClick={() => remove(i)} className={removeButtonClass}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className={addButtonClass}>
        + Add light
      </button>
    </div>
  );
}

const HAPTIC_KINDS: { value: HapticKind; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
  { value: "success", label: "Success" },
];

export function HapticEditor({ name, defaultValue }: { name: string; defaultValue: HapticRow[] }) {
  const [rows, setRows] = useState<HapticRow[]>(defaultValue.length ? defaultValue : [{ atMs: 0, kind: "light" }]);

  function update(i: number, patch: Partial<HapticRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function add() {
    const lastAtMs = rows.length ? rows[rows.length - 1].atMs : 0;
    setRows((prev) => [...prev, { atMs: lastAtMs + 400, kind: "medium" }]);
  }
  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((row, i) => (
        <div key={i} className={rowCardClass}>
          <label className={miniLabelClass}>
            At (ms)
            <input
              type="number"
              step={50}
              min={0}
              value={row.atMs}
              onChange={(e) => update(i, { atMs: Number(e.target.value) })}
              className={`w-24 ${miniInputClass}`}
            />
          </label>
          <label className={miniLabelClass}>
            Feel
            <Segmented value={row.kind} onChange={(v) => update(i, { kind: v })} options={HAPTIC_KINDS} />
          </label>
          <button type="button" onClick={() => remove(i)} className={removeButtonClass}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className={addButtonClass}>
        + Add beat
      </button>
    </div>
  );
}

export function OpeningBeatsEditor({ name, defaultValue }: { name: string; defaultValue: BeatRow[] | null }) {
  const [rows, setRows] = useState<BeatRow[]>(defaultValue ?? []);

  function update(i: number, patch: Partial<BeatRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function add() {
    const lastAtMs = rows.length ? rows[rows.length - 1].atMs : 0;
    setRows((prev) => [...prev, { atMs: rows.length ? lastAtMs + 500 : 0, label: "" }]);
  }
  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Empty stays "" (not "[]"), matching the server action's own null-means-unset handling
  // (lib/actions.ts's jsonField falls back to `null` for these two fields on a blank string).
  const hiddenValue = rows.length ? JSON.stringify(rows) : "";

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={hiddenValue} />
      {rows.length === 0 && (
        <p className="text-xs text-text-mute">No narrated sub-beats — the reveal plays with no on-screen labels.</p>
      )}
      {rows.map((row, i) => (
        <div key={i} className={rowCardClass}>
          <label className={miniLabelClass}>
            At (ms)
            <input
              type="number"
              step={50}
              min={0}
              value={row.atMs}
              onChange={(e) => update(i, { atMs: Number(e.target.value) })}
              className={`w-24 ${miniInputClass}`}
            />
          </label>
          <label className={`flex-1 ${miniLabelClass}`} style={{ minWidth: 160 }}>
            Label
            <input
              type="text"
              value={row.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="VAULT DOOR OPENING"
              className={`w-full ${miniInputClass}`}
            />
          </label>
          <button type="button" onClick={() => remove(i)} className={removeButtonClass}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className={addButtonClass}>
        + Add beat
      </button>
    </div>
  );
}
