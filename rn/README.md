# GrailHaus - React Native

Screen-by-screen RN implementation of the GrailHaus mockups. Expo managed
workflow. Every screen is one file under \`src/screens/\`.

## Run it

    cd rn
    npm install
    npx expo start

Press \`i\` for the iOS simulator or \`a\` for Android. The gesture screens
need a real touch surface, so use a device or simulator, not the web target.

## One thing to do first

Drop your logo at \`assets/logo.png\` (the PNG from the design file). Three
screens import it. Without it Metro will error on the missing asset.

## Files

    App.js                      state machine wiring every screen together
    src/theme.js                colours, springs, timings, button shadow
    src/data/packs.js           shelf inventory, pull contents, odds tables
    src/lib/money.js            integer-cent formatting
    src/lib/haptics.js          the two haptic vocabularies

    src/components/
      PackFace.js               SVG radial gradient + sheen + crimped foil
      GameButton.js             chunky button that sinks into its own shadow
      RayBurst.js               rotating ray field (conic-gradient stand-in)
      Screen.js                 the category-washed ground
      TabBar.js                 floating pill bar
      Dots.js                   page dots, active one stretches

    src/screens/
      TitleScreen.js            logo, ray burst, ten drifting cards
      OnboardingScreen.js       the three intro pages
      OddsScreen.js             odds table; pass gate for the pre-purchase stop
      ShelfScreen.js            category switch, three tiers, finite stock
      BuySheet.js               quantity, balance-after, partial-fulfil notice
      PackSelectScreen.js       3D fanned pack carousel
      CardRipScreen.js          swipe to tear, swipe through cards
      WatchUnboxScreen.js       drag the lid, velvet, rise, one glint
      ResultScreen.js           the payoff number
      CollectionScreen.js       owned grid with a locked slot
      DropScreen.js             timed drop; state="soon" | "live" | "closed"

## What the code actually enforces

**Money is integer cents.** \`src/lib/money.js\` formats; nothing divides. A
balance is never a float.

**The two reveals share nothing.** Cards use \`spring.cards\` (overshoot) and
spend haptics on frequency. Watches use \`cubic-bezier(.22,.61,.36,1)\` via
\`Easing.bezier\`, never overshoot, and spend their budget on silence — 1.1s
of dead air on the velvet before the 2.4s rise.

**Gestures are reversible and interruptible.** Both the foil peel and the
watch lid track 1:1, commit on travel *or* velocity, and otherwise return —
the foil springs, the lid falls under gravity. A new touch mid-settle takes
over.

**The rare pull cannot be rushed.** \`CardRipScreen\` disables the swipe
gesture for \`GATE_MS\` on a chase card. Input is absorbed, not queued.

**Scarcity is honest.** \`BuySheet\` states balance-after before the tap and
discloses partial fulfilment. \`DropScreen\` says plainly that losing a race
costs you nothing.

## Not implemented

These need a backend, so the screens are wired to local data:

- purchase transaction (debit + stock decrement + contents in one write)
- idempotency keys on retry
- seed-hash commit and reveal
- marketplace listing, delist and the 6% fee
- portfolio value drift

## Substitutions from the web mockups

- \`conic-gradient\` has no RN equivalent. \`RayBurst\` draws individual SVG
  polygons on a rotating, radially masked group.
- \`radial-gradient\` becomes an SVG \`RadialGradient\` in \`PackFace\`.
- CSS \`box-shadow\` with a hard offset becomes a sibling view behind the
  button, since RN shadows cannot be inset.
- Display type is Outfit. Wire it with \`expo-font\` and swap the weights in
  \`theme.js\`, or leave the numeric weights as they are.
