import Link from "next/link";
import { listPacksWithEv } from "@/lib/packs";
import { Card, CardTitle, PageHeader, Pill, Table, Td, TdNum, TdStrong, Th, Thead } from "@/components/ui";

function usd(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function returnTone(pct: number): "good" | "warn" | "danger" {
  if (pct >= 85 && pct <= 100) return "good";
  if (pct < 85 && pct >= 70) return "warn";
  if (pct > 100 && pct <= 120) return "warn";
  return "danger";
}

/** Straight from the product spec's own description of each tier's role. */
const PACK_DESCRIPTIONS: Record<string, string> = {
  street_rip:
    "Entry-level collecting. Designed to encourage frequent openings — the user should feel 'I can open one quickly, maybe I get lucky.'",
  vault_break:
    "Premium collecting. One more card than Street Rip, better rarity odds, and guarantees at least one Prime-or-Grail card.",
  black_label:
    "High-stakes collecting. Guarantees at least 2 Prime-or-Grail cards and a premium final slot — should feel significant before the user even opens it.",
  reserve: "The entry point into luxury collecting. Premium without feeling inaccessible.",
  archive: "Serious collector territory — a meaningful chance at a highly desirable watch.",
  obsidian_vault: "The highest-stakes watch experience. This purchase should feel ceremonial.",
};

export default async function OverviewPage() {
  const packs = await listPacksWithEv();
  const cards = packs.filter((p) => p.category === "cards");
  const watches = packs.filter((p) => p.category === "watches");

  return (
    <div>
      <PageHeader
        title="Overview"
        info="Every pack's price against its estimated payout. This is the first place to look after changing a pack's price or its slot-probability grid — it tells you immediately whether that change broke the economics."
        description="Expected value per pack, computed from the pack's own catalog items. A pack whose EV sits far from its target return is the exact thing this dashboard exists to catch and fix."
      />

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
                  <Th info="What a user pays for one rip of this pack.">Price</Th>
                  <Th info="The real average payout of this pack: for every pull position, (odds of each rarity tier) × (the actual average value of this pack's own catalog items at that tier), summed. This is the pack's own real items, not a category-wide approximation — editing Rarity Tiers won't move this number; editing this pack's price or odds will.">
                    Est. EV
                  </Th>
                  <Th info="Est. EV as a % of price. Green = within the healthy 85–100% target band. Amber = drifting off target. Red = seriously wrong — either the platform is losing money on this pack (over 100%) or it feels stingy to rip (well under 85%).">
                    Return
                  </Th>
                  <Th></Th>
                </tr>
              </Thead>
              <tbody>
                {group.rows.map((pack) => {
                  const returnPct = (pack.evCents / pack.priceCents) * 100;
                  return (
                    <tr key={pack.id}>
                      <TdStrong info={PACK_DESCRIPTIONS[pack.tier]}>{pack.name}</TdStrong>
                      <TdNum>{usd(pack.priceCents)}</TdNum>
                      <TdNum>{usd(pack.evCents)}</TdNum>
                      <Td>
                        <Pill tone={returnTone(returnPct)}>{returnPct.toFixed(1)}%</Pill>
                      </Td>
                      <Td>
                        <Link href={`/packs/${pack.id}`} className="text-sm font-medium text-accent hover:underline">
                          Edit →
                        </Link>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        ))}
      </div>
    </div>
  );
}
