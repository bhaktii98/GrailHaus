# GrailHaus — Product Requirements Document

**Version** 0.1 · **Status** Draft — open for sign-off · **Date** 4 Sep 2026 · **Categories** Cards, Watches — Handbags reserved

> Live, fully-styled version: see the published artifact linked from the project chat. This file is the git-native source of truth for diffing and history.

A mobile app where users buy sealed mystery packs across two distinct luxury categories, rip them open through a real-time 3D reveal built per category, hold what they pull in a live portfolio, and trade peer-to-peer. This is the working spec behind the build — what's decided, what's still open, and why.

---

## 01. Core Loop

**Deposit funds → Shelf or Drop → Rip → Feel something → Hold, flex, or sell → Repeat**

On mobile, the feel *is* the conversion funnel. A user deposits because the rip felt premium and trustworthy; they come back because pack ten felt as good as pack one. Every screen should pull them one step deeper into the loop — if any step feels cheap, the loop breaks.

## 02. Categories & Personalities

Same underlying reveal engine, deliberately different products. If two categories share an easing curve, something has gone wrong.

| Category | Gesture | Personality |
|---|---|---|
| **Trading Cards** | Tear | Fast, tactile, commons-first. Swipe-to-tear the foil, card-by-card, rare-pull slow-burn. This is the dopamine loop — pace it like one. |
| **Watches** | Lift-lid | Slow, dark, deliberate. Velvet, lacquered wood, one light source. Nothing bounces, nothing is fast — the luxury is in the restraint. |
| **Handbags** *(reserved)* | — | Not built. Wired in live on the review call to prove the engine's category is config, not a rewrite. |

## 03. Naming & Taxonomy

"Common / Uncommon / Rare" is inventory language, not product voice — it reads like a spreadsheet, not a $500 unboxing. Below is the proposed replacement, plus what it's replacing and why.

### Item Rarity Ladder

| Tier | Was | Description | Pull weight |
|---|---|---|---|
| **Find** | common | The everyday pull. Still worth having, still yours — the floor of the pool, not a consolation prize. | ~100 |
| **Relic** | uncommon | Older, scarcer, worth a second look. The middle of the ladder — the pull that makes you check the value. | ~30 |
| **Grail** | rare | The pull people show up for — and the reason "GrailHaus" is the name on the box. | ~5 |

"Grail" isn't invented slang — it's already what collectors call their most-wanted item. Find → Relic → Grail also reads as an actual progression (found → aged and valuable → mythic), not three arbitrary labels.

**Alternates considered:**
- *Standard / Elite / Legendary* — reads more gaming-coded, less collector-authentic.
- *Base / Vault / Icon* — "Vault" collides with the pack-tier naming below.

**Status: Proposed** — pending sign-off. Code (`Rarity` type, `colors.rarity` tokens) already keys off `common`/`uncommon`/`rare` internally; this is a display-label swap plus optional enum rename.

**Adjacent — Pack Tier Ladder**: a separate axis, the price ladder per category (currently functional: *Entry / Mid / High*). Not part of this ask, but flagged in the decisions log in case the whole taxonomy should be unified in one pass (e.g. Entry → *Access*, Mid → *Signature*, High → *Reserve*).

## 04. Screens & Flows

| Screen | Purpose | Status |
|---|---|---|
| Shelf | Browse evergreen SKUs by category/tier, see balance, tap to rip. | 🟢 Live slice |
| Reveal | The gesture-driven 3D rip — the star of the product. | 🟢 Live slice |
| Drops | Countdown + limited-unit competition at go-live. | ⚪ Placeholder |
| Portfolio | Owned items as a live-ticking premium tracker. | ⚪ Placeholder |
| Marketplace | Fixed-price peer-to-peer listings. | ⚪ Placeholder |
| Admin | Packs sold, fees earned, margin per category. | ⚪ Not started |

## 05. Reveal Engine Requirements

One engine, config-driven per category. The rules below apply to every category equally — they live in the engine, not in any one category's code.

**Gesture physics — non-negotiable:**
- **1:1 tracking** — the object follows the finger; it never animates to a preset on touch-up.
- **Reversible mid-gesture** — start the tear, change your mind, it springs back.
- **Velocity-aware completion** — a flick finishes it; a slow drag over the same distance doesn't.
- **Interruptible** — a new touch during the settle animation takes control immediately.

**Haptics**: a designed, sequenced track alongside the animation — not one buzz on success. Timing and intensity are part of each category's config, escalating through a rare-pull hold.

**Extensibility**: a category's personality — geometry, materials, lighting, camera, timing, haptic track, reveal order — is one config object. Adding Handbags is one new config file and one registry line; the engine, gesture layer, and haptics track never change.

