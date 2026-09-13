import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authService } from "../services/authService";
import { profileService } from "../services/profileService";
import { useAuthStore } from "../state/authStore";
import { auth as authCopy } from "../content/copy";

export type AuthStep = "welcome" | "register" | "signin" | "claim-username" | "welcome-back";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const USERNAME_CHECK_DEBOUNCE_MS = 400;

function messageFor(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Drives the whole account sheet — welcome, register/sign-in, and (for a
 * brand-new account) the mandatory Collector ID claim that follows it.
 * `initialStep` lets AuthProvider drop a signed-in-but-unclaimed user
 * straight into "claim-username" (e.g. the app was killed between
 * registering and claiming) instead of replaying the welcome screen.
 * Nothing here closes the sheet on its own — `finish()` is the only exit,
 * called once the account is genuinely usable.
 */
export function useAuthViewModel(initialStep: AuthStep = "welcome") {
  const [step, setStep] = useState<AuthStep>(initialStep);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimedUsername, setClaimedUsername] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameCheckToken = useRef(0);
  const queryClient = useQueryClient();

  useEffect(
    () => () => {
      if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);
    },
    []
  );

  function goTo(next: AuthStep) {
    setError(null);
    setStep(next);
  }

  async function afterAuthenticated() {
    const profile = await profileService.getCurrent();
    queryClient.setQueryData(["profile", "me"], profile);
    if (profile.username) {
      setClaimedUsername(profile.username);
      setStep("welcome-back");
    } else {
      setStep("claim-username");
    }
  }

  async function register(email: string, password: string, confirmPassword: string) {
    setError(null);
    if (password.length < 8) {
      setError(authCopy.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(authCopy.passwordMismatch);
      return;
    }
    setSubmitting(true);
    try {
      await authService.signUp(email.trim(), password);
      await afterAuthenticated();
    } catch (err) {
      setError(messageFor(err, "Couldn't create your account — try again."));
    } finally {
      setSubmitting(false);
    }
  }

  async function signIn(email: string, password: string) {
    setError(null);
    setSubmitting(true);
    try {
      await authService.signIn(email.trim(), password);
      await afterAuthenticated();
    } catch (err) {
      setError(messageFor(err, "That email and password don't match."));
    } finally {
      setSubmitting(false);
    }
  }

  function checkUsername(raw: string) {
    const token = ++usernameCheckToken.current;
    if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);

    const normalized = raw.trim().toLowerCase();
    if (normalized.length === 0) {
      setUsernameStatus("idle");
      return;
    }
    if (!USERNAME_PATTERN.test(normalized)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    usernameCheckTimer.current = setTimeout(async () => {
      try {
        const result = await authService.checkUsernameAvailability(normalized);
        if (usernameCheckToken.current !== token) return;
        setUsernameStatus(result.available ? "available" : "taken");
      } catch {
        if (usernameCheckToken.current !== token) return;
        setUsernameStatus("idle");
      }
    }, USERNAME_CHECK_DEBOUNCE_MS);
  }

  async function claimUsername(raw: string) {
    if (usernameStatus !== "available") return;
    setError(null);
    setSubmitting(true);
    try {
      const { username } = await authService.claimUsername(raw.trim().toLowerCase());
      const profile = await profileService.getCurrent();
      queryClient.setQueryData(["profile", "me"], profile);
      setClaimedUsername(username);
      setStep("welcome-back");
    } catch (err) {
      setError(messageFor(err, "Couldn't claim that Collector ID — try again."));
    } finally {
      setSubmitting(false);
    }
  }

  function finish() {
    useAuthStore.getState().resolvePendingAction();
  }

  return {
    step,
    isSubmitting,
    error,
    claimedUsername,
    usernameStatus,
    goTo,
    register,
    signIn,
    checkUsername,
    claimUsername,
    finish,
  };
}
