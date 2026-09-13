import { pool } from "@/lib/db";
import { createItem, deleteItem, updateItems } from "@/lib/actions";
import { Button, CollapsibleCard, Field, Input, PageHeader, Table, Td, TdStrong, Th, Thead } from "@/components/ui";

interface ItemRow {
  id: string;
  pack_id: string;
  name: string;
  rarity_tier_level: number;
  base_value_cents: string;
  texture_url: string | null;
  collection: string | null;
  tagline: string | null;
  external_ref: string | null;
  traits: string | null;
  pokemon_name: string | null;
  card_title: string | null;
  pokemon_type: string | null;
  generation: string | null;
  pokedex_number: string | null;
  watch_name: string | null;
  model_name: string | null;
  brand: string | null;
  style: string | null;
  case_material: string | null;
  dial_color: string | null;
  movement: string | null;
  case_size: string | null;
  rarity_name: string | null;
}

interface PackGroup {
  pack_name: string;
  category: string;
  price_cents: number;
  rows: ItemRow[];
}

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function flavorInfo(item: ItemRow) {
  return [item.tagline, item.traits].filter(Boolean).join(" — ") || undefined;
}

async function getCatalog(): Promise<[string, PackGroup][]> {
  // Starts from packs (left join items), not items (inner join packs) — a brand-new pack with
  // zero items yet (e.g. a category just added via Categories -> Packs, nothing stocked yet)
  // still needs its own section here so there's somewhere to add its first item.
  const [packsRes, itemsRes] = await Promise.all([
    pool.query<{ id: string; name: string; category: string; price_cents: string }>(
      "select id, name, category, price_cents from public.packs order by category, price_cents"
    ),
    pool.query<ItemRow & { pack_name: string; category: string; price_cents: string }>(`
      select
        i.id, i.pack_id, i.name, i.rarity_tier_level, i.base_value_cents, i.texture_url,
        i.collection, i.tagline, i.external_ref, i.traits,
        i.pokemon_name, i.card_title, i.pokemon_type, i.generation, i.pokedex_number,
        i.watch_name, i.model_name, i.brand, i.style, i.case_material, i.dial_color, i.movement, i.case_size,
        p.name as pack_name, p.category, p.price_cents,
        rt.name as rarity_name
      from public.items i
      join public.packs p on p.id = i.pack_id
      left join public.rarity_tiers rt on rt.category = p.category and rt.tier_level = i.rarity_tier_level
      order by p.category, p.price_cents, i.rarity_tier_level, i.base_value_cents
    `),
  ]);

  const byPack = new Map<string, PackGroup>();
  for (const pack of packsRes.rows) {
    byPack.set(pack.id, {
      pack_name: pack.name,
      category: pack.category,
      price_cents: Number(pack.price_cents),
      rows: [],
    });
  }
  for (const row of itemsRes.rows) {
    byPack.get(row.pack_id)?.rows.push(row);
  }
  return [...byPack.entries()];
}

/** Read-only flavor display for the two categories the source spreadsheets shipped rich data
 * for. Any other category (handbags, sneakers, whatever's added next) has no dedicated flavor
 * columns — it's not a gap, the generic manage-items table below already covers every field the
 * reveal/purchase engine itself reads; these are bonus display columns for cards/watches only. */
function CardsFlavor({ item }: { item: ItemRow }) {
  return (
    <>
      <TdStrong info={flavorInfo(item)}>{item.pokemon_name}</TdStrong>
      <Td>{item.card_title}</Td>
      <Td>{item.pokemon_type}</Td>
      <Td>{item.generation}</Td>
      <Td className="font-mono">{item.pokedex_number}</Td>
    </>
  );
}

function WatchesFlavor({ item }: { item: ItemRow }) {
  return (
    <>
      <TdStrong info={flavorInfo(item)}>{item.brand}</TdStrong>
      <Td>{item.watch_name}</Td>
      <Td>{item.model_name}</Td>
      <Td>{item.style}</Td>
      <Td>{item.case_material}</Td>
      <Td>{item.dial_color}</Td>
      <Td>{item.movement}</Td>
      <Td>{item.case_size}</Td>
    </>
  );
}

const selectClass =
  "w-16 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm text-text outline-none focus:border-accent";

/** The category-agnostic manage-items table — the surface that makes "add a category, then
 * actually stock it from the dashboard" true for any category, not just cards/watches. Editing
 * here only ever touches the generic fields (name, rarity level, value, texture url), the exact
 * same fields the reveal/purchase engine reads (packs.repository.ts) — flavor columns for
 * cards/watches are shown read-only alongside, never through this form. */
