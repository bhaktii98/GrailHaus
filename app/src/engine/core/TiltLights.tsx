import { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import type { DirectionalLight } from "three";
import type { LightDef } from "./types";
import type { DeviceTilt } from "./useDeviceTilt";

/**
 * Renders a `CategoryRevealConfig.lighting` array exactly like the plain `.map()` every reveal
 * scene used to do it inline, except each directional light also sways a little off its own
 * declared base position every frame, following `tilt` (see useDeviceTilt) — this is the whole
 * "tilt the phone, the highlight moves" requirement, and it's here rather than duplicated per
 * scene so every category gets it by just switching to this component instead of the raw map.
 * Ambient lights are direction-less by definition, so they're untouched.
 */
export function TiltLights({ lighting, tilt }: { lighting: LightDef[]; tilt: React.MutableRefObject<DeviceTilt> }) {
  const lightRefs = useRef<(DirectionalLight | null)[]>([]);

  useFrame(() => {
    lighting.forEach((light, i) => {
      if (light.kind !== "directional" || !light.position) return;
      const ref = lightRefs.current[i];
      if (!ref) return;
      const [bx, by, bz] = light.position;
      // Scaled up from the already-clamped ±0.5 rad tilt reading so a modest phone tilt reads as
      // a modest, visible highlight sweep rather than an imperceptible twitch — tuned by eye
      // against this rig's own light distances, not a physically derived number.
      ref.position.set(bx + tilt.current.x * 1.2, by + tilt.current.y * 1.2, bz);
    });
  });

  return (
    <>
      {lighting.map((light, i) =>
        light.kind === "ambient" ? (
          <ambientLight key={i} intensity={light.intensity} color={light.color} />
        ) : (
          <directionalLight
            key={i}
            ref={(r) => {
              lightRefs.current[i] = r;
            }}
            position={light.position ?? [0, 0, 0]}
            intensity={light.intensity}
            color={light.color}
          />
        )
      )}
    </>
  );
}
