import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import { Object3D } from "three";
import type { Group, InstancedMesh, Mesh, PointLight } from "three";
import type { SharedValue } from "react-native-reanimated";
import { contrastHexFor, resolveCaseMetalHex, resolveDialColorHex } from "./watchCatalogColors";

// Heritage Case, ported from the Claude Design handoff (heritage-case.html /
// heritage-case.js / three-d-stage.js) onto the `lift-lid-box` archetype this app already
// has wired up. The desktop prototype builds a millimeter-accurate case (ExtrudeGeometry
// walls with real cavities, canvas-baked wood-grain/emblem textures, a PMREM environment
// map, 2048px shadow maps) — none of that is a fit for an expo-gl reveal that has to hold
// 60fps on a mid-range phone next to a shared, unmodified RevealEngine, so this rebuilds
// the same *choreography* (resisted lift, dead-air dwell, cushion-and-watch rising
// together, one glint, a small hero tilt, no bounce anywhere) out of primitive geometry
// and flat PBR colors, the same budget CardMesh/HandbagMesh already spend.
//
// Timing is tied to the actual `watches` row in categories (seedCategories.ts:
// commonBeatMs 1400 / rareHoldMs 3000, the window RevealEngine holds `phase: "opening"`
// open before moving on) rather than either prototype's own seconds — the choreography
// below is paced to read as complete, unhurried, inside the *shorter* of those two
// windows, so a common pull never looks cut off.
//
// Every position below is additionally a resting-state default in the JSX itself (lid
// closed, platform at its base height, pivot untilted) — useFrame only ever adjusts
// refs, so a frame that renders before the first useFrame tick still shows the closed
// case, not a pop from zero.

// Brighter than the source prototype's own values on purpose — that build lit these through a
// PMREM environment map plus 2048px-shadow key/rim lights; this category's actual configured rig
// (seedCategories.ts: one 0.2 ambient + one 0.9 directional, against a #0a0908 background) is far
// weaker, and the prototype's near-black wood/velvet tones rendered as indistinguishable from the
// background under it — effectively invisible, not just moody. Paired with each material's own
// small `emissive` below (a self-lit floor brightness that doesn't depend on scene lighting at
// all), so this reads as a real object even under a dim/differently-tuned rig, the same reason
// `interiorLightRef` exists as this archetype's own bespoke light rather than trusting the
// category's shared pair alone.
//
// `emissiveIntensity` on all three is deliberately low (not the 0.5-0.6 first tried) — that was
// visible, but it washed out the directional light's own shading gradient across each face,
// reading as a flat, unlit-looking sticker rather than a real lit object. This keeps just enough
// of a floor to never go fully invisible while leaving the actual PBR shading doing most of the
// work — base colors bumped up slightly again to compensate for the lower emissive floor.
const WALNUT = "#8f5c38";
const WALNUT_EMISSIVE = "#2b1808";
const BRASS = "#c9a24b"; // matches this category's admin-configured palette accent
const BRASS_DARK = "#8a6c39";
const VELVET = "#7d2838";
const VELVET_EMISSIVE = "#280a10";
const VELVET_LINING = "#c9a97c";
const LEATHER = "#5a3a1f";
const LEATHER_EMISSIVE = "#1c0f06";
// Same underlying problem as WALNUT/VELVET/LEATHER above, on a different material property this
// time: a near-1.0 metalness with no environment map to reflect (this scene has none — no cost
// budget for a PMREM/cubemap on mobile GL) renders almost entirely black, since a real metal's
// visible color comes from reflected environment light, not its own diffuse albedo. That's what
// was reading as a plain black ring instead of a steel band/case. Metalness pulled down to a
// satin/brushed-metal range instead, which still looks like metal but derives its brightness from
// the scene's actual point/directional lights rather than reflections that don't exist here.
const STEEL = "#c7cdd2";
// The band (below) is a full ring wrapped around the cushion — most of its underside necessarily
// faces away from this scene's single overhead directional light, with nothing (no envmap) to
// bounce a reflection off instead, unlike the case above whose faces happen to point toward that
// same light. That's what was rendering as a solid black blob rather than metal. Same fix as
// WALNUT/VELVET/LEATHER's own emissive floor, on a brighter/cooler base so it still reads as
// steel rather than bronze.
const BAND_STEEL = "#d7dce0";
const BAND_STEEL_EMISSIVE = "#4a4e52";
const GLINT = "#fff6df";

