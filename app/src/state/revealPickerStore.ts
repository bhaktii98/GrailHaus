import { create } from "zustand";

interface RevealPickerState {
  visible: boolean;
  open: () => void;
  close: () => void;
}

/**
 * Drives the "Reveal" tab's category-picker sheet (RevealPickerSheet.tsx / PillTabBar.tsx) — a
 * plain visibility flag, not local state on any one screen, since the tab bar that toggles it sits
 * above every screen regardless of which tab is currently focused. Mirrors authStore's own
 * isAccountSheetOpen/openAccountSheet/closeAccountSheet shape.
 */
export const useRevealPickerStore = create<RevealPickerState>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}));
