import Link from "next/link";
import { pool } from "@/lib/db";
import { createPack } from "@/lib/actions";
import { Button, Card, CardTitle, CollapsibleCard, Field, Input, PageHeader, Table, TdNum, TdStrong, Th, Thead } from "@/components/ui";

function usd(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function listPacks() {
  const { rows } = await pool.query<{
    id: string;
    category: string;
    tier: string;
    name: string;
    price_cents: string;
    item_count: number;
    stock_remaining: number | null;
    goes_live_at: string | null;
    recurrence_weekdays: number[] | null;
  }>(
    "select id, category, tier, name, price_cents, item_count, stock_remaining, goes_live_at, recurrence_weekdays from public.packs order by category, price_cents"
  );
  return rows;
}

async function listCategories() {
  const { rows } = await pool.query<{ id: string; label: string }>(
    "select id, label from public.categories order by sort_order, id"
  );
  return rows;
}

export default async function PacksPage() {
  const [packs, categories] = await Promise.all([listPacks(), listCategories()]);

  return (
    <div>
      <PageHeader
        title="Packs"
        description="Every pack SKU — price, items per pull, and stock. Open one to edit its price, item count, and slot-probability grid."
      />

      <div className="flex flex-col gap-8">
        {/* Grouped by whatever's in the categories table, not a hardcoded pair — a category
            with zero packs yet still gets its own (empty) section, so it's obvious a new
            category needs at least one pack before it's actually purchasable. */}
        {categories.map((cat) => {
          const rows = packs.filter((p) => p.category === cat.id);
          return (
            <Card key={cat.id}>
              <CardTitle>{cat.label}</CardTitle>
              {rows.length === 0 ? (
                <p className="text-sm text-text-mute">No packs yet — create one below.</p>
              ) : (
                <Table>
                  <Thead>
                    <tr>
                      <Th>Pack</Th>
                      <Th>Price</Th>
                      <Th>Items/pull</Th>
                      <Th>Stock</Th>
                      <Th>Availability</Th>
                      <Th></Th>
                    </tr>
                  </Thead>
                  <tbody>
                    {rows.map((pack) => (
                      <tr key={pack.id}>
                        <TdStrong>{pack.name}</TdStrong>
                        <TdNum>{usd(Number(pack.price_cents))}</TdNum>
                        <TdNum>{pack.item_count}</TdNum>
                        <TdNum>{pack.stock_remaining ?? "—"}</TdNum>
                        <TdNum>
                          {pack.recurrence_weekdays && pack.recurrence_weekdays.length > 0
                            ? "Recurring drop"
                            : pack.goes_live_at
                              ? new Date(pack.goes_live_at) > new Date()
                                ? `Live ${new Date(pack.goes_live_at).toLocaleString()}`
                                : "Drop — live"
                              : "Evergreen"}
                        </TdNum>
                        <td className="border-t border-border px-4 py-3">
                          <Link href={`/packs/${pack.id}`} className="text-sm font-medium text-accent hover:underline">
                            Edit →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          );
        })}

        <CollapsibleCard summary={<span className="text-sm font-semibold text-text">+ New pack</span>}>
          <p className="mb-4 text-xs text-text-mute">
            tier is a slug (e.g. street_rip) — it's cosmetic/routing only, doesn't affect behavior. Slot probabilities
            are optional here; a pack with none yet just can't be purchased until they're added (same rule the
            purchase path already enforces), same as on a pack's own edit page.
          </p>
          <form action={createPack} className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Field label="Category">
              <select
                name="category"
                required
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tier slug">
              <Input name="tier" placeholder="e.g. street_rip" required pattern="[a-z][a-z0-9_]*" />
            </Field>
            <Field label="Name">
              <Input name="name" placeholder="e.g. Street Rip" required />
            </Field>
            <Field label="Price ($)">
              <Input name="priceDollars" type="number" step="0.01" min="0" required />
            </Field>
            <Field label="Items per pull">
              <Input name="itemCount" type="number" min="1" required />
            </Field>
            <Field label="Starting stock (blank = unlimited)">
              <Input name="stockRemaining" type="number" min="0" />
            </Field>
            <Field label="Max stock / restock ceiling (blank = none)">
              <Input name="maxStock" type="number" min="0" />
            </Field>
            <Field label="Restock amount (blank = never restocks — a drop)">
              <Input name="restockAmount" type="number" min="1" />
            </Field>
            <Field label="Restock interval, seconds (blank = never)">
              <Input name="restockIntervalSeconds" type="number" min="1" />
            </Field>
            <Field label="Goes live at (blank = evergreen, live now)">
              <Input name="goesLiveAt" type="datetime-local" />
            </Field>
            <Field label="Ends at (optional hard cutoff)">
              <Input name="endsAt" type="datetime-local" />
            </Field>
            <div className="col-span-2 sm:col-span-3">
              <Field
                label="Slot probabilities (optional, JSON array of {slotPosition, rarityTierLevel, probabilityPercent})"
                info='Each slotPosition needs all 3 rarity tier levels together, summing to 100. Example: [{"slotPosition":1,"rarityTierLevel":1,"probabilityPercent":80},{"slotPosition":1,"rarityTierLevel":2,"probabilityPercent":18},{"slotPosition":1,"rarityTierLevel":3,"probabilityPercent":2}]'
              >
                <textarea
                  name="slotProbabilities"
                  rows={3}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-text outline-none focus:border-accent"
                />
              </Field>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <Button type="submit">Create pack</Button>
            </div>
          </form>
        </CollapsibleCard>
      </div>
    </div>
  );
}