## 06. Architecture Snapshot

**Mobile — MVVM**
- View — screens. No fetches, no business state.
- ViewModel — hooks. No JSX, unit-testable alone.
- Service — typed fetch calls. No React.
- Model — shared types, the Fastify API.

**Backend — modular**
- Routes — thin HTTP adapters.
- Service — business logic, orchestration.
- Repository — the only place raw SQL lives.
- Postgres — Supabase, atomicity real and testable.

Live today: `/health`, `/me`, `/packs?category=cards` against a seeded catalog. Shelf → Reveal is demoable end to end using a client-side mocked pull, clearly flagged for replacement once the atomic `/purchase` endpoint lands.

## 07. Transaction Integrity Strategy

Correctness under concurrency is 23% of the grade and pass/fail in spirit — a breathtaking rip on a drop that oversells fails the trial regardless of how good the rest looks. This is the actual mechanism, not just the promise.

### The atomic write pattern

Every money-moving action funnels through the same shape: a conditional `UPDATE ... WHERE ... RETURNING` inside one database transaction — never a separate read, then a decision, then a write. The check and the write are the same statement, so there is no gap between them for another request to land in.

```sql
UPDATE profiles SET balance_cents = balance_cents - $amount
WHERE id = $user AND balance_cents >= $amount
RETURNING balance_cents;  -- 0 rows = insufficient funds, transaction aborts

UPDATE packs SET stock = stock - $qty
WHERE id = $sku AND stock >= $qty
RETURNING stock;  -- 0 rows = sold out, transaction aborts
```

Both statements run in the same transaction as content generation and the purchase-record insert. Postgres holds a row lock on whatever an `UPDATE` touches for the life of the transaction, so concurrent purchases against the same SKU or the same balance serialize naturally — no explicit `SELECT ... FOR UPDATE` and no optimistic-locking retry loop needed for this shape. The one discipline that matters across every code path: lock the pack row before the profile row, always in that order, so two concurrent transactions can never deadlock waiting on each other in reverse.

### Idempotency key contract

Generated client-side (UUIDv4) the instant the user taps *Rip* — before the request leaves the device — and persisted with the pending purchase intent, so a retry after a dropped connection reuses the identical key. A new key is only ever minted for a genuinely new purchase intent, never for a retry of the same one.

| Case | What the server does |
|---|---|
| First arrival | Inserts the key row inside the purchase transaction, runs the purchase, caches the response against the key, commits. |
| Exact retry (same key, same payload) | Insert hits the unique constraint; server looks up the stored row, finds it completed, returns the cached response. Zero new side effects — one charge, total. |
| Same key, different payload | Insert hits the unique constraint, but the stored request hash doesn't match — rejected with a distinct "key reused" error rather than silently replaying the wrong response. |
| Two requests, same key, truly concurrent | Both attempt the insert; the unique constraint lets exactly one commit first. The second blocks on that row, then either returns the now-completed cached response or retries as a lookup — net effect, exactly one purchase executes. |

### Bulk purchase policy — decided

**Fail-whole, not partial.** A 10-pack request runs the stock `UPDATE` against the full requested quantity in one statement — if fewer than 10 remain, 0 rows return, the whole transaction aborts, nothing is charged and nothing is generated. One content-generation batch, one purchase row, one idempotency key for the entire batch, never ten. This was chosen over partial fulfillment because it keeps the correctness story to a single invariant ("charged for exactly what was delivered, always") instead of adding partial-charge UX and partial-refund logic — asked for 10, you get 10 or a clean sold-out, never billed for 10 and handed 7.

### The concurrency harness

`scripts/hammer.ts` runs two distinct tests, not one:

1. **N distinct purchasers** — N distinct idempotency keys hammering the last M units of a SKU. Expect exactly M succeed, N−M get a clean sold-out, and no balance ever goes negative.
2. **One purchaser's retry storm** — the same idempotency key fired K times concurrently, simulating a client retrying itself after airplane mode. Expect exactly one charge and one pack delivered, with K−1 identical cached responses.

### Client contract

Optimistic UI shows a pending state on tap, but never renders success before the server confirms it. A definitive failure (sold out, insufficient funds) rolls the pending state back and shows the real reason. An ambiguous failure (timeout, dropped connection) keeps the pending state and retries with the *same* idempotency key — it only ever resolves to success or failure once a definitive response actually arrives.

## 08. Money Mechanics

Not an EV optimizer, and not a real market — this is the strategy behind two deliberate revenue engines, how a dollar actually moves through the system from deposit to resale, and why the platform is structurally unable to lose money regardless of any single user's luck.

