import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/requireAdmin";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/economics", label: "Economics" },
  { href: "/packs", label: "Packs" },
  { href: "/categories", label: "Categories" },
  { href: "/catalog", label: "Catalog" },
  { href: "/rarity-tiers", label: "Rarity Tiers" },
  { href: "/pressure-rules", label: "Pressure Rules" },
  { href: "/ownership-weights", label: "Duplicate Weights" },
  { href: "/platform-config", label: "Platform Config" },
  { href: "/marketplace-fees", label: "Marketplace Fees" },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <div className="flex min-h-screen">
      <nav className="flex w-56 flex-shrink-0 flex-col border-r border-border bg-surface px-4 py-6">
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-accent">
            ◈
          </span>
          <span className="text-sm font-bold tracking-tight text-text">GrailHaus Admin</span>
        </div>
        <ul className="flex flex-col gap-1">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-text-soft transition-colors hover:bg-surface-2 hover:text-text"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1 px-10 py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
