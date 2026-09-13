# Bulk Reveal Architecture — the 10-Pack Grail Hunt

How a 10-pack purchase is presented, and why it is a presentation layer rather than a second
reveal engine.

---

## 1. The governing principle

> **The server decides results. The frontend presents results.**

A bulk purchase changes *nothing* about generation. Same RNG, same slot probabilities, same
guarantees, same Grail Pressure carry-over, same ownership rows, same atomic transaction. The only
thing that differs is the order and ceremony with which already-decided, already-persisted results
are shown to the user.

Everything in this document follows from that. If a change would let presentation affect an
outcome, it is the wrong change.

---

## 2. What was already there (and was not rebuilt)

The backend already supported `quantity: 10` atomically before this feature existed.
`executePurchase` in `server/src/modules/purchase/purchase.service.ts` locks the profile balance
and pack rows, validates stock/funds/drop windows, loops the reward engine once per pack carrying
pressure state between packs, inserts ownership, decrements stock, debits balance, and writes the
result — all inside one transaction, claimed through a unique-index idempotency insert.

So there is deliberately **no `BatchPurchase` table**. The `purchases` row *is* the batch:

| Conceptual field | Where it actually lives |
| --- | --- |
| `batchId` | `purchases.id` |
| `packCount` | `purchases.quantity` |
| `totalSpend` | `purchases.total_price_cents` |
| `idempotencyKey` | `purchases.idempotency_key` |
| locked results | `purchases.result` (JSON, written once) |
| batch retrieval | `GET /purchases/:idempotencyKey` |
| ownership | `owned_items` rows, each carrying `purchase_id` |

Introducing a parallel batch model would have duplicated a working, correct, transactional system
for no gain.

---

## 3. The one real backend change: explicit pack association

Pack boundaries used to be *implicit* — `result.items` is a flat array generated pack by pack, so
the client re-derived boundaries by slicing on `itemCount`. That worked, but it made the
batch → pack → card relationship a reconstruction rather than a stored fact.

Since the bulk UI reorders cards out of their packs, that relationship now has to be
unambiguous. `PurchaseResultPayload` therefore persists `packCoordinates` — one
`{ packIndex, cardIndex }` per item, recorded as each pack is generated — and those coordinates
travel out to the client on every `PulledOwnedItem`.

**Backward compatible.** Rows written before this existed have no `packCoordinates`; readers fall
back to positional derivation (`Math.floor(i / itemCount)`), which reproduces exactly the same
structure. A server test asserts the stored and derived forms always agree.

---

## 4. Presentation order vs authoritative result order

This is the distinction the whole feature rests on.

**Authoritative order** — what the server generated and stored. Never mutated, never reordered,
never re-attributed:

```
Pack 0: Core  Core  Prime Core  Grail
Pack 1: Core  Grail Core  Core  Core
Pack 2: Core  Core  Prime Core  Core
```

**Presentation order** — what the Grail Hunt shows:

```
Grail (pack 1, card 1)   ← weakest grail first
Grail (pack 0, card 4)   ← strongest last, the climax
Prime (pack 0, card 2)  Prime (pack 2, card 2)
Core  Core  Core  Core  Core  Core  Core  Core  Core
```

The reordering happens in `shared/src/bulkPresentation.ts`, in pure functions that **return new
arrays over the same item references** — nothing is copied, mutated, or renumbered. Each card
still carries its own `packIndex`/`cardIndex`, and the Grail Hunt actually displays it
("From pack 2"), which is what keeps the presentation honest about not having changed anything
underneath.

Tests assert this explicitly: grouping loses no items, duplicates none, mutates the input
structure not at all, and a grail extracted from pack 2 still reports pack 2.

---

## 5. Strategy, not a second engine

```
RevealScreen
   │
   ├── strategy === "SINGLE_PACK"      → CardFlowEngine / VaultBreak / BlackLabel   (unchanged)
   │
   └── strategy === "BULK_GRAIL_HUNT"  → BulkRunOrchestrator
                                              │
                                              ├── RunIntroStage
                                              ├── GrailHuntStage
                                              ├── PrimeGridStage
                                              └── CoreListStage
                                                      ↓
                                             BatchSummaryScreen   (shared by both paths)
```

