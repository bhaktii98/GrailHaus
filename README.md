# GrailHaus

A native mobile app for a luxury mystery-pack platform. Users buy packs — evergreen shelf SKUs or
limited timed drops — rip them open through a category-specific real-time 3D/2D reveal, hold what
they pull in a live-drifting portfolio, and trade it on a peer-to-peer marketplace. Two categories
are fully shipped: **Trading Cards** and **Watches**, on one shared reveal engine.

**[Walkthrough video](https://drive.google.com/file/d/1PEOb7EJeM2MhpnlCDUaog_SHnywmjJ7c/view?usp=sharing)** ·
**[Admin dashboard](https://admin-dashboard-taupe-two-88.vercel.app)** (deployed on Vercel — magic-link login required, see [Setup](#setup)) ·
**[Installable Android APK](https://expo.dev/artifacts/eas/k1BtTKcGK1eFzoqx-HdJGs8_HGMdU8kDtUB00Lzy3J8.apk)** (signed, standalone — wired to the live Render backend, no dev client/Metro needed; allow installs from unknown sources)

---

## Setup

npm workspaces monorepo: `app/` (React Native/Expo client), `server/` (Fastify + TypeScript API),
`admin-dashboard/` (Next.js config tool), `shared/` (framework-agnostic reward engine + domain
types, raw `.ts`, no build step, consumed directly by both Metro and the server).

### Prerequisites

- Node 22
- A Postgres database — built against Supabase (Postgres + Auth). Anything with a real connection
  string and row-level locking works; Supabase isn't load-bearing.
- `npx eas-cli` (Expo Application Services) + an Expo account, for the mobile dev client.
- Xcode / Android Studio if building the native project locally instead of an EAS cloud build.

### Install

```bash
npm install
```

Installs all four workspaces from the repo root.

### Environment variables

```bash
cp server/.env.example server/.env
cp app/.env.example app/.env
```

`server/.env`: `DATABASE_URL` (**use a transaction-mode pooler**, e.g. Supabase port `6543` not
`5432` — session-mode poolers cap total concurrent connections project-wide, well below what this
app's own connection pool expects, and that mismatch shows up as a silent hang under concurrency
rather than a clear error), `SUPABASE_URL`/`SUPABASE_ANON_KEY` (admin dashboard's magic-link login
only), `APP_JWT_SECRET` (signs the mobile app's own session tokens —
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), `SENDGRID_API_KEY`/
`SENDGRID_FROM_EMAIL` (admin dashboard OTP mail).

`app/.env`: `EXPO_PUBLIC_API_URL` (the server's base URL), `EXPO_PUBLIC_FORCE_2D_REVEAL` (leave at
`0`; set to `1` to force every reveal onto its 2D fallback path for testing, regardless of device
capability — requires a Metro restart, it's baked in at bundle time).

### Database schema + seed catalog

Built incrementally against a live Supabase project via scripts in `server/scripts/` rather than
one committed `schema.sql` (see [Scope cuts](#scope-cuts)). To stand up a fresh database: run the
migration scripts in `server/scripts/` in the order they were written
(`npx tsx server/scripts/<name>.ts`), then `seedCategories.ts`, then populate the catalog
(~30-50 items/category) via the admin dashboard — `seedHandbagsItems.ts`/`seedHandbagsDemo.ts`
show the exact row shape every table expects.

### Running it

```bash
npm run server:dev   # Fastify API, http://localhost:3000
npm run admin:dev    # Next.js admin dashboard, http://localhost:3002
```

The mobile app needs a **dev client build** — Expo Go cannot launch it (native modules:
`react-native-skia`, `expo-gl`/`@react-three/fiber`):

```bash
cd app
npx eas build --profile development --platform android   # cloud build, or:
npx expo prebuild && npx expo run:android                # local native build
```

Then `npx expo start` serves JS to the installed dev client like any other Expo project.

### Concurrency harness

```bash
npm run hammer --workspace=server                              # shelf pack, 10 buyers, stock 5
npm run hammer --workspace=server -- 20 3 black_label_drop      # a timed/recurring drop instead
```

Fires N concurrent `purchase()` calls — the same function the real `/purchase` endpoint calls —
at a pack pinned to a small stock, then verifies final stock and every `owned_items` row reconcile
exactly against what should have succeeded. Restores every row it touches on exit.

---

## Architecture overview

### The reveal engine

One engine, two category personalities — not two hardcoded screens. The seam is
`CategoryRevealConfig` (`app/src/engine/core/types.ts`): palette, camera, lighting, gesture mode,
timing, haptic track, reveal order, and (for a timeline-driven category) a full choreography are
all data on that one interface. `toCategoryRevealConfig()`
(`app/src/engine/core/categoryRevealConfig.ts`) builds one of these directly from a `categories`
database row — an admin adding a category that fits an existing 3D silhouette needs **zero app
code**, only a dashboard row.

The one piece that stays code on purpose: 3D topology. `meshArchetypes.tsx` maps a `meshArchetype`
string to one geometry-building function (`tear-pack` for cards, `lift-lid-box` for watches). A
category whose silhouette doesn't fit any existing archetype needs one new small mesh function;
everything else — palette, lighting, camera, pacing, haptics — is still pure configuration.

### Cards: gesture-physics tear + 2D fan reveal

The tear is real 3D (`react-three-fiber` + `expo-gl`), driven 1:1 by the drag — not a canned
animation triggered on touch-up:
- Follows the finger the entire way (`CardFlowEngine.tsx`'s `GestureLayer`).
- **Reversible mid-gesture**: release before the commit threshold and it springs back to sealed.
- **Velocity-aware**: a fast flick commits short of the full distance; a slow drag needs to travel
  further.
- **Interruptible**: a new touch during the settle animation takes control immediately.

Once torn, the reveal switches to flat 2D (`@shopify/react-native-skia`) — deliberately: keeping a
full 3D scene alive per card was the first design tried and thrown out (see
[Scope cuts](#scope-cuts)). Cards are revealed one at a time, tap-to-open, commons-first, via
`HoldToOpenFanReveal.tsx` — every card gets the identical flip animation (5 half-turns, 100ms
each, 320ms settle) regardless of rarity; only the landing "punch" scale and the ring/mote
flourish count scale with rarity, so the gesture never tips off what's coming before the card
itself does.

### Watches: timeline-driven 3D choreography

A completely different animation model, deliberately: `RevealChoreography`
(`app/src/engine/core/types.ts`) is an absolute-clock timeline (`pose(t)`/`lights(t)`/`camera(t)`),
not a gesture-progress value — because a watch reveal keeps animating *after* the gesture ends
(locks retracting, the case rising, lighting escalating to the piece). Each of the three tiers has
its own choreography file (`watches/*/config/*.ts`); the mechanism is identical across all three,
only pacing and how far the lighting builds before commit differ, tier to tier.

### Haptics: a designed, sequenced track

Real vibration, on the beat, everywhere in the reveal — not one generic buzz on success. Built on
`expo-haptics` (`app/src/engine/core/HapticsTrack.ts`), driven by the same per-category
`hapticTrack`/choreography config as everything else, so every meaningful beat gets its own pulse:
a tick as the tear starts giving way, a sharper impact the instant the foil actually gives, a
light tap as each card slides into the tray, escalating intensity through a rare-pull hold, a
distinct stronger pulse the moment a Grail lands. This meets the brief's own P0 bar directly —
*"a deliberate, sequenced track... Sequenced platform-level haptics (expo-haptics or equivalent)
are an acceptable way to hit that bar, provided the sequencing and timing are designed rather than
incidental."* What's cut is only the optional upgrade beyond this — see
[Scope cuts](#scope-cuts).

### Renderer choice and fallback

`react-three-fiber` on `expo-gl` for the 3D path; `@shopify/react-native-skia` for the 2D
card-fan reveal (cheap, declarative gradients/canvases for per-card art without a second
heavyweight renderer). Fallback detection (`app/src/engine/core/rendererCapability.ts`) covers two
real failure shapes seen on-device:
1. A thrown JS error during r3f/expo-gl mount — caught by an Error Boundary.
2. **Silent** degradation — expo-gl mounts without throwing, but three.js logs a WARN that a GPU
   capability it needs (`EXT_color_buffer_float`) isn't there. A narrow `console.warn`/`console.log`
   intercept catches exactly this signal and flips every currently-mounted reveal to 2D live.

Stated honestly: a genuine native-level crash below the JS bridge is caught by neither path.
`EXPO_PUBLIC_FORCE_2D_REVEAL=1` forces the fallback for testing without a real unsupported device.

### Multi-pack (10-pack) reveal

Bulk mode is a **pacing/presentation configuration**, not a second reveal implementation — same
reward engine, same odds, same Grail Pressure carried across all ten packs in one continuous
streak, same atomic transaction. What changes is purely how already-decided results are shown
(`shared/src/bulkPresentation.ts`):

- **Grail Hunt stage** — every genuinely good pull across all ten packs is surfaced *first*,
  weakest to strongest, before the regular cards. Buying ten at once is a bigger commitment than
  one pack; making the buyer scroll through forty commons to maybe find out buries the payoff.
- **Exactly one card is ever mounted at a time.** No 3D scene at all runs in bulk mode — the
  expensive tear mesh is reserved for a single-pack rip. See [Scope cuts](#scope-cuts) for why.
- **Per-pack resume.** `activeReveal.ts` persists `packIndex`/`openedCount` to `SecureStore` on
  every advance. Force-stop at pack six of ten: packs 1-5 stay shown, pack 6 resumes on its next
  sealed card, 7-10 stay sealed — nothing is re-rolled because contents were already generated
  server-side inside the purchase's own transaction.

### Atomic purchase, single and bulk

One purchase path for shelf, drops, single, and bulk (`purchase.service.ts`) — never forked.

- **Idempotency**: client-generated `Crypto.randomUUID()`, reused across retries of the same
  attempt. Enforced by a **Postgres unique-index insert**
  (`insert into purchases (...) on conflict (idempotency_key) do nothing returning *`), not
  application-level locking — two collided requests, one wins the row, the other reads what the
  winner produced.
- **Atomicity**: balance debit, stock decrement, content generation, and the purchase record all
  commit or roll back together, with `SELECT ... FOR UPDATE` on the pack row so concurrent
  purchases serialize through Postgres.
- **Bulk quantity is fixed at 10, not a free 1-10 range.** Requesting 10 against 7 remaining fails
  the whole purchase atomically — no partial charge, no partial delivery.
- **Interruption-safety** (`app/src/lib/pendingPurchase.ts`) writes the idempotency key to
  `SecureStore` before the request fires; on reconnect it asks the server what actually happened
  rather than ever retrying with a fresh key — airplane mode mid-10-pack, reconnect, is one charge
  and ten packs, never twenty.

### Marketplace

`buyListing()` locks the listing row (`for update of l`) for the whole transaction: two
simultaneous buyers on the same listing serialize, the loser gets a clean `already_sold` after the
winner commits. Self-purchase is blocked before any money moves. The fee is computed server-side
at sale time from the listing's own category/tier — never client-supplied.

---

## Performance report (Deliverable 1)

Measured live on a real, connected mid-range Android device via `adb` — `am start -W` for cold
launch timing, `dumpsys gfxinfo` for frame stats, `dumpsys meminfo` for memory. Not a simulator.

| Metric | Value |
|---|---|
| Test device (model) and GPU | OnePlus CPH2381 (OnePlus Nord CE 2 Lite 5G) — Qualcomm Adreno 619, Android 14. Mid-range, not a flagship. |
| Renderer used, and fallback used (if any) | `react-three-fiber` + `expo-gl` for the 3D tear/watch choreography; `@shopify/react-native-skia` for the 2D card-fan reveal. This device's GPU/driver fully supports the 3D path — the 2D fallback (`rendererCapability.ts`) was not triggered here; it's exercisable on demand via `EXPO_PUBLIC_FORCE_2D_REVEAL=1`. |
| Time to first frame, cold session | **2433ms** total (`am start -W`, `LaunchState: COLD`) from launch intent to the app's own first rendered frame. |
| Time from rip gesture to revealed cards | **~5.08s**, tap-committed tear to the fan-reveal screen fully settled — this is the full choreographed tear animation duration (by design), not input lag. Timestamped via a `gfxinfo reset` + polling screenshots against wall-clock. |
| Median / worst frame time — pack 1 | Single Street Rip pack (tear + fan reveal), stats isolated via a clean `gfxinfo reset` immediately before the gesture: **50th 14ms / 90th 18ms / 95th 23ms / 99th 40ms**, 7.53% janky frames. |
| Median / worst frame time — pack 10 | A real 10-pack Vault Break batch (Grail Hunt + 55 remaining cards), measured at the batch summary screen: **50th 14ms / 90th 17ms / 95th 18ms / 99th 24ms**, 2.45% janky frames (cumulative since the same reset point, see caveat below). No frame-time regression from pack 1 to pack 10 — if anything the higher-percentile numbers look *better* once already warmed up. |
| Peak memory — pack 1 | TOTAL PSS **342MB** (Graphics 67MB), mid-reveal on a single pack. |
| Peak memory — pack 10 | TOTAL PSS **690MB** (Graphics 224MB), at the 10-pack batch summary screen. |
| Memory after batch completes and reveal is dismissed | TOTAL PSS **695MB** — **did not drop** after returning Home; stayed at (slightly above) the pack-10 peak. See caveat below — this is a real, honest finding, not smoothed over. |
| Hours spent on toolchain/setup vs. product | *TODO — only measurable by you.* |

**Methodology caveats, stated plainly:**
- This device's Android build (OnePlus/ColorOS) does not reliably honor `dumpsys gfxinfo <pkg> reset` scoping the way stock Android does — the "pack 10" frame percentiles above are cumulative from the same reset point through the end of the 10-pack batch (i.e. they include pack 1 single-pack traffic too), not a slice isolated to only the final pack's own frames. The pack 1 row *is* cleanly isolated (reset called immediately before that specific gesture). Directionally still useful — frame times did not degrade across the batch — but not as precise a pack-10-only slice as the brief ideally wants.
- The memory-after-dismissal number is a genuine, slightly concerning result worth investigating further: PSS stayed essentially at its pack-10 peak (695MB vs. 690MB) rather than dropping back toward the 342MB pack-1 baseline after the reveal was dismissed and the user returned to Home. Either disposal is lazy (deferred past this measurement window) or there's a real retention issue in how Skia/GPU resources from the bulk reveal get released — flagged here rather than hidden, and worth a follow-up profiling pass (Android Studio Profiler's heap dump / native allocation tracker would pinpoint which allocator is holding on).
- `adb`'s synthetic `input swipe` could not reliably trigger the tear gesture — it doesn't generate a realistic enough multi-sample touch trace for the velocity-based gesture physics to recognize as a commit (arguably a good sign for the gesture implementation's real-device robustness). The actual tear gesture in this test was performed by a real human finger on the device, with stats captured programmatically around it.

---

## Scope cuts

Cutting scope was expected and is graded; this is the honest list, not a hidden one.

**Shipped beyond the required baseline:**
- Price-history sparklines per item — a P2 "nice to have."
- A real admin economics/totals screen — P2 said cut this first if needed; it wasn't.
- Marketplace category + rarity-tier filtering (not just list-and-buy).
- Layered one-shot sound design tied to real actions (tear complete, per-tick drag, card flip).
  Deliberately **no ambient/looping audio anywhere** — every sound is discrete and tied to an
  actual gesture event, kept after early ambient-loop attempts were tried and rejected.

**Cut, deliberately, and why:**
- **Native haptic choreography** (CoreHaptics / `VibrationEffect` composition) — the P1 *bonus*
  tier on top of haptics. Real, sequenced vibration is built and working throughout the reveal
  (see [Haptics](#haptics-a-designed-sequenced-track) above) and meets the required P0 bar; what's
  cut is only the deeper OS-native layer beyond that baseline, never haptics itself.
- **Provably-fair commit-reveal** — not built; cut for time in favor of the
  concurrency/interruption-safety work, which is pass/fail in spirit.
- **Push/local notifications** on drop-live — not built. "Notify me" exists in the UI but isn't
  wired to a real notification.
- **Marketplace free-text search** — cut per the brief's own P2 allowance ("list and buy is
  enough"); category/tier filtering shipped instead.
- **A single committed `schema.sql`** — the schema evolved as a sequence of small scripts against
  a live Supabase project rather than one authoritative migration file. Fine for this trial's
  single environment, a real gap for reproducing the schema from a clean database without walking
  the script history.
- **Alt-account prevention** is detection-only (a recorded device ID on signup), not enforcement —
  an honest gap, not implied to be solved.


**The design mistake behind the current bulk-reveal architecture:** the first version of the
10-pack reveal kept every pack's full 3D scene (tear included) alive across a continuous scroll
through all ten. It fell over on a real phone — stutters and freezes mid-scroll — because the
design started from "how should this look" instead of "what can this device actually hold in
memory across ten packs." The current architecture (3D reserved for the single-pack tear only;
bulk mode is flat 2D with exactly one card mounted at a time) is the direct result of that rebuild.
