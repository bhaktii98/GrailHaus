import { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import { DoubleSide, type Mesh } from "three";
import type { SharedValue } from "react-native-reanimated";

/** A thin foil-card plane: turns and slides open as `openProgress` goes 0 -> 1 (the tear).
 * `tierColor` comes from the pack's admin-configurable rarity_tiers data, not a hardcoded map. */
export function CardMesh({
  tierColor,
  openProgress,
}: {
  tierColor: string;
  openProgress: SharedValue<number>;
}) {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    const p = openProgress.value;
    meshRef.current.rotation.y = p * Math.PI * 0.5;
    meshRef.current.position.x = p * 0.6;
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1.4, 2, 1, 1]} />
      <meshStandardMaterial color={tierColor} metalness={0.7} roughness={0.3} side={DoubleSide} />
    </mesh>
  );
}
