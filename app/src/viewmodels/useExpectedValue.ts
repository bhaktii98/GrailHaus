import { useMemo } from "react";
import type { PackSku } from "@grailhaus/shared";
import { computeExpectedValueCents } from "@grailhaus/shared";

export interface ExpectedValue {
  expectedCents: number;
  /** What fraction of the price the house expects to keep, as a whole percent (0-100). */
  houseEdgePercent: number;
}

/**
 * "Expected contents $X · edge Y%" — thin wrapper around the shared package's
 * own `computeExpectedValueCents` (already used server-side; previously had
 * no caller in the app) plus the house-edge percent the mockup pairs it
 * with. Kept as a hook rather than an inline calculation so every screen
 * that shows this number computes it the same way.
 */
export function useExpectedValue(sku: PackSku | null): ExpectedValue | null {
  return useMemo(() => {
    if (!sku || sku.slotProbabilities.length === 0) return null;
    const expectedCents = computeExpectedValueCents(sku);
    const houseEdgePercent = sku.priceCents > 0 ? Math.max(0, (1 - expectedCents / sku.priceCents) * 100) : 0;
    return { expectedCents, houseEdgePercent };
  }, [sku]);
}
