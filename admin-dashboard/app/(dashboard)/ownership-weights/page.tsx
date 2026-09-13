import { pool } from "@/lib/db";
import { updateOwnershipWeights } from "@/lib/actions";
import { Button, Card, CardTitle, PageHeader, Table, TableInput, Td, Th, Thead } from "@/components/ui";

/** copies_owned = 3 is the floor row — "3 or more," not exactly 3. */
const COPIES_LABEL: Record<number, string> = {
  0: "Never owned",
  1: "Own 1 copy",
  2: "Own 2 copies",
  3: "Own 3+ copies",
};

/** Default weight ladder for a category with no ownership_weight_tiers rows yet — matches
 * shared/src/rewardEngine.ts's FALLBACK_OWNERSHIP_CURVE ({byCopies:[1.0,0.5,0.25], floor:0.15}),
 * so a brand-new category behaves the same way in the admin form as it already does at runtime
 * before anyone's edited it. */
const DEFAULT_WEIGHT: Record<number, string> = { 0: "100", 1: "50", 2: "25", 3: "15" };

interface WeightRow {
  category: string;
  copies_owned: number;
  weight_percent: string;
}

async function getData() {
  const [categories, weights] = await Promise.all([
    pool.query<{ id: string; label: string }>("select id, label from public.categories order by sort_order, id"),
    pool.query<WeightRow>(
      "select category, copies_owned, weight_percent from public.ownership_weight_tiers order by category, copies_owned"
    ),
  ]);
  return { categories: categories.rows, weights: weights.rows };
}

export default async function OwnershipWeightsPage() {
  const { categories, weights } = await getData();
  const byCategory = new Map<string, WeightRow[]>();
  for (const w of weights) byCategory.set(w.category, [...(byCategory.get(w.category) ?? []), w]);

  return (
    <div>
      <PageHeader
        title="Duplicate Weights"
        info="When a pull's rarity is decided, the specific item is chosen by weighted random selection from that rarity's pool — nothing is ever removed from the pool, and a duplicate is never blocked, even twice in the same pack. Owning more copies of an item just makes it progressively less likely to be picked again. 100 means full odds (as if you owned zero); 15 means 15% of full odds. This only affects which specific item you get, never which rarity tier. Every category always shows exactly 4 rows (0/1/2/3+ copies) — a category with none saved yet shows sensible defaults, ready to fill in and submit."
        description="How much less likely an item is to be re-selected the more copies of it a user already owns."
      />

      <form action={updateOwnershipWeights} className="flex flex-col gap-6">
        {categories.map((cat) => {
          const existing = byCategory.get(cat.id) ?? [];
          const byCopies = new Map(existing.map((w) => [w.copies_owned, w]));
          const rows = [0, 1, 2, 3].map(
            (copies) => byCopies.get(copies) ?? { category: cat.id, copies_owned: copies, weight_percent: DEFAULT_WEIGHT[copies] }
          );

          return (
            <Card key={cat.id}>
              <CardTitle>{cat.label}</CardTitle>
              <Table>
                <Thead>
                  <tr>
                    <Th>Copies owned</Th>
                    <Th info="The item's selection weight as a percentage of its normal (never-owned) odds. Lower means rarer to see again.">
                      Weight %
                    </Th>
                  </tr>
                </Thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.copies_owned}>
                      <Td className="font-medium text-text">{COPIES_LABEL[row.copies_owned] ?? row.copies_owned}</Td>
                      <Td>
                        <TableInput
                          name={`${cat.id}_${row.copies_owned}`}
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          defaultValue={row.weight_percent}
                          className="w-24"
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          );
        })}
        <Button type="submit" className="self-start">
          Save
        </Button>
      </form>
    </div>
  );
}
