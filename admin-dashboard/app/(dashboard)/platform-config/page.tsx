import { pool } from "@/lib/db";
import { updatePlatformConfig } from "@/lib/actions";
import { Button, Card, Field, Input, PageHeader } from "@/components/ui";

async function getConfig() {
  const res = await pool.query<{
    starting_balance_cents: string;
    price_drift_interval_seconds: number;
    cards_drift_min_pct: string;
    cards_drift_max_pct: string;
    watches_drift_min_pct: string;
    watches_drift_max_pct: string;
  }>("select * from public.platform_config limit 1");
  return res.rows[0];
}

export default async function PlatformConfigPage() {
  const config = await getConfig();

  return (
    <div>
      <PageHeader
        title="Platform Config"
        info="Global settings that apply to every user and every pack — not specific to any one SKU. This is what replaced the hardcoded $1,000 starting balance and hardcoded drift constants from earlier in the build."
        description="Applies immediately to every new signup and every future price-drift tick — nothing here is hardcoded in app or server code."
      />

      <Card className="max-w-lg">
        <form action={updatePlatformConfig} className="flex flex-col gap-5">
          <Field
            label="Starting balance (USD)"
            info="How much paper USD a brand-new signup starts with. Applied automatically the instant an account is created (via a database trigger) — no app or server redeploy needed."
          >
            <Input
              name="startingBalanceDollars"
              type="number"
              step="0.01"
              defaultValue={(Number(config.starting_balance_cents) / 100).toFixed(2)}
            />
          </Field>
          <Field
            label="Price drift interval (seconds)"
            info="How often an owned item's portfolio value re-rolls within its bounded random-walk range. Not yet wired to a running job — this sets the intended cadence for when that's built."
          >
            <Input name="driftIntervalSeconds" type="number" defaultValue={config.price_drift_interval_seconds} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cards drift min %" info="The smallest possible move (in either direction) on a single drift tick for a card item.">
              <Input name="cardsDriftMin" type="number" step="0.01" defaultValue={config.cards_drift_min_pct} />
            </Field>
            <Field label="Cards drift max %" info="The largest possible move (in either direction) on a single drift tick for a card item.">
              <Input name="cardsDriftMax" type="number" step="0.01" defaultValue={config.cards_drift_max_pct} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Watches drift min %" info="The smallest possible move (in either direction) on a single drift tick for a watch item. Kept lower than Cards — watches should feel slower-moving.">
              <Input name="watchesDriftMin" type="number" step="0.01" defaultValue={config.watches_drift_min_pct} />
            </Field>
            <Field label="Watches drift max %" info="The largest possible move (in either direction) on a single drift tick for a watch item.">
              <Input name="watchesDriftMax" type="number" step="0.01" defaultValue={config.watches_drift_max_pct} />
            </Field>
          </div>
          <Button type="submit" className="self-start">
            Save
          </Button>
        </form>
      </Card>
    </div>
  );
}
