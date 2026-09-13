import { create } from "zustand";

interface OnboardingState {
  /** null = still reading the persisted flag at boot. */
  needsOnboarding: boolean | null;
  setNeedsOnboarding: (value: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  needsOnboarding: null,
  setNeedsOnboarding: (needsOnboarding) => set({ needsOnboarding }),
}));
