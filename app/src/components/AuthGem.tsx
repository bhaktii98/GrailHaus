import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber/native";
import type { Mesh } from "three";
import { accent } from "../theme/tokens";

function Gem() {
  const meshRef = useRef<Mesh>(null);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * 0.6;
    meshRef.current.rotation.x += delta * 0.15;
  });

  return (
    <mesh ref={meshRef}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={accent.cards.c1} metalness={0.85} roughness={0.15} />
    </mesh>
  );
}

/** The brand crest's violet gem, rendered live — the one 3D flourish in the auth flow,
 * spent on the two screens that bookend it (Welcome, and the post-claim "vault is
 * ready" moment) rather than scattered across every step. */
export function AuthGem({ size = 132 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Canvas camera={{ position: [0, 0, 3.2], fov: 40 }}>
        <ambientLight intensity={0.55} color="#ffffff" />
        <directionalLight position={[2, 2, 3]} intensity={1.4} color={accent.cards.c1} />
        <directionalLight position={[-2, -1, 2]} intensity={0.6} color="#ffffff" />
        <Gem />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "center" },
});
