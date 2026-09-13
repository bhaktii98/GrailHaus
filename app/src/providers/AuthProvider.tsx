import { useEffect, useRef, type ReactNode } from "react";
import { AppState, Modal, type AppStateStatus } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authToken } from "../lib/authToken";
import { profileService } from "../services/profileService";
import { reconcilePendingPurchase } from "../lib/pendingPurchase";
import { usePackFlowViewModel } from "../viewmodels/usePackFlowViewModel";
import { navigateToReveal } from "../navigation/navigationRef";
import { useAuthStore } from "../state/authStore";
import { AuthScreen } from "../screens/AuthScreen";
import { AccountScreen } from "../screens/AccountScreen";

/**
 * Root-level wiring: hydrates the auth store from the token persisted in
 * SecureStore (see lib/authToken.ts — there's no live "auth state changed"
 * event source now that this isn't Supabase; sign-in/up/out set the store
 * directly, see authService.ts), and hosts the account sheet that
 * `requireAuth()` (see state/authStore.ts) opens on demand. Nothing here is
 * a ViewModel — this is app-shell plumbing, same role as the
 * QueryClientProvider.
 *
 * The account sheet also force-reopens, independent of `isSheetOpen`,
 * whenever there's a session with no Collector ID claimed yet — the one way
 * that can happen is the app getting killed between registering and
 * claiming (the normal in-flow case is handled inside the sheet itself,
 * before it ever closes). This is what makes "every account has a
 * Collector ID" actually hold, not just true for the happy path.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const setToken = useAuthStore((s) => s.setToken);
  const setReady = useAuthStore((s) => s.setReady);
  const token = useAuthStore((s) => s.token);
  const isSheetOpen = useAuthStore((s) => s.isSheetOpen);
  const closeSheet = useAuthStore((s) => s.closeSheet);
  const isAccountSheetOpen = useAuthStore((s) => s.isAccountSheetOpen);
  const closeAccountSheet = useAuthStore((s) => s.closeAccountSheet);
  const queryClient = useQueryClient();
  const { resumeFlow } = usePackFlowViewModel();
  // Stashed in a ref so the AppState listener below (registered once) always calls the latest
  // closure without needing to re-subscribe every render — `resumeFlow` is stable in practice
  // (zustand actions never change identity) but this keeps the effect's dependency array honest.
  const resumeFlowRef = useRef(resumeFlow);
  resumeFlowRef.current = resumeFlow;

  useEffect(() => {
    authToken.get().then((stored) => {
      setToken(stored);
      setReady(true);
    });
  }, [setToken, setReady]);

  /**
   * Reconciles both halves of "any process at any step should be resumable": pendingPurchase.ts
   * (was a POST /purchase's outcome ever learned) and activeReveal.ts (was its reveal ever
   * shown). Runs at boot with a session, AND every time the app comes back to the foreground —
   * an incoming call or the app switcher never kills the process, so waiting for a cold start
   * alone would miss the far more common "backgrounded mid-purchase, network finished while
   * away" case entirely.
   */
  async function reconcileAndResume() {
    await reconcilePendingPurchase();
    const resumed = await resumeFlowRef.current();
    if (resumed) navigateToReveal();
    queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
    queryClient.invalidateQueries({ queryKey: ["portfolio", "me"] });
  }

  useEffect(() => {
    if (!token) return;
    reconcileAndResume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token != null]);

  useEffect(() => {
    if (!token) return undefined;
    function onChange(state: AppStateStatus) {
      if (state === "active") reconcileAndResume();
    }
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token != null]);

  const profileQuery = useQuery({
    queryKey: ["profile", "me"],
    queryFn: profileService.getCurrent,
    enabled: token != null,
  });

  const needsUsername = token != null && profileQuery.data != null && !profileQuery.data.username;
  const visible = isSheetOpen || needsUsername;

  return (
    <>
      {children}
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={needsUsername ? undefined : closeSheet}
      >
        <AuthScreen
          key={needsUsername ? "claim" : "sheet"}
          onClose={needsUsername ? undefined : closeSheet}
          initialStep={needsUsername ? "claim-username" : undefined}
        />
      </Modal>
      <Modal visible={isAccountSheetOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeAccountSheet}>
        <AccountScreen onClose={closeAccountSheet} />
      </Modal>
    </>
  );
}
