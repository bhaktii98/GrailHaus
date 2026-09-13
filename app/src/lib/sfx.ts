// Sound effects for the reveal flows (pack tear, card open, watch reveal) — a thin, imperative
// wrapper around expo-audio's non-hook API, since these fire from plain callbacks deep inside the
// reveal engines (useHoldToOpenDeck.grab, ChoreographyDriver's beat clock, flow engines' own
// handleTearComplete), not from a mounted component that could own a `useAudioPlayer` hook.
//
// Every source gets one persistent `AudioPlayer` (created lazily, on first use), reused via
// `seekTo(0)` + `play()` for every subsequent trigger — cheap and correct for these short, one-shot
// SFX, which in practice never need to overlap *with themselves* (a card can only open once at a
// time; a haptic beat track already spaces its own steps out). True overlapping polyphony (two
// different sounds at once) still works fine since each key owns its own player.
//
// Deliberately one-shot only, no looping/ambient bed anywhere — tried a continuous loop bound to
// the tear gesture's duration and it still read as unwanted background noise per explicit user
// feedback. Every sound here fires exactly once, tied to one real action (a tear completing, a
// gesture tick, a card flipping open), never sustained.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

const SOURCES = {
  // Generic beat-kind sounds — mirror HapticStep["kind"] (see engine/core/types.ts), used
  // wherever a haptic track already fires (HapticsTrack.ts, ChoreographyDriver.tsx) so every
  // watch reveal / grail-hunt beat gets a matching sound for free.
  light: require("../../assets/sounds/tick.wav"),
  medium: require("../../assets/sounds/click.wav"),
  heavy: require("../../assets/sounds/thud.wav"),
  success: require("../../assets/sounds/chime.wav"),
  // The physical pack-tear moment, shared by every card tier's flow engine.
  packTear: require("../../assets/sounds/pack-tear.wav"),
  // Per-card open/flip — useHoldToOpenDeck.grab (shared by every card tier's fan reveal) fires
  // this the instant a card flips face-up. User-supplied real audio, not a synthesized placeholder.
  cardOpen: require("../../assets/sounds/card-open.mp3"),
} as const;

export type SfxKey = keyof typeof SOURCES;

let players: Partial<Record<SfxKey, AudioPlayer>> | null = null;
let stopTimers: Partial<Record<SfxKey, ReturnType<typeof setTimeout>>> = {};
let audioModeSet = false;
let muted = false;

function ensurePlayer(key: SfxKey): AudioPlayer {
  if (!players) players = {};
  const existing = players[key];
  if (existing) return existing;
  const created = createAudioPlayer(SOURCES[key]);
  players[key] = created;
  return created;
}

/** Respect the phone's silent switch, same as every other app's UI sounds — these are a nice-to-
 * have layered on top of the haptics that already carry the reveal's feel, not something a user
 * expects to punch through a muted phone. Safe to call more than once (only the first call does
 * anything); cheap to call from App.tsx's boot path alongside the other one-time setup there. */
export async function initSfx(): Promise<void> {
  if (audioModeSet) return;
  audioModeSet = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: "mixWithOthers" });
  } catch {
    // Best-effort — a reveal missing its sound is not worth surfacing to the user.
  }
}

/** `maxDurationMs`, when given, cuts the sound off after that long instead of letting the whole
 * source file play out — for a source that's genuinely longer than the on-screen moment it's
 * tied to (e.g. `cardOpen`'s ~3s source vs. the ~800ms flip animation it should only last as
 * long as), so it reads as "while flipping," not "an unrelated clip that keeps going after." */
export function playSfx(key: SfxKey, maxDurationMs?: number): void {
  if (muted) return;
  try {
    const player = ensurePlayer(key);
    const pendingStop = stopTimers[key];
    if (pendingStop) clearTimeout(pendingStop);
    player.seekTo(0);
    player.play();
    if (maxDurationMs != null) {
      stopTimers[key] = setTimeout(() => {
        try {
          player.pause();
        } catch {
          // Best-effort.
        }
      }, maxDurationMs);
    }
  } catch {
    // Same best-effort spirit as initSfx above — never let a sound glitch break a reveal.
  }
}

export function setSfxMuted(value: boolean): void {
  muted = value;
}
