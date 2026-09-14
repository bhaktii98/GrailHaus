# GrailHaus — Product Requirements Document

**Version:** 1.0  
**Status:** Product Definition Finalized — Ready for Development

---

# 1. Product Overview

## 1.1 Product Name

**GrailHaus**

GrailHaus is a premium mobile mystery-collecting platform where users purchase collectible products, experience category-specific cinematic reveals, build a portfolio of owned assets, and trade those assets through a peer-to-peer marketplace.

The platform currently supports two categories:

1. **Trading Cards**
2. **Luxury Watches**

These categories must feel like two completely different products emotionally and visually while sharing a scalable underlying product and reveal architecture.

The core product loop is:

> **Start with funds → Browse → Buy → Reveal → Feel something → Collect → Track value → Trade → Repeat**

The product is designed around two principles:

> **The reveal is the product.**

and

> **The money must always be correct.**

---

# 2. Product Goals

## Primary Goals

### Goal 1 — Create a premium mobile-native experience

The application must feel designed specifically for a phone.

Priority areas include:

- Real-time interaction
- Gesture physics
- Haptic feedback
- Smooth frame pacing
- Premium visual design
- Category-specific personality

---

### Goal 2 — Make collecting emotionally rewarding

Users should experience:

- Anticipation before opening
- Tension during reveals
- Surprise from rarity
- Satisfaction from valuable pulls
- Motivation to continue collecting

The rarity system should provide excitement without making outcomes feel mechanically predictable.

---

### Goal 3 — Build a trustworthy economic system

All money, inventory, ownership and purchases must remain correct under:

- Concurrent purchases
- Network failures
- Retries
- Multiple devices
- Marketplace races

---

### Goal 4 — Build an extensible product

The architecture must allow future categories to be added without rewriting the core system.

The reveal system should eventually support categories such as:

- Handbags
- Sneakers
- Jewelry
- Other luxury collectibles

Adding a category should primarily involve configuration and category-specific assets rather than copying an entire feature implementation.

---

# 3. Product Scope

## In Scope

### Core Categories

- Trading Cards
- Luxury Watches

### Core Features

- User balance
- Pack/case shelf
- Evergreen inventory
- Limited timed drops
- Single purchases
- Bulk card purchases
- Category-specific reveals
- Portfolio
- Simulated price movement
- Marketplace
- Fixed-price trading
- Platform fees
- Concurrency protection
- Idempotent purchases
- Performance reporting

---

## Explicitly Out of Scope

- Real money payments
- Cryptocurrency
- Real-world market price integrations
- Auctions
- Sneakers
- Paid APIs
- Scraping

---

# 4. Currency & User Balance

## Currency

**USD**

All money in the prototype is paper money.

No real financial transactions occur.

---

## Starting Balance

### **$25,000**

Every new user starts with:

> **$25,000.00**

### Reasoning

This balance allows the evaluator to experience:

- All three card tiers
- All three watch tiers
- Multiple purchases
- Bulk card purchases
- Marketplace transactions
- Portfolio value movement

The application should feel like a premium collecting environment rather than a prototype where the user immediately runs out of funds.

---

# 5. Product Categories

# Category A — Trading Cards

## Category Personality

Cards represent:

> **Speed. Energy. Competition. Suspense. Dopamine.**

The experience should feel dynamic and tactile.

The user is actively ripping open something.

The emotional progression is:

> **Curiosity → Momentum → Suspicion → Tension → Reveal → Celebration**

---

# 6. Trading Card Product Tiers

The card category contains three tiers.

---

## Tier 1 — Street Rip

### Price

**$25**

### Contents

**5 Cards**

### Position

Entry-level collecting experience.

Street Rip should encourage frequent openings.

The user should feel:

> “I can open one quickly. Maybe I get lucky.”

---

## Tier 2 — Vault Break

### Price

**$75**

### Contents

**6 Cards**

### Position

Premium collecting experience.

Vault Break provides:

- One additional card
- Better rarity opportunities
- A guaranteed premium outcome
- Higher reveal tension

---

## Tier 3 — Black Label

### Price

**$250**

### Contents

**7 Cards**

### Position

High-stakes collecting.

Black Label should feel significant before the user even begins opening it.

The user should feel:

> “Something serious could happen here.”

---

# 7. Trading Card Rarity System

Cards use three rarity levels.

## 1. Core

The foundation of the collection.

Core cards are the most frequently obtained items.

---

## 2. Prime

Premium collectible cards.

Prime cards create meaningful excitement during an opening.

---

## 3. Grail

