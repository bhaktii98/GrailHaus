import { useEffect, useRef } from "react";
import { DeviceMotion } from "expo-sensors";

export interface DeviceTilt {
  x: number;
  y: number;
}

/**
 * Reads the phone's live tilt (DeviceMotion's `rotation`, not the noisier raw gyroscope rate) so
 * a reveal scene's light can sway with it — the PRD's "tilt the phone, the highlight moves"
 * requirement (§42). A plain ref, not a Reanimated shared value: nothing here is touch-latency
 * critical the way GestureLayer's drag is, and `useFrame` already reads plain refs elsewhere in
 * this engine (see BoosterCarouselStage's idle spin) — no reason to pull Reanimated's UI thread
 * into a 3D scene that only ever reads this once per rendered frame anyway.
 *
 * Subscribing is deferred behind `DeviceMotion.isAvailableAsync()` — a simulator or a device with
 * the sensor disabled just never updates `tilt.current` past (0, 0), which reads as "the light
 * sits still," not a crash.
 */
export function useDeviceTilt(enabled = true) {
  const tilt = useRef<DeviceTilt>({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    let sub: { remove: () => void } | null = null;

    DeviceMotion.isAvailableAsync()
      .then((available) => {
        if (!available || !mounted) return;
        DeviceMotion.setUpdateInterval(33); // ~30Hz — an ambient sway, not a gesture; no need for more
        sub = DeviceMotion.addListener(({ rotation }) => {
          if (!rotation) return;
          // Clamped hard: a phone tilted past a modest angle shouldn't send the highlight flying
          // off-object — this reads as "the light noticed you moved," not a joystick.
          tilt.current = {
            x: Math.max(-0.5, Math.min(0.5, rotation.gamma)),
            y: Math.max(-0.5, Math.min(0.5, rotation.beta)),
          };
        });
      })
      .catch(() => {
        // No motion sensor (or permission denied) — tilt.current just stays (0, 0) forever,
        // same as "enabled: false". Not a reveal-blocking failure either way.
      });

    return () => {
      mounted = false;
      sub?.remove();
    };
  }, [enabled]);

  return tilt;
}
