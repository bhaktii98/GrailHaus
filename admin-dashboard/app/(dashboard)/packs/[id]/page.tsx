import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { updatePack } from "@/lib/actions";
import { computeRealEvCents } from "@/lib/ev";
import { Button, Card, CardTitle, Field, Info, Input, PageHeader, Pill, Table, TableInput, Td, Th, Thead } from "@/components/ui";

/** Index = `Date#getUTCDay()` (0=Sunday..6=Saturday) — matches the `recurrence_weekdays` column
 * and dropRecurrence.ts on the server, which both use the same convention. */
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Generalizes the spec's own pacing language ("Cards 1-2 establish rhythm... Card 5 becomes
 * the major tension point") to any slot count, including the single-slot watch case. */
function describeSlot(position: number, totalSlots: number) {
  if (totalSlots === 1) return "The only pull — for watches, this is the entire reveal.";
  if (position === 1) return "Opening pull — establishes rhythm before the odds start shifting.";
  if (position === totalSlots)
    return "Final pull — the major tension point. This is also where most Pressure Rule guarantees land (see the Pressure Rules page).";
  return "Escalating pull — odds shift further toward the higher tiers than earlier slots.";
}

/** `datetime-local` inputs need `YYYY-MM-DDTHH:mm` in the *viewer's* local time, not the raw
 * UTC ISO string Postgres returns — otherwise the field silently shows the wrong hour. */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function getPack(id: string) {
  const packRes = await pool.query<{
    id: string;
    category: string;
    tier: string;
    name: string;
    price_cents: string;
    item_count: number;
    stock_remaining: number | null;
    max_stock: number | null;
    restock_amount: number | null;
    restock_interval_seconds: number | null;
    goes_live_at: string | null;
    ends_at: string | null;
    recurrence_weekdays: number[] | null;
    recurrence_time_utc: string | null;
    recurrence_duration_minutes: number | null;
  }>(
    `select id, category, tier, name, price_cents, item_count,
            stock_remaining, max_stock, restock_amount, restock_interval_seconds, goes_live_at, ends_at,
            recurrence_weekdays, recurrence_time_utc, recurrence_duration_minutes
     from public.packs where id = $1`,
    [id]
  );
  const pack = packRes.rows[0];
  if (!pack) return null;

  const rarityRes = await pool.query<{
    tier_level: number;
    name: string;
    value_min_cents: string;
    value_max_cents: string;
  }>(
    "select tier_level, name, value_min_cents, value_max_cents from public.rarity_tiers where category = $1 order by tier_level",
    [pack.category]
  );

  const slotRes = await pool.query<{ slot_position: number; rarity_tier_level: number; probability_percent: string }>(
    "select slot_position, rarity_tier_level, probability_percent from public.slot_probabilities where pack_id = $1 order by slot_position, rarity_tier_level",
    [id]
  );

  const slotsByPosition = new Map<number, Record<number, number>>();
  for (const row of slotRes.rows) {
    const slot = slotsByPosition.get(row.slot_position) ?? {};
    slot[row.rarity_tier_level] = Number(row.probability_percent);
    slotsByPosition.set(row.slot_position, slot);
  }

  return {
    pack,
    rarityTiers: rarityRes.rows,
    slots: [...slotsByPosition.entries()].sort((a, b) => a[0] - b[0]),
  };
}