### Two revenue engines

- **Engine 01 — Primary: Pack margin.** Captured once, at mint. Every pack's contents pool has an expected value published in-app and held below the pack price. The spread is realized the instant a pack is bought — it doesn't depend on the user ever selling anything.
- **Engine 02 — Compounding: Marketplace fee.** Captured on every resale, indefinitely. A Grail pulled today can change hands ten times over a year — the platform earns a slice each time. This is the engine that rewards a healthy, liquid marketplace instead of one-and-done pack sales.

### Per-SKU sanity check

The mechanical proof behind Engine 01 — using the live seeded Starter Pack ($10.00, 5 pulls per rip):

| Item | Rarity | Value | Weight |
|---|---|---|---|
| Ember Sprout | Find | $0.60 | 100 |
| Tide Pup | Find | $0.60 | 100 |
| Rock Cub | Find | $0.60 | 100 |
| Gale Wing | Relic | $2.50 | 30 |
| Storm Fang | Grail | $18.00 | 5 |

Expected value per single pull = $1.03. At 5 pulls per rip, expected payout ≈ **$5.15** against a **$10.00** price — a ~48.5% margin before any fee. Same method scales to every SKU as the catalog grows: publish the pool, compute the weighted average, confirm it clears price.

### Tiered edge strategy — where the "unique" is

A flat margin on every SKU is the obvious move and the boring one. Real mystery-box and gacha economics vary the edge by *why* someone is buying at that tier — and Drops get a strategy of their own:

| Channel / Tier | Margin band | Why |
|---|---|---|
| Shelf — Entry | 30–35% | Thin enough that the everyday loop feels fair. This is the habit-forming tier — most volume, most repeat buyers. |
| Shelf — Vault / high-stakes | 50–60% | The buyer is paying for the chase and the status of ripping a $500 box, not the math. Wider edge is defensible because EV was never the pitch. |
| Timed Drops | 20–25% | Deliberately thinner than shelf at the same tier. The margin given up here is marketing spend: FOMO drives volume, and drop pulls skew straight into the marketplace at a premium — recouped by Engine 02, not Engine 01. |

### The money-flow loop

An illustrative cohort — 100 users at the app's actual $1,000 seeded starting balance, i.e. $100,000 total deposited. Assumptions are labeled; the mechanism is what matters.

| Stage | Amount | Platform revenue (running) |
|---|---|---|
| 100 users deposit $1,000 each | $100,000.00 | $0.00 |
| Entry-tier pack spend (32% margin, 70% of volume) | $28,000.00 | $8,960.00 |
| Vault-tier pack spend (55% margin, 30% of volume) | $12,000.00 | $15,560.00 |
| Contents minted into portfolios (held, not cash) | $23,600.00 | — |
| 25% of minted value listed & resold (8% blended fee) | $5,900.00 | $16,032.00 |
| **Platform revenue this period** | | **$16,032.00** |

Read the loop as: deposit → spread captured at mint (Engine 01) → value sits as portfolio "float," notional until traded → fee captured on every resale (Engine 02) → seller's proceeds re-enter as spendable balance, ready to buy the next pack. The more that float circulates instead of sitting idle, the more times Engine 02 fires on the same dollar of original contents value.

### Buy / sell mechanics

One atomic path underneath both a pack rip and a marketplace sale — doc requirement, not a suggestion:

- **List** — seller sets a fixed price; item flips to *listed*, ownership unchanged. Delist anytime before sale.
- **Buy** — one transaction: buyer balance −price, seller balance +(price − fee), platform revenue +fee, ownership transfers, listing closes. No step happens without the others.
- **Fee tiering by rarity** — Grails carry the highest fee (demand and urgency are highest there; the seller will still clear a premium), Finds the lowest (keeps the long tail liquid instead of stagnant).

| Item rarity | Marketplace fee |
|---|---|
| Find | 5% |
| Relic | 7% |
| Grail | 10% |

### Ledger conservation invariant

The actual, auditable version of "GrailHaus can't lose money" — true at every instant, checkable off the admin screen's own numbers:

> **Σ(user balances) + Σ(platform revenue collected) = Σ(total ever deposited)**
> holds at every instant — no transaction is allowed to violate it

### Loophole audit

