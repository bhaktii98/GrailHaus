import { StyleSheet, View } from "react-native";
import { Canvas } from "@react-three/fiber/native";

/**
 * Forces the GPU to compile the shader program every reveal's dominant material (a lit
 * MeshStandardMaterial — metalness/roughness PBR, what the pack shells, card faces, and watch
 * case all use) needs, before the first real reveal Canvas of the session ever mounts — the
 * PRD's "the first rip of a cold session must not stutter — no shader compilation hitch"
 * requirement (§45).
 *
 * Mounted once, in App.tsx, alongside font loading — genuinely dead time already spent behind
 * the splash screen, so paying the one-time shader-compile cost here is invisible. A 4×4 canvas
 * (not 1×1 — some GL drivers mishandle a literal 1-pixel framebuffer) tucked off-screen via
 * `left: -9999` rather than `opacity: 0`/`display: none`, neither of which reliably stops
 * `expo-gl` from still creating and rendering into the GL context — off-screen positioning is
 * the one approach guaranteed to still let the context (and therefore the real compile) happen.
 * Stays mounted for the rest of the session at near-zero cost (4×4 pixels, one draw call) rather
 * than unmounting after one frame — disposing and losing the GL context back would only reintroduce
 * the exact recompile risk this exists to avoid.
 */
export function ShaderWarmup() {
  return (
    <View style={styles.offscreen} pointerEvents="none">
      <Canvas gl={{ antialias: false }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[1, 1, 1]} intensity={1} />
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#888888" metalness={0.7} roughness={0.3} />
        </mesh>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: "absolute", left: -9999, top: -9999, width: 4, height: 4 },
});