The chase items.

Grail cards represent the highest rarity level and should create the strongest reveal moments.

---

# 8. Trading Card Probability Architecture

## Design Principle

Card rarity must not be generated using one simple probability for the entire pack.

The system uses:

> **Progressive Slot Probability**

Each card position has its own rarity probability.

As the user progresses through a pack, the probability profile becomes more exciting.

This creates a natural emotional progression without making every pack identical.

---

# 9. Street Rip Probability Table

## Price: $25

## Cards: 5

| Card Position | Core | Prime | Grail |
|---|---:|---:|---:|
| Card 1 | 100% | 0% | 0% |
| Card 2 | 100% | 0% | 0% |
| Card 3 | 85% | 14% | 1% |
| Card 4 | 70% | 26% | 4% |
| Card 5 — Final Pull | 55% | 35% | 10% |

### Experience Logic

Cards 1 and 2 establish rhythm.

Card 3 introduces possibility.

Card 4 increases anticipation.

Card 5 becomes the major tension point.

The final card matters, but it is never guaranteed to be extraordinary.

---

# 10. Vault Break Probability Table

## Price: $75

## Cards: 6

| Card Position | Core | Prime | Grail |
|---|---:|---:|---:|
| Card 1 | 100% | 0% | 0% |
| Card 2 | 90% | 10% | 0% |
| Card 3 | 75% | 23% | 2% |
| Card 4 | 65% | 30% | 5% |
| Card 5 | 45% | 42% | 13% |
| Card 6 — Final Pull | 30% | 50% | 20% |

## Guarantee

Every Vault Break pack guarantees:

> **At least one Prime-or-Grail card.**

If the generated result contains no Prime or Grail:

- The highest eligible Core result is upgraded to Prime.

---

# 11. Black Label Probability Table

## Price: $250

## Cards: 7

| Card Position | Core | Prime | Grail |
|---|---:|---:|---:|
| Card 1 | 90% | 10% | 0% |
| Card 2 | 80% | 19% | 1% |
| Card 3 | 65% | 32% | 3% |
| Card 4 | 50% | 43% | 7% |
| Card 5 | 40% | 47% | 13% |
| Card 6 | 25% | 52% | 23% |
| Card 7 — Final Pull | 15% | 55% | 30% |

## Guarantees

Every Black Label pack guarantees:

- At least **2 Prime-or-Grail cards**
- A premium final reveal position

A Grail is never guaranteed by default.

The chase must remain meaningful.

---

# 12. Grail Pressure System

Cards include a transparent bad-luck protection system.

## Name

**Grail Pressure**

The system tracks:

> `consecutivePacksWithoutGrail`

The counter is maintained separately for each user.

---

## Packs 1–5 Without a Grail

Normal probabilities apply.

---

## After 5 Packs Without a Grail

Add:

> **+3 percentage points**

to Grail probability on eligible premium slots.

---

## After 8 Packs Without a Grail

Add:

> **+6 percentage points**

to Grail probability on eligible premium slots.

---

## After 10 Packs Without a Grail

The next eligible final pull is:

> **Guaranteed Grail**

After a Grail is obtained:

> The Grail Pressure counter resets.

---

## Transparency

The user should be able to see their current progression.

Example:

> **Grail Pressure: 6 / 10**

The system must be documented clearly.

It should never secretly manipulate odds.

---

# 13. Card Value Ranges

Rarity and value are related but are not identical.

This prevents the system from feeling artificially linear.

## Core

Typical range:

**$5–$30**

---

## Prime

Typical range:

**$25–$150**

---

## Grail

Typical range:

**$100–$1,000+**

---

## Value Overlap

Some overlap is intentional.

Example:

A highly desirable Prime may be worth more than a lower-end Grail.

This makes the portfolio and marketplace feel more like a genuine collecting ecosystem.

---

---

# Category B — Luxury Watches

## Category Personality

Watches represent:

> **Luxury. Restraint. Mystery. Weight. Prestige.**

The user is not opening a pack.

The user is unveiling a:

> **Grail Case**

The experience should feel fundamentally different from Cards.

Cards are fast and energetic.

Watches are slow and deliberate.

---

# 14. Watch Product Tiers

Every Grail Case contains:

> **1 Watch**

The difference between tiers is primarily the rarity and quality distribution.

---

## Tier 1 — The Reserve

### Price

**$750**

### Contents

**1 Watch**

### Position

The entry point into luxury collecting.

The experience should feel premium without feeling inaccessible.

---

## Tier 2 — The Archive

### Price

