import { pool } from "@/lib/db";
import { updatePressureRule } from "@/lib/actions";
import { Button, Card, Info, PageHeader, Pill, Table, TableInput, Td, Th, Thead } from "@/components/ui";

async function getRules() {
  const res = await pool.query<{
    id: string;
    pack_name: string;
    category: string;
    qualifying_min_tier: number;
    steps_without_qualifying: number;
    effect_type: string;
    target_tier_level: number;
    effect_value: number | null;
    applies_to_final_slot_only: boolean;
  }>(
    `select pr.id, p.name as pack_name, p.category, pr.qualifying_min_tier, pr.steps_without_qualifying,
            pr.effect_type, pr.target_tier_level, pr.effect_value, pr.applies_to_final_slot_only
     from public.pressure_rules pr
     join public.packs p on p.id = pr.pack_id
     order by p.price_cents, pr.steps_without_qualifying`
  );
  return res.rows;
}

async function getTierNames() {
  const res = await pool.query<{ category: string; tier_level: number; name: string }>(
    "select category, tier_level, name from public.rarity_tiers"
  );
  const byKey = new Map<string, string>();
  for (const r of res.rows) byKey.set(`${r.category}_${r.tier_level}`, r.name);
  return byKey;
}

export default async function PressureRulesPage() {
  const [rules, tierNames] = await Promise.all([getRules(), getTierNames()]);

  function tierName(category: string, level: number) {
    return tierNames.get(`${category}_${level}`) ?? `tier ${level}`;
  }

  /** Computed live from the row's own data, not a static string — stays accurate if the numbers change. */
  function describeRule(rule: (typeof rules)[number]) {
    const qualifying = tierName(rule.category, rule.qualifying_min_tier);
    const target = tierName(rule.category, rule.target_tier_level);
    const scope = rule.applies_to_final_slot_only ? "on the pack's final pull only" : "on any eligible pull";
    if (rule.effect_type === "guarantee_min_tier") {
      return `After ${rule.steps_without_qualifying} consecutive pulls below ${qualifying}, the next qualifying pull is guaranteed to be at least ${target}, ${scope}.`;
    }
    return `After ${rule.steps_without_qualifying} consecutive pulls below ${qualifying}, ${target} odds get +${rule.effect_value ?? 0} percentage points, ${scope}.`;
  }

  return (
    <div>
      <PageHeader
        title="Pressure Rules"
        info="The doc calls this 'Grail Pressure' for Cards and 'The Curator's Guarantee' for Watches — same mechanic, generalized into one rule shape. The system tracks, per user per pack, how many pulls in a row came back below the qualifying tier; once a threshold is hit, the rule below fires. Deliberately tracked per pack SKU, never globally across a user's account or shared across price tiers — tracking it globally would let someone farm cheap packs to build pressure, then cash the resulting guarantee in on an expensive pack."
        description="Grail Pressure / Curator's Guarantee — tracked per pack SKU, never globally per user. Each rule fires once its threshold is met; the engine applies only the highest threshold met, not a sum of all of them."
      />

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Pack</Th>
              <Th info="'guarantee' forces the pull to be at least the target tier once the threshold is met. 'bonus %' only adds percentage points to the target tier's odds — it doesn't guarantee anything by itself.">
                Effect
              </Th>
              <Th info="Which rarity level this rule boosts or guarantees.">Target tier</Th>
              <Th info="If yes, this rule only ever applies to the pack's last pull position (e.g. the 5th card of a Street Rip) — not every slot.">
                Final slot only
              </Th>
              <Th info="First number: how many consecutive non-qualifying pulls trigger this rule. Second number (bonus rules only): how many percentage points get added to the target tier's odds.">
                Threshold / Bonus
              </Th>
            </tr>
          </Thead>
          <tbody>
            {rules.map((rule) => {
              const updateWithId = updatePressureRule.bind(null, rule.id);
              return (
                <tr key={rule.id}>
                  <Td className="font-medium text-text">
                    <span className="inline-flex items-center">
                      {rule.pack_name}
                      <Info>{describeRule(rule)}</Info>
                    </span>
                  </Td>
                  <Td>
                    <Pill tone={rule.effect_type === "guarantee_min_tier" ? "good" : "neutral"}>
                      {rule.effect_type === "guarantee_min_tier" ? "guarantee" : "bonus %"}
                    </Pill>
                  </Td>
                  <Td>{tierName(rule.category, rule.target_tier_level)}</Td>
                  <Td>{rule.applies_to_final_slot_only ? "yes" : "no"}</Td>
                  <Td>
                    <form action={updateWithId} className="flex items-center gap-2">
                      <TableInput name="steps" type="number" defaultValue={rule.steps_without_qualifying} className="w-16" />
                      {rule.effect_type === "bonus_percent" ? (
                        <TableInput name="effectValue" type="number" defaultValue={rule.effect_value ?? 0} className="w-16" />
                      ) : (
                        <input type="hidden" name="effectValue" value="" />
                      )}
                      <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">
                        Save
                      </Button>
                    </form>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
