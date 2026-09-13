# GrailHaus

A React Native (Expo) port of two card-pack reveals from Claude Design
handoffs — GPU-real, gesture-torn foil packs, one per tier:

- **Street Rip** (Tier 1) — `grailhaus-pack.html` + `rip-pack.js` +
  `pack-art.js`, the "Trading Cards" category of the GrailHaus trial spec
  (see `design-handoff/instructions.md` for the full 40-hour brief this is
  one slice of). `src/reveal/`.
- **Vault Break** (Tier 2) — `grailhaus-vault-break.html` +
  `rip-pack.js`/`reveal.js` + `vault-art.js`/`card-art.js`/`art-util.js`, a
  later, separately-handed-off collector-luxury tier: a satin-violet pack,
  a metallic inner liner, and — once torn open — a staged multi-phase card
  reveal (stack → fan → a rarity "notice" moment for the Grail pull →
  tap-to-inspect) instead of Tier 1's cards-rise-together ending.
  `src/vault/`.

Both run from one screen (`App.tsx` has a small tier switcher pill at the
top — not part of either design handoff, just a reviewer convenience for
having both in one build). Vault Break is the default tier on launch.

## Scope of this pass

Tier 1's scope note still applies unchanged (see the paragraph below this
list — it predates Vault Break and nothing in it changed). Vault Break
adds the second tier's pack-tear + staged reveal + post-reveal card
inspection as its own standalone screen (`src/vault/VaultBreakScreen.tsx`)
sharing Tier 1's texture/gesture *infrastructure* (Skia canvas helpers,
the `noise()`/`makeDataTexture()` engine primitives) but not its
`CategoryPersonality` config shape — see "Vault Break (Tier 2)" below for
why. Neither tier implements accounts, the shelf, purchases, drops,
portfolio, marketplace, or the concurrency/economics work the full trial
also asks for; that scope was agreed explicitly before writing any code,
given how large the full brief is.

Run it:

```sh
npm install
npx expo run:android   # or: npx expo run:ios
```

This needs a dev build, not Expo Go — the graphics path uses native
modules (`expo-gl`, `@shopify/react-native-skia`).

## Architecture

```
src/reveal/
  config/            category personality (colors, copy, size, timing,
                     haptic thresholds) — a new category is a new file
                     here, not a new screen. Only "trading-cards" exists;
                     the shape in config/types.ts is what a "watches" or
                     "handbags" personality would also implement.
  engine/
    noise.ts         multi-octave noise, ported verbatim
    buildPackObject.ts   pure three.js: geometry, tear/peel/gape
                     deformation, torn-strip physics. Ported from
                     project/rip-pack.js almost unchanged — it never
                     touched the DOM in the original either.
    textures.ts      DataTexture wrapper + logo asset loader
  art/
    packArt.ts       ported from design-handoff/pack-art.js onto Skia's
                     offscreen canvas (see "Why Skia for textures" below)
    canvasHelpers.ts small canvas-2D-shaped wrapper over Skia's Paint/
                     Path/Shader API (gradients, tracked text, dashed
                     lines) so packArt.ts reads as a port, not a rewrite
  gesture/
    useTearGesture.ts  the 1:1 / reversible / velocity-aware / interruptible
                     state machine (see below)
  haptics/
    hapticTrack.ts   sequenced haptic track (tick / give / commit / success)
  scene/
    PackScene.tsx    r3f scene: lighting rig, the pack object, the
                     invisible hit-plane that turns raycasts into gesture
                     input, per-frame engine wiring
  ui/
    VignetteBackground.tsx   the page's CSS radial-gradient vignette,
                     redrawn with Skia's declarative <Canvas>
  PackRevealScreen.tsx   the screen: loads the logo, lays the overlay
                     text and Reseal control over the Canvas
```

### Why react-three-fiber + expo-gl

