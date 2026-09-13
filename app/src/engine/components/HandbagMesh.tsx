import { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import type { Group, Mesh } from "three";
import type { SharedValue } from "react-native-reanimated";

/**
 * The `flap-bag` archetype — a structured body, a flap that swings open on `openProgress` (a
 * handbag's closure doesn't lift straight up like a watch box's lid, it rotates open and
 * forward around a hinge at the top-back edge), and a handle loop. Built specifically because
 * neither existing archetype's silhouette fits: `tear-pack` has no rigid body at all, and
 * `lift-lid-box`'s lid translates+rotates around a point well above the box, not a hinge flush
 * with its own back edge. Same "lighter/stubbed on purpose" scope as WatchMesh was at this
 * stage — proves a genuinely new category needs exactly one small mesh function, not a rewrite
 * of the gesture/haptics/engine machinery around it. `tierColor` comes from the pack's
 * admin-configurable rarity_tiers data, same as every other archetype.
 */
export function HandbagMesh({
  tierColor,
  openProgress,
}: {
  tierColor: string;
  openProgress: SharedValue<number>;
}) {
  const flapRef = useRef<Group>(null);
  const handleRef = useRef<Mesh>(null);

  useFrame(() => {
    const p = openProgress.value;
    if (flapRef.current) {
      // Hinged at the flap's own top-back edge (the pivot the flap's group offset below sets
      // up), swinging forward and up as it opens rather than translating straight up.
      flapRef.current.rotation.x = -p * 1.9;
    }
    if (handleRef.current) {
      // A small lift as the bag "opens toward you" — subtle, not a bounce.
      handleRef.current.position.y = 0.62 + p * 0.05;
    }
  });

  return (
    <group>
      {/* Body */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[1.1, 0.9, 0.55]} />
        <meshStandardMaterial color={tierColor} metalness={0.25} roughness={0.55} />
      </mesh>
      {/* Flap — the outer group sits at the hinge (the body's top-back edge); the mesh inside
          it is offset away from that same origin via its own `position`, so rotating the
          *group* swings the visible box around the hinge instead of its own center. */}
      <group position={[0, 0.35, -0.275]} ref={flapRef}>
        <mesh position={[0, -0.2, 0.15]}>
          <boxGeometry args={[1.14, 0.4, 0.3]} />
          <meshStandardMaterial color={tierColor} metalness={0.3} roughness={0.45} />
        </mesh>
      </group>
      {/* Handle */}
      <mesh ref={handleRef} position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.045, 12, 24, Math.PI]} />
        <meshStandardMaterial color="#2a1f16" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Clasp — a small bright accent where the flap meets the body, reads as metal hardware. */}
      <mesh position={[0, 0.08, 0.28]}>
        <boxGeometry args={[0.16, 0.1, 0.04]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}