**$2,500**

### Contents

**1 Watch**

### Position

Serious collector territory.

The user now has a meaningful chance of receiving a highly desirable watch.

---

## Tier 3 — The Obsidian Vault

### Price

**$7,500**

### Contents

**1 Watch**

### Position

The highest-stakes watch experience.

This purchase should feel ceremonial.

---

# 15. Watch Rarity System

Watches use completely separate nomenclature.

## 1. Heritage

Recognisable luxury watches.

The foundation of the luxury collection.

---

## 2. Icon

Highly desirable collector watches.

These should create a noticeable increase in excitement.

---

## 3. Apex

Exceptional watches.

These are the chase outcomes.

An Apex reveal should be memorable.

---

# 16. Watch Probability System

Unlike Cards, Watches contain only one item.

Therefore the probability system is based on:

> **Case-Class Probability**

---

# The Reserve

## Price: $750

| Rarity | Probability |
|---|---:|
| Heritage | 75% |
| Icon | 22% |
| Apex | 3% |

---

# The Archive

## Price: $2,500

| Rarity | Probability |
|---|---:|
| Heritage | 55% |
| Icon | 35% |
| Apex | 10% |

---

# The Obsidian Vault

## Price: $7,500

| Rarity | Probability |
|---|---:|
| Heritage | 30% |
| Icon | 45% |
| Apex | 25% |

---

# 17. The Curator's Guarantee

Watches have their own collection protection system.

It should feel premium rather than game-like.

## Name

**The Curator's Guarantee**

The system tracks consecutive outcomes that do not meet the expected premium threshold.

---

## The Reserve

After:

> **4 consecutive Heritage pulls**

The next case guarantees:

> **Icon or Apex**

---

## The Archive

After:

> **3 consecutive Heritage pulls**

The next case guarantees:

> **Icon or Apex**

---

## The Obsidian Vault

After:

> **3 consecutive non-Apex pulls**

The next Vault receives:

> **+10 percentage points Apex probability**

After:

> **5 consecutive non-Apex pulls**

The next Vault guarantees:

> **Apex**

---

## Transparency

The guarantee progression must be visible to the user.

Example:

> **Curator's Guarantee: 3 / 5**

---

# 18. Watch Value Ranges

The catalog uses believable luxury value ranges without requiring live market data.

---

## Heritage

Typical range:

**$1,000–$4,000**

---

## Icon

Typical range:

**$3,000–$15,000**

---

## Apex

Typical range:

**$8,000–$50,000+**

Overlap between rarities is allowed where it makes sense.

---

# 19. Pack and Case Availability

Both purchase models are required.

---

## Evergreen Shelf

Evergreen products:

- Have finite inventory
- Are available immediately
- Restock after inventory is depleted
- Can be purchased at any time

The shelf contains products across:

- Categories
- Tiers

---

## Timed Drops

At least one limited product must use a timed drop.

Timed drops include:

- Countdown
- Scheduled go-live time
- Fixed inventory
- Real-time inventory updates
- Competition at release
- Sold-out state

---

# 20. Initial Drop Recommendation

## Pending Final SKU Selection

The product model is finalized, but the exact drop SKU should be selected while creating the seeded catalog.

Recommended direction:

> **A limited Black Label Card Drop**

Reason:

It creates strong visual contrast with the evergreen shelf and naturally supports the required high-competition inventory test.

---

# 21. Bulk Purchase Model

## Cards

Bulk purchasing supports:

> **10 Packs**

Bulk purchases are supported for:

- Street Rip
- Vault Break
- Black Label

Mixed-tier bulk purchases are not required.

A bulk purchase contains:

> 10 packs of the selected SKU.

---

## Watches

Bulk purchasing is not a primary product experience.

Watch cases are intended to feel deliberate and individually significant.

The product will therefore prioritize:

> **Single-case watch purchases**

This is a conscious category-specific product decision.

---

# 22. Insufficient Stock Rule

When a user requests 10 packs but fewer than 10 remain:

> **The entire purchase fails.**

Example:

User requests:

> 10 Street Rip packs

Inventory remaining:

> 7

Result:

> **Purchase fails with no charge.**

### Reasoning

This creates:

- Clear transaction behavior
- Simple implementation
- No ambiguous partial orders
- Better user understanding
- Easier concurrency testing

Bulk purchases are therefore:

> **All-or-nothing.**

---

# 23. Purchase Architecture

All purchase paths use the same atomic purchase system.

This includes:

- Evergreen purchases
- Timed drops
- Single purchases
- Bulk purchases

