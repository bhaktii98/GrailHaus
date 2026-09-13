import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { deleteCategory } from "@/lib/actions";
import { Button, PageHeader } from "@/components/ui";
import type { CategoryRow } from "../CategoryForm";

const linkButtonClass =
  "inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-deep";
const ghostLinkClass =
  "inline-flex items-center rounded-lg bg-transparent px-4 py-2 text-sm font-semibold text-text-soft transition-colors hover:text-text";

async function getCategory(id: string) {
  const res = await pool.query<CategoryRow>("select * from public.categories where id = $1", [id]);
  return res.rows[0] ?? null;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-mute">{label}</dt>
      <dd className="mt-1 text-sm text-text">{value}</dd>
    </div>
  );
}

function Swatch({ hex }: { hex: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-4 w-4 rounded-full border border-border" style={{ background: hex }} />
      <span className="font-mono">{hex}</span>
    </span>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-mute">{label}</dt>
      <dd className="mt-1">
        {value == null ? (
          <span className="text-sm text-text-mute">Not set</span>
        ) : (
          <pre className="overflow-x-auto rounded-lg border border-border bg-surface-2 p-3 font-mono text-xs text-text">
            {JSON.stringify(value, null, 2)}
          </pre>
        )}
      </dd>
    </div>
  );
}

export default async function CategoryViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCategory(id);
  if (!c) notFound();

  return (
    <div>
      <PageHeader title={c.label} description={c.id} />

      <div className="mb-6 flex gap-3">
        <Link href={`/categories/${c.id}/edit`} className={linkButtonClass}>
          Edit
        </Link>
        <form action={deleteCategory}>
          <input type="hidden" name="id" value={c.id} />
          <Button type="submit" variant="ghost" className="text-red-400 hover:text-red-300">
            Delete
          </Button>
        </form>
        <Link href="/categories" className={ghostLinkClass}>
          ← Back to list
        </Link>
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-mute">Identity</p>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Detail label="Id" value={c.id} />
            <Detail label="Label" value={c.label} />
            <Detail label="Sort order" value={c.sort_order} />
            <Detail label="Mesh archetype" value={c.mesh_archetype} />
            <Detail label="Background" value={<Swatch hex={c.palette_background} />} />
            <Detail label="Accent" value={<Swatch hex={c.palette_accent} />} />
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-mute">Camera</p>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Detail label="Position X" value={c.camera_position?.[0]} />
            <Detail label="Position Y" value={c.camera_position?.[1]} />
            <Detail label="Position Z" value={c.camera_position?.[2]} />
            <Detail label="FOV" value={c.camera_fov} />
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-mute">Gesture &amp; timing</p>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Detail label="Gesture mode" value={c.gesture_mode} />
            <Detail label="Velocity threshold" value={c.gesture_velocity_threshold} />
            <Detail label="Travel distance" value={c.gesture_travel_distance} />
            <Detail label="Common beat (ms)" value={c.common_beat_ms} />
            <Detail label="Rare hold (ms)" value={c.rare_hold_ms} />
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-mute">Advanced (JSON)</p>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <JsonBlock label="Lighting" value={c.lighting} />
            <JsonBlock label="Haptic — common" value={c.haptic_common} />
            <JsonBlock label="Haptic — rare" value={c.haptic_rare} />
            <JsonBlock label="Opening beats — common" value={c.opening_beats_common} />
            <JsonBlock label="Opening beats — rare" value={c.opening_beats_rare} />
          </dl>
        </div>
      </div>
    </div>
  );
}