`presentationStrategyFor(quantity)` is the single definition of the single/bulk decision —
`quantity > 1`, in one place, rather than a `length > 1` check scattered per screen.

`BulkRunOrchestrator` is deliberately thin: it decides which stage is on screen and what "next"
means. All the *rules* live as pure functions in `shared`:

- `groupBulkRun` — split into grails / primes / cores
- `compareGrailsForReveal` — escalation ranking
- `grailIntensity` — how much ceremony each reveal earns
- `nextStage` — stage transitions, skipping empty stages
- `summarizeBulkRun` — every figure on the summary

The terminal screen is the *same* `BatchSummaryScreen` both paths route to, reached by the same
`isBatchSummary` flag — there is exactly one batch summary in the app, not a bulk-specific copy.

**Single-pack is untouched.** A one-pack purchase never constructs bulk state at all
(`bulkReveal` is `null`), and four regression tests guard that.

---

## 6. Grail ordering and escalation

Grails are revealed **weakest first, strongest last**, so a run builds to a climax rather than
peaking early.

Ranking is by `baseValueCents` ascending, ties broken on `ownedItemId`. Two deliberate choices:

- **Not rarity** — every grail is already the same rarity class; value is what separates them.
- **Not `currentValueCents`** — that drifts every 30s (PRD §28). Ranking on it would let the order
  of a *locked* result change between a reveal and its resume. Base value is fixed at catalog
  import, so ordering is deterministic for the life of the batch.

If a real `revealRank` / desirability field is added later, `compareGrailsForReveal` is the only
function that changes. Nothing else knows how grails are ordered.

`grailIntensity(index, total)` returns 0.45→1.0, driving anticipation length (620ms→1850ms), glow
reach, sheen behaviour and haptic density. The final grail is always 1.0 — a single-grail run
still gets a full hero moment, it just doesn't build to one.

**Edge cases**, all handled and tested:

| Grails | Behaviour |
| --- | --- |
| 0 | `GrailHuntStage` renders an honest "NO GRAIL THIS RUN" beat, then moves on. Not styled as an error, not faked, not re-rolled. The stage is *not* skipped — silently skipping the stage the feature is named after reads as broken. |
| 1 | One full-intensity hero reveal. |
| n | Sequential, escalating, strongest last. |

---

## 7. Resume behaviour

Bulk progress is persisted **client-side**, in the same SecureStore marker that already protects
per-pack resume (`app/src/lib/activeReveal.ts`). No schema change, no migration.

```
ActiveReveal {
  idempotencyKey, packId, quantity, packIndex,
  bulkReveal?: { stage, currentGrailIndex, completedGrailIds,
                 primeStageCompleted, coreStageCompleted, summaryViewed }
}
```

Written on every stage transition and every grail reveal — the reveal write happens immediately,
because that is exactly the moment a resume needs to land after.

On boot/foreground, `resumeActiveReveal` re-fetches results from
`GET /purchases/:idempotencyKey` (server-side, immutable — asking again never re-rolls), and the
run continues from its persisted stage.

**What resume can and cannot restore.** Contents: always, in full, for every pack — they were
never at risk. Presentation position: stage and grail index. Mid-animation sub-state (a card
halfway through its turn) is not restored; it dies with the process like any unsaved UI state, and
the run resumes at the start of the next beat.

A bulk run resumes into its *own* stage machine, never into a per-pack summary —
`resumedToSummary` is a single-pack concept and would strand a bulk run on the wrong screen.

---

## 8. Performance

A 70-card run cannot mount 70 expensive scenes. The stages are tiered by cost:

| Stage | Approach |
| --- | --- |
| Grail Hunt | Exactly **one** card mounted at a time. No 3D scene at all — `PackFace` plus Reanimated transforms on the UI thread. Each grail is keyed so shared values never leak between reveals. Nothing pre-renders the next one. |
| Prime Grid | Pure 2D. `expo-image`, `memory-disk` cache, 3-column grid. Entrance stagger capped at 11 items so a 30-prime run assembles no slower than a 9-prime one. |
| Core List | `FlatList` with `getItemLayout` (fixed row height, so measurement is skipped entirely), windowed, `removeClippedSubviews`. **No entrance animation** — staggering 48 rows is exactly the delay this stage exists to avoid, and animation on a fast-scrolling list is where jank appears first. |