The system must not have separate purchase implementations for each flow.

---

## Atomic Purchase Requirements

A purchase transaction must include:

1. Validate user balance
2. Validate inventory
3. Reserve/decrement inventory
4. Debit user balance
5. Generate item contents
6. Persist immutable ownership records
7. Persist purchase record

All operations must succeed or fail together.

---

# 24. Idempotency

Every purchase request must include an:

> **Idempotency Key**

The same purchase request may be retried after:

- Network loss
- App restart
- Airplane mode
- Client timeout

The server must guarantee:

> The user is charged once and receives exactly one successful result.

For bulk purchases:

> The user receives exactly the purchased number of packs.

Never duplicates.

---

# 25. Inventory Rules

Inventory must always be exact.

If:

- 100 users attempt to buy
- 5 units remain

Then:

> Exactly 5 purchases succeed.

The remaining 95 receive a clean failure.

Never:

- Oversell
- Undersell accidentally
- Create duplicate inventory

---

# 26. Concurrency Harness

The repository includes:

> `scripts/hammer.ts`

The script must:

- Fire concurrent purchase requests
- Target a low-stock SKU
- Simulate multiple users
- Print successful purchases
- Print failed purchases
- Verify the final inventory state

It must be usable for:

- Evergreen inventory
- Timed drop inventory

---

# 27. Portfolio

The Portfolio represents the user's collection as a premium financial-style experience.

Each owned item displays:

- Image
- Name
- Category
- Rarity
- Current value
- Purchase value
- Profit/Loss

---

## Portfolio Features

### Filters

- All
- Cards
- Watches

### Sorting

- Highest value
- Highest P&L
- Most recent

### Item Actions

- View details
- List for sale

---

# 28. Price Drift

Real-world market data is intentionally not used.

The prototype uses:

> **Bounded Simulated Random Drift**

Each item contains:

- `baseValue`
- `currentValue`
- `minValue`
- `maxValue`

---

## Update Frequency

Prices update:

> **Every 30 seconds**

---

## Card Drift

Each update:

> **±0.5% to ±2%**

Cards may move more aggressively.

---

## Watch Drift

Each update:

> **±0.2% to ±1%**

Watches move more slowly.

---

## Boundaries

Every item has a minimum and maximum value.

Example:

Base Value:

> $100

Minimum:

> $80

Maximum:

> $130

The value can move within this range but never outside it.

---

# 29. Realtime Strategy

## Decision

> **Polling every 30 seconds**

### Reasoning

Price movement is:

- Simulated
- Low-frequency
- Not time-critical

Polling provides:

- Faster implementation
- Lower architectural complexity
- Easier debugging
- Sufficient prototype realism

Realtime subscriptions are not required for this prototype.

---

# 30. Marketplace

The marketplace supports:

> **Fixed-price peer-to-peer trading**

No auctions.

---

## Seller Flow

A user can:

1. Select an owned item
2. Choose a listing price
3. Publish the listing
4. Delist before sale

---

## Buyer Flow

A user can:

1. Browse listings
2. Select an item
3. Buy immediately

---

# 31. Marketplace Fee

## Platform Fee

> **8%**

Every successful marketplace transaction collects an 8% platform fee.

Example:

Listing Price:

> $10,000

Seller receives:

> $9,200

GrailHaus receives:

> $800

The fee is calculated and recorded atomically during the transaction.

---

# 32. Marketplace Correctness Rules

The marketplace must prevent:

- One item selling twice
- One item being listed twice
- Selling an item not owned
- Self-trading
- Double-spending
- Listing and ownership disagreement
- Fee bypassing

The following operations must happen atomically:

1. Validate listing availability
2. Validate buyer balance
3. Debit buyer
4. Credit seller
5. Collect platform fee
6. Transfer ownership
7. Mark listing sold

---

# 33. Reward Engine Architecture

Rarity generation should not be implemented as a simple random-number check.

The product uses a reusable:

> **Reward Engine**

---

## Reward Engine Inputs

### Cards

- Tier
- Card position
- Base probability table
- Grail Pressure state
- Guarantee rules

---

### Watches

- Tier
- Base probability table
- Curator's Guarantee state
- Guarantee rules

---

## Reward Engine Outputs

- Selected rarity
- Selected catalog item
- Applied guarantee
- Applied probability modifier
- Immutable result

---

# 34. Content Generation Rules

Contents are generated:

> **Server-side at purchase time**

The result becomes:

> **Immutable**

The reveal client does not generate randomness.

The reveal only displays the already-generated result.

