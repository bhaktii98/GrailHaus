// Black Label's 3D scene — forked from ../../vaultReveal/scene/VaultScene.tsx rather than
// parameterized further, because the design's own lighting/fire choreography (the actual
// Claude Design handoff's grailhaus-vault-break.html script) is genuinely a different render
// loop, not a palette swap of Vault Break's: a crimson fill + "ember rim" alongside the shared
// key/hemi/spot, three point lights whose intensity rides the fire system's own flicker, and a
// want-level state machine that ties fire intensity to tear progress and reveal phase. Gesture
// handling, camera choreography's basic shape, and the pack/reveal engine underneath are all
// identical to VaultScene's — only wired up here again because the lighting and fire hooks live
// inside the same per-frame loop and splitting them into a shared component with per-tier
// callbacks would have been more indirection than just forking the ~150 lines that actually
// differ.
//
// Smoothness pass: the design's original rig also carried a "gold kick" directional light and a
// dedicated "cardKey" light for the revealed card — both cut, matching Vault Break's own
// precedent of trimming a light that measurably cost more than it bought (see that scene's
// header). Every extra real-time light adds a term to the fragment shader of everything it
// touches; on top of a tear-shell mesh and two full particle-based fire instances (see
// ../art/fire.ts, also trimmed this pass), the 10-light original measured noticeably less smooth
// than Vault Break's own tear. key/fill/rim/hemi/spot plus the fire-tied point lights carry the
// same "crimson, molten, ember" read on their own.
import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber/native";
import type { ThreeEvent } from "@react-three/fiber";
import type { SkImage } from "@shopify/react-native-skia";
import { buildBlackLabelPackObject } from "../engine/buildBlackLabelPackObject";
import { useVaultInteraction } from "../../vaultReveal/gesture/useVaultInteraction";
import type { BuiltVaultPack } from "../../vaultReveal/engine/buildVaultPackObject";
import type { VaultBreakPersonality, VaultCardData } from "../../vaultReveal/config/types";
import type { RevealPhase } from "../../vaultReveal/engine/buildReveal";
import { buildFire, type BuiltFire } from "../art/fire";

export interface BlackLabelSceneHandle {
  reseal: () => void;
  setOrbit: (on: boolean) => void;
}

export interface BlackLabelStateSnapshot {
  phase: RevealPhase;
  hero: number;
  ready: boolean;
  running: boolean;
  dim: number;
  shown: number;
  /** Max of the card fire's and the pack fire's level, 0..~1 — drives BlackLabelVignette's
   * --fire-equivalent glow, mirroring the design's `vign.style.setProperty('--fire', ...)`. */
  fireLevel: number;
  surge: number;
  heroLabel: {
    rarity: string; edition: string; name: string; value: string; serial: string;
    tagline: string; type: string; traitsRaw: string | null;
  } | null;
}

export interface BlackLabelSceneProps {
  personality: VaultBreakPersonality;
  deck: VaultCardData[];
  logo: SkImage | null;
  orbit: boolean;
  onSnapshot?: (s: BlackLabelStateSnapshot) => void;
  introDolly?: boolean;
}

const CENTER_Y = 0;
const BASE_Z = 0.218;

// Hoisted out of useFrame — see the matching note in ../../vaultReveal/scene/VaultScene.tsx.
const ORBIT_TARGET = new THREE.Vector3(0, CENTER_Y, 0);