`instructions.md` recommends this stack explicitly, and it's the shortest
path from the prototype: `rip-pack.js` is pure `three.js` math (geometry
construction, procedural vertex deformation, a small ballistic sim for the
torn strip) with **no DOM dependency** beyond where its texture came from —
so nearly the entire file ports unchanged into `engine/buildPackObject.ts`
(the original is kept for reference at `design-handoff/rip-pack.js`).
An `@shopify/react-native-skia` port would mean re-deriving the pillowed
3D geometry, per-vertex tear/peel/crinkle deformation, and lighting as a
2D approximation — a reinterpretation, not a port, and it's exactly the
"real-time 3D … not a layered-parallax illusion" the trial spec asks for.

**Fallback path**: not built in this pass. The trial's own answer —
detect an unsupported GL context and degrade to a 2D swipe-reveal — is a
second reveal implementation and out of scope for this patch; flagged
here rather than silently skipped.

### Why Skia for textures

React Native has no DOM `<canvas>`, so `rip-pack.js`'s
`new THREE.CanvasTexture(canvas)` has nothing to wrap. Two options:
pre-bake PNGs at build time, or generate the same art at runtime with a
canvas-shaped API. `@shopify/react-native-skia`'s CPU-backed offscreen
surface (`Skia.Surface.Make`, not `MakeOffscreen` — deliberately CPU, not
GPU, so there's no cross-context handoff between Skia's own GPU surface
and expo-gl's separate GL context) draws with a Paint/Path/Shader
vocabulary close enough to Canvas2D that `packArt.ts` is a function-for-
function port of `pack-art.js`, and `surface.getCanvas().readPixels(...)`
hands back a raw RGBA8 buffer that becomes a `THREE.DataTexture` directly
— no PNG encode/decode round trip. Textures are generated once per pack
build, not per frame.

One deliberate deviation: the front-panel's no-logo fallback drew a red
"clawMark" burst in the original file — leftover from an earlier,
differently-branded iteration in the chat history that never got cleaned
up in that specific branch. This port draws the gold ring+diamond+"G"
emblem (used elsewhere on the back face) instead, since a red claw burst
makes no sense on the GrailHaus violet/gold identity the rest of the pack
settled on.

**Texture resolution**: 640×960 (front/back) and 480×672 (card, one
texture shared across every card mesh) versus the prototype's 800×1200 —
a phone shows this pack at a fraction of a browser preview's width, so
the extra resolution was memory the pack didn't need. Every pixel
constant in `packArt.ts` is scaled by `width / 800`, so this is a tuning
knob, not a hardcoded assumption.

**Font**: baked-texture text uses Skia's `FontMgr.System().matchFamilyStyle`
against `"Georgia"` — the prototype's own CSS fallback chain was
`"Cormorant Garamond", Georgia, serif`, and Georgia is a real system font
on iOS; Android's FontMgr degrades to its default serif. Bundling the
actual Cormorant Garamond TTF for pixel-parity was cut for time — noted
here rather than left silent.

### Gesture physics — the four hard requirements

`useTearGesture.ts` reads pointer input off **react-three-fiber's own
raycasted pointer events**, not `react-native-gesture-handler`. Reasoning:
r3f-native's `Canvas` already installs its own `PanResponder` internally
to synthesize the pointer events its raycasting event system needs (see
`node_modules/@react-three/fiber/native/dist/*.cjs.dev.js`) — layering
RNGH's native gesture recognizers over the *same* view is two competing
touch-responder systems on one view tree, which is exactly the kind of
thing that produces intermittent, hard-to-repro gesture bugs on device.
Reading `event.point` (already a 3D intersection, converted to the pack's
local space with `pack.group.worldToLocal`) also deletes the screen-space
camera-projection math the web version needed (`cutSpan`/`cutAt` in
`grailhaus-pack.html`) — the intersection point is already in the same
local units as `seamY`/`W`.

- **1:1 finger tracking** — `progress` is set directly from the local-space
  fraction while `dragging` is true; no smoothing filter.
- **Reversible mid-gesture** — `onPointerUp` picks a spring target of 0 or
  1; letting go mid-pull springs back unless the flick/distance bar is met.
- **Velocity-aware completion** — release velocity feeds the spring's
  initial velocity *and* lowers the distance bar for completion (a flick
  finishes it, a slow drag past the same point doesn't).
- **Interruptible** — `onPointerDown` cancels any live settle spring
  outright, so a new touch takes over instantly, mid-animation or not.

### Haptics

`hapticTrack.ts` — a light tick every `1/14`th of the tear, a sharper
medium impact the instant the foil visibly gives, a heavy impact the
instant a release *commits* to completing (not when the spring finishes
animating), and a success notification if the user drags all the way
through without releasing. This is the P0 "sequenced platform-level
haptics" bar (`expo-haptics`) — the P1 bonus (CoreHaptics /
`VibrationEffect` composition) was not attempted.

### GPU memory discipline

`buildPackObject` returns a `dispose()` that frees every geometry,
material and texture it allocated (7 geometries, 9 materials, 4 textures
— see the arrays in `buildPackObject.ts`). `PackScene` calls it on
unmount/personality change. The full trial's per-batch memory-growth
requirement (ten packs in one session) isn't exercised here since bulk
ripping is out of this patch's scope, but the single-pack path is already
clean rather than leaking by default.

## What's cut from this pass (be upfront about it)

- **No fallback 2D path** for unsupported GL contexts.
- **No sequential per-card reveal / rare-pull slow-burn** — this pack
  tears open and all cards rise/fan together, matching the prototype's
  own behavior. The full trial wants commons-first, rare-last pacing
  across individual card flips; that's a different (larger) piece of work
  than "the pack."
- **No gyroscope-driven highlight.**
- **No bundled Cormorant Garamond TTF** (see Font, above).
- **Not run on a physical device or simulator** — this patch was built and
  type-checked (`npm run typecheck`, zero errors) in an environment
  without an iOS/Android runtime available. Treat the gesture/engine code
  as reviewed-carefully-but-unverified-on-hardware, not measured. The
  trial's own required performance table (cold-start frame time, memory
  per pack, frame pacing) could not be produced here for that reason —
  filling it in on a real mid-range Android is the first thing to do
  before trusting this feels right in the hand.