This guarantees:

- No rerolls
- No cheating through replay
- No changed contents after restart
- No client-side manipulation

---

# 35. Catalog Requirements

The seeded catalog must contain approximately:

> **30–50 items per category**

---

## Card Catalog Data

Each card includes:

- ID
- Name
- Tier eligibility
- Rarity
- Image
- Base value
- Minimum value
- Maximum value

---

## Watch Catalog Data

Each watch includes:

- ID
- Name
- Tier eligibility
- Rarity
- Image
- Base value
- Minimum value
- Maximum value

---

# 36. Catalog Selection Rules

The Reward Engine:

1. Determines rarity
2. Filters the catalog by:
   - Category
   - Tier eligibility
   - Rarity
3. Selects an eligible item
4. Persists the result

The catalog must contain sufficient items in every rarity/tier combination to prevent repetitive outcomes.

---

# 37. Economics

# 37. Economics & Expected Value Model

## 37.1 Economics Philosophy

GrailHaus is designed around a premium and transparent mystery-collecting economy.

The platform should not feel like a system where users are guaranteed to lose a large percentage of their purchase value.

Instead, the economic philosophy is:

> **Every opening has meaningful value. Every collection has upside.**

GrailHaus generates revenue through two complementary mechanisms:

1. **Primary product economics** — a controlled positive margin on packs and watch cases.
2. **Secondary marketplace economics** — an 8% platform fee whenever an item is successfully traded.

The objective is to create a sustainable economy while maintaining a premium and fair user experience.

---

# 37.2 Expected Value Philosophy

Expected Value (EV) represents the average mathematical value of the contents distributed across a large number of purchases.

It does **not** mean that every individual user receives exactly that amount.

For example:

A product costing **$100** may have an EV of **$95**.

Individual outcomes may be:

* $90
* $95
* $110
* $150
* $300

However, across a sufficiently large number of purchases, the average distributed value should approach:

> **$95**

This creates a controlled platform margin while preserving meaningful upside for exceptional outcomes.

---

# 37.3 Target Expected Value by Tier

The following target EVs are fixed product decisions.

## Trading Cards

| Product     | Price | Target EV | Target Return |
| ----------- | ----: | --------: | ------------: |
| Street Rip  |   $25 |      ~$23 |          ~92% |
| Vault Break |   $75 |      ~$70 |          ~93% |
| Black Label |  $250 |     ~$240 |          ~96% |

---

## Luxury Watches

| Product            |  Price | Target EV | Target Return |
| ------------------ | -----: | --------: | ------------: |
| The Reserve        |   $750 |     ~$700 |          ~93% |
| The Archive        | $2,500 |   ~$2,400 |          ~96% |
| The Obsidian Vault | $7,500 |   ~$7,300 |          ~97% |

Higher-priced tiers intentionally provide a higher expected return.

This is a deliberate premium product decision.

The more a user commits to the GrailHaus experience, the more economically generous the experience becomes.

---

# 37.4 Expected Value Formula

The Expected Value of a rarity outcome is calculated using:

> **Probability × Average Eligible Item Value**

For a single slot:

```text
Slot EV =
(Core Probability × Average Core Value)
+
(Prime Probability × Average Prime Value)
+
(Grail Probability × Average Grail Value)
```

For Watches:

```text
Case EV =
(Heritage Probability × Average Heritage Value)
+
(Icon Probability × Average Icon Value)
+
(Apex Probability × Average Apex Value)
```

---

# 37.5 Pack Expected Value Formula

Card packs use progressive slot probabilities.

Therefore, the total pack EV is:

```text
Pack EV =
EV(Card 1)
+
EV(Card 2)
+
EV(Card 3)
+
...
EV(Final Card)
```

Each card position has its own probability distribution.

This means the system does not treat every card as mathematically identical.

Later positions can have greater upside and therefore contribute differently to the overall expected value.

---

# 37.6 Example EV Calculation

Suppose a card slot has:

| Rarity | Probability | Average Eligible Value |
| ------ | ----------: | ---------------------: |
| Core   |         70% |                    $15 |
| Prime  |         26% |                    $60 |
| Grail  |          4% |                   $250 |

The slot EV is:

```text
(0.70 × $15)
+
(0.26 × $60)
+
(0.04 × $250)
```

Result:

```text
$10.50 + $15.60 + $10.00
```

Therefore:

> **Slot Expected Value = $36.10**

The same calculation is performed for every slot in the pack.

---

# 37.7 Tier-Specific Reward Pools