const W = 1.3, D = 1.0;
const BODY_H = 0.42, LID_H = 0.26;
const WALL = 0.05;
const RECESS = 0.16;

const LID_MAX_RAD = 1.92; // ~110°, same travel as the source prototype
const LID_DAMP = 5; // critically-damped approach rate, no overshoot at either stop
const OPEN_LATCH = 0.98; // openProgress past this = "the lid is open," latched, never undone

const CUSHION_R = 0.14;
const PLATFORM_BASE_Y = BODY_H - RECESS + CUSHION_R;

// Bracelet — the source (watch-builder.js's `braceletGrp`) never builds this as one smooth ring:
// it's ~46 individual short link segments swept around a circle, alternating a polished center
// link with two brushed side links, with a gap left where the case sits. That construction
// matters, not just as detail-for-detail fidelity — a smooth torus tube viewed at a grazing angle
// (this app's camera has no oblique offset; see the strap mesh's own comment below) collapses to
// a bare line, the same failure two earlier passes at this ran into, but a fan of small flat
// plates each catching the single directional light at a slightly different angle reads as a
// real pleated bracelet even edge-on — exactly what the source's own reference screenshots show
// (screenshots/01-strap.png, 01-p3.png): an alternating light/dark accordion drape, not a ring.
//
// That segmented-link build went through several rounds and never stopped being fragile: with
// `ExploreOrbit` letting the user spin the whole piece to an arbitrary angle (not just this
// category's one fixed camera), there's no single set of link positions that reads as a
// continuous drape from every angle — from some angles the visible links clump together, from
// others they thin out to almost nothing. Replaced with the same technique watch-builder.js's own
// "leather" strap type uses: one continuous partial-torus arc (gapped only where the case sits),
// flattened into a strap cross-section via a non-uniform scale rather than left as a round tube.
// A single continuous mesh can't visually clump or gap depending on viewing angle the way
// discrete links can — it reads as one strap from any orbit angle by construction.
const BRACELET_LOOP_R = CUSHION_R + 0.03;
const BRACELET_TUBE = 0.016;
// A round tube read as a thin wire, not a strap — flattening its cross-section along what becomes
// (after the rotation below) the loop's own "depth" direction turns it into a proper flat band.
const BRACELET_FLATTEN = 3.4;
// Degrees measured the same way the source measures them (0° = straight out toward the camera/
// front of the cushion, 90° = straight up) — skip the arc where the watch case actually sits on
// top, same 56°-wide gap centered on "up" the source itself leaves open.
const BRACELET_GAP_START_DEG = 62;
const BRACELET_GAP_END_DEG = 118;
const BRACELET_GAP_A_RAD = (BRACELET_GAP_START_DEG * Math.PI) / 180;
const BRACELET_GAP_B_RAD = (BRACELET_GAP_END_DEG * Math.PI) / 180;
const BRACELET_ARC = Math.PI * 2 - (BRACELET_GAP_B_RAD - BRACELET_GAP_A_RAD);
const RISE_HEIGHT = 0.16; // a visible but modest lift — "a few centimeters," not a launch
// RevealEngine holds `phase: "opening"` open for `commonBeatMs` (1400ms) on a common pull, 3x
// that on the rare one (seedCategories.ts) — the previous DWELL_S+RISE_S only spent ~0.85s of
// that 1.4s budget, so a common pull's whole lift-rise-tilt-glint sequence finished with over a
// third of its own window still unused, which read as rushed ("just went to revealed") rather
// than unhurried. These now spend close to the full common-pull budget instead of a fraction of
// it, with margin so nothing clips even on a slow device frame.
const DWELL_S = 0.45; // pure velvet/interior beat before anything stirs — was 0.3
const RISE_S = 0.75; // was 0.55
const HERO_TILT_X = 0.3; // tilt the dial toward the lens
const HERO_TURN_Y = 0.22; // ~13° hero turn
const GLINT_START = 0.4; // fraction of the rise before the crystal glint is allowed to fire
const GLINT_S = 0.45;
const IDLE_GLINT_PERIOD_S = 4.5; // ambient sparkle repeat rate once the reveal glint is done

