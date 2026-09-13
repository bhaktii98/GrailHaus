import { create } from "zustand";

interface PressureStoreState {
  /** packId -> consecutive pulls without a "qualifying" (pity-resetting) result. */
  byPackId: Record<string, number>;
  get: (packId: string) => number;
  set: (packId: string, value: number) => void;
}

/**
 * Client-side stand-in for pity/guarantee state — TODO: move server-side once
 * the real /purchase endpoint exists (Deliverable 2). In-memory only and
 * scoped per pack SKU, never globally per user or per category, so pressure
 * built on a cheap pack can never be cashed in on an expensive one.
 */
export const usePressureStore = create<PressureStoreState>((set, get) => ({
  byPackId: {},
  get: (packId) => get().byPackId[packId] ?? 0,
  set: (packId, value) =>
    set((state) => ({ byPackId: { ...state.byPackId, [packId]: value } })),
}));