function ItemsTable({ pack }: { pack: PackGroup }) {
  const flavorHeaders =
    pack.category === "cards" ? (
      <>
        <Th>Pokémon</Th>
        <Th>Card Title</Th>
        <Th>Type</Th>
        <Th>Gen</Th>
        <Th>Pokédex #</Th>
      </>
    ) : pack.category === "watches" ? (
      <>
        <Th>Brand</Th>
        <Th>Watch</Th>
        <Th>Edition</Th>
        <Th>Style</Th>
        <Th>Case Material</Th>
        <Th>Dial Color</Th>
        <Th>Movement</Th>
        <Th>Size</Th>
      </>
    ) : null;

  return (
    <form action={updateItems} className="flex flex-col gap-3">
      <Table>
        <Thead>
          <tr>
            {flavorHeaders}
            <Th>Name</Th>
            <Th>Rarity</Th>
            <Th>Value ($)</Th>
            <Th>Texture URL</Th>
            <Th></Th>
          </tr>
        </Thead>
        <tbody>
          {pack.rows.map((item) => (
            <tr key={item.id}>
              {pack.category === "cards" ? (
                <CardsFlavor item={item} />
              ) : pack.category === "watches" ? (
                <WatchesFlavor item={item} />
              ) : null}
              <Td>
                <input
                  name={`item_${item.id}_name`}
                  defaultValue={item.name}
                  className="w-40 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm text-text outline-none focus:border-accent"
                />
              </Td>
              <Td>
                <select name={`item_${item.id}_rarityTierLevel`} defaultValue={item.rarity_tier_level} className={selectClass}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
                {item.rarity_name && <span className="ml-1 text-xs text-text-mute">{item.rarity_name}</span>}
              </Td>
              <Td>
                <input
                  name={`item_${item.id}_value`}
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={(Number(item.base_value_cents) / 100).toFixed(2)}
                  className="w-28 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm text-text outline-none focus:border-accent"
                />
              </Td>
              <Td>
                <input
                  name={`item_${item.id}_textureUrl`}
                  defaultValue={item.texture_url ?? ""}
                  placeholder="optional"
                  className="w-40 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm text-text outline-none focus:border-accent"
                />
              </Td>
              <Td>
                <Button
                  type="submit"
                  formAction={deleteItem}
                  name="id"
                  value={item.id}
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                >
                  Delete
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div>
        <Button type="submit">Save changes</Button>
      </div>
    </form>
  );
}

function AddItemForm({ packId }: { packId: string }) {
  return (
    <form action={createItem} className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-4">
      <input type="hidden" name="packId" value={packId} />
      <Field label="Name">
        <Input name="name" required />
      </Field>
      <Field label="Rarity level">
        <select
          name="rarityTierLevel"
          required
          defaultValue={1}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </Field>
      <Field label="Value ($)">
        <Input name="valueDollars" type="number" step="0.01" min="0" required />
      </Field>
      <Field label="Texture URL (optional)">
        <Input name="textureUrl" placeholder="optional" />
      </Field>
      <div className="col-span-2 sm:col-span-4">
        <Button type="submit">Add item</Button>
      </div>
    </form>
  );
}

export default async function CatalogPage() {
  const packs = await getCatalog();
  const total = packs.reduce((sum, [, p]) => sum + p.rows.length, 0);

  return (
    <div>
      <PageHeader
        title="Catalog"
        info="Every individual item that can be pulled from a pack, grouped by rarity tier, cheapest first — this is exactly the pool a pack draws from when a user rips it. Name, rarity level, value, and texture URL are editable and creatable here for any category — those are the exact fields the reveal/purchase engine reads. Cards/watches additionally show their rich source-spreadsheet flavor columns read-only alongside. Deleting is blocked once an item's actually been pulled by a real user — remove it from future slot odds instead."
        description={`${total} items across ${packs.length} packs. Click a pack to expand it.`}
      />

      <div className="flex flex-col gap-4">
        {packs.map(([packId, pack]) => (
          <CollapsibleCard
            key={packId}
            summary={
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold capitalize text-text">{pack.pack_name}</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-mute">{pack.category}</span>
                <span className="text-xs text-text-mute">
                  {fmt(pack.price_cents)} · {pack.rows.length} item{pack.rows.length === 1 ? "" : "s"}
                </span>
              </div>
            }
          >
            <div className="flex flex-col gap-4">
              {pack.rows.length > 0 ? (
                <ItemsTable pack={pack} />
              ) : (
                <p className="text-sm text-text-mute">No items yet — add one below.</p>
              )}
              <AddItemForm packId={packId} />
            </div>
          </CollapsibleCard>
        ))}
      </div>
    </div>
  );
}
