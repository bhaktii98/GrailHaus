import { getMarketplaceEconomics, getPackEconomics } from "@/lib/economics";
import { Card, CardTitle, PageHeader, Table, TdNum, TdStrong, Th, Thead } from "@/components/ui";

function usd(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export default async function EconomicsPage() {
  const [packs, marketplace] = await Promise.all([getPackEconomics(), getMarketplaceEconomics()]);

  const cards = packs.filter((p) => p.category === "cards");
  const watches = packs.filter((p) => p.category === "watches");

  const totalRevenueCents = packs.reduce((sum, p) => sum + p.revenueCents, 0);
  const totalPayoutCents = packs.reduce((sum, p) => sum + p.payoutCents, 0);
  const totalPrimaryMarginCents = totalRevenueCents - totalPayoutCents;
  const totalPacksSold = packs.reduce((sum, p) => sum + p.packsSold, 0);

  const totalFeesCollectedCents = marketplace.reduce((sum, m) => sum + m.feesCollectedCents, 0);
  const totalMarketplaceSales = marketplace.reduce((sum, m) => sum + m.salesCount, 0);

  const totalPlatformTakeCents = totalPrimaryMarginCents + totalFeesCollectedCents;

  return (
    <div>
      <PageHeader
        title="Economics"
        info="Deliverable 5's economics floor, made visible: actual realized numbers from purchases and sales that have happened, not a projection. The Overview page estimates what a pack should return before anyone buys it; this page shows what actually happened once people did."
        description="Packs sold, fees collected, contents payout vs. pack revenue, and margin per category — all computed from real purchase and listing history."
      />

      <div className="mb-8 grid grid-cols-3 gap-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-mute">Primary margin</p>
          <p className="mt-2 text-2xl font-bold text-text">{usd(totalPrimaryMarginCents)}</p>
          <p className="mt-1 text-xs text-text-soft">
            {usd(totalRevenueCents)} revenue − {usd(totalPayoutCents)} payout across {totalPacksSold} packs sold
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-mute">Marketplace fees</p>
          <p className="mt-2 text-2xl font-bold text-text">{usd(totalFeesCollectedCents)}</p>
          <p className="mt-1 text-xs text-text-soft">across {totalMarketplaceSales} completed sales</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-mute">Total platform take</p>
          <p className="mt-2 text-2xl font-bold text-text">{usd(totalPlatformTakeCents)}</p>
          <p className="mt-1 text-xs text-text-soft">primary margin + marketplace fees</p>
        </Card>
      </div>

      <div className="flex flex-col gap-8">
        {[
          { label: "Trading Cards", rows: cards },
          { label: "Watches", rows: watches },
        ].map((group) => (
          <Card key={group.label}>
            <CardTitle>{group.label}</CardTitle>
            <Table>
              <Thead>
                <tr>
                  <Th>Pack</Th>
                  <Th info="Total completed purchases of this pack — bulk buys count every pack in the batch, not just the transaction.">
                    Sold
                  </Th>
                  <Th info="Sum of what buyers actually paid — the real number, not price × est. sold.">Revenue</Th>
                  <Th info="Sum of the actual catalog value of every item this pack has ever generated — the real realized payout, not the Overview page's estimate.">
                    Payout
                  </Th>
                  <Th info="Revenue minus payout — what the platform actually kept from this pack.">Margin</Th>
                  <Th>Margin %</Th>
                </tr>
              </Thead>
              <tbody>
                {group.rows.map((pack) => {
                  const marginCents = pack.revenueCents - pack.payoutCents;
                  return (
                    <tr key={pack.id}>
                      <TdStrong>{pack.name}</TdStrong>
                      <TdNum>{pack.packsSold.toLocaleString()}</TdNum>
                      <TdNum>{usd(pack.revenueCents)}</TdNum>
                      <TdNum>{usd(pack.payoutCents)}</TdNum>
                      <TdNum>{usd(marginCents)}</TdNum>
                      <TdNum>{pct(marginCents, pack.revenueCents)}</TdNum>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        ))}

        <Card>
          <CardTitle>Marketplace</CardTitle>
          <Table>
            <Thead>
              <tr>
                <Th>Category</Th>
                <Th>Sales</Th>
                <Th info="Total price paid by buyers across all completed sales in this category.">Gross sales</Th>
                <Th info="The 8% platform fee, collected out of the seller's proceeds on every sale — see Marketplace Fees for the configured rate per tier.">
                  Fees collected
                </Th>
                <Th>Seller proceeds</Th>
                <Th>Effective fee %</Th>
              </tr>
            </Thead>
            <tbody>
              {marketplace.length === 0 ? (
                <tr>
                  <TdStrong>No marketplace sales yet</TdStrong>
                  <TdNum>—</TdNum>
                  <TdNum>—</TdNum>
                  <TdNum>—</TdNum>
                  <TdNum>—</TdNum>
                  <TdNum>—</TdNum>
                </tr>
              ) : (
                marketplace.map((row) => (
                  <tr key={row.category}>
                    <TdStrong>{row.category.charAt(0).toUpperCase() + row.category.slice(1)}</TdStrong>
                    <TdNum>{row.salesCount.toLocaleString()}</TdNum>
                    <TdNum>{usd(row.grossSalesCents)}</TdNum>
                    <TdNum>{usd(row.feesCollectedCents)}</TdNum>
                    <TdNum>{usd(row.sellerProceedsCents)}</TdNum>
                    <TdNum>{pct(row.feesCollectedCents, row.grossSalesCents)}</TdNum>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