## Vault Break (Tier 2)

```
src/vault/
  config/
    types.ts          VaultBreakPersonality — deliberately its own shape,
                     not an extension of ../../reveal/config/types.ts's
                     CategoryPersonality. Tier 1's shape is a palette/copy/
                     timing swap over one shared tear-only engine; Vault
                     Break adds a whole second engine stage (the staged
                     reveal, a liner, post-reveal inspection) that shape
                     has no room for without optional fields nothing else
                     would use. Two tiers isn't yet a pattern worth a
                     deeper shared hierarchy over — project/tiers.js
                     itself keeps Tier 1 and Tier 2 as two config objects,
                     not a type hierarchy, and this follows that.
    vaultBreak.config.ts   the tier's numbers, carried over unchanged from
                     project/tiers.js's 'vault-break' entry and
                     project/card-art.js's vaultBreakDeck().
  art/
    artUtil.ts       ported from project/art-util.js — metalFill,
                     hairlines, grooveLine, guilloche, microBlock,
                     barcode, embossText — the shared drawing vocabulary
                     vault-art.js and card-art.js both built on in the
                     original. Layered on ../../reveal/art/canvasHelpers.ts
                     rather than duplicating its Paint/Path/Shader
                     plumbing.
    vaultArt.ts      ported from project/vault-art.js — the pack front/
                     back/liner/crimp-glint art.
    cardArt.ts       ported from project/card-art.js — the six collector
                     card faces + shared verso.
  engine/
    buildVaultPackObject.ts   ported from project/rip-pack.js's
                     buildPack(), specialised to Vault Break's config:
                     same tear/peel/gape deformation as Tier 1's
                     buildPackObject.ts, plus the liner and the reveal
                     wiring Tier 1 never needed. Reuses
                     ../../reveal/engine/noise.ts and
                     ../../reveal/engine/textures.ts as-is rather than
                     forking them.
    buildReveal.ts   ported from project/reveal.js — the phase machine
                     (stack → hold → rise → separate → settle → notice →
                     approach → reveal → present → ready), spring-driven
                     per-card targets, and inspection (pick/hero-drag/
                     zoom/flip). The only real change: `pick()` takes an
                     already-cast `THREE.Ray` instead of an NDC point +
                     camera, for the same reason as Tier 1's gesture hook
                     (see below).
  gesture/
    useVaultInteraction.ts   the *whole* pointer state machine from
                     grailhaus-vault-break.html's script — tear, then
                     (once open) pick/drag/pinch/double-tap/orbit — as one
                     hook, because the original is one coherent state
                     machine keyed off `orbit` / `reveal.state.ready` /
                     `progress`, not two. See "Gesture reinterpretation
                     for touch" below for what changed reaching mobile.
  haptics/
    vaultHapticTrack.ts   the original's `navigator.vibrate(ms)` calls
                     (6 / 5 / 38 / 8 / 20ms, at grab / tick / tear-commit /
                     card-pick / collect) re-expressed as expo-haptics
                     impact styles — same P0-not-P1 baseline as Tier 1's
                     `hapticTrack.ts`.
  scene/
    VaultScene.tsx   r3f scene: the "private collector space" lighting
                     rig (warm key + violet rim + champagne kick + dim
                     hemi + a focused rarity spot — this replaces
                     three-d-stage.js's neutral studio defaults, exactly
                     as the original page's script does), the floor +
                     back wall, the pack object, the interaction plane,
                     and the per-frame camera/lighting choreography across
                     the reveal's phases.
  ui/
    VaultVignette.tsx   the page's `#vign` CSS radial-gradient vignette,
                     redrawn with Skia's declarative `<Canvas>` — same
                     technique as Tier 1's VignetteBackground.tsx.
  VaultBreakScreen.tsx   the screen: loads the logo, lays the kicker/
                     title/meta, seam-drag hint, card-note, and Orbit/
                     Reseal/Add-to-collection pills over the Canvas.
