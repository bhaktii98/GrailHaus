import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { profileService } from "../services/profileService";
import { useSessionStore } from "../state/sessionStore";
import { useAuthStore } from "../state/authStore";

/**
 * ViewModel for session/balance. Views read this hook only — they never call
 * profileService or the session store directly. The underlying query only
 * runs once signed in — `/me` requires an app session now (see modules/auth).
 */
export function useSessionViewModel() {
  const setProfile = useSessionStore((s) => s.setProfile);
  const profile = useSessionStore((s) => s.profile);
  const isSignedIn = useAuthStore((s) => s.token != null);

  const query = useQuery({
    queryKey: ["profile", "me"],
    queryFn: profileService.getCurrent,
    enabled: isSignedIn,
  });

  useEffect(() => {
    if (query.data) setProfile(query.data);
  }, [query.data, setProfile]);

  return {
    profile: isSignedIn ? profile : null,
    balanceCents: isSignedIn ? profile?.balanceCents ?? null : null,
    isSignedIn,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}
