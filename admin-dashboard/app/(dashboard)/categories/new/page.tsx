import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { CategoryForm } from "../CategoryForm";

export default function CategoryNewPage() {
  return (
    <div>
      <PageHeader
        title="New category"
        description={'id becomes the value packs.category references — lowercase, no spaces, e.g. "handbags". Can\'t be changed after creation.'}
      />
      <div className="mb-6">
        <Link href="/categories" className="text-sm text-text-mute hover:text-text">
          ← Back to categories
        </Link>
      </div>
      <CategoryForm category={null} />
    </div>
  );
}
