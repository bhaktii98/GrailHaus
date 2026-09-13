import Link from "next/link";
import { pool } from "@/lib/db";
import { deleteCategory } from "@/lib/actions";
import { Button, PageHeader } from "@/components/ui";

interface CategoryListRow {
  id: string;
  label: string;
  mesh_archetype: string;
  palette_background: string;
  palette_accent: string;
}

const linkButtonClass =
  "flex flex-1 items-center justify-center rounded-lg bg-transparent px-3 py-1.5 text-sm font-semibold text-text-soft transition-colors hover:text-text";

async function getCategories() {
  const res = await pool.query<CategoryListRow>(
    "select id, label, mesh_archetype, palette_background, palette_accent from public.categories order by sort_order, id"
  );
  return res.rows;
}

function CategoryCard({ category }: { category: CategoryListRow }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <span
          className="h-9 w-9 shrink-0 rounded-full border border-border"
          style={{
            background: `linear-gradient(135deg, ${category.palette_background} 50%, ${category.palette_accent} 50%)`,
          }}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{category.label}</p>
          <p className="truncate text-xs text-text-mute">
            {category.id} · {category.mesh_archetype}
          </p>
        </div>
      </div>
      <div className="flex gap-2 border-t border-border pt-3">
        <Link href={`/categories/${category.id}`} className={linkButtonClass}>
          View
        </Link>
        <Link href={`/categories/${category.id}/edit`} className={linkButtonClass}>
          Edit
        </Link>
        <form action={deleteCategory} className="flex flex-1">
          <input type="hidden" name="id" value={category.id} />
          <Button type="submit" variant="ghost" className="w-full text-red-400 hover:text-red-300">
            Delete
          </Button>
        </form>
      </div>
    </div>
  );
}

function AddCategoryCard() {
  return (
    <Link
      href="/categories/new"
      className="flex min-h-[116px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-text-mute transition-colors hover:border-accent hover:text-accent"
    >
      <span className="text-2xl leading-none">+</span>
      <span className="text-sm font-medium">Add category</span>
    </Link>
  );
}

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div>
      <PageHeader
        title="Categories"
        info="This is the whole reveal *personality* for a category — palette, camera, lighting, gesture feel, timing, haptics, and which 3D mesh archetype it uses — as data, not a hardcoded file in the app. The mobile app fetches this list at runtime (GET /categories). Adding a genuinely new category (e.g. handbags) is: create it here, then go set up its rarity tiers, pack SKUs, and catalog items same as any other category."
        description="Every category's reveal engine config, backend-driven and admin-editable."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <CategoryCard key={c.id} category={c} />
        ))}
        <AddCategoryCard />
      </div>
    </div>
  );
}