The heavy `PackTearMesh` 3D path remains where it belongs: a single-pack rip, where there is one
pack to tear rather than ten.

---

## 8b. Tier visual consistency

A bulk run must look and feel like the tier it belongs to. `app/src/engine/cards/bulk/tierPersonality.ts`
is the single lookup driving every tier-specific channel across all four stages plus the summary.

| Channel | Street Rip | Vault Break | Black Label |
| --- | --- | --- | --- |
| Accent (metal) | `#d8a93f` gold | `#e8cf9a` champagne | `#c9a24a` bronze |
| Card back | violet → violet-deep | violet → plum | graphite → ink |
| Backdrop | violet → `#0b0b10` | plum → `#0a0413` | crimson → `#08060a` |
| Ambience | sparse gold foil motes | violet vault shafts | rising ember field |
| Hot core | `#ffe9b0` | `#fbf0d4` | `#fff1cf` (fire.ts's `HOT`) |
| Haptics | 1 beat, medium land | +1 build, medium, double climax | +2 build, **heavy** land, double climax |

Values are **derived from each tier's existing single-pack personality config**, not re-typed, so a
palette change in the single-pack reveal follows through automatically. Tests assert the derivation
directly against those configs — drift fails the build.

### The ambience is a translation, not a port

Black Label's single-pack identity comes from `art/fire.ts`: six GPU particle layers (skirt, sheet,
embers, smoke, sparks, cracks) plus a heat halo and light sweep. Reproducing that in the Grail Hunt
would be wrong (no 3D scene to attach to) and unaffordable (a run shows up to ten grails back to
back; a particle system per reveal is exactly the memory spike the bulk flow exists to avoid).

`GrailAmbience.tsx` instead reproduces the *silhouette and palette* with ~8 Reanimated views on the
UI thread, keeping fire.ts's actual shapes: the `grow * die` alpha envelope, stacked-sine lateral
sway, crimson→molten→champagne colour assignment, and a `surge` spike on the landing standing in for
`burst()`/`uSurge`. The read is consistent; the cost is a rounding error.

### Journey tracker

`GrailJourneyTracker.tsx` shows **"GRAIL 3 OF 7"** plus a pip per grail (past / live / upcoming) and
an "n more to come" line.

This reverses the original decision to hide the grail total. Hiding it didn't create suspense — it
made runs feel formless, because a user partway through couldn't tell if the next tap was the last.
The count is not the spoiler; *which* cards they are and what they're worth still is. The intro beat
("THE CHASE BEGINS") still withholds everything, so the opening lands as a reveal and the count
appears only once the hunt starts.

### Bug found by the consistency pass

`VaultCardFanReveal`'s `accentRGB` was `232,207,162` while its `accentHex` was `#e8cf9a`
(= `232,207,154`). Every `rgba()` built from the triple rendered slightly greener than the hex-driven
chrome beside it. Fixed at source in the shipped single-pack reveal, and a test now pins hex/RGB
agreement for all three tiers.

---

## 9. All card tiers are now bulk-eligible

Vault Break and Black Label previously blocked `×10` because batching meant replaying their rich
3D fan reveals ten times. A bulk buy no longer replays any per-pack reveal, so that restriction is
gone — every card tier can batch. Watches still cannot (one case at a time, PRD), and timed drops
still cannot (scarcity is the mechanic).

---

## 10. Adding a future category

The architecture is category-agnostic by construction:

1. **Tier ordinals, not names.** `bulkPresentation.ts` keys off `rarityTierLevel` 1/2/3, and every
   display name and colour comes from the SKU's admin-configured `rarityTiers`. Watches'
   Heritage/Icon/Apex works unchanged.
2. **A new strategy is a new `PresentationStrategy` value** plus a stage list — not a new engine.
   `presentationStrategyFor` is the one place the decision is made.
