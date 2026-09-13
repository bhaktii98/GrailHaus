import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { CategoryForm, type CategoryRow } from "../../CategoryForm";

async function getCategory(id: string) {
  const res = await pool.query<CategoryRow>("select * from public.categories where id = $1", [id]);
  return res.rows[0] ?? null;
}

export default async function CategoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await getCategory(id);
  if (!category) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${category.label}`} description={category.id} />
      <div className="mb-6">
        <Link href={`/categories/${category.id}`} className="text-sm text-text-mute hover:text-text">
          ← Back to view
        </Link>
      </div>
      <CategoryForm category={category} />
    </div>
  );
}