export default async function PackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPack(id);
  if (!data) notFound();
  const { pack, rarityTiers, slots } = data;

  const evCents = await computeRealEvCents(pack.id);
  const priceCents = Number(pack.price_cents);
  const returnPct = (evCents / priceCents) * 100;
  const tone = returnPct >= 85 && returnPct <= 100 ? "good" : returnPct > 100 && returnPct <= 120 ? "warn" : returnPct < 85 && returnPct >= 70 ? "warn" : "danger";

  const updateWithId = updatePack.bind(null, pack.id);

  return (
    <div>
      <PageHeader
        title={pack.name}
        description={`${pack.category} · ${pack.tier}`}
        info="One pack SKU — its price, how many items it delivers per pull, and the exact odds at each pull position. Saving here immediately changes this pack's Est. EV shown on the Overview page."
      />

      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm text-text-soft">
          Est. EV {`$${(evCents / 100).toFixed(2)}`} on {`$${(priceCents / 100).toFixed(2)}`}
        </span>
        <Pill tone={tone}>{returnPct.toFixed(1)}% return</Pill>
      </div>

      <form action={updateWithId} className="flex flex-col gap-6">
        <Card className="flex gap-4">
          <Field label="Price (USD)" info="What a user pays for one rip of this pack.">
            <Input name="priceDollars" type="number" step="0.01" defaultValue={(priceCents / 100).toFixed(2)} />
          </Field>
          <Field
            label="Items per pull"
            info="How many items come out of one rip — 5–7 for card packs, 1 for watch cases. Changing this doesn't add or remove slot rows below automatically; edit the migration/seed if you need a different row count."
          >
            <Input name="itemCount" type="number" defaultValue={pack.item_count} />
          </Field>
        </Card>

        <Card>
          <CardTitle info="Null goesLiveAt means evergreen — always purchasable. Set a future date to schedule a timed drop (PRD §19-20); it won't be buyable before that instant. A restock amount/interval makes stock replenish over time (also §19) — leave both blank to make this pack sell out permanently once stock hits 0, which is what a drop should do.">
            Availability &amp; stock
          </CardTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Stock remaining" info="How many are left to buy right now.">
              <Input name="stockRemaining" type="number" min={0} defaultValue={pack.stock_remaining ?? ""} />
            </Field>
            <Field
              label="Max stock"
              info="The ceiling an evergreen pack restocks up to, or a drop's one-time starting inventory."
            >
              <Input name="maxStock" type="number" min={0} defaultValue={pack.max_stock ?? ""} />
            </Field>
            <Field
              label="Restock amount"
              info="How much stock is added back per interval. Leave blank for a drop — it should never restock."
            >
              <Input name="restockAmount" type="number" min={1} defaultValue={pack.restock_amount ?? ""} />
            </Field>
            <Field label="Restock interval (seconds)" info="How often the restock amount is added back.">
              <Input
                name="restockIntervalSeconds"
                type="number"
                min={1}
                defaultValue={pack.restock_interval_seconds ?? ""}
              />
            </Field>
            <Field label="Goes live at" info="Blank = evergreen, purchasable immediately. A future date/time makes this a scheduled drop.">
              <Input name="goesLiveAt" type="datetime-local" defaultValue={toDatetimeLocal(pack.goes_live_at)} />
            </Field>
            <Field label="Ends at" info="Optional hard cutoff for a drop — leave blank to let it end purely by selling out.">
              <Input name="endsAt" type="datetime-local" defaultValue={toDatetimeLocal(pack.ends_at)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle info="Makes this pack go live on a repeating weekly schedule instead of a single goesLiveAt/endsAt window — e.g. every Mon/Wed/Fri at 18:00 UTC, live for 2 hours each time. Stock resets to Max stock (above) at the start of every occurrence. Pick at least one day, a time, and a duration together — leaving any of the three blank turns recurrence off and this pack falls back to the plain Goes live at / Ends at fields above.">
            Recurring drop (optional)
          </CardTitle>
          <div className="flex flex-col gap-4">
            <Field label="Days (UTC)" info="Which days of the week a new occurrence starts on.">
              <div className="flex flex-wrap gap-3">
                {WEEKDAY_LABELS.map((label, day) => (
                  <label key={day} className="inline-flex items-center gap-1.5 text-sm text-text">
                    <input
                      type="checkbox"
                      name={`recurrenceDay_${day}`}
                      defaultChecked={pack.recurrence_weekdays?.includes(day) ?? false}
                      className="h-4 w-4 rounded border-border accent-accent"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Time (UTC)" info="The time of day each occurrence starts.">
                <Input name="recurrenceTimeUtc" type="time" defaultValue={pack.recurrence_time_utc?.slice(0, 5) ?? ""} />
              </Field>
              <Field label="Duration (minutes)" info="How long each occurrence stays live before closing until its next scheduled day.">
                <Input
                  name="recurrenceDurationMinutes"
                  type="number"
                  min={1}
                  defaultValue={pack.recurrence_duration_minutes ?? ""}
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle info="Cards don't use one flat probability for the whole pack — each pull position (1st card, 2nd, ...) has its own odds, escalating toward the final slot. This is the 'Progressive Slot Probability' system from the spec. Watches have a single slot, so this table is one row.">
            Slot probabilities (% per position)
          </CardTitle>
          <Table>
            <Thead>
              <tr>
                <Th info="The pull's position in the pack — 1 is the first item revealed, the highest number is the final, most-tense pull.">
                  Slot
                </Th>
                {rarityTiers.map((t) => (
                  <Th
                    key={t.tier_level}
                    info={`The odds (%) that this position lands on ${t.name}. Every row must add up to 100.`}
                  >
                    {t.name}
                  </Th>
                ))}
              </tr>
            </Thead>
            <tbody>
              {slots.map(([slotPosition, probs]) => (
                <tr key={slotPosition}>
                  <Td className="font-medium text-text">
                    <span className="inline-flex items-center">
                      {slotPosition}
                      <Info>{describeSlot(slotPosition, slots.length)}</Info>
                    </span>
                  </Td>
                  {rarityTiers.map((t) => (
                    <Td key={t.tier_level}>
                      <TableInput
                        name={`slot_${slotPosition}_tier_${t.tier_level}`}
                        type="number"
                        step="0.01"
                        defaultValue={probs[t.tier_level] ?? 0}
                        className="w-20"
                      />
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-text-mute">Each row should sum to 100.</p>
        </Card>

        <Button type="submit" className="self-start">
          Save
        </Button>
      </form>
    </div>
  );
}