```

### Gesture reinterpretation for touch

The original is mouse/keyboard/trackpad-shaped in three places that have
no direct mobile equivalent. Each is called out here rather than left
silent, matching this README's own standard for Tier 1:

- **`wheel` → pinch.** Desktop zoom of the inspected card
  (`reveal.zoomHero(e.deltaY * ...)`) becomes two-finger pinch-to-zoom,
  tracked as a delta on the distance between two active pointers on the
  interaction plane.
- **`dblclick` → double-tap.** Flipping the inspected card
  (`reveal.flipHero()`) becomes a same-card tap within 320ms of the
  previous one, detected by hand since RN's pointer stream has no native
  double-tap event.
- **Free orbit → hand-rolled spherical drag + pinch-dolly.** The "Orbit"
  pill originally handed control to three.js's `OrbitControls` addon,
  which is DOM-only (drag listeners bound to a canvas element) and has no
  React Native build. A small spherical-coordinates orbit
  (`useVaultInteraction.ts`'s `orbitTheta`/`orbitPhi`/`orbitRadius`) drives
  the camera instead when orbit mode is on, rotated by single-finger drag
  and dollied by pinch — same two gestures OrbitControls exposed
  (drag-to-rotate, pinch/wheel-to-zoom), just reimplemented for touch.

One structural difference from `useTearGesture.ts` worth flagging:
`pick()`'s ray comes from the *interaction plane's* pointer event, not a
plane parented to the pack. `PackScene.tsx`'s tear plane is a child of
`pack.group` on purpose (screen-space maths collapses to pack-local
division). Vault Break's plane deliberately isn't — the pack leans during
a tear reaction and the fan spreads cards sideways later, so a
pack-parented plane would drag the touch target around under the user's
finger. Sitting the plane in fixed world space keeps it predictable; the
tear phase still recovers correct pack-local X/Y via
`pack.group.worldToLocal()`, which accounts for any lean regardless of
where the plane itself sits. See the comment above the plane in
`VaultScene.tsx`.

### The liner, and other things Tier 1 didn't need

- **Inner liner.** `buildVaultPackObject.ts` builds the brushed-champagne
  liner mesh (`vaultArt.ts`'s `drawLiner()`) and toggles its visibility
  once the mouth gapes past 1.5%, exactly mirroring `rip-pack.js`'s own
  `liner.visible = open > 0.015` line — Tier 1 has no liner at all
  (`cfg.liner.enabled` was `false` for street-rip in the original
  `tiers.js`, so `PackScene.tsx` never grew this code path).
- **Foil pre-stretch.** Vault Break's foil resists for the first 5% of
  drag before the tear front starts moving (`tear.stretch = 0.05` in the
  config, `setStretch()` on the pack) — a "denser material" cue Tier 1's
  `tear.stretch = 0` never exercises. Ported into
  `useVaultInteraction.ts`'s tear-drag branch.
- **The staged reveal itself.** This is the piece Tier 1's own README
  explicitly cut ("No sequential per-card reveal / rare-pull slow-burn...
  that's a different (larger) piece of work than 'the pack'") — Vault
  Break's `buildReveal.ts` is that larger piece: a nine-phase sequence
  with per-card critically-damped springs, a Grail that's deliberately
  placed mid-fan and face-turned-away until the "notice" phase lights it,
  and free-rotate/zoom/flip inspection once the sequence finishes.

### Texture resolution & font

Same reasoning as Tier 1 (see that section above): 640×960 for the front/
back foil panels versus the prototype's 800×1200 browser-preview canvas,
256×256 for the liner web, 512×32 for the crimp glint. Card faces are
310×434 (native resolution in `cardArt.ts`, itself already half the
prototype's 620×868 — not further scaled). Baked-texture type uses the
same `Skia.FontMgr.System().matchFamilyStyle('Georgia', ...)` fallback as
Tier 1, for the same reason (no bundled Cormorant Garamond TTF — a scope
cut, not an oversight).

### What's cut from this pass (Vault Break)

- **No fallback 2D path**, same as Tier 1.
- **No gyroscope-driven highlight**, same as Tier 1.
- **No bundled Cormorant Garamond TTF**, same as Tier 1.
- **Not run on a physical device or simulator.** Built and type-checked
  (`npm run typecheck`, zero errors) in an environment without an iOS/
  Android runtime. The pinch/double-tap/orbit gestures in particular are
  reviewed-carefully-but-unverified-on-hardware — multi-touch pointer
  tracking through r3f-native's event system is the piece of this patch
  with the least precedent to lean on, and is the first thing worth
  putting in front of a real device.
- **One reproduced-but-inert original behavior, dropped rather than
  faithfully ported:** the original's `#vign` vignette sets
  `opacity = 1 + dim*0.5` during the rarity moment, but the element's
  baseline CSS opacity is already 1 (unset in its rule), so pushing it
  past 1 is clamped by the browser and was already a no-op there.
  `VaultVignette.tsx` renders at a constant opacity instead of wiring up
  an `Animated.Value` to reproduce a visual effect the original itself
  didn't actually have.