GrailHaus does not use one universal rarity pool for all products.

Each product tier has its own eligible reward pool.

This is essential for controlling:

* Expected Value
* Product differentiation
* Premium progression
* Chase-item economics

For example:

A Grail pulled from a **Street Rip** does not necessarily come from the same pool as a Grail pulled from a **Black Label** product.

---

## Example Card Grail Pools

### Street Rip Grails

Typical value range:

> **$80–$200**

---

### Vault Break Grails

Typical value range:

> **$150–$500**

---

### Black Label Grails

Typical value range:

> **$400–$1,000+**

This means rarity alone does not determine the complete value of an item.

The item's:

* Category
* Product tier
* Rarity
* Individual catalog value

all contribute to its economic position.

---

# 37.8 The Reward Selection Model

The Reward Engine follows this sequence:

### Step 1 — Identify the Category

Example:

> Cards

or

> Watches

---

### Step 2 — Identify the Product Tier

Example:

> Vault Break

---

### Step 3 — Apply the Relevant Probability Model

For Cards:

> Progressive Slot Probability

For Watches:

> Case-Class Probability

---

### Step 4 — Apply Guarantee or Protection Rules

Cards:

> Grail Pressure

Watches:

> Curator's Guarantee

---

### Step 5 — Select the Rarity

Example:

> Prime

---

### Step 6 — Select From the Eligible Catalog Pool

The system filters items using:

* Category
* Product tier
* Rarity

Only eligible items can be selected.

---

### Step 7 — Persist the Result

The selected item becomes:

> **Immutable**

The client never generates or rerolls the reward.

---

# 37.9 Why Tier-Specific Pools Are Important

Without tier-specific reward pools, the economy becomes difficult to control.

For example:

A $25 product could theoretically access the same high-value Grail pool as a $250 product.

That creates two problems:

1. The premium tier loses differentiation.
2. The EV of lower-priced products becomes difficult to control.

Tier-specific pools solve this.

They allow GrailHaus to create:

> **Vertical rarity progression**

rather than simply:

> Common → Rare → Legendary.

The complete reward identity becomes:

> **Tier + Rarity + Item**

For example:

> **Black Label + Grail + Midnight Phantom**

is economically and emotionally different from:

> **Street Rip + Grail + Neon Chase**

Both are Grails.

But they belong to different levels of the GrailHaus ecosystem.

---

# 37.10 Controlled Value Overlap

Rarity and value should not have a perfectly linear relationship.

A Prime item may occasionally be worth more than a lower-end Grail item.

For example:

| Item             | Rarity | Value |
| ---------------- | ------ | ----: |
| Chrome Signature | Prime  |  $180 |
| Neon Chase       | Grail  |  $150 |

This creates a more believable collecting economy.

Users should evaluate:

* The item
* Its desirability
* Its value

—not only its rarity label.

---

# 37.11 Guarantee Systems and Economics

Guarantee systems must be included in the economic model.

The platform cannot calculate EV using only base probabilities while ignoring:

* Grail Pressure
* Curator's Guarantee
* Minimum rarity upgrades

These systems increase the probability of premium outcomes.

Therefore, the final Economics Audit must calculate:

> **Effective Expected Value**

rather than only:

> **Base Expected Value**

The final audit should evaluate:

1. Base probability EV
2. Guarantee-adjusted EV
3. Long-run average EV
4. Maximum platform exposure

This ensures that protection systems do not accidentally make the platform structurally loss-making.

---

# 37.12 Grail Pressure Economic Impact

Grail Pressure modifies Grail probabilities after consecutive unsuccessful packs.

Therefore, the system must calculate the EV impact across a complete pressure cycle.

For Cards:

```text
Normal Packs
        ↓
5 Packs Without Grail
        ↓
+3% Eligible Grail Probability
        ↓
8 Packs Without Grail
        ↓
+6% Eligible Grail Probability
        ↓
10 Packs Without Grail
        ↓
Guaranteed Grail
        ↓
Counter Reset
```

The economics audit must simulate this complete cycle.

This is more accurate than calculating every purchase as an independent random event.

---

# 37.13 Curator's Guarantee Economic Impact

The same principle applies to Watches.

The Watch EV model must include:

* Heritage streak protection
* Icon guarantees
* Apex probability increases
* Apex guarantees

The final watch economics should therefore be calculated using:

> **Long-run guarantee-adjusted probabilities**

rather than the displayed base probability alone.

---

# 37.14 Economics Audit Methodology

The final Economics Audit will be generated after the seeded catalog is finalized.

The process is:

### Step 1

Create the complete catalog.

Each item receives:

* Category
* Tier eligibility
* Rarity
* Base value
* Minimum value
* Maximum value

---

### Step 2

Calculate the average value of every eligible rarity pool.

Example:

```text
Average Street Rip Core Value
Average Street Rip Prime Value
Average Street Rip Grail Value
```

---

### Step 3

Apply the probability tables.

Calculate:

> **Base Expected Value**

---

### Step 4

Apply guarantee systems.

Calculate:

> **Guarantee-Adjusted Expected Value**

---

### Step 5

Compare against the product price.

Calculate:

```text
Expected Margin =
Product Price − Effective Expected Value
```

---

### Step 6

Calculate Expected Return.

```text
Expected Return % =
(Effective Expected Value ÷ Product Price) × 100
```

---

# 37.15 Platform Revenue Model

GrailHaus has two revenue streams.

---

## Revenue Stream 1 — Primary Product Margin

Example:

Product Price:

> $100

Effective Expected Value:

> $95

Expected Primary Margin:

> $5

The platform earns a controlled margin through the difference between:

> Product price

and

> Long-run distributed value.

---

## Revenue Stream 2 — Marketplace Fees

Every successful marketplace transaction collects:

> **8%**

Example:

Listing Price:

> $10,000

Buyer pays:

> $10,000

Seller receives:

> $9,200

GrailHaus receives:

> $800

The marketplace fee is calculated and recorded atomically during the transaction.

---

# 37.16 Economic Flywheel

The GrailHaus economy creates a continuous product loop:

```text
PURCHASE
    ↓
REVEAL
    ↓
OWN
    ↓
TRACK VALUE
    ↓
LIST FOR SALE
    ↓
8% MARKETPLACE FEE
    ↓
NEW OWNER
    ↓
COLLECT / HOLD / TRADE
    ↓
CONTINUED PLATFORM ACTIVITY
```

The platform does not depend exclusively on users receiving less value than they paid.

Revenue is generated through:

1. Controlled primary product margins.
2. Continued secondary-market activity.

---

# 37.17 GrailHaus Economic Differentiator

The core economic differentiator of GrailHaus is:

> **High-return mystery collecting.**

Rather than maximizing platform margin by making the average user outcome significantly lower than the purchase price, GrailHaus intentionally targets a high expected return.

The progression is:

> **Higher commitment → Higher expected return**

This means premium tiers are not only visually more exciting.

They are also economically more generous.

---

# 37.18 Final Economics Principle

GrailHaus is built around three economic rules:

### Rule 1 — The user must always have meaningful upside.

Premium outcomes must be capable of exceeding the purchase price.

---

### Rule 2 — The platform must remain structurally sustainable.

Effective Expected Value must remain below product price over the long run.

---

### Rule 3 — Protection systems must be mathematically audited.

Grail Pressure and Curator's Guarantee must be included in the final EV calculation.

---

# Final Economics Statement

> **GrailHaus is not designed around making users lose.**

> **It is designed around creating suspenseful collecting experiences with controlled economics, meaningful upside, premium protection systems, and a sustainable secondary marketplace.**

The final expected-value table will be mathematically generated from the seeded catalog while preserving the already-defined product prices, probability systems and target return philosophy.


# 38. Required Economic Protection

The audit must address:

- Pack price vs expected contents value
- Marketplace fee collection
- Self-trading prevention
- Buy/sell cycle exploits
- Duplicate ownership
- Duplicate reveals
- Listing race conditions
- Delist-during-purchase races
- Double refunds

---

# 39. Mobile Client

## Platform

**React Native**

The application requires a native development build.

Expo Go is not sufficient for the required graphics stack.

---

# 40. Backend

## Language

**TypeScript**

---

## Database

**PostgreSQL**

The database must support real atomic transactions and concurrency protection.

---

# 41. Financial Math

Server-side money calculations must use:

> **Decimal-safe arithmetic**

Examples include:

- `decimal.js`
- Integer cents

Floating-point arithmetic must not be used for money.

---

# 42. Graphics & Reveal Architecture

The final graphics implementation must support:

- Real-time rendering
- GPU acceleration
- Lighting
- Materials
- Camera movement
- Direct gesture interaction

The recommended implementation direction is:

> **react-three-fiber + expo-gl**

However, the final renderer choice remains a technical architecture decision that must be justified based on implementation feasibility and device compatibility.

---

# 43. Reveal Architecture Requirements

The reveal system must be:

> **Configuration-driven**

The shared engine should support category-specific configuration for:

- Models
- Materials
- Lighting
- Camera
- Timing curves
- Haptics
- Reveal order
- Sounds
- Bulk pacing

Cards and Watches should not be implemented as unrelated hardcoded features.

---

# 44. Reveal Animation Design

## Status

> **Intentionally pending detailed design**

The following remains to be designed separately:

### Cards

- Exact rip gesture
- Foil deformation
- Camera choreography
- Card timing
- Rare slow-burn
- Exact haptic sequence
- Bulk reveal pacing

### Watches

- Case interaction
- Opening mechanism
- Lighting choreography
- Watch emergence
- Camera movement
- Exact haptic sequence

This is the primary remaining creative design area.

---

# 45. Performance Requirements

The application must target:

- 60 FPS minimum
- 120 FPS where supported

Performance must be tested on a real mid-range Android device.

---

## Performance Metrics

The final report must measure:

- Device model
- GPU
- Renderer
- Fallback renderer
- Cold first-frame time
- Median frame time — Pack 1
- Worst frame time — Pack 1
- Median frame time — Pack 10
- Worst frame time — Pack 10
- Peak memory — Pack 1
- Peak memory — Pack 10
- Memory after reveal dismissal
- Toolchain/setup hours
- Product development hours

---

# 46. Interruption Safety

The application must handle:

- Backgrounding
- App switching
- Notifications
- Process death
- Rotation
- Safe-area changes

Contents must never:

- Disappear
- Reroll
- Change

---

# 47. Multi-Pack Resume

For a 10-pack Card session:

If the app closes during Pack 6:

- Packs 1–5 remain revealed
- Pack 6 resumes or lands safely on its summary
- Packs 7–10 remain sealed
- No results change

---

# 48. Haptics

Haptics are part of the product choreography.

The application must use:

> **Sequenced haptic feedback**

Haptics must be tied intentionally to meaningful moments.

The advanced native haptic implementation remains optional.

---

# 49. Submission Requirements

The final submission includes:

## 1. Installable Build

- Signed Android APK or install link

---

## 2. GitHub Repository

Including:

- Setup instructions
- Architecture overview
- Scope cuts
- Performance report

---

## 3. Architecture Document

Including:

- Reveal engine architecture
- Category configuration
- Graphics decision
- Fallback strategy
- Multi-pack strategy
- GPU memory strategy
- Atomic purchase architecture
- Economics audit
- Animation and haptics architecture

---

## 4. Concurrency Harness

> `scripts/hammer.ts`

---

## 5. Loom Walkthrough

Maximum:

> **8 minutes**

---

# 50. Development Priority

## P0 — Must Be Excellent

1. Card real-time 3D reveal
2. Gesture physics
3. Sequenced haptics
4. 10-pack experience
5. Atomic single purchase
6. Atomic bulk purchase
7. Exact inventory
8. Idempotency
9. Portfolio with live value movement
10. Installable Android build
11. Renderer fallback
12. Performance measurement

---

## P1 — Should Work

1. Watch reveal
2. Marketplace
3. Timed drops
4. Extensible reveal engine
5. Concurrency harness
6. Economics audit
7. Advanced native haptics

---

## P2 — Cut First If Necessary

1. Admin totals screen
2. Marketplace search
3. Marketplace filtering
4. Advanced sound design
5. Shareable pull cards
6. Notifications
7. Price-history charts

---

# 51. Final Product Definition

GrailHaus is now defined as a premium mobile collecting platform with two deliberately different emotional experiences.

## Cards

> **Street Rip → Vault Break → Black Label**

Rarity:

> **Core → Prime → Grail**

Mechanic:

> **Progressive Slot Probability + Grail Pressure**

---

## Watches

> **The Reserve → The Archive → The Obsidian Vault**

Rarity:

> **Heritage → Icon → Apex**

Mechanic:

> **Case-Class Probability + Curator's Guarantee**

---

## Platform Economics

- Starting balance: **$25,000**
- Marketplace fee: **8%**
- Paper USD
- Server-side immutable rewards
- Bounded simulated price movement
- Polling every 30 seconds
- Atomic purchases
- All-or-nothing bulk purchases

---

# 52. Development Readiness

The product is ready to move into technical planning and development.

The remaining major creative work is:

> **The exact rip and reveal choreography.**

All major product rules, pricing, tiers, rarity systems, marketplace economics, purchase rules and portfolio behavior are now defined.

# Final Product Principle

> **GrailHaus should feel expensive in the hand, exciting in the moment, and mathematically trustworthy underneath.**