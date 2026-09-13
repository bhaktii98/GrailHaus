import { pool } from "@/lib/db";
import { updateRarityTiers } from "@/lib/actions";
import { Button, Card, CardTitle, Info, PageHeader, Table, TableInput, Td, Th, Thead } from "@/components/ui";

/** Straight from the product spec's own description of each tier's role — shown for the two
 * categories the PRD actually defines. A newly-added category has no ready-made description
 * yet, so it just gets no tooltip rather than a guessed one. */
const TIER_DESCRIPTIONS: Record<string, Record<number, string>> = {
  cards: {
    1: "The foundation of the collection — the most frequently obtained items.",
    2: "Premium collectible cards — create meaningful excitement during an opening.",
    3: "The chase items — the highest rarity level, meant to create the strongest reveal moments.",
  },
  watches: {
    1: "Recognisable luxury watches — the foundation of the luxury collection.",
    2: "Highly desirable collector watches — a noticeable increase in excitement.",
    3: "Exceptional watches — the chase outcomes. An Apex reveal should be memorable.",
  },
};

interface TierRow {
  category: string;
  tier_level: number;
  name: string;
  color_hex: string;
  value_min_cents: string;
  value_max_cents: string;
}

async function getData() {
  const [categories, tiers] = await Promise.all([
    pool.query<{ id: string; label: string }>("select id, label from public.categories order by sort_order, id"),
    pool.query<TierRow>(
      "select category, tier_level, name, color_hex, value_min_cents, value_max_cents from public.rarity_tiers order by category, tier_level"
    ),
  ]);
  return { categories: categories.rows, tiers: tiers.rows };
}

export default async function RarityTiersPage() {
  const { categories, tiers } = await getData();
  const byCategory = new Map<string, TierRow[]>();
  for (const t of tiers) byCategory.set(t.category, [...(byCategory.get(t.category) ?? []), t]);

  return (
    <div>
      <PageHeader
        title="Rarity Tiers"
        info="Rarity is stored as an ordinal level (1/2/3), not a hardcoded name — everything shown to a user (the name, color, value range) lives here as data. Every category always has exactly 3 levels; a category with none saved yet shows blank rows ready to fill in and submit — that's what turns a brand-new category (added on the Categories page) into one that's actually reveal-ready. Note: the Overview page's Est. EV is computed from each pack's actual catalog items, not from these ranges — editing here changes what's shown to users, not the EV number. To move a pack's EV, edit its price or slot odds on the pack's own page."
        description="Name, color, and the display value range shown to users for each rarity tier."
      />

      <form action={updateRarityTiers} className="flex flex-col gap-6">
        {categories.map((cat) => {
          // Always exactly 3 rows (levels 1-3) — a category with no rarity_tiers rows yet gets
          // blank ones, ready to fill in; the upsert on submit creates them.
          const existing = byCategory.get(cat.id) ?? [];
          const byLevel = new Map(existing.map((t) => [t.tier_level, t]));
          const rows = [1, 2, 3].map(
            (level) =>
              byLevel.get(level) ?? {
                category: cat.id,
                tier_level: level,
                name: "",
                color_hex: "#888888",
                value_min_cents: "0",
                value_max_cents: "0",
              }
          );

          return (
            <Card key={cat.id}>
              <CardTitle>{cat.label}</CardTitle>
              <Table>
                <Thead>
                  <tr>
                    <Th info="1 = the most common tier, 3 = the rarest. Fixed — not editable here.">Level</Th>
                    <Th info="What's shown to the user in the app for this rarity, e.g. 'Grail'.">Name</Th>
                    <Th info="The badge/highlight color used for this tier in the app. Hex code, e.g. #ffc933.">
                      Color
                    </Th>
                    <Th info="The typical low end of an item's value at this rarity, shown to users in the app. Display only.">
                      Min ($)
                    </Th>
                    <Th info="The typical high end of an item's value at this rarity, shown to users in the app. Display only.">
                      Max ($)
                    </Th>
                  </tr>
                </Thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.tier_level}>
                      <Td className="font-medium text-text">
                        <span className="inline-flex items-center">
                          {t.tier_level}
                          <Info>{TIER_DESCRIPTIONS[cat.id]?.[t.tier_level]}</Info>
                        </span>
                      </Td>
                      <Td>
                        <TableInput name={`${cat.id}_${t.tier_level}_name`} defaultValue={t.name} required />
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-4 w-4 flex-shrink-0 rounded-full border border-border"
                            style={{ background: t.color_hex }}
                          />
                          <TableInput
                            name={`${cat.id}_${t.tier_level}_color`}
                            defaultValue={t.color_hex}
                            className="w-24 font-mono"
                            required
                          />
                        </div>
                      </Td>
                      <Td>
                        <TableInput
                          name={`${cat.id}_${t.tier_level}_min`}
                          type="number"
                          step="0.01"
                          defaultValue={(Number(t.value_min_cents) / 100).toFixed(2)}
                          className="w-28"
                        />
                      </Td>
                      <Td>
                        <TableInput
                          name={`${cat.id}_${t.tier_level}_max`}
                          type="number"
                          step="0.01"
                          defaultValue={(Number(t.value_max_cents) / 100).toFixed(2)}
                          className="w-28"
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