| Attack | Why it's impossible |
|---|---|
| Self-trade to inflate balance | A buy and its matching sale are the same atomic transaction — money only moves from one balance to another, net platform revenue is always the fee, never negative. |
| Buy/sell cycle mints money | Every sale's buyer-debit and seller-credit are computed from the same listed price in one transaction; there's no path where a credit is written without an equal-or-greater debit. |
| Selling to an alt account | Doesn't extract value — the "profit" is the alt's own deposited balance moving back, minus the fee. Net negative for the operator, not a duplication of funds. |
| Replaying a reveal | Contents are decided server-side at purchase and persisted immutably; replaying the reveal replays a read, not a re-roll. |
| Listing mid-sale | Listing state changes only inside the same atomic transaction as a sale; a listing row is locked for the duration, so two buyers can't both close it. |
| Delist during purchase | Delist and buy both require the same row-level lock on the listing; whichever transaction commits first invalidates the other's precondition instead of both succeeding. |
| Cross-pack "pity" farming | Each pull is an independent weighted sample from its SKU's published pool — nothing server-side stores a "packs since last Grail" counter, so there's no accumulating state to carry from a $1 pack into a $100 pack. |
| Adaptive odds after a win streak | Odds are fixed per SKU and published in-app at all times. The server never conditions a roll on prior payouts or live house exposure, and a persisted pull can't be quietly "corrected" after the fact. |
| Buyback mispricing | There is no platform buyback price to get wrong — every sale is peer-to-peer at a price the seller sets, so there's no algorithmic valuation for the platform to mismark. |

**Competitive lesson.** The last three rows aren't hypothetical — they're the exact mechanics one of the doc's own named inspirations, [Rips by Triumph](https://www.youtube.com/watch?v=FzCbEvDwKWQ), appears to run in production. Its community has a documented "pity" farming strategy that counts packs across price tiers looking for a rare-pull window, a near-miss "bonus card" that resets that count without paying out (extending spend), an apparent payout correction after a win streak, and a platform buyback price checked against external markets because it can simply be wrong. Every one of those is a named failure mode this section is designed to make structurally impossible here, not just discouraged.

## 09. Non-Functional Requirements

| Requirement | Bar |
|---|---|
| Frame pacing | 60fps minimum, 120 where offered — pack ten holds pack one's rate. |
| Cold start | No shader-compile hitch or first-render jank on the first rip of a session. |
| GPU memory | Flat across a 10-pack batch — dispose geometries/materials/textures between packs. |
| Interruption safety | Survives backgrounding, process death, and rotation — resumes at the right beat, never re-rolls. |
| Money math | Decimal or integer-cents everywhere. Floating-point money is an automatic fail. |

## 10. Success Metrics

| Criteria | Weight | Status |
|---|---|---|
| Reveal & 3D craft | 28% | 🟡 In progress |
| Mobile-native feel & performance | 20% | ⚪ Not measured |
| Correctness under concurrency | 23% | 🔴 Not started |
| Architecture & system design | 12% | 🟢 On track |
| Ship quality & release hygiene | 9% | ⚪ Not started |
| Product judgment | 8% | 🟡 In progress |

## 11. Open Decisions Log

| Decision | Status | Current answer |
|---|---|---|
| Backend framework | 🟢 Decided | Fastify + TypeScript over Supabase Postgres. |
| 3D stack | 🟢 Decided | react-three-fiber on expo-gl. |
| Mobile state architecture | 🟢 Decided | MVVM via hooks; Zustand + React Query. |
| Starting balance | 🟢 Decided | $1,000.00, seeded. |
| Item rarity naming | 🟡 Proposed | Find / Relic / Grail — section 03. |
| Pack tier naming | 🔴 Open | Keep Entry/Mid/High, or rename to match rarity ladder? |
| Marketplace fee % | 🟡 Proposed | Tiered by rarity — Find 5%, Relic 7%, Grail 10%. Section 08. |
| Pack margin bands | 🟡 Proposed | Entry 30–35%, Vault 50–60%, Drops 20–25% (thinner by design). Section 08. |
| Drop cadence & quantities | 🔴 Open | Not yet set. |
| Partial bulk fulfillment | 🟢 Decided | Fail-whole, not partial. Asked for 10, 7 remain → clean sold-out, nothing charged. Section 07. |
| Idempotency key strategy | 🟢 Decided | Client-generated UUIDv4 per purchase intent, unique-constrained server-side, cached response replay. Section 07. |

## 12. Roadmap

1. **Phase 0 — done.** Scaffold, Supabase, MVVM skeleton, config-driven reveal engine, Shelf → Reveal demo slice (Cards, mocked pulls).
2. **Phase 1 — next.** Atomic `/purchase`, shelf/drop concurrency, `scripts/hammer.ts`.
3. **Phase 2.** Portfolio live-ticking, Marketplace fixed-price trading.
4. **Phase 3.** Full Watches choreography, economics audit doc, measured performance report.

---

*GrailHaus PRD · v0.1 · living document — update as decisions close.*
