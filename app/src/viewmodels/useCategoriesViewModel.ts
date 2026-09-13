import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CategoryReveal } from "@grailhaus/shared";
import { categoriesService } from "../services/categoriesService";

/**
 * The backend-driven category list (palette, camera, lighting, gesture, timing, haptics, mesh
 * archetype) — what makes a category's whole reveal personality, and the label/colors any
 * screen shows for it, a row in the `categories` table instead of a hardcoded `*.config.tsx`
 * file or a `Record<"cards"|"watches", T>` lookup table scattered across screens. A category
 * added via the admin dashboard (e.g. "handbags") shows up here — and therefore everywhere that
 * reads from this hook — with no app code change.
 *
 * Long staleTime: this list changes only when an admin edits it, not per-user-action, so there's
 * no reason to refetch on every screen focus the way portfolio/marketplace data does.
 */
export function useCategoriesViewModel() {
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesService.list,
    staleTime: 5 * 60 * 1000,
  });

  const categories = query.data ?? [];
  const byId = useMemo(() => {
    const map = new Map<string, CategoryReveal>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  return {
    categories,
    byId,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: () => query.refetch(),
  };
}