export const BlackLabelScene = memo(forwardRef<BlackLabelSceneHandle, BlackLabelSceneProps>(function BlackLabelScene(
  { personality, deck, logo, orbit, onSnapshot, introDolly },
  ref
) {
  const pack = useMemo<BuiltVaultPack>(() => buildBlackLabelPackObject(personality, deck, logo), [personality, deck, logo]);
  const interaction = useVaultInteraction(pack, personality);
  // grailCard is assigned once, at build time, from the deck this pack was built with — stable
  // for this pack instance's whole lifetime, not something that appears mid-animation. The tear
  // stage (BlackLabelTearStage.tsx) always builds with an empty deck, so this is always false
  // there — which is exactly why fireLightRef/emberLightRef below are worth skipping entirely
  // rather than just animating toward zero intensity: an unlit pointLight still costs a loop
  // iteration in every lit material's fragment shader for as long as it's mounted, whether its
  // intensity is 5 or 0 — the shader has no way to know at compile time that a uniform is zero.
  const hasGrail = !!pack.reveal.grailCard;

  // ---- fire: the card's own fire is parented to whichever card isGrail; the sealed pack burns
  // at pack scale too, so heat is already in the room before anything opens (design header:
  // "the same system at pack scale, so heat is already in the room before anything is opened,
  // and it dies back once the cards take over the story").
  const fire = useMemo<BuiltFire>(() => buildFire({ cardW: pack.cardSize.w, cardH: pack.cardSize.h }), [pack]);
  const packFire = useMemo<BuiltFire>(
    () => buildFire({ cardW: pack.size.W * 1.02, cardH: pack.size.H * 0.94, pack: true }),
    [pack]
  );
  useEffect(() => {
    const grail = pack.reveal.grailCard;
    if (grail) {
      grail.obj.add(fire.group);
      grail.faceMat.emissive = new THREE.Color(0x30100a);
    }
    packFire.group.name = "packFire";
    pack.group.add(packFire.group);
    return () => {
      if (grail) grail.obj.remove(fire.group);
      pack.group.remove(packFire.group);
    };
  }, [pack, fire, packFire]);
  useEffect(() => () => { fire.dispose(); packFire.dispose(); }, [fire, packFire]);

  const keyRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const emberRimRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const spotRef = useRef<THREE.SpotLight>(null);
  const spotTargetRef = useRef<THREE.Object3D>(null);
  const fireLightRef = useRef<THREE.PointLight>(null);
  const emberLightRef = useRef<THREE.PointLight>(null);
  const packLightRef = useRef<THREE.PointLight>(null);

  const touching = useRef(0);
  const reframeNext = useRef(false);
  const hasReframedOnce = useRef(false);
  const camAim = useRef({ x: 0, y: CENTER_Y + 0.006, z: BASE_Z, tx: 0, ty: CENTER_Y });
  const lookAt = useRef(new THREE.Vector3(0, CENTER_Y, 0));
  const lastPhase = useRef<RevealPhase>("idle");
  const sweptAt = useRef(-1);
  const lastSnapshot = useRef<BlackLabelStateSnapshot | null>(null);
  const lastPlanePos = useRef(new Map<number, { x: number; y: number }>());
  const wpos = useRef(new THREE.Vector3());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    interaction.toggleOrbit(orbit);
    if (!orbit) reframeNext.current = true;
  }, [orbit]);

  useEffect(() => {
    if (spotRef.current && spotTargetRef.current) spotRef.current.target = spotTargetRef.current;
  }, []);

  useEffect(() => () => pack.dispose(), [pack]);

  useImperativeHandle(ref, () => ({
    reseal: () => {
      interaction.reseal();
      pack.setProgress(0);
      fire.setLevel(0);
      sweptAt.current = -1;
    },
    setOrbit: (on: boolean) => interaction.toggleOrbit(on),
  }), [pack, interaction, fire]);

  const localXY = (e: ThreeEvent<PointerEvent>) => {
    const p = pack.group.worldToLocal(e.point.clone());
    return { x: p.x, y: p.y };
  };
  const planeXY = (e: ThreeEvent<PointerEvent>) => ({ x: e.point.x, y: e.point.y });

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    if (!pack.reveal.state.ready) touching.current = 1;
    lastPlanePos.current.set(e.pointerId, planeXY(e));
    interaction.onPointerDown(e.pointerId, localXY(e), planeXY(e), e.ray);
    (e.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
  };
  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    const p = planeXY(e);
    const last = lastPlanePos.current.get(e.pointerId);
    if (last) {
      const dx = (p.x - last.x) / pack.size.W;
      const dy = (p.y - last.y) / pack.size.H;
      interaction.dragDelta(e.pointerId, dx, dy);
    }
    lastPlanePos.current.set(e.pointerId, p);
    interaction.onPointerMove(e.pointerId, localXY(e), p);
    e.stopPropagation();
  };
  const handleUp = (e: ThreeEvent<PointerEvent>) => {
    lastPlanePos.current.delete(e.pointerId);
    interaction.onPointerUp(e.pointerId);
    e.stopPropagation();
  };
  const handleCancel = (e: ThreeEvent<PointerEvent>) => {
    lastPlanePos.current.delete(e.pointerId);
    interaction.onPointerCancel(e.pointerId);
    e.stopPropagation();
  };

  useFrame((state, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const f = interaction.update(dt);
    pack.react(dt, f.pullX, f.dragging);
    pack.setProgress(f.shown);
    pack.setTime(state.clock.elapsedTime, f.dragging ? 0.5 + f.energy : f.energy);
    touching.current *= Math.pow(0.05, dt);

    const st = pack.reveal.state;
    const camera = state.camera as THREE.PerspectiveCamera;

    // ---- fire intensity: strictly tied to how far the reveal has come, per the design's own
    // want-level table.
    let want: number;
    if (!st.running && !st.ready) {
      want = f.shown * 0.14 + f.energy * 0.05;
    } else if (st.ready) {
      want = st.hero >= 0 ? 0.3 : 0.4;
    } else {
      const ph = st.phase;
      want = ph === "stack" || ph === "hold" ? 0.16
        : ph === "rise" ? 0.2
          : ph === "separate" || ph === "settle" ? 0.24
            : ph === "notice" ? 0.3
              : ph === "approach" ? 0.4 + st.emerge * 0.2
                : ph === "reveal" ? 0.45 + st.emerge * 0.4
                  : 0.72;
    }
    // The card fire is parented to pack.reveal.grailCard (see the mount effect above) — with no
    // grail card yet (the tear stage always passes an empty deck), fire.group is never attached
    // to anything THREE actually traverses, so stepping it costs a full pass over every particle
    // layer's uniforms for something that can't be seen. Skipped entirely until there's a grail
    // card to attach to; this is exactly the JS-thread work Black Label's tear was paying that
    // Vault Break's never did; see this file's "Smoothness pass" header note.
    const pixHeight = state.size.height * (state.viewport?.dpr ?? 1);
    const grailForFire = pack.reveal.grailCard;
    if (grailForFire) fire.setLevel(want);
    const fx = grailForFire ? fire.step(dt, camera, pixHeight) : { level: 0, flick: 0, surge: 0 };

    // the sealed pack's own fire: strong while it's the subject, then hands the heat to the cards
    const packWant = !st.running && !st.ready
      ? 0.36 + f.shown * 0.34 + touching.current * 0.12 + f.energy * 0.12
      : st.ready ? 0.12 : 0.3;
    packFire.setLevel(packWant);
    const pfx = packFire.step(dt, camera, pixHeight);
    if (packLightRef.current) packLightRef.current.intensity = (0.03 + pfx.level * 0.16 + pfx.surge * 0.4) * pfx.flick;

    // the light sweep lands after the mid-emergence hold, before the turn
    if (st.phase === "reveal" && sweptAt.current < 0 && st.emerge > 0.52) {
      sweptAt.current = 1; fire.runSweep();
    }

    // ---- lighting choreography -------------------------------------------------------------
    const dim = st.dim;
    const phaseLight = st.hero >= 0 ? 1.35
      : st.ready ? 1.45
        : st.running ? 1.3
          : 2.1 + touching.current * 0.3 + f.shown * 0.3;
    if (keyRef.current) keyRef.current.intensity += (phaseLight * (1 - dim * 0.34) - keyRef.current.intensity) * Math.min(1, dt * 2.4);
    if (fillRef.current) fillRef.current.intensity += ((0.4 + fx.level * 0.9) - fillRef.current.intensity) * Math.min(1, dt * 3);
    if (hemiRef.current) hemiRef.current.intensity += ((0.14 + fx.level * 0.16) - hemiRef.current.intensity) * Math.min(1, dt * 3);
    const spotWant = st.hero >= 0 ? 0.8 : dim > 0.05 ? 2.0 * dim : 0;
    if (spotRef.current) {
      spotRef.current.intensity += (spotWant - spotRef.current.intensity) * Math.min(1, dt * 3.2);
      if (st.hero >= 0) spotRef.current.position.set(0.012, st.focus.y + 0.05, st.focus.z + 0.19);
      else spotRef.current.position.set(st.focus.x * 0.5 + 0.02, st.focus.y + 0.14, st.focus.z + 0.14);
    }
    if (spotTargetRef.current) spotTargetRef.current.position.lerp(st.focus, Math.min(1, dt * 4));

    // fire light rides with the grail card and flickers with the flames
    const grail = pack.reveal.grailCard;
    if (grail && fireLightRef.current && emberLightRef.current) {
      grail.obj.getWorldPosition(wpos.current);
      fireLightRef.current.position.set(wpos.current.x, wpos.current.y - pack.cardSize.h * 0.3, wpos.current.z + 0.006);
      emberLightRef.current.position.set(wpos.current.x, wpos.current.y + pack.cardSize.h * 0.4, wpos.current.z - 0.012);
    }
    if (fireLightRef.current) fireLightRef.current.intensity = (Math.max(0, fx.level - 0.08) * 0.55 + fx.surge * 1.4) * fx.flick;
    if (emberLightRef.current) emberLightRef.current.intensity = (Math.max(0, fx.level - 0.12) * 0.2 + fx.surge * 0.5) * fx.flick;

    // ---- camera choreography -----------------------------------------------------------------
    if (f.orbit) {
      const target = ORBIT_TARGET;
      camera.position.set(
        target.x + f.orbitRadius * Math.sin(f.orbitPhi) * Math.sin(f.orbitTheta),
        target.y + f.orbitRadius * Math.cos(f.orbitPhi),
        target.z + f.orbitRadius * Math.sin(f.orbitPhi) * Math.cos(f.orbitTheta)
      );
      camera.lookAt(target);
    } else {
      if (reframeNext.current) {
        reframeNext.current = false;
        if (!introDolly || hasReframedOnce.current) {
          camera.position.set(0, CENTER_Y + 0.006, BASE_Z);
          lookAt.current.set(0, CENTER_Y, 0);
          camera.lookAt(lookAt.current);
        }
        camAim.current = { x: 0, y: CENTER_Y + 0.006, z: BASE_Z, tx: 0, ty: CENTER_Y };
        hasReframedOnce.current = true;
      }
      const aspect = state.size.width / state.size.height;
      const vFovRad = (camera.fov * Math.PI) / 180;
      const spreadMargin = 1.15;
      const minSpreadZ = (pack.reveal.spreadWidth * spreadMargin) / (2 * Math.tan(vFovRad / 2) * aspect);
      const a = camAim.current;
      if (st.hero >= 0) {
        const h = pack.reveal.heroCard!.obj.position;
        a.z = 0.206; a.y = h.y * 0.9; a.x = 0;
        a.tx = 0; a.ty = h.y * 0.92;
      } else if (st.phase === "notice" || st.phase === "approach" || st.phase === "reveal" || st.phase === "present") {
        a.z = Math.max(0.264 - dim * 0.03, minSpreadZ);
        a.x = st.focus.x * 0.42;
        a.y = st.focus.y * 0.82 + 0.004;
        a.tx = st.focus.x * 0.5; a.ty = st.focus.y * 0.88;
      } else if (st.running || st.ready) {
        a.z = Math.max(0.262, minSpreadZ); a.x = 0; a.y = CENTER_Y + 0.022; a.tx = 0; a.ty = CENTER_Y + 0.022;
      } else {
        a.z = BASE_Z - f.shown * 0.014;
        a.x = 0;
        a.y = CENTER_Y + 0.006 + f.shown * 0.012;
        a.tx = 0; a.ty = CENTER_Y + f.shown * 0.012;
      }
      const slow = st.phase === "notice" || st.phase === "approach" || st.phase === "reveal" || st.phase === "present";
      const sp = Math.min(1, dt * (slow ? 1.1 : 2.6));
      camera.position.x += (a.x - camera.position.x) * sp;
      camera.position.y += (a.y - camera.position.y) * sp;
      camera.position.z += (a.z - camera.position.z) * sp;
      lookAt.current.set(
        lookAt.current.x + (a.tx - lookAt.current.x) * sp,
        lookAt.current.y + (a.ty - lookAt.current.y) * sp,
        0
      );
      camera.lookAt(lookAt.current);
    }

    // ---- beats: fire's release burst fires once, the instant 'present' starts (the design's
    // own comment: "contained energy released: one surge, then it settles")
    if (st.phase !== lastPhase.current) {
      lastPhase.current = st.phase;
      if (st.phase === "reveal") sweptAt.current = -1;
      if (st.phase === "present") fire.burst();
    }

    // ---- overlay snapshot (throttled to real changes) ---------------------------------------
    if (onSnapshot) {
      const heroCard = pack.reveal.heroCard;
      const labelCard = heroCard ?? (st.phase === "present" ? grail : null);
      const fireLevel = Math.max(fx.level, pfx.level * 0.85);
      const changed = !lastSnapshot.current
        || lastSnapshot.current.phase !== st.phase
        || lastSnapshot.current.hero !== st.hero
        || lastSnapshot.current.ready !== st.ready
        || Math.abs(lastSnapshot.current.dim - dim) > 0.02
        || Math.abs(lastSnapshot.current.shown - f.shown) > 0.01
        || Math.abs(lastSnapshot.current.fireLevel - fireLevel) > 0.02
        || Math.abs(lastSnapshot.current.surge - fx.surge) > 0.05;
      if (changed) {
        const snap: BlackLabelStateSnapshot = {
          phase: st.phase, hero: st.hero, ready: st.ready, running: st.running, dim, shown: f.shown,
          fireLevel, surge: fx.surge,
          heroLabel: labelCard ? {
            rarity: labelCard.data.rarityLabel, edition: labelCard.data.edition, name: labelCard.data.name,
            value: labelCard.data.value, serial: labelCard.data.serial,
            tagline: labelCard.data.tagline ?? "", type: labelCard.data.type ?? "",
            traitsRaw: null,
          } : null,
        };
        lastSnapshot.current = snap;
        onSnapshot(snap);
      }
    }
  });

  const floorY = -pack.size.H / 2;

  return (
    <>
      <hemisphereLight ref={hemiRef} args={[personality.lighting.hemiSky, personality.lighting.hemiGround, 0.4]} />
      <directionalLight ref={keyRef} color={personality.lighting.key} intensity={2.1} position={[0.17, 0.3, 0.3]} castShadow />
      <directionalLight ref={fillRef} color={0x8c2408} intensity={0.9} position={[-0.3, 0.1, -0.2]} />
      <directionalLight ref={emberRimRef} color={personality.lighting.rim} intensity={1.15} position={[0.06, -0.16, 0.34]} />
      <spotLight
        ref={spotRef}
        color={personality.lighting.spot}
        intensity={0}
        distance={0.6}
        angle={0.5}
        penumbra={0.92}
        decay={1.2}
        position={[0.02, 0.16, 0.16]}
      />
      <object3D ref={spotTargetRef} position={[0, 0, 0]} />
      {/* Only mounted once there's a grail card for them to ride — see hasGrail's own comment
          above. In the tear stage (always an empty deck) this is never true, so these two never
          exist in the scene at all, rather than sitting at intensity 0. */}
      {hasGrail && (
        <>
          <pointLight ref={fireLightRef} color={0xff6a18} intensity={0} distance={0.22} decay={2.2} />
          <pointLight ref={emberLightRef} color={0xff9330} intensity={0} distance={0.2} decay={2.0} />
        </>
      )}
      <pointLight ref={packLightRef} color={0xff6a18} intensity={0} distance={0.18} decay={2.4} position={[0.035, -pack.size.H * 0.06, 0.055]} />

      <mesh rotation-x={-Math.PI / 2} position={[0, floorY - 0.0004, 0]} receiveShadow>
        <planeGeometry args={[0.66, 0.66]} />
        <meshStandardMaterial name="apexFloor" color={0x040407} roughness={0.62} metalness={0.36} />
      </mesh>
      <mesh position={[0, floorY + 0.25, -0.28]}>
        <planeGeometry args={[0.98, 0.66]} />
        <meshStandardMaterial name="apexWall" color={0x030306} roughness={0.95} metalness={0.04} />
      </mesh>

      <primitive object={pack.group} />

      {/* See ../../vaultReveal/scene/VaultScene.tsx's own comment on why this plane is
          deliberately NOT a child of pack.group. */}
      <mesh
        position={[0, CENTER_Y, pack.size.T * 3]}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleCancel}
      >
        <planeGeometry args={[pack.size.W * 6, pack.size.H * 3]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>
    </>
  );
}));
