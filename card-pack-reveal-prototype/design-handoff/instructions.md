
Build a native mobile app for a luxury mystery-pack platform. Users buy packs — some always on the shelf, some in limited timed drops — rip them open one at a time or ten at once through a real-time 3D reveal, build a portfolio, and trade what they pull on a peer-to-peer marketplace.

This trial tests two things at once, and both are graded hard.

The reveal experience is the product. We are hiring product engineers who can make software feel expensive on a phone — real-time 3D, haptics, gesture physics, frame pacing, restraint. A reveal that looks fine in a screen recording but feels dead in the hand fails.

The money must be correct. Finite per-SKU stock, limited timed drops, concurrent purchases, atomic trades. Correctness is not a bonus track here — it is roughly a quarter of your grade, and it is pass/fail in spirit. A breathtaking rip on a drop that oversells fails the trial.

Inspiration — study these on a phone before writing any code:

Pokémon TCG Pocket — the gold standard for mobile pack opening: swipe-to-tear, card-by-card choreography, the rare-pull slow-burn, haptics that land on the beat
Rips by Triumph — live pack-rip energy, the tension of the reveal
Robinhood / Courtyard.io / StockX — portfolio and marketplace surfaces that feel premium
Total time: 40 hours of effort, spread across up to 9 days. Single part. All tools available.

Before You Start — Read This Section
This trial mandates React Native on the client and TypeScript on the server, because that is our house stack top to bottom and we need to see you write it. We know from your interview that your professional mobile work has been Flutter and your backend work has been Python.

That is a deliberate choice on our part, and we are telling you so up front rather than letting you discover it as a penalty.

Three things follow from it:

Ramp time is expected and is not held against you. Getting a React Native dev build running with a native graphics module for the first time is real work. Budget for it, and report in your README roughly how many hours went to toolchain and setup versus product. We would rather read an honest number than guess at one.
We would much rather see two things excellent than everything thin. The prioritisation guide below is not decoration. Build P0 to a standard you're proud of and tell us plainly what you didn't reach.
Ask questions. Anything ambiguous in this document is either your call to make and document, or a question worth asking — and asking is never held against you. In particular: if you hit a wall on tooling rather than on the product, tell us instead of burning six hours on it. We are grading your judgment and your craft, not your ability to fight a build system alone. How and when you ask for help is useful information to us, not a mark against you.
Product Concept
GrailHaus is a consumer app where users buy mystery packs, reveal the contents through a category-specific cinematic experience, hold a portfolio whose value moves, and buy/sell items with other users.

The core loop: Deposit funds → Grab a pack off the shelf, or wait for a drop → Rip it open → Feel something → Hold it, flex it, or sell it.

Every category has its own personality. Ripping a card pack should feel nothing like unboxing a Rolex. That difference — designed, engineered, and felt through the device — is the heart of this trial.

Why the polish matters commercially: on mobile, the feel is the conversion funnel. A user deposits real money because the app feels premium and trustworthy, and comes back tomorrow because the rip felt good in their hand. Every screen should pull them deeper into the motion — shelf → buy → rip → portfolio → marketplace → rip again. If any step feels cheap or janky, the loop breaks and the money stops.

Key Parameters
Some are fixed. Most are yours to design, and you will defend every one on the review call.

Parameter	Value
Categories	Trading Cards (Pokémon-style) and Watches (Rolex-tier luxury) — both across the catalog, shelf, portfolio and marketplace, each with its own reveal. They must feel like different products, not one reveal with two skins. Sneakers are explicitly out of scope for this trial — do not build them.
Item data	Seeded catalog you generate and commit (see Catalog). Pokémon TCG API optional for card data/images.
Currency	USD, paper only — no real money moves. Starting balance is yours to decide.
Financial math	Decimal library on the server (decimal.js or equivalent) and integer-cents or decimal on the client. Floating-point money is an automatic fail.
Pack tiers	At least 3 tiers per category, casual to high-stakes. Floors must be category-appropriate — a $10 card pack makes sense, a $10 watch box does not (a Rolex-tier box starts at $500+). You pick the ladder and justify it.
Pack availability	Both models required. Evergreen SKUs sit on the shelf with finite restocked stock, buyable any time. At least one limited timed drop with a countdown and a fixed unit count. You decide the SKU ladder, stock levels, drop cadence, and quantities.
Bulk ripping	Required. Users can buy and rip multiple packs in one go — offer at least a 10-pack. The pacing model for a bulk rip is yours to design and defend.
Rarity odds	We are not testing EV optimization. Pick sensible odds per tier, publish them in-app, document them. They must not be a loophole.
Marketplace fee	You decide. The platform takes a cut on every fixed-price trade.
Price movement	Light simulated drift, bounded, so portfolios tick. No real market-data pipeline required.
Objective
Build a working mobile app where a user can:

Sign up and see their balance
Browse the pack shelf by category and tier and buy an in-stock SKU on the spot
See a countdown to the next timed drop, then compete for limited inventory when it goes live
Rip the pack open through a category-specific real-time 3D reveal (the star of this trial)
Buy and rip a batch of packs in one session without the experience becoming tedious
View their collection as a premium portfolio with live-ticking values
List an item at a fixed price, browse listings, and buy from other users
See a simple platform view: fees earned, packs sold, margin per category
Cut scope wherever necessary — except the reveal and except the correctness floor. One category beautifully revealed with an honest note about the other beats two mediocre ones — but both shipped and genuinely distinct is the bar strong candidates hit.

Deliverable 1 — The Reveal Experience (the star, ~45% of your effort)
Each category gets its own reveal choreography. Same underlying engine, completely different feel.

Required category personalities
Cards — the rip. Swipe-to-tear the foil (study TCG Pocket's gesture until you can feel it). Cards revealed one at a time, commons first. When a rare is coming, the card knows — glow, hold, slow-burn before the flip. This is the dopamine loop; pace it like one.

Watches — the luxury unboxing. Slow. Dark. Deliberate. Velvet, lacquered wood, a single light source. The box opens with weight. The watch emerges with a glint. Nothing bounces, nothing is fast. The luxury is in the restraint — easing, shadow, negative space. The user should feel slightly underdressed.

These two are the tonal poles of the product. If they share an easing curve, something has gone wrong.

Hard requirements
Gesture physics, not gesture detection. The user performs the rip, and the gesture must behave like a physical object:

1:1 finger tracking — the foil follows the thumb, it does not animate to a preset on touch-up
Reversible mid-gesture — start the tear, change your mind, it springs back
Velocity-aware completion — a flick finishes the tear; a slow drag past the same distance does not
Interruptible — a new touch during the settle animation takes control immediately
Reveals that auto-play on a timer, or that fire a canned animation on tap, miss the entire point. This is the least negotiable item in the document.

Haptics as a designed track. Haptics are choreography alongside the animation, not a single buzz on success. The P0 bar: a deliberate, sequenced track — something like a light tick per card sliding out, a sharper impact at the moment the foil gives, escalating intensity through the rare-pull hold. Sequenced platform-level haptics (expo-haptics or equivalent) are an acceptable way to hit that bar, provided the sequencing and timing are designed rather than incidental.

Richer native choreography — CoreHaptics on iOS, VibrationEffect composition on Android, via a platform channel or native module — is P1 and a bonus, not a requirement. If you build it, say so loudly; it will earn credit. If you don't, spend the hours on the gesture and the pacing instead.

We will feel this on our own device. Haptics are not gradeable from video, at either bar.

Real-time 3D, GPU-accelerated. The pack, box or crate is an actual object in an actual scene — geometry, materials, lighting, camera. Not a sprite sheet, not a layered-parallax illusion, not a pre-rendered video. Requirements:

The object responds to the camera and to light — foil catches a highlight as it turns, the watch box has depth and shadow
The user's gesture drives the object directly: the thumb turns it, the tear deforms it, the lid lifts on the drag
Gyroscope input where it earns its place — tilt the phone, the highlight moves
A fallback path for devices where your renderer isn't supported. Detect it, degrade to a 2D reveal that still feels good, and say so in the README. Shipping something that white-screens on a third of Android is not shipping.
Recommended stack: react-three-fiber on expo-gl. Given three.js experience, this is the shortest path from what you already know to something running on a device, and it is a fully legitimate production choice — we are recommending it, not tolerating it.

react-native-webgpu is also permitted and we will not penalise the choice, but go in informed: it maps to Metal on iOS and Vulkan on Android, support on mid-range Android is uneven, and the RN bindings are young. That is a real engineering risk to take and a real one to decline. @shopify/react-native-skia, Filament, or something else are all open too.

Whatever you pick, state in the architecture doc why it is the better choice here, including the fallback path. We grade the reasoning, not the brand. What we will not accept is a choice made by default with no argument behind it.

Tension choreography. Contents ordered for drama, commons → rare last. The rare-pull moment is a graded artifact: we will ask you to show us your best pull and we will judge how it lands.

A summary moment. All items laid out, total value vs pack price, profit/loss — styled per category, satisfying to screenshot.

Multi-pack ripping (a design problem disguised as a feature)
A user buys ten packs. Ten full cinematic reveals back to back is torture — and skipping straight to a spreadsheet of results throws away the entire reason they bought ten. Solving that tension is the sharpest product-judgment test in this trial, and there is no single right answer. We want to see yours, and hear why.

Things you will have to decide:

Pacing. Does the choreography compress for bulk? Does each pack get a shorter beat with the batch's best pull earning the full treatment? Is there a rhythm across ten, or ten identical rips?
Agency. Tap to advance, hold to skip, skip-all, auto-play? A user who wants speed should get speed without losing the moment that mattered.
The batch summary. Everything pulled across ten packs, total spend versus total value, and the best pull surfaced as the hero. This is the screenshot they post.
Where tension lives. If a chase item is in pack seven of ten, the user should feel it coming. A batch that flattens every pull into the same beat has lost the plot.
Engineering requirements that come with it:

GPU discipline. Ten packs of 3D scenes in one session must not leak. Dispose geometries, materials and textures between packs; reuse what you can. A session that climbs in memory until it crashes or thermally throttles fails this section regardless of how good pack one looked.
Sustained frame pacing. Pack ten holds the same frame rate as pack one. Watch for thermal throttling on a real device — this is exactly where it shows up.
Per-pack resume. Kill the app at pack six of ten. On reopen, packs one to five stay revealed, six resumes or lands on its summary, seven to ten are still sealed. Nothing is re-rolled.
Frame pacing. 60fps minimum, 120 where the device offers it. Test on a real mid-range Android, not a flagship and not a simulator. The first rip of a cold session must not stutter — no shader compilation hitch, no first-render jank.

Interruption-safe, the mobile version. Contents are decided server-side at purchase and are immutable. The reveal must survive:

Backgrounding mid-rip (incoming call, app switcher, notification)
Process death — force-stop the app mid-reveal, reopen it
Rotation and safe-area changes
On return, the reveal either resumes at the right beat or lands on the summary. Contents are never lost, never re-rolled, never different.

Required performance report
This is a deliverable, not a remark in the README. Fill in this table with measured numbers, not estimates:

Metric	Value
Test device (model) and GPU	
Renderer used, and fallback used (if any)	
Time to first frame, cold session, first rip	
Median / worst frame time — pack 1	
Median / worst frame time — pack 10	
Peak memory — pack 1	
Peak memory — pack 10	
Memory after batch completes and reveal is dismissed	
Hours spent on toolchain/setup vs product	
If your renderer is unsupported on your test device, report the fallback path's numbers instead and say so. How you measured is part of the answer — tell us the tool.

Architecture requirement
Build the reveal as a framework, not two hardcoded screens. Category personality — models, materials, lighting rigs, camera moves, timing curves, haptic track, reveal-order rules, sound if you add it — should be configuration and composition over a shared reveal engine. The same engine drives a single rip and a 10-pack batch; bulk mode is a pacing configuration, not a second implementation.

On the review call we will hand you a third category — handbags — and ask you to wire it in live. If the answer is "copy the folder and rewrite it," the architecture failed.

Deliverable 2 — The Shelf, Drops & Purchase (the concurrency test)
Two ways to buy, one purchase path underneath.

The shelf (evergreen). Defined pack SKUs per category and tier, always available, each with finite stock that restocks. Browse, tap, buy, rip. This is the everyday loop and where most volume lives.

Timed drops (scarcity). A limited SKU released at a scheduled time with a fixed unit count. Countdown before, competition at go-live, inventory decrementing visibly in real time, clean sold-out state after.

The tier must be felt in the UI — a $10 rip and a $5,000 box should not look like the same product. Price the presentation, not just the pack. A drop should feel different from the shelf: scarcity is a design problem, not just a stock number.

Both paths run through the same atomic purchase logic. Do not fork it.

What must not break:

Exact inventory, on both paths: if N users buy the last M units of any SKU in the same millisecond — shelf or drop — exactly M succeed and exactly N−M get a clean sold-out state. Not M+1. Not M−1.
Atomic purchase: balance debit + inventory decrement + content generation happen in one transaction. No state where money is taken and no pack exists, or vice versa.
Contents server-side at purchase time, persisted and immutable. Replaying the reveal, killing the app, or calling the API directly can never change or re-roll a pull.
No overdraft: rapid or concurrent purchases can never take a balance negative.
Bulk purchase is all-or-nothing, or explicitly partial — never accidentally either. A 10-pack buy debits for exactly what it delivers. Decide what happens when a user asks for 10 and 7 remain: fail the whole thing, or fulfil 7 and charge for 7. Either is defensible; silently charging for 10 and delivering 7 is not. Document the choice.
One transaction for the batch. Ten packs' contents are generated and persisted together. No state where six packs exist and four are missing.
Idempotent under network loss. This is the mobile version of the double-click test and we take it seriously. Enable airplane mode mid-purchase. On reconnect, the client retries and the user is charged once and receives exactly what they paid for — one pack on a single buy, ten on a bulk buy, never twenty. Optimistic UI must roll back cleanly when the server disagrees.
You must ship a concurrency harness. Include scripts/hammer.ts (or equivalent) in the repo that fires N concurrent purchase requests at the last unit of a given SKU — shelf or drop — and prints the outcome. We will run it. Proving your own correctness is part of the job.

Deliverable 3 — Portfolio
The collection as a premium tracker — Robinhood energy, styled to the luxury identity.

Grid of owned items: image, name, category, rarity, current value, P&L since acquisition
Total portfolio value ticking with price drift (realtime subscription or polling — your call, document the tradeoff)
Filter by category; sort by value / P&L / recency
Per-item actions: view details, list for sale
Deliverable 4 — Marketplace
Fixed-price peer-to-peer trading. No auctions in this trial.

List an owned item at a chosen price; delist anytime before sale
Browse and search listings across categories
Buy instantly: money moves, item moves, fee is taken — one atomic transaction
Listings feel like the category they belong to — a watch listing should not be styled like a card listing
What must not break:

A listed item cannot sell to two buyers. One succeeds, one gets a clean "already sold."
A seller cannot list an item twice, sell an item they no longer own, or trade with themselves to mint money.
A buyer cannot spend the same funds twice via concurrent purchases.
Listing state and ownership never disagree — no item is both owned-and-listed by two people, or listed with no owner.
The platform fee is collected on every sale, exactly, and recorded.
Deliverable 5 — Economics Floor (an audit, not an algorithm)
We are not asking for an EV optimizer or dynamic rebalancing. We're asking for something simpler and stricter: the platform must not be a loss-making machine, and there must be no loopholes.

In your architecture doc, include a short "Why GrailHaus can't lose money" section:

Pack pricing vs contents: with your odds and catalog prices, expected contents value sits sensibly below pack price. Show the simple math per tier — a paragraph and a table, not a solver.
Fee integrity: every sale pays the fee; no path around it.
Loophole audit: walk the money paths and state why each of these is impossible — self-trading to inflate balance, buy/sell cycles that create money, selling to an alt account, revealing a pack twice, listing an item mid-sale, delisting during a purchase to duplicate an item or refund twice.
A thin admin screen closes the loop: packs sold, fees collected, contents payout vs pack revenue, margin per category. Simple numbers, honestly computed.

Catalog & Assets
No paid APIs, no scraping.

Generate a seeded catalog (LLMs welcome): ~30–50 items per category with believable names, tiers, rarities, images, and realistic USD prices. A Submariner is not $400; a common card is not $4,000. Commit the catalog to the repo.
Images: free assets, AI-generated, or tasteful placeholders. Cohesion and styling matter more than provenance.
Pokémon TCG API (free, no auth) may be used for card data and images.
Price drift: bounded simulated random walk so portfolio values tick without a Rolex drifting to $12. Document the bounds.
Tech Stack
Layer	Technology
Mobile client	React Native. A dev build (Expo prebuild or bare) — the graphics layer needs native modules, so Expo Go won't cut it.
Backend	TypeScript. Supabase Edge Functions / Postgres RPC, or a small Express/Fastify service.
Database	PostgreSQL (Supabase or Neon recommended — atomicity must be real and testable)
3D / graphics	react-three-fiber on expo-gl recommended. react-native-webgpu, Skia, Filament or others welcome with a clear written justification — see Deliverable 1.
Realtime	Supabase Realtime, WebSocket, or polling — your call, document the tradeoff
Financial math	Decimal on the server. Floating-point money is an automatic fail.
Distribution	Signed Android APK + Firebase App Distribution (or equivalent install link). iOS via TestFlight is welcome but optional — we will not penalise a Windows machine.
The backend is mandated in TypeScript because our house stack is TypeScript top to bottom and we need to see you write it. The client is React Native for the same reason, and because the graphics path we want to see runs there. See Before You Start on what that means for your ramp.

Submission
Installable build — a signed APK or install link that runs on a real Android device. iOS optional.
GitHub repo — clean code, README with setup, architecture overview, the completed performance table from Deliverable 1, and your scope cuts. Cutting scope is expected and graded; silent gaps read as misses.
Architecture document (2 pages): the reveal engine design and how a category personality is defined; your graphics library choice and the argument for it, including the fallback path for unsupported devices; your multi-pack pacing model and why; how you manage GPU memory across a batch; the atomic purchase path across shelf, drop and bulk buys; the "Why GrailHaus can't lose money" audit; your animation and haptics stack.
Concurrency harness — scripts/hammer.ts, documented, runnable by us.
Loom walkthrough (max 8 min): ~3 min ripping one pack per category including your best rare pull; ~2 min on a full 10-pack rip at real speed, uncut; ~3 min on the hardest problem you solved.
Evaluation Criteria
Criteria	Weight	What we look for
Reveal & 3D craft	28%	Two genuinely distinct category personalities on one engine. Real-time 3D that reads as a physical object — materials, lighting, gesture-driven motion. Gesture physics that behave like a physical object, not a triggered animation. Tension choreography and a rare-pull moment that lands. Luxury-grade polish — spacing, type, easing, restraint. The honest test: after using it, do we want to rip another?
Mobile-native feel & performance	20%	60/120fps on a mid-range device, held through pack ten of a batch. No GPU memory growth across a session. Clean cold start, no first-rip hitch. Measured, reported numbers with a named device — and a credible method behind them. Haptics designed as a sequenced track. Interruption-safe through backgrounding, process death and mid-batch resume. Fallback path for unsupported devices.
Correctness under concurrency	23%	Shelf and drop inventory never oversell by one unit in either direction. Purchases and trades atomic. Idempotent under network loss. Ownership and listing state never disagree. Survives the harness and our probing.
Architecture & system design	12%	Reveal engine is genuinely extensible — a third category is config, not a rewrite. Schema makes sense. Native boundary is deliberate. Tradeoffs documented.
Ship quality & release hygiene	9%	The build installs and runs. Versioning, signing, and distribution handled. README is honest and complete.
Product judgment	8%	The multi-pack pacing model — does ripping ten feel good or feel like a chore? Smart scope cuts, stated and reasoned. Parameter and library choices you can defend. Feels like one coherent product, not a feature list.
Note the balance: craft and mobile feel together are 48% — this is a product-engineering role and the rip is the product. But correctness at 23% is pass/fail in spirit. Neither half saves the other.

What We'll Test During Review (30 min)
We rip a 10-pack on our own phone, uninterrupted, watching the frame counter and memory. Then we do it again immediately to see what pack one of session two looks like. Both categories get ripped singly too. We'll name our favourite and least favourite moment and ask you to walk the code behind each — the timeline, the easing choices, why this duration, what you tried and threw away. Haptics get judged in the hand.
"Add handbags." We hand you a third category and you wire it into your reveal engine live, on screen share. We are watching how much of it is configuration and how much is new code.
We run your harness against the last unit of a shelf SKU and of a drop, and check the balances afterward.
Airplane mode mid-purchase of a 10-pack. Then reconnect. One charge, ten packs, not twenty.
"Walk me through your idempotency key." How it's constructed, who generates it, what happens if two of them collide, and what the server does to enforce single execution.
"Only 7 left, user asks for 10." What does your system do, and why is that the right call?
"Why this renderer?" Defend your graphics choice against the two obvious alternatives, and show us the fallback path running.
Force-stop at pack six of ten. Reopen. Packs one to five revealed, six resumes, seven to ten still sealed, nothing re-rolled.
Two devices, one listing. Simultaneous buys on the same item, then we check both balances and who owns it.
We hunt loopholes with your audit doc in one hand and your app in the other. Self-trades, alt-account sales, fee bypasses, replayed reveals, delist-during-purchase races.
"How would you have built this in Flutter, and what was genuinely harder in React Native?" An honest comparison, not a diplomatic one. Tell us what you missed from your own stack and what surprised you about ours.
We interrogate parameters: why these odds, why this fee, why this SKU ladder, why this pacing on the rare pull.
You must understand every line, including anything a model generated. The reveal code especially — "the library did it" is not an answer to "why does this easing curve feel right?"

Prioritization Guide
This trial is deliberately over-specified. Nobody finishes all of it in 40 hours, and we are not expecting you to. What we grade is where you spent the time and how honestly you tell us what you cut. Build the P0 list to a standard you're proud of before touching P1.

Must be excellent (P0):

Card rip in real-time 3D — gesture-driven with real gesture physics, sequenced haptics, 60fps, interruption-safe
Multi-pack rip with a deliberate pacing model and a batch summary that surfaces the best pull
Atomic purchase, single and bulk — no oversell on finite SKU stock, no overdraft, server-side contents, idempotent under network loss
Portfolio with live-ticking values
Installable signed build, plus a fallback path if your renderer isn't universally supported
The completed performance table, measured on a named mid-range Android
Should work (P1):

Watch reveal, fully distinct in pacing and personality
Fixed-price marketplace buy — atomic, no double-sell, fee collected
Timed drop with countdown, live inventory, and competition at go-live
Reveal engine clean enough to accept a third category live
Concurrency harness
Economics audit (the document matters more than the admin screen)
Native haptic choreography (CoreHaptics / VibrationEffect composition) above the sequenced-platform-haptics baseline
Cut these first, and say so (P2 / acceptable casualties):

Admin totals screen — the audit section in your doc covers the thinking
Marketplace search and filtering — list and buy is enough
Nice to have (P2):

Sound design layered with the haptic track
Shareable pull card via native share sheet / save to camera roll
Provably fair commit-reveal: commit a hashed seed at purchase, reveal it after, let the user verify the pull was not manipulated. Small to build and it punches well above its weight on the review call.
Push or local notification when a drop goes live
Price-history sparklines per item
Out of scope — do not build:

Sneakers. Two categories plus the live third prove the framework. Spend the hours on the two you're building.
A Note on AI Tools
Use whatever you want — Claude, Cursor, Copilot, AI-generated assets. We don't care how it's made; we care that you understand it and that it feels right.

The parts models struggle with here: haptic and animation taste (pacing, restraint, the difference between luxurious and cheesy), gesture physics on real hardware, GPU memory discipline across a long session, judging whether ripping ten packs actually feels good, the reveal engine's architecture, and transaction atomicity under real concurrency. Those need judgment. The review call is where we find out whose it was.

Time and Terms
40 hours of effort across up to 10 days, paid. You're currently employed, so we've set the outside window at ten days rather than seven — use it. Single submission.

Deliberately more than fits; see the prioritisation guide. Toolchain ramp is expected and reported, not penalised. Ask questions freely, including about tooling.

Build something that feels expensive in the hand and never loses a cent — on the first pack and on the tenth. The rip is the product. Make us feel it.
