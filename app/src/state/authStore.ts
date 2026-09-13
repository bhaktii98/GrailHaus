import { create } from "zustand";

interface AuthState {
  /** GrailHaus's own app JWT (see server/modules/auth) — not a Supabase session. */
  token: string | null;
  isReady: boolean;
  isSheetOpen: boolean;
  pendingAction: (() => void) | null;
  /** The signed-in account sheet (profile + sign out) — separate from `isSheetOpen`,
   * which is the signed-out sign-in/register sheet. */
  isAccountSheetOpen: boolean;
  setToken: (token: string | null) => void;
  setReady: (ready: boolean) => void;
  /** Runs `action` immediately if signed in; otherwise opens the auth sheet and
   * stashes `action` to run once sign-in completes. This is how the app stays
   * browsable without a login wall — auth surfaces only on intent. */
  requireAuth: (action: () => void) => void;
  closeSheet: () => void;
  resolvePendingAction: () => void;
  openAccountSheet: () => void;
  closeAccountSheet: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  isReady: false,
  isSheetOpen: false,
  pendingAction: null,
  isAccountSheetOpen: false,
  setToken: (token) => set({ token }),
  setReady: (isReady) => set({ isReady }),
  requireAuth: (action) => {
    if (get().token) {
      action();
      return;
    }
    set({ isSheetOpen: true, pendingAction: action });
  },
  closeSheet: () => set({ isSheetOpen: false, pendingAction: null }),
  resolvePendingAction: () => {
    const action = get().pendingAction;
    set({ isSheetOpen: false, pendingAction: null });
    action?.();
  },
  openAccountSheet: () => set({ isAccountSheetOpen: true }),
  closeAccountSheet: () => set({ isAccountSheetOpen: false }),
}));
