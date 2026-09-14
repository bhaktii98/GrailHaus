# GrailHaus

A native mobile app for a luxury mystery-pack platform. Users buy packs — evergreen shelf SKUs or
limited timed drops — rip them open through a category-specific real-time 3D/2D reveal, hold what
they pull in a live-drifting portfolio, and trade it on a peer-to-peer marketplace.

Two categories are fully shipped: **Trading Cards** and **Watches**. A third (**Handbags**) has
been built and proven end-to-end as evidence the reveal engine is genuinely config-driven, not
demoed live in the submission build — see [Extensibility: the handbags proof](#extensibility-the-handbags-proof).

This README covers setup, architecture, the performance report, and an honest account of what was
cut and why. The 2-page architecture document lives at [docs/PRD.md](docs/PRD.md) and
[docs/bulk-reveal-architecture.md](docs/bulk-reveal-architecture.md) for the deeper design
rationale this file only summarizes.

---

## Contents

- [Repo layout](#repo-layout)
- [Setup](#setup)
- [Running everything](#running-everything)
- [Concurrency harness](#concurrency-harness)
- [Architecture overview](#architecture-overview)
- [Why GrailHaus can't lose money](#why-grailhaus-cant-lose-money-the-economics-audit)
- [Extensibility: the handbags proof](#extensibility-the-handbags-proof)
- [Performance report (Deliverable 1)](#performance-report-deliverable-1)
- [Scope cuts](#scope-cuts)
- [Hours: toolchain vs. product](#hours-toolchain-vs-product)

---

## Repo layout

npm workspaces monorepo, four packages:

| Workspace | What it is |
|---|---|
| `app/` | The React Native / Expo client — the reveal engine, shelf, portfolio, marketplace. Requires a dev build (Expo prebuild/EAS); **Expo Go cannot run this app** because it depends on native modules (`react-native-skia`, `expo-gl`/`@react-three/fiber`) Expo Go doesn't ship. |
| `server/` | Fastify + TypeScript API. Postgres via `pg`, decimal-safe money, the one atomic purchase path, the marketplace, the WebSocket drop-stock channel, and `scripts/hammer.ts`. |
| `admin-dashboard/` | Next.js internal tool. Configure categories, packs, rarity tiers, pressure rules, marketplace fees; view the economics/EV dashboard. |
| `shared/` | Framework-agnostic TypeScript shared by both client and server — the reward engine (`pullPack`/`resolveItems`), bulk-reveal presentation logic, and every domain type. Ships raw `.ts` (no build step) so both Metro and the server's `tsx`/esbuild toolchains consume the same source directly. |

---

## Setup

### Prerequisites

- Node 22
- A Postgres database — this project was built against **Supabase** (Postgres + its own Auth for
  the mobile app's session tokens, and a separate magic-link login for the admin dashboard).
  Anything that gives you a real Postgres connection string with row-level locking works; Supabase
  isn't load-bearing.
- `npx eas-cli` (Expo Application Services) and an Expo account, for building the mobile dev client.
- Xcode / Android Studio if you want to run the native project locally instead of an EAS cloud build.

### 1. Install

```bash
npm install
```

Installs all four workspaces from the repo root (`package.json`'s `workspaces` field).

### 2. Environment variables

Copy each `.env.example` and fill in real values:

```bash
cp server/.env.example server/.env
cp app/.env.example app/.env
```

`server/.env` needs:
- `DATABASE_URL` — **use a transaction-mode pooler** (e.g. Supabase's port `6543`, not `5432`).
  Session-mode poolers cap total concurrent connections project-wide far lower than this app's own
  `pool.ts` `max` setting expects, and that mismatch presents as a silent hang under concurrency
  rather than a clear error — see [Scope cuts](#scope-cuts) for the full story.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — used by the admin dashboard's magic-link login only; the
  mobile app's own auth is independent (see below).
- `APP_JWT_SECRET` — signs the mobile app's own email+password session tokens. Generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` — outbound mail for the admin dashboard's magic-link
  OTP (configured as custom SMTP in Supabase Auth, not called directly by this server).

`app/.env` needs:
- `EXPO_PUBLIC_API_URL` — the server's base URL. Point this at a deployed backend (this project's
  own was deployed to Render — free tier, so the first request after idle can take ~50s to cold
  start) or your own machine's LAN IP for local dev on a physical device.
- `EXPO_PUBLIC_FORCE_2D_REVEAL` — leave at `0`. Set to `1` to force every reveal onto its 2D
  fallback path regardless of device capability (see [Renderer choice](#renderer-choice-and-fallback)) —
  useful for demoing the fallback without needing a real unsupported device. Requires a Metro
  restart, not just a reload — this is baked in at bundle time, not read live.

### 3. Database schema + seed catalog

The schema and seed catalog were built incrementally against a live Supabase project via the
scripts in `server/scripts/` (there is no single `schema.sql` — see
[Scope cuts](#scope-cuts) for why that's a documented gap, not an oversight). To stand up a fresh
database:

1. Run the SQL migrations in `server/scripts/` in the order they were written (each is a small,
   idempotent `alter table` / `create table` script — `addPackRecurrence.ts`,
   `fixCategoryConstraints.ts`, `fixOwnershipWeightsFkey.ts`, etc.) — `npx tsx server/scripts/<name>.ts`.
2. Seed categories: `npx tsx server/scripts/seedCategories.ts`.
3. Populate the catalog (~30-50 items per category, tiers, rarity ranges) via the admin dashboard,
   or adapt `seedHandbagsItems.ts`/`seedHandbagsDemo.ts` as a template — they show the exact shape
   every table expects (`rarity_tiers`, `packs`, `slot_probabilities`, `items`, `pressure_rules`).

---

## Running everything

```bash
npm run server:dev   # Fastify API, tsx watch, http://localhost:3000
npm run admin:dev     # Next.js admin dashboard, http://localhost:3002
```

The mobile app needs a **dev client build** — Expo Go will not launch it:

```bash
cd app
npx eas build --profile development --platform android   # cloud build; or:
npx expo prebuild && npx expo run:android                # local native build
```

Once the dev client is installed on a device/emulator, `npx expo start` (or `npm run start -w app`)
serves JS to it like any other Expo project.

---

## Concurrency harness

```bash
npm run hammer --workspace=server                              # street_rip shelf pack, 10 buyers, stock 5
npm run hammer --workspace=server -- 20 3 black_label_drop      # a timed/recurring drop instead
```

Fires N concurrent `purchase()` calls (the same function the real `/purchase` endpoint calls, not
a separate test path) at a pack temporarily pinned to a small stock, then verifies the pack's
final `stock_remaining` and every `owned_items` row reconcile *exactly* against what should have
succeeded — no oversell, no undersell, no phantom items. Every row it touches (stock, balance,
pressure state, drop timing) is restored to its original value on exit, success or failure. Full
design rationale is in the script's own header comment.

---

## Architecture overview

### The reveal engine

One engine, two (three, proven) category personalities — not two hardcoded screens. The seam is
`CategoryRevealConfig` (`app/src/engine/core/types.ts`): palette, camera, lighting, gesture mode,
timing, haptic track, reveal order, and (for a timeline-driven category) a full choreography are
all data on that one interface. `toCategoryRevealConfig()`
(`app/src/engine/core/categoryRevealConfig.ts`) builds one of these directly from a `categories`
database row — an admin adding a category that fits an existing 3D silhouette needs **zero app
code**, only a dashboard row.

The one piece that stays code on purpose: 3D topology. `meshArchetypes.tsx` maps a `meshArchetype`
string to one geometry-building function — `tear-pack` (cards), `lift-lid-box` (watches),
`flap-bag` (handbags). A category whose silhouette doesn't fit any existing archetype needs one
new ~70-line mesh function (see `HandbagMesh.tsx`); everything else about that category — palette,
lighting, camera, pacing, haptics — is still pure configuration.

### Cards: gesture-physics tear + 2D fan reveal

The tear is real 3D (`react-three-fiber` + `expo-gl`), driven 1:1 by the drag — not a canned
animation triggered on touch-up:
- Follows the finger the entire way (`CardFlowEngine.tsx`'s `GestureLayer`).
- **Reversible mid-gesture**: release before the commit threshold and it springs back to sealed.
- **Velocity-aware**: a fast flick commits short of the full distance; a slow drag needs to travel
  further.
- **Interruptible**: a new touch during the settle animation takes control immediately.

Once torn, the reveal switches to flat 2D (`@shopify/react-native-skia`) — deliberately: keeping a
full 3D scene alive per card was the first design that was tried and thrown out (see
[Scope cuts](#scope-cuts)/hardest problem). Cards are revealed one at a time, tap-to-open,
commons-first, via `HoldToOpenFanReveal.tsx` — every card gets the identical flip animation (5
half-turns, 100ms each, 320ms settle) regardless of rarity; only the landing "punch" scale and the
ring/mote flourish count scale with rarity, so the gesture never tips off what's coming before the
card itself does.

### Watches: timeline-driven 3D choreography

A completely different animation model, deliberately: `RevealChoreography`
(`app/src/engine/core/types.ts`) is an absolute-clock timeline (`pose(t)`/`lights(t)`/`camera(t)`),
not a gesture-progress value — because a watch reveal keeps animating *after* the gesture ends
(locks retracting, the case rising, lighting escalating to the piece). Each of the three tiers
(Reserve/Archive/Obsidian Vault) has its own choreography file
(`watches/*/config/*.ts`); the mechanism is identical across all three, only pacing and how far the
lighting builds before commit differ, tier to tier — that's where the escalating "luxury restraint"
lives, on purpose.

### Renderer choice and fallback

`react-three-fiber` on `expo-gl` for the 3D path (recommended in the brief, and the shortest path
from prior three.js experience to something running on-device); `@shopify/react-native-skia` for
the 2D card-fan reveal, chosen over Reanimated-only views because it gives cheap, declarative
gradients/canvases for the per-card art without a second heavyweight renderer.

Fallback detection (`app/src/engine/core/rendererCapability.ts`) covers two distinct real failure
shapes observed on-device:
1. A thrown JS error during r3f/expo-gl mount — caught by an Error Boundary.
2. **Silent** degradation — expo-gl mounts without throwing, but three.js logs a WARN that a GPU
   capability it needs (`EXT_color_buffer_float`) isn't there. A narrow `console.warn`/`console.log`
   intercept catches exactly this signal and flips every currently-mounted reveal to 2D live, no
   reload needed.

Stated honestly, not oversold: a genuine native-level crash below the JS bridge is caught by
neither path. `EXPO_PUBLIC_FORCE_2D_REVEAL=1` forces the fallback for testing without needing a
real unsupported device.

### Multi-pack (10-pack) reveal

Bulk mode is a **pacing/presentation configuration**, not a second reveal implementation — same
`pullPack`/`resolveItems` reward engine, same odds, same Grail Pressure carried across all ten
packs in one continuous streak, same atomic transaction. What changes is purely how the
already-decided results are shown (`shared/src/bulkPresentation.ts`,
[docs/bulk-reveal-architecture.md](docs/bulk-reveal-architecture.md)):

- **Grail Hunt stage** — every genuinely good pull across all ten packs is surfaced *first*,
  weakest to strongest, before the regular cards. Buying ten at once is a bigger commitment than
  one pack, and the first thing on a buyer's mind the moment it's done is "did I get anything
  good" — making them scroll through forty commons to maybe find out buries the actual payoff.
- **Exactly one card is ever mounted at a time.** No 3D scene at all runs in bulk mode — the
  expensive tear mesh is reserved for a single-pack rip. Nothing pre-renders the next pull, nothing
  from a prior pull stays resident. This is a direct result of a design that didn't work — see
  [Scope cuts](#scope-cuts).
- **Per-pack resume.** `activeReveal.ts` persists `packIndex`/`openedCount` (and bulk stage state)
  to `SecureStore`, rewritten on every advance. Force-stop at pack six of ten: packs 1-5 stay
  shown, pack 6 resumes on its next sealed card, 7-10 stay sealed — contents are never re-rolled
  because they were already generated, server-side, inside the purchase's own transaction, at
  purchase time.

### Atomic purchase, single and bulk

One purchase path for shelf, drops, single, and bulk (`server/src/modules/purchase/purchase.service.ts`)
— never forked per flow.

- **Idempotency**: client-generated `Crypto.randomUUID()`, reused across retries of the same
  attempt (never re-minted). Enforced server-side by a **Postgres unique-index insert**
  (`insert into purchases (...) on conflict (idempotency_key) do nothing returning *`) — not
  application-level locking. Two collided requests: one INSERT wins and gets the claimed row back,
  the other gets zero rows and falls through to reading whatever the winner produced.
- **Atomicity**: balance debit, stock decrement, content generation, and the purchase record all
  commit or roll back together inside one `BEGIN`/`COMMIT`, with `SELECT ... FOR UPDATE` on the
  pack row so concurrent purchases against the same SKU serialize through Postgres, not app code.
- **Exact inventory under concurrency**: this is what `scripts/hammer.ts` exists to prove.
- **Bulk quantity is fixed at 10, not a free 1-10 range.** Requesting 10 against 7 remaining fails
  the *whole* purchase atomically — `insufficient_stock`, no partial charge, no partial delivery.
  Chosen over partial fulfillment because a 10-pack is one priced product; charging for something
  that wasn't actually offered isn't defensible.
- **Interruption-safety** (`app/src/lib/pendingPurchase.ts`) writes the idempotency key to
  `SecureStore` *before* the request fires. On reconnect/foreground, it asks the server what
  actually happened (`GET /purchases/:idempotencyKey`) rather than ever blindly retrying with a
  fresh key — so airplane mode mid-10-pack, then reconnect, is one charge and ten packs, never
  twenty.

### Marketplace

`buyListing()` (`server/src/modules/marketplace/marketplace.service.ts`) locks the listing row
(`for update of l`) for the whole transaction: two simultaneous buyers on the same listing
serialize, the loser sees a clean `already_sold` after the winner commits, no double-sell window.
Self-purchase is blocked outright before any money moves. The platform fee is computed server-side
at sale time from the listing's own category/tier — never client-supplied, so there's no path
around it.

---

## Why GrailHaus can't lose money (the economics audit)

### Pack pricing vs. contents

Every pack's expected payout is computed from the pack's **own real catalog items**
(`admin-dashboard/lib/ev.ts`'s `computeSteadyStateEvForAllPacks`), not a category-wide value-range
approximation — and, critically, it's simulated across a realistic run of consecutive pulls with
the pity/pressure streak actually carried forward, not a single isolated pull. An earlier version
of this tool only modeled the isolated-pull case, which looked healthy (85-96% return) while real
repeat buyers were actually costing the platform more than they paid (up to ~120% return on some
packs) because the pity system's own cost wasn't in the model at all. Current, verified numbers
after retuning the pity thresholds (base odds untouched):

| Pack | Price | Steady-state EV | Return |
|---|---:|---:|---:|
| Street Rip | $25.00 | $23.94 | 95.8% |
| Vault Break | $75.00 | $72.17 | 96.2% |
| Black Label | $250.00 | $239.88 | 96.0% |
| Black Label: Midnight Drop | $250.00 | $243.84 | 97.5% |
| The Reserve | $750.00 | $722.33 | 96.3% |
| The Archive | $2,500.00 | $2,421.75 | 96.9% |
| The Obsidian Vault | $7,500.00 | $7,252.38 | 96.7% |

All packs sit inside the target 85-100% return band, verified against the real production reward
engine (`shared/src/rewardEngine.ts`'s `pullPack`), not a re-derived approximation.

### Fee integrity

The marketplace fee (8% flat today, configurable per category/tier via
`marketplace_fee_tiers`) is looked up and applied server-side, inside the same locked transaction
as the sale itself — there is no client-supplied fee field and no code path that completes a sale
without it.

### Loophole audit

| Loophole | Why it's closed |
|---|---|
| Self-trading to inflate balance | `buyListing` rejects `listing.seller_id === buyerId` outright, before any money moves. |
| Buy/sell cycles that create money | Every sale moves a fixed amount from a locked buyer balance to a locked seller balance minus the fee — no path credits more than was debited. |
| Selling to an alt account | **Not fully closed — an honest gap.** `X-Device-Id` is recorded as a signal on signup (`app/src/lib/deviceId.ts`) but nothing today blocks a second account on the same device; there's no KYC-equivalent in scope for this trial. |
| Revealing a pack twice / replayed reveals | Contents are generated once, server-side, at purchase time, and stored immutably in `purchases.result`. A resumed or re-fetched reveal re-reads the same stored result; nothing re-rolls. |
| Listing an item mid-sale / delist-during-purchase races | Both the buy and the delist path acquire the same row lock on the listing (`for update of l`); whichever transaction commits first wins, the other sees a resolved, non-`active` status and fails cleanly. |
| Double refunds | There is no refund path in this trial (no real money moves) — a failed purchase never debits in the first place, so there's nothing to refund. |
| Cross-tier pressure farming (farm cheap packs, cash in the guarantee on an expensive one) | Grail Pressure/Curator's Guarantee state is tracked per pack SKU, never globally per user or per category — a deliberate, documented choice in `shared/src/rewardEngine.ts`. |
| Oversell under concurrency | Proven, not just argued — see [Concurrency harness](#concurrency-harness). |

---

## Extensibility: the handbags proof

The review call hands over a third category live. Rather than leave that untested, handbags were
actually built end-to-end against this codebase:

- `HandbagMesh.tsx` — a new `flap-bag` mesh archetype (a hinged flap swinging open, not sliding up
  like a lid or absent like a card) — the one genuinely new piece of code a real third category
  needed, ~70 lines.
- `server/scripts/seedHandbagsDemo.ts` / `seedHandbagsItems.ts` — real `rarity_tiers`, a real
  purchasable pack SKU (`Atelier Drop`, $200, 25 units), and catalog items, seeded through the same
  tables the admin dashboard itself writes to.

This isn't wired into the submitted build's live catalog (no `handbags` row is currently in
`categories` — see [Scope cuts](#scope-cuts)), but the mesh and the seed data both exist and are
runnable, so "wire in a third category live" on the call is genuinely just the admin-dashboard
`categories` form the way it's designed to work, not a cold start.

---

## Performance report (Deliverable 1)

> **Outstanding — needs a real measured run on the test device, not filled in here.** The brief is
> explicit that this must be measured numbers, not estimates, and I don't have a live device
> session's frame/memory trace to read them off honestly. Filling this table in is the very next
> step before submission.

| Metric | Value |
|---|---|
| Test device (model) and GPU | *TODO* |
| Renderer used, and fallback used (if any) | react-three-fiber + expo-gl (3D tear/watch choreography); `@shopify/react-native-skia` (2D card fan). Fallback path exists and is exercisable via `EXPO_PUBLIC_FORCE_2D_REVEAL=1` — *TODO: confirm which path the test device actually took.* |
| Time to first frame, cold session, first rip | *TODO* |
| Median / worst frame time — pack 1 | *TODO* |
| Median / worst frame time — pack 10 | *TODO* |
| Peak memory — pack 1 | *TODO* |
| Peak memory — pack 10 | *TODO* |
| Memory after batch completes and reveal is dismissed | *TODO* |
| Hours spent on toolchain/setup vs. product | *see [Hours](#hours-toolchain-vs-product) below* |

Suggested measurement tools, to record alongside the numbers once captured: Android GPU
Inspector/`adb shell dumpsys gfxinfo` for frame timing, Android Studio Profiler or `adb shell dumpsys meminfo` for
memory, and a stopwatch/screen-recording timestamp for cold first-frame.

---

## Scope cuts

Cutting scope was expected and is graded; this is the honest list, not a hidden one.

**Shipped beyond the required baseline** (worth knowing before assuming the P2 list was skipped
wholesale):
- Price-history sparklines per item (`app/src/components/Sparkline.tsx`) — a P2 "nice to have."
- A real admin economics/totals screen (`admin-dashboard/app/(dashboard)/economics`) — P2 said cut
  this first if needed; it wasn't.
- Marketplace category + rarity-tier filtering (not just list-and-buy).
- Layered one-shot sound design tied to real actions (tear complete, per-tick drag, card flip) —
  P2 "nice to have." Deliberately **no ambient/looping audio anywhere** — every sound is discrete
  and tied to an actual gesture event, a design constraint kept after early ambient-loop attempts
  were tried and explicitly rejected.
- A working, seeded third category (handbags) proving the reveal engine's extensibility claim with
  real code and real data, not just an architecture argument — see above.

**Cut, deliberately, and why:**
- **Native haptic choreography** (CoreHaptics / `VibrationEffect` composition) — stayed at the P0
  bar (a designed, sequenced track via `expo-haptics`) rather than reaching the P1 bonus. Every
  haptic beat is deliberately sequenced and timed to the animation it accompanies, just via the
  cross-platform API rather than a native module.
- **Provably-fair commit-reveal** — not built. Flagged in the brief as small and high-value; cut
  for time in favor of the concurrency/interruption-safety work, which is pass/fail in spirit.
- **Push/local notifications** on drop-live — not built. The "Notify me" affordance exists in the
  UI but is not wired to a real notification.
- **Marketplace free-text search** — cut per the brief's own P2 allowance ("list and buy is
  enough"); category/tier filtering shipped instead.
- **Sneakers** — explicitly out of scope per the brief; not built.
- **A single committed `schema.sql`** — the schema evolved as a sequence of small scripts in
  `server/scripts/` against a live Supabase project rather than one authoritative migration file.
  Functionally fine for this trial's single environment, but a real gap for reproducing the exact
  schema from a clean database without walking through the script history — noted rather than
  hidden, and the seed scripts (`seedHandbagsDemo.ts` etc.) show the real shape of every table.
- **Alt-account prevention** is detection-only (a recorded device ID), not enforcement — documented
  as an honest gap in the loophole audit above rather than implied to be solved.

**A real bug found and fixed along the way, worth knowing about rather than discovering live:**
recurring drops originally read their `goes_live_at`/`ends_at` columns directly at purchase time —
values that are set once and never updated once a pack becomes a *recurring* drop, meaning a
recurring drop could actually be purchased at any time regardless of its real schedule. Fixed by
recomputing the true current occurrence under the same row lock the purchase already takes
(`server/src/modules/purchase/purchase.repository.ts`'s `lockPackForPurchase`), rather than trusting
stale columns.

**The design mistake behind the current bulk-reveal architecture:** the first version of the
10-pack reveal kept every pack's full 3D scene (tear included) alive across a continuous scroll
through all ten. It ran fine in isolation and fell over on a real phone — stutters and freezes
mid-scroll, because the design started from "how should this look" instead of "what can this
device actually hold in memory across ten packs." The current architecture (3D reserved for the
single-pack tear only; bulk mode is flat 2D with exactly one card mounted at a time, nothing
pre-rendered or retained) is the direct result of that rebuild.

---

## Hours: toolchain vs. product

*TODO — the brief explicitly wants an honest number here (roughly how many hours went to
toolchain/dev-client setup vs. actual product work), and only you have that number. Fill in before
submitting; an honest number is what's asked for, not a guess.*