## `design-handoff/`

Reference only — not imported by the app:

- `grailhaus-pack.html`, `rip-pack.js`, `pack-art.js`, `three-d-stage.js`
  — the original Tier 1 Claude Design prototype this patch ports.
- `grailhaus-vault-break.html`, `vault-art.js`, `card-art.js`, `reveal.js`,
  `art-util.js`, `tiers.js` — the original Tier 2 Claude Design prototype
  (`rip-pack.js` above is shared by both tiers; `tiers.js` is the config
  object that switches the shared engine between them).
- `chat1.md` — Tier 1's design iteration history. Genuinely worth reading
  before touching the tear physics; several "obvious" choices in
  `useTearGesture.ts` and `buildPackObject.ts`'s deformation math exist
  because earlier, more naive versions were tried in that chat and
  rejected for specific, articulated reasons (e.g. why the tear edge is
  multi-octave noise and not a straight line, why the strip falls under
  gravity instead of animating to a preset, why completion is judged
  against distance-still-reachable-from-grab-point rather than a fixed
  threshold).
- `vault-chat1.md` — Tier 2's (much shorter) handoff conversation.
- `instructions.md` — the full 40-hour trial brief this patch is one
  slice of.
- `GrailHaus Product Requirements Document.md` — product spec the card
  face's copy (rarity ribbon, valuation block, authentication footer)
  is drawn from.

The full handoff bundle (screenshots, PDFs, other uploads) was left out
of this patch to keep it to the code and the documents actually worth a
reviewer's time — ask if you want the rest included too.
