// Tracks whether this session's device can actually run the r3f/expo-gl 3D reveal path, so a
// device where it can't gets a 2D fallback instead of a white screen — the trial's explicit
// requirement ("A fallback path for devices where your renderer isn't supported. Detect it,
// degrade to a 2D reveal that still feels good.").
//
// Detection has two paths, because the failures observed on-device were two different shapes:
//
// 1. A JS-level throw during react-three-fiber's reconciliation / expo-gl's context creation —
//    a mount inside Renderer3DBoundary (an Error Boundary) catches this cleanly.
// 2. Silent degradation: expo-gl/three.js mount without ever throwing, but three.js's own
//    WebGLRenderer logs a WARN that it's missing a GPU capability it actually needs — seen
//    on-device as "EXT_color_buffer_float extension not supported". Nothing throws, so an Error
//    Boundary alone never sees it. installRendererWarningWatch() patches console.warn/console.log
//    once at app start to catch exactly this signal (a narrow, explicit substring list — ordinary
//    deprecation noise like "THREE.Clock: deprecated" or Skia's path-API deprecations, and
//    expo-gl's own routine "doesn't support this parameter yet" LOG-level notices, are left
//    alone — see BAD_SIGNALS below for why the latter was tried and removed) and flips the same
//    flag path 1 uses. Every Renderer3DBoundary currently mounted is subscribed and swaps to its
//    2D fallback live, the moment the warning fires — no reload needed.
//
// Known limitation, stated plainly rather than overclaimed: a genuine native-level crash (a
// segfault below the JS bridge, not a thrown JS exception or a console warning) cannot be caught
// by either path and would take the whole app down before this flag is ever set. The safer
// long-run fix is a proactive headless GL probe run once at app boot, before any reveal screen is
// reached — noted as a follow-up in the README rather than built here, since both failure modes
// actually observed are covered.
//
// Manual override, for testing either path on demand: set EXPO_PUBLIC_FORCE_2D_REVEAL=1 in
// app/.env (Metro must be restarted — EXPO_PUBLIC_* vars are baked at bundle time, a reload isn't
// enough) to force every reveal onto the 2D path regardless of what the 3D one does.
const FORCED_2D = process.env.EXPO_PUBLIC_FORCE_2D_REVEAL === "1";

let supports3D: boolean | null = FORCED_2D ? false : null; // null = untested this session
const listeners = new Set<() => void>();

export function getRenderer3DCapability(): boolean | null {
  return supports3D;
}

export function markRenderer3DUnsupported(reason: unknown): void {
  if (supports3D === false) return;
  supports3D = false;
  // eslint-disable-next-line no-console
  console.warn("[GrailHaus] 3D reveal renderer unsupported on this device — falling back to 2D.", reason);
  listeners.forEach((fn) => fn());
}

export function markRenderer3DSupported(): void {
  supports3D = true;
}

/** Renderer3DBoundary calls this on mount/unmount so a live 3D instance can swap to its 2D
 * fallback the moment markRenderer3DUnsupported() fires from anywhere — including from the
 * console warning watch below, which has no other way to reach an already-mounted component. */
export function subscribeRenderer3DCapability(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Warning text that means "the 3D path is silently degraded," not "something merely deprecated
// still works fine" — narrow and explicit on purpose, see the file header.
//
// "gl.pixelStorei() doesn't support this parameter yet!" was in this list and has been removed:
// on real testing it fired on *every single* 3D mount, unconditionally, before the scene had any
// chance to actually render — which made it impossible to tell whether the pack was genuinely
// invisible or just typical expo-gl noise. It's a LOG-level notice about one unsupported pixel-
// unpack parameter, not a WARN from three.js about a missing capability the renderer actually
// needs (that's what EXT_color_buffer_float, below, is) — expo-gl likely no-ops it with a sane
// default rather than breaking texture uploads outright. Treating it as fatal was the detection
// being wrong, not the renderer.
const BAD_SIGNALS = ["ext_color_buffer_float extension not supported"];

let watchInstalled = false;

/** Call once, as early as possible (this module's own import is early enough for every current
 * caller). Idempotent — a second call is a no-op. */
export function installRendererWarningWatch(): void {
  if (watchInstalled) return;
  watchInstalled = true;

  const wrap = (method: "warn" | "log") => {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      original(...args);
      if (supports3D === false) return;
      const text = args.map((a) => (typeof a === "string" ? a : "")).join(" ").toLowerCase();
      if (BAD_SIGNALS.some((signal) => text.includes(signal))) {
        markRenderer3DUnsupported(args[0]);
      }
    };
  };
  wrap("warn");
  wrap("log");
}

installRendererWarningWatch();

/** Test-only — resets the session's cached capability so a test can exercise both paths. */
export function __resetRendererCapabilityForTest(): void {
  supports3D = FORCED_2D ? false : null;
}