3. **Reuse or replace stages individually.** A category wanting a different middle act swaps
   `PrimeGridStage` without touching the hunt, the summary, resume, or persistence.
4. **Ranking is one function.** `compareGrailsForReveal` is the single definition of desirability.

---

## 11. Analytics

`app/src/lib/analytics.ts` is a typed event vocabulary with an in-memory buffer and dev logging.
There is **no analytics provider or endpoint in this stack**, so it does not pretend to send
anything — adding a provider later is a change to `track()` alone, since every call site already
emits the right event with the right payload at the right moment.

Events: `bulk_reveal_started`, `grail_hunt_started`, `grail_revealed`, `best_grail_revealed`,
`prime_stage_started`, `core_stage_started`, `batch_summary_viewed`, `bulk_reveal_completed`.
Payloads carry tier/counts/values — never user identity or balance.

---

## 12. Test coverage

70 tests, run with `npm test` from the repo root.

| Suite | Count | Covers |
| --- | --- | --- |
| `shared/src/bulkPresentation.test.ts` | 31 | Strategy selection, grail ordering & determinism, intensity escalation, grouping integrity (no loss/duplication/mutation), pack-association survival, summary math incl. losses, stage transitions, empty-stage skipping |
| `server/.../bulkGeneration.test.ts` | 11 | 50/60/70-card counts, per-pack coordinate correctness, stored-vs-derived agreement, pressure carry-over across packs, odds unchanged by bulk, catalog integrity |
| `app/src/state/packFlowStore.test.ts` | 14 | Single-pack regression guards, stage progression, idempotent grail completion, skip-to-results, resume at every stage, content preservation on resume |
| `app/src/engine/cards/bulk/tierPersonality.test.ts` | 14 | Per-tier distinctness, derivation from each tier's own config, hex/RGB agreement, haptic escalation ordering, backdrop/ground consistency, unknown-tier fallback |

### What is deliberately *not* covered

Honest gaps rather than claimed coverage:

- **Transactional guarantees** (atomicity, idempotency dedupe, balance/stock movement) are enforced
  by Postgres — the unique-index claim and `for update` locks — not by application logic. Testing
  them needs an integration harness against a real database. The generation tests exercise the
  loop's logic in isolation; they do not and cannot prove the transaction.
- **Rendered component behaviour** (3×3 grid layout, animation timing) would need
  `@testing-library/react-native`, which this project does not currently configure. The logic those
  components consume is tested; their rendering is not.

---

## 13. Files touched

**Shared**
- `types.ts` — `packIndex`/`cardIndex` on `PulledOwnedItem`; `PresentationStrategy`, `RevealStage`,
  `BatchRevealState`
- `bulkPresentation.ts` *(new)* — the entire strategy, as pure functions
- `bulkPresentation.test.ts` *(new)*

**Server**
- `purchase.types.ts` — `packCoordinates` on the result payload
- `purchase.service.ts` — record coordinates during generation; enrich them out, with positional
  fallback
- `bulkGeneration.test.ts` *(new)*

**App**
- `state/packFlowStore.ts` — bulk stage state alongside untouched single-pack state
- `viewmodels/usePackFlowViewModel.ts` — `goToBulkStage`, `advanceBulkStage`, `revealGrail`,
  `strategy`
- `lib/activeReveal.ts` — persist/restore bulk stage
- `lib/analytics.ts` *(new)*
- `engine/cards/bulk/` *(new)* — `BulkRunOrchestrator`, `RunIntroStage`, `GrailHuntStage`,
  `PrimeGridStage`, `CoreListStage`
- `engine/cards/BatchSummaryScreen.tsx` — rarity breakdown, ledger, P&L, staged entrance,
  "List a Pull"
- `screens/RevealScreen.tsx` — bulk routing, listing hand-off, batch-wide collection highlight
- `screens/PackDetailScreen.tsx`, `components/PackTile.tsx` — all card tiers bulk-eligible
- `content/copy.ts` — the `bulkRun` block
- `state/packFlowStore.test.ts` *(new)*
