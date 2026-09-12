import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber/native";
import type { SharedValue } from "react-native-reanimated";
import { buildPackObject } from "./engine/buildPackObject";
import { cardPackPersonality } from "./config/cardPack.config";

/**
 * Drives the real procedural foil-pack build (`buildPackObject`) from the same
 * `openProgress` shared value every other category's mesh already reads — `setProgress`/
 * `setTime` are pure functions of that one number plus elapsed time, with no dependency on the
 * prototype's own gesture hook (`useTearGesture`) or haptics track, both of which
 * `CardFlowEngine` already has its own working versions of via `GestureLayer` and
 * `cardsConfig.hapticTrack`. That's what makes this a drop-in replacement for `CardMesh`
 * rather than a rewrite of the surrounding flow.
 *
 * `pack.react(dt, pullX, pulling)` gets called every frame with `pullX=0, pulling=false` — not
 * skipped. That was a real bug in an earlier pass: `react()` looks like it's purely the
 * cosmetic "lean toward the drag" embellishment, but `stepPhys()` — the actual gravity/bounce
 * integration that moves the torn strip after `release()` — only ever runs *inside* `react()`,
 * nowhere else. Omitting the call didn't just drop a flourish, it froze the released strip at
 * its spawn point forever, which read as "nothing falls." Calling it with `pulling=false` still
 * skips the lean itself (target stays 0, so `lean`/`leanV` never move off 0) while keeping the
 * physics step alive. `useTearGesture`'s `energy` boost is the only thing still genuinely
 * skipped — cosmetic only, affects glint brightness, nothing structural.
 *
 * The ground plane lives here, not in the parent Canvas, because it needs `pack.size.H` to
 * position correctly — every mesh inside `buildPackObject` already sets `castShadow`/
 * `receiveShadow` correctly (ported as-is), so this plane receiving shadows is the only piece
 * needed for the torn strip to actually read as landing on something once released, instead of
 * floating in an empty void. The parent Canvas still needs `shadows` enabled and the key light
 * needs `castShadow` + a configured shadow camera — r3f's shadow pipeline is off by default and
 * per-mesh flags alone do nothing without it.
 */
export function PackTearMesh({ openProgress }: { openProgress: SharedValue<number> }) {
  const pack = useMemo(() => buildPackObject(cardPackPersonality, null), []);

  useEffect(() => () => pack.dispose(), [pack]);

  useFrame((state, delta) => {
    // Capped exactly as PackScene.tsx's own useFrame does — a large delta from a stuttering
    // frame (this emulator has shown real ones) can push `1 - 2.6*dt` in stepPhys negative,
    // flipping the scrap's velocity sign instead of just damping it, which reads as physics
    // suddenly going haywire rather than a strip settling.
    const dt = Math.min(0.05, delta);
    pack.setProgress(openProgress.value);
    pack.setTime(state.clock.elapsedTime);
    pack.react(dt, 0, false);

    // Shadows are enabled on this tier's Canvas, which by default re-renders the shadow map
    // every frame — a second full pass over the pack's (deforming, high-vertex-count) geometry
    // on top of the main render. The shadow only actually changes when the pack's geometry
    // moves, so drive the map manually from exactly that condition. `autoUpdate` is switched off
    // once here rather than on the Canvas so the rest of the scene graph keeps its normal
    // behaviour; the visible shadow is identical, it just stops being recomputed for frames
    // where nothing it depends on moved.
    const shadowMap = state.gl.shadowMap;
    if (shadowMap.autoUpdate) shadowMap.autoUpdate = false;
    if (pack.shadowDirty()) shadowMap.needsUpdate = true;
  });

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={-pack.size.H / 2} receiveShadow>
        <planeGeometry args={[pack.size.W * 6, pack.size.H * 6]} />
        <shadowMaterial opacity={0.4} transparent />
      </mesh>
      <primitive object={pack.group} />
    </>
  );
}