// This category's configured camera (seedCategories.ts: position [0, 0.4, 3.2], fov 40) has a
// visible frame only ~1.07 world units wide at that distance — narrower than this case's own
// W=1.3, so the unscaled case overflowed both edges of the screen entirely rather than sitting
// centered with room around it. 0.42 brings it to a comfortable ~55% of frame width. A single
// wrapping <group scale> below (not rescaling every individual dimension by hand) so every
// measurement in this file stays internally consistent with itself.
const CASE_SCALE = 0.42;

export function WatchMesh({
  tierColor,
  openProgress,
  dialColorName,
  caseMaterialName,
  watchName,
}: {
  tierColor: string;
  openProgress: SharedValue<number>;
  /** The pulled item's own `dial_color` catalog column (e.g. "Turquoise Blue") — every dial
   * used to render as `tierColor` (the pack's rarity-tier hex) regardless of which specific watch
   * was pulled, since the mesh never received the item's own data at all. Optional/nullable since
   * a catalog row can leave it blank; falls back to `tierColor` in that case, same as before this
   * fix existed. */
  dialColorName?: string | null;
  /** The pulled item's own `case_material` catalog column (e.g. "Titanium", "Oystersteel"). */
  caseMaterialName?: string | null;
  /** The pulled item's own `watch_name` column (e.g. "Oyster Perpetual") — used only for the
   * dateWindow heuristic below, mirroring watch-catalog.js's own
   * `/Datejust|Oyster Perpetual|Seamaster/.test(row.name)`. */
  watchName?: string | null;
}) {
  const dialHex = resolveDialColorHex(dialColorName, tierColor);
  const caseHex = resolveCaseMetalHex(caseMaterialName, STEEL);
  const hasDateWindow = watchName ? /Datejust|Oyster Perpetual|Seamaster/i.test(watchName) : false;
  const tickCount = hasDateWindow ? 10 : 11;
  const faceHex = contrastHexFor(dialHex);

  const lidRef = useRef<Group>(null);
  const platformRef = useRef<Group>(null);
  const watchPivotRef = useRef<Group>(null);
  const interiorLightRef = useRef<PointLight>(null);
  const glintRef = useRef<Mesh>(null);
  const secondHandRef = useRef<Mesh>(null);
  const tickMeshRef = useRef<InstancedMesh>(null);

  // The hour-tick marks are static — none of them ever move — so they're one GPU-instanced draw
  // call instead of 10-11 separate mesh/geometry/material triples. Set once on mount via a scratch
  // Object3D, not every frame: this whole scene was already a lot of individual meshes for a
  // mobile GL context (case, lid, hinges, medallion, nameplate, bracelet...), and adding more
  // fully separate draw calls for ornamental detail that never animates was the wrong trade even
  // before accounting for how much slower an Android emulator's typically-software GL path is
  // than a real device's. Re-runs when `tickCount` changes (i.e. when `hasDateWindow` flips,
  // which only happens across a mount, not mid-reveal) so the 3-o'clock slot correctly holds
  // either a tick or the date window, never both.
  useLayoutEffect(() => {
    const mesh = tickMeshRef.current;
    if (!mesh) return;
    const dummy = new Object3D();
    let idx = 0;
    for (let i = 0; i < 12; i++) {
      if (i === 0) continue; // 12 o'clock is the brand mark instead, see below
      if (hasDateWindow && i === 3) continue; // 3 o'clock is the date window instead
      const a = (i / 12) * Math.PI * 2;
      dummy.position.set(Math.sin(a) * 0.115, 0.097, Math.cos(a) * 0.115);
      dummy.rotation.set(0, -a, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      idx += 1;
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [hasDateWindow]);

  // Choreography state lives in refs, not React state — every field below is written and
  // read only inside useFrame, so a 60fps reveal never triggers a single re-render.
  const lidAngle = useRef(0);
  const opened = useRef(false);
  const openedAt = useRef(0);
  const glintStartedAt = useRef<number | null>(null);
  const glintDone = useRef(false);

  useFrame((state, delta) => {
    const p = openProgress.value;
    const elapsed = state.clock.elapsedTime;

    // The seconds hand runs continuously from the moment the mesh mounts, real watch speed (one
    // sweep per 60s) — the one piece of "this watch is alive, not a photo" motion that's visible
    // regardless of how briefly or long the reveal holds on it, unlike the hour/minute hands
    // (whose real-time movement over a few seconds would be imperceptible) or the one-shot glint
    // below (which needs the case to have opened first).
    if (secondHandRef.current) secondHandRef.current.rotation.z = -((elapsed % 60) / 60) * Math.PI * 2;

    // Lid: eases toward whatever the gesture (or its post-release settle) currently wants,
    // never overshooting — the tonal opposite of a card's tear/snap.
    const targetAngle = Math.max(0, Math.min(1, p)) * LID_MAX_RAD;
    lidAngle.current += (targetAngle - lidAngle.current) * Math.min(1, delta * LID_DAMP);
    if (lidRef.current) lidRef.current.rotation.x = -lidAngle.current;

    if (!opened.current && p >= OPEN_LATCH) {
      opened.current = true;
      openedAt.current = elapsed;
    }

    // Interior light breathes in with the lid itself, well before the watch ever moves —
    // matches the source's "light spills in" beat. A small non-zero floor even while fully
    // closed (0.08, not 0) — not physically accurate for a sealed case, but this is the one
    // light this archetype can rely on regardless of the category's own configured rig (see
    // WALNUT's own comment), and a case that's genuinely pitch dark at rest reads as broken,
    // not as "sealed" — subtle enough not to spoil the actual light-spilling-in beat below.
    const openness = lidAngle.current / LID_MAX_RAD;
    if (interiorLightRef.current) {
      interiorLightRef.current.intensity = 0.08 + 0.55 * Math.max(0, openness - 0.1);
    }

    if (opened.current) {
      const t = elapsed - openedAt.current;
      const riseLinear = Math.max(0, Math.min(1, (t - DWELL_S) / RISE_S));
      const riseEased = 1 - (1 - riseLinear) ** 3; // ease-out cubic: weighted, no bounce

      if (platformRef.current) platformRef.current.position.y = PLATFORM_BASE_Y + RISE_HEIGHT * riseEased;
      if (watchPivotRef.current) {
        watchPivotRef.current.rotation.x = HERO_TILT_X * riseEased;
        watchPivotRef.current.rotation.y = HERO_TURN_Y * riseEased;
      }
      if (interiorLightRef.current) {
        interiorLightRef.current.intensity += 0.5 * riseEased;
      }

      if (!glintDone.current && riseEased > GLINT_START) {
        if (glintStartedAt.current === null) glintStartedAt.current = elapsed;
        const gt = Math.min(1, (elapsed - glintStartedAt.current) / GLINT_S);
        const mat = glintRef.current?.material;
        if (glintRef.current && mat && !Array.isArray(mat)) {
          glintRef.current.position.x = -0.09 + gt * 0.18;
          mat.opacity = Math.sin(gt * Math.PI) * 0.6;
        }
        if (gt >= 1) glintDone.current = true;
      } else if (glintDone.current && glintRef.current) {
        // The one-shot reveal glint above is deliberately never repeated on its own timer — but
        // once it's done, a slower ambient sparkle keeps the case from going visually static for
        // however long the user lingers in Inspection (settled phase has no time limit; see
        // RevealEngine's own removal of its old flat auto-advance timer).
        const period = IDLE_GLINT_PERIOD_S;
        const phase = elapsed % period;
        const mat = glintRef.current.material;
        if (mat && !Array.isArray(mat)) {
          if (phase < GLINT_S) {
            const gt = phase / GLINT_S;
            glintRef.current.position.x = -0.09 + gt * 0.18;
            mat.opacity = Math.sin(gt * Math.PI) * 0.45;
          } else {
            mat.opacity = 0;
          }
        }
      }
    }
  });

  return (
    // CASE_SCALE wraps everything below so the whole case (offset included — the inner group's
    // own -BODY_H position is inside this wrapper too, not sibling to it, so the centering math
    // and the geometry shrink together rather than drifting apart) renders at a size that
    // actually fits this category's configured camera framing.
    <group scale={CASE_SCALE}>
    {/* This category's Canvas has no orbit controls — config.camera is a fixed shot at the
        world origin (see RevealEngine.tsx), so unlike the source prototype (which frames
        this box through a user-orbitable camera) the geometry itself has to sit centered on
        origin rather than resting on a y=0 floor. Shifted down by one body-height so the
        opening/watch sit near origin and the box reads centered against the fixed shot —
        same convention CardMesh/HandbagMesh already use. */}
    <group position={[0, -BODY_H, 0]}>
      {/* Warm interior glow — the one bespoke light this archetype adds beyond the category's
          own configured ambient/directional pair (TiltLights), on purpose: a single extra
          point light is the cheapest way to sell "light spilling into the case" and stays well
          inside a mobile GL budget. No shadows anywhere in this tree. */}
      <pointLight ref={interiorLightRef} color="#ffcf8f" intensity={0.08} distance={1.6} decay={2} position={[0, BODY_H + 0.14, 0.05]} />

      {/* Body */}
      <mesh position={[0, BODY_H / 2, 0]}>
        <boxGeometry args={[W, BODY_H, D]} />
        <meshStandardMaterial color={WALNUT} emissive={WALNUT_EMISSIVE} emissiveIntensity={0.22} roughness={0.4} metalness={0.05} />
      </mesh>

      {/* Front nameplate — brand presence on the case itself, visible closed or open (the
          medallion inside the lid, below, only shows once opened). Plain brass strip, same
          "medallion not lettering" reasoning as that one. */}
      <mesh position={[0, BODY_H * 0.32, D / 2 + 0.001]}>
        <boxGeometry args={[W * 0.5, BODY_H * 0.16, 0.006]} />
        <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0, BODY_H * 0.32, D / 2 + 0.004]}>
        <boxGeometry args={[W * 0.42, BODY_H * 0.04, 0.004]} />
        <meshStandardMaterial color={BRASS_DARK} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, BODY_H - RECESS / 2, 0]}>
        <boxGeometry args={[W - WALL * 2, RECESS, D - WALL * 2]} />
        <meshStandardMaterial color={VELVET} emissive={VELVET_EMISSIVE} emissiveIntensity={0.28} roughness={0.95} metalness={0} />
      </mesh>
      {/* Rim trim — four brass strips outlining the opening, standing in for the source's
          continuous inlay ring without an extruded hollow shape. */}
      <mesh position={[0, BODY_H + 0.005, D / 2 - 0.015]}>
        <boxGeometry args={[W - 0.02, 0.02, 0.03]} />
        <meshStandardMaterial color={BRASS_DARK} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, BODY_H + 0.005, -(D / 2 - 0.015)]}>
        <boxGeometry args={[W - 0.02, 0.02, 0.03]} />
        <meshStandardMaterial color={BRASS_DARK} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[W / 2 - 0.015, BODY_H + 0.005, 0]}>
        <boxGeometry args={[0.03, 0.02, D - 0.02]} />
        <meshStandardMaterial color={BRASS_DARK} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[-(W / 2 - 0.015), BODY_H + 0.005, 0]}>
        <boxGeometry args={[0.03, 0.02, D - 0.02]} />
        <meshStandardMaterial color={BRASS_DARK} roughness={0.4} metalness={0.5} />
      </mesh>

      {/* Hinge barrels */}
      <mesh position={[0.35, BODY_H - 0.02, -D / 2 - 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.18, 16]} />
        <meshStandardMaterial color={BRASS_DARK} roughness={0.45} metalness={0.55} />
      </mesh>
      <mesh position={[-0.35, BODY_H - 0.02, -D / 2 - 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.18, 16]} />
        <meshStandardMaterial color={BRASS_DARK} roughness={0.45} metalness={0.55} />
      </mesh>

      {/* Lid — pivots at the back-top hinge line (group origin), same offset-mesh-inside-a-
          hinged-group trick HandbagMesh's flap uses, so rotating the group swings the lid
          around its own back edge instead of its center. */}
      <group position={[0, BODY_H, -D / 2]} ref={lidRef}>
        <mesh position={[0, LID_H / 2, D / 2]}>
          <boxGeometry args={[W, LID_H, D]} />
          <meshStandardMaterial color={WALNUT} emissive={WALNUT_EMISSIVE} emissiveIntensity={0.22} roughness={0.4} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0.03, D / 2]}>
          <boxGeometry args={[W - WALL * 2, 0.02, D - WALL * 2]} />
          <meshStandardMaterial color={VELVET_LINING} roughness={0.9} metalness={0} />
        </mesh>
        <mesh position={[0, LID_H + 0.011, D / 2]}>
          <cylinderGeometry args={[0.09, 0.09, 0.02, 32]} />
          <meshStandardMaterial color={BRASS} roughness={0.35} metalness={0.5} />
        </mesh>
        <mesh position={[0, LID_H + 0.021, D / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.095, 0.008, 8, 32]} />
          <meshStandardMaterial color={BRASS_DARK} roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.03, D - 0.02]}>
          <boxGeometry args={[0.12, 0.05, 0.02]} />
          <meshStandardMaterial color={BRASS} roughness={0.35} metalness={0.5} />
        </mesh>

        {/* Maker's medallion — the traditional spot for a jewelry case's own mark, on the lid's
            interior where it's revealed the moment the case opens. Two concentric brass rings
            around a plain disc rather than literal lettering: legible 3D text needs a font-glyph
            library (@react-three/drei's Text relies on troika-three-text, which needs a browser
            canvas context this native renderer doesn't have, and isn't a dependency this app
            actually declares) — a clean medallion reads as a real maker's mark without that risk. */}
        <mesh position={[0, 0.032, D * 0.15]}>
          <cylinderGeometry args={[0.12, 0.12, 0.004, 32]} />
          <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.035, D * 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.1, 0.006, 8, 32]} />
          <meshStandardMaterial color={BRASS_DARK} roughness={0.35} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.035, D * 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.055, 0.005, 8, 32]} />
          <meshStandardMaterial color={BRASS_DARK} roughness={0.35} metalness={0.5} />
        </mesh>
      </group>

      {/* Platform — the cushion and the watch (bracelet included — see its own comment below on
          why it's now parented under `watchPivot` rather than kept flush here) rise together as
          one piece. Cushion length was 0.55 (plus its own two 0.14-radius rounded caps ≈ 0.83
          total span) — nearly 1.5x wider than the bracelet's own reach, so the band used to sit
          entirely inside the cushion's own silhouette regardless of its own size. Shortened to a
          snug pad the watch head sits on, not a full pillow bar, so the bracelet now genuinely
          extends past both its ends. */}
      <group position={[0, PLATFORM_BASE_Y, 0]} ref={platformRef}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[CUSHION_R, 0.18, 8, 16]} />
          <meshStandardMaterial color={LEATHER} emissive={LEATHER_EMISSIVE} emissiveIntensity={0.22} roughness={0.85} metalness={0.05} />
        </mesh>

        {/* `watchPivot`'s own origin sits at the cushion's true center (no y-offset on this group
            itself) — not, as a previous pass had it, offset up by `CUSHION_R` to the cushion's top
            surface. That offset seemed harmless at rest, but `watchPivot` is what the hero-tilt
            rotates (below, in useFrame) once the piece rises, and a group rotates about its *own*
            origin: with the pivot sitting above the cushion's center, rotating it swung the
            bracelet's compensating offset (which assumed a center pivot) sideways and back, out
            from under the cushion's own silhouette entirely — the actual cause of the bracelet
            visibly sinking/disappearing under the cushion once the piece finished rising. The
            source (heritage-case.js) never hits this: its own `watchPivot.position.y = cushionY`
            is the true cushion center, and only the *case* group gets an additional
            `caseY - cushionY` lift on top of that — exactly mirrored below by wrapping just the
            case/dial/hands/crown/crystal in their own `+CUSHION_R` inner group, leaving the
            bracelet as a direct, unoffset child of `watchPivot` so its own loop math (built around
            local origin = cushion center) and `watchPivot`'s rotation pivot now agree. */}
        <group ref={watchPivotRef}>
          {/* Bracelet — a direct child of `watchPivot` with no extra offset (see the note above on
              why that's now correct). One continuous partial-torus arc, gapped only where the
              case sits (`BRACELET_GAP_*`, matching the source's own 56°-wide gap), rather than a
              full ring or a chain of discrete links — both of those were tried first and both
              failed for related reasons: a full smooth ring lying in the Y-Z plane, viewed by this
              app's dead-center camera (no oblique offset, no `lookAt` anywhere in the installed
              renderer — confirmed by reading its source), is edge-on and collapses to a bare line;
              a chain of separate link meshes fixed that but introduced a new problem once
              `ExploreOrbit` lets the user spin the whole piece to an arbitrary angle — there's no
              single set of discrete link positions that reads as continuous from every angle, so
              it visibly clumped from some and thinned to nothing from others. One continuous
              mesh has neither failure mode: `rotation.z` (`BRACELET_GAP_B_RAD`) phases the arc's
              start so the gap lands at local "up" before `rotation.y` (`Math.PI/2`, this file's
              established wrap-around-the-cushion's-X-axis convention) reorients the whole loop —
              the exact `rotateZ`-then-`rotateY` composition watch-builder.js's own "leather" strap
              type uses (Euler order 'XYZ' applies Z first, then Y, matching that order here
              without needing two nested groups). `scale`'s Z factor (`BRACELET_FLATTEN`) is applied
              in the mesh's own *pre-rotation* local frame — the geometry's original "out of the
              ring's plane" axis, uniform around the whole loop — which is what turns a round tube
              into a flat strap cross-section rather than merely stretching the loop into an
              ellipse. */}
          <mesh rotation={[0, Math.PI / 2, BRACELET_GAP_B_RAD]} scale={[1, 1, BRACELET_FLATTEN]}>
            <torusGeometry args={[BRACELET_LOOP_R, BRACELET_TUBE, 10, 96, BRACELET_ARC]} />
            <meshStandardMaterial
              color={BAND_STEEL}
              emissive={BAND_STEEL_EMISSIVE}
              emissiveIntensity={0.6}
              roughness={0.28}
              metalness={0.45}
            />
          </mesh>
          {/* Center stripe — a brighter, narrower polished band riding the exact same arc as the
              base strap above (identical `rotation`/`args[0]` radius, only the tube radius and
              flatten factor differ), the two-tone brushed/polished look real bracelets have down
              their center row. Deliberately NOT a separate set of discrete links: this reads as
              "same strap, richer material" rather than reintroducing the earlier per-link
              approach's exact failure mode (a set of independently-positioned pieces that only
              lines up from some viewing angles) — since it shares the base strap's own geometry
              parameters, it's mathematically guaranteed to stay aligned with it from any
              ExploreOrbit angle. */}
          <mesh rotation={[0, Math.PI / 2, BRACELET_GAP_B_RAD]} scale={[1, 1, BRACELET_FLATTEN * 0.55]}>
            <torusGeometry args={[BRACELET_LOOP_R, BRACELET_TUBE * 0.55, 8, 96, BRACELET_ARC]} />
            <meshStandardMaterial color="#eef1f2" roughness={0.16} metalness={0.55} />
          </mesh>

          {/* Case (+ bezel, crystal, dial, hands, crown, glint) — lifted up onto the cushion's top
              surface by the same `CUSHION_R` `watchPivot` itself used to carry directly. Every
              position below is unchanged from before this restructure; only the wrapping group is
              new. */}
          <group position={[0, CUSHION_R, 0]}>
            {/* Case — tinted by the pulled item's own `case_material` (Titanium/Oystersteel/18K
                Gold/etc, resolved via watchCatalogColors.ts), not a flat `STEEL` regardless of
                which watch this is. Falls back to `STEEL` when the catalog row leaves it blank. */}
            <mesh position={[0, 0.045, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.09, 32]} />
              <meshStandardMaterial color={caseHex} roughness={0.25} metalness={0.5} />
            </mesh>
            {/* Bezel — tinted by `caseHex` (the item's own case material), not a flat `BRASS`.
                A steel/titanium-cased watch showing a gold bezel and crown regardless of its
                actual material was the same "same watch for everyone" bug as the dial's own fix
                above, just on the case's metal instead of the dial's color. */}
            <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.16, 0.018, 10, 32]} />
              <meshStandardMaterial color={caseHex} roughness={0.22} metalness={0.55} />
            </mesh>
            {/* Crystal */}
            <mesh position={[0, 0.096, 0]}>
              <cylinderGeometry args={[0.145, 0.145, 0.012, 32]} />
              <meshStandardMaterial color="#ffffff" roughness={0.05} metalness={0} transparent opacity={0.22} />
            </mesh>
            {/* Dial — tinted by the pulled item's own `dial_color` catalog column (resolved via
                watchCatalogColors.ts), the same field the source's own watch-catalog.js reads.
                Every dial used to render as the flat pack rarity-tier color instead, identical
                across every watch regardless of which one was actually pulled — falls back to
                `tierColor` only when the catalog row leaves this blank. Lower roughness/higher
                gloss than a first pass at this — a lacquered dial should show a soft highlight
                bloom, not read as a flat matte disc. */}
            <mesh position={[0, 0.093, 0]}>
              <cylinderGeometry args={[0.135, 0.135, 0.008, 32]} />
              <meshStandardMaterial color={dialHex} roughness={0.22} metalness={0.1} />
            </mesh>
            {/* Date window — only for the models the source itself gives one (`hasDateWindow`
                above, same name match as watch-catalog.js's `dateWindow` column). No digit inside
                (real numerals need the same font-glyph rendering this file avoids everywhere
                else — see the brand mark's own note below) — a blank cream window still reads as
                "there's a date complication here" at this scale. */}
            {hasDateWindow && (
              <mesh position={[0.1, 0.0975, 0]}>
                <boxGeometry args={[0.016, 0.002, 0.012]} />
                <meshStandardMaterial color="#eceef0" roughness={0.4} metalness={0} />
              </mesh>
            )}
            {/* Hour indices — the dial used to be a bare disc with nothing but two hands on it,
                which on a dark dial (once real per-item dial colors could land on "Black"/
                "Blue"/etc — see dialHex above) read as an empty circle rather than a watch face.
                Eleven short radial ticks (12 o'clock is the brand mark instead), colored by the
                same dial-contrast rule as the hands so they're legible on any dial — one
                instanced draw call, positioned once in the useLayoutEffect above, not 11
                separate meshes. */}
            <instancedMesh key={tickCount} ref={tickMeshRef} args={[undefined, undefined, tickCount]}>
              <boxGeometry args={[0.007, 0.003, 0.02]} />
              <meshStandardMaterial color={faceHex} roughness={0.5} metalness={0.2} />
            </instancedMesh>
            {/* Brand mark — a diamond-and-bar lockup in the case's own brass trim, standing in for
                a "GRAILHAUS" wordmark: legible 3D text needs a font-glyph library
                (@react-three/drei's Text depends on troika-three-text, which needs a browser
                canvas context this native renderer doesn't have and isn't a dependency this app
                declares — the same constraint the lid medallion and case nameplate elsewhere in
                this file were already built around). A simple brass mark at 12 o'clock reads as
                "there's a maker's mark here" without that risk. */}
            <mesh position={[0, 0.097, 0.09]} rotation={[0, Math.PI / 4, 0]}>
              <boxGeometry args={[0.018, 0.003, 0.018]} />
              <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.5} />
            </mesh>
            <mesh position={[0, 0.097, 0.065]}>
              <boxGeometry args={[0.026, 0.003, 0.005]} />
              <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.5} />
            </mesh>
            {/* Hands — colored by dial contrast (see faceHex above), not a fixed dark grey that
                used to vanish against a dark dial. */}
            <mesh position={[0, 0.1, 0]} rotation={[0, 0, 0.3]}>
              <boxGeometry args={[0.008, 0.09, 0.006]} />
              <meshStandardMaterial color={faceHex} roughness={0.5} metalness={0.3} />
            </mesh>
            <mesh position={[0, 0.1, 0]} rotation={[0, 0, -0.9]}>
              <boxGeometry args={[0.008, 0.06, 0.006]} />
              <meshStandardMaterial color={faceHex} roughness={0.5} metalness={0.3} />
            </mesh>
            {/* Seconds hand — the one piece of "this is a running watch, not a photo" motion;
                driven every frame in useFrame (real watch speed, one sweep per 60s), not a static
                rotation like the hour/minute hands above (whose real-time movement over the span
                of a reveal would be imperceptible anyway). Thinner and in the case's own brass
                trim so it reads as the accent hand, not a third identical one. */}
            <mesh ref={secondHandRef} position={[0, 0.101, 0]}>
              <boxGeometry args={[0.004, 0.1, 0.004]} />
              <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.4} />
            </mesh>
            {/* Crown — `caseHex`, same reasoning as the bezel above. */}
            <mesh position={[0.18, 0.045, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.02, 0.02, 0.04, 16]} />
              <meshStandardMaterial color={caseHex} roughness={0.25} metalness={0.55} />
            </mesh>
            {/* Glint — a single unlit highlight sweeping the crystal once, cheap on purpose
                (meshBasicMaterial skips lighting entirely; a glint should read as blown-out
                regardless of scene light direction). */}
            <mesh ref={glintRef} position={[-0.09, 0.097, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.02, 16]} />
              <meshBasicMaterial color={GLINT} transparent opacity={0} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
    </group>
  );
}
