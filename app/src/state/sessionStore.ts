import { create } from "zustand";
import type { Profile } from "@grailhaus/shared";

interface SessionState {
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
}

/** Cross-screen session state (balance, profile). Server-state fetching itself lives in
 * viewmodels via React Query — this store just holds the result other screens also need. */
export const useSessionStore = create<SessionState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
}));
