import type { Profile } from "@grailhaus/shared";
import { authToken } from "../lib/authToken";
import { useAuthStore } from "../state/authStore";
import { apiGet, apiPost } from "./apiClient";

interface AuthResponse {
  token: string;
  profile: Profile;
}

/** Establishes a session both ways — persisted (SecureStore, survives app restarts,
 * read by apiClient) and reactive (the Zustand store, read by every isSignedIn check).
 * There's no live "auth state changed" event source now that this isn't Supabase, so
 * the service that mints/clears a session is what keeps both in sync, not a listener. */
async function establishSession(token: string): Promise<void> {
  await authToken.set(token);
  useAuthStore.getState().setToken(token);
}

export const authService = {
  /** Creates the account and returns a session immediately — no email confirmation step,
   * since there's no email sender in this app's own auth (see server/modules/auth). */
  async signUp(email: string, password: string): Promise<Profile> {
    const { token, profile } = await apiPost<AuthResponse>("/auth/signup", { email, password });
    await establishSession(token);
    return profile;
  },

  async signIn(email: string, password: string): Promise<Profile> {
    const { token, profile } = await apiPost<AuthResponse>("/auth/signin", { email, password });
    await establishSession(token);
    return profile;
  },

  async signOut(): Promise<void> {
    await authToken.clear();
    useAuthStore.getState().setToken(null);
  },

  getToken(): Promise<string | null> {
    return authToken.get();
  },

  checkUsernameAvailability(username: string) {
    return apiGet<{ username: string; available: boolean }>(`/username/availability?u=${encodeURIComponent(username)}`);
  },

  claimUsername(username: string) {
    return apiPost<{ username: string }>("/username", { username });
  },
};
