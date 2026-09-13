import { pool } from "@/lib/db";
import { updateMarketplaceFees } from "@/lib/actions";
import { Button, Card, CardTitle, Info, PageHeader, Table, TableInput, Td, Th, Thead } from "@/components/ui";

/** Why the fee is proposed to differ by tier — from the PRD's Money Mechanics section. */
const FEE_RATIONALE: Record<number, string> = {
  1: "Lowest tier gets the lowest fee — keeps the long tail liquid instead of stagnant.",
  2: "Middle tier — a moderate fee, between the long-tail and the chase items.",
  3: "Highest tier gets the highest fee — demand and urgency are greatest here, and the seller still clears a premium.",
};

async function getData() {
  const [categories, tiers, fees] = await Promise.all([
    pool.query<{ id: string; label: string }>("select id, label from public.categories order by sort_order, id"),
    pool.query<{ category: string; tier_level: number; name: string }>(
      "select category, tier_level, name from public.rarity_tiers order by category, tier_level"
    ),
    pool.query<{ category: string; rarity_tier_level: number; fee_percent: string }>(
      "select category, rarity_tier_level, fee_percent from public.marketplace_fee_tiers order by category, rarity_tier_level"
    ),
  ]);
  return { categories: categories.rows, tiers: tiers.rows, fees: fees.rows };
}

export default async function MarketplaceFeesPage() {
  const { categories, tiers, fees } = await getData();
  return renderPage(categories, tiers, fees);
}

function tierNameFor(tiers: { category: string; tier_level: number; name: string }[], category: string, level: number) {
  return tiers.find((t) => t.category === category && t.tier_level === level)?.name ?? `Tier ${level}`;
}

function feeFor(fees: { category: string; rarity_tier_level: number; fee_percent: string }[], category: string, level: number) {
  return fees.find((f) => f.category === category && f.rarity_tier_level === level)?.fee_percent ?? "5.00";
}

function renderPage(
  categories: { id: string; label: string }[],
  tiers: { category: string; tier_level: number; name: string }[],
  fees: { category: string; rarity_tier_level: number; fee_percent: string }[]
) {
  return (
    <div>
      <PageHeader
        title="Marketplace Fees"
        info="The cut the platform takes on every peer-to-peer sale on the marketplace (not on pack purchases — those are a separate revenue engine). Structurally tiered by rarity, so a Grail-tier sale can charge a different fee than a Core-tier one, even though every row is set to the same flat value today. Every category always shows exactly 3 rows (tier levels 1-3) — a category with no fee rows saved yet defaults to 5% until you save, which is when the rows are actually created."
        description="Structurally tiered by rarity per category, even though today every row is set to the same flat value."
      />

      <form action={updateMarketplaceFees} className="flex flex-col gap-6">
        {categories.map((cat) => (
          <Card key={cat.id}>
            <CardTitle>{cat.label}</CardTitle>
            <Table>
              <Thead>
                <tr>
                  <Th>Tier</Th>
                  <Th info="The percentage of the sale price the platform keeps when an item at this rarity sells. E.g. 8 means the seller receives 92% of the listing price.">
                    Fee %
                  </Th>
                </tr>
              </Thead>
              <tbody>
                {[1, 2, 3].map((level) => (
                  <tr key={level}>
                    <Td className="font-medium text-text">
                      <span className="inline-flex items-center">
                        {tierNameFor(tiers, cat.id, level)}
                        <Info>{FEE_RATIONALE[level]}</Info>
                      </span>
                    </Td>
                    <Td>
                      <TableInput
                        name={`${cat.id}_${level}`}
                        type="number"
                        step="0.01"
                        defaultValue={feeFor(fees, cat.id, level)}
                        className="w-24"
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))}
        <Button type="submit" className="self-start">
          Save
        </Button>
      </form>
    </div>
  );
}
