// End-to-end parity check on the real builder, not just the extracted formulas.
//
// fastGeometry.test.ts proves the optimized *formulas* match the originals. This file proves the
// thing that actually ships — buildPackObject as wired up today — produces a well-formed,
// correctly-deforming pack across the whole tear, and that the `lastQ` guard added for
// performance never changes the geometry you end up looking at (a skipped deform must be a
// deform that would have been a no-op).
import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";

// buildPackObject transitively imports @shopify/react-native-skia (via art/packArt.ts, which
// bakes the foil textures) and expo-asset. Both ship untranspiled React Native source that
// Vitest's bundler cannot parse, and neither has anything to do with what this file tests — the
// *geometry* the builder produces, not the pixels painted onto it. Stubbing the art layer keeps
// every line of the real deform code under test while cutting the native modules out of the
// import graph.
vi.mock("../art/packArt", () => {
  const flat = (width: number, height: number) => ({
    data: new Uint8Array(width * height * 4).fill(128),
    width,
    height,
  });
  return {
    drawFront: ({ width, height }: { width: number; height: number }) => flat(width, height),
    drawBack: ({ width, height }: { width: number; height: number }) => flat(width, height),
    drawCardBack: ({ width, height }: { width: number; height: number }) => flat(width, height),
    drawShine: (width: number, height: number) => flat(width, height),
  };
});
vi.mock("@shopify/react-native-skia", () => ({ Skia: {} }));
vi.mock("expo-asset", () => ({ Asset: {} }));

const { buildPackObject } = await import("./buildPackObject");
const { cardPackPersonality } = await import("../config/cardPack.config");

/** Collects every deformable sheet's vertex positions into one flat snapshot. */
function snapshotVertices(group: THREE.Group): Float32Array {
  const chunks: Float32Array[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry?.attributes?.position) {
      chunks.push(Float32Array.from(m.geometry.attributes.position.array as Float32Array));
    }
  });
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

describe("buildPackObject geometry parity", () => {
  it("produces finite vertices and normals across the whole tear", () => {
    const pack = buildPackObject(cardPackPersonality, null);
    try {
      for (let i = 0; i <= 20; i++) {
        pack.setProgress(i / 20);
        // Scan in plain JS and assert once per step — a NaN here is the classic symptom of a
        // hoisted term being read before it was filled, and would render as an invisible or
        // exploded pack rather than throwing. (Asserting per-vertex instead would mean ~1.3M
        // matcher calls per step, which is slow enough to dominate the whole suite.)
        let bad = 0;
        pack.group.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || !m.geometry?.attributes?.position) return;
          const pos = m.geometry.attributes.position.array as Float32Array;
          const nor = m.geometry.attributes.normal?.array as Float32Array | undefined;
          for (let v = 0; v < pos.length; v++) if (!Number.isFinite(pos[v])) bad++;
          if (nor) for (let v = 0; v < nor.length; v++) if (!Number.isFinite(nor[v])) bad++;
        });
        expect(bad, `non-finite values at progress ${i / 20}`).toBe(0);
      }
    } finally {
      pack.dispose();
    }
  });

  it("re-deforms to the identical pose when progress returns to a previous value", () => {
    const pack = buildPackObject(cardPackPersonality, null);
    try {
      pack.setProgress(0.42);
      const atFirst = snapshotVertices(pack.group);

      // Move well away, then come back. The deform is a pure function of `q`, so the same input
      // must reproduce the same vertices exactly — this is what lets the lastQ guard skip work.
      pack.setProgress(0.9);
      pack.setProgress(0.1);
      pack.setProgress(0.42);
      const atReturn = snapshotVertices(pack.group);

      expect(atReturn.length).toBe(atFirst.length);
      let mismatches = 0;
      for (let i = 0; i < atFirst.length; i++) if (atReturn[i] !== atFirst[i]) mismatches++;
      expect(mismatches).toBe(0);
    } finally {
      pack.dispose();
    }
  });

  it("the lastQ guard skips only deforms that would not have moved anything", () => {
    const pack = buildPackObject(cardPackPersonality, null);
    try {
      pack.setProgress(0.6);
      const settled = snapshotVertices(pack.group);

      // Repeat the same progress several times — the guard short-circuits these. The geometry
      // must be byte-identical afterwards, i.e. nothing was skipped that mattered.
      for (let i = 0; i < 5; i++) pack.setProgress(0.6);
      const afterRepeats = snapshotVertices(pack.group);
      let mismatches = 0;
      for (let i = 0; i < settled.length; i++) if (afterRepeats[i] !== settled[i]) mismatches++;
      expect(mismatches).toBe(0);

      // A change above the guard's epsilon must actually move geometry.
      pack.setProgress(0.62);
      const afterRealChange = snapshotVertices(pack.group);
      let moved = false;
      for (let i = 0; i < settled.length; i++) {
        if (afterRealChange[i] !== settled[i]) { moved = true; break; }
      }
      expect(moved).toBe(true);
    } finally {
      pack.dispose();
    }
  });

  it("keeps every deformed vertex inside its pinned bounding sphere", () => {
    // The deformed sheets carry a fixed bounding sphere instead of recomputing one per frame
    // (see the note in buildPackObject's `sheet()`). That is only safe while the sphere actually
    // contains the geometry at every point of the tear — if the deform ever grew past it, the
    // frustum culler could decide the pack is off-screen and stop drawing it.
    const pack = buildPackObject(cardPackPersonality, null);
    try {
      let worstDistance = 0;
      let smallestRadius = Infinity;
      for (let i = 0; i <= 40; i++) {
        pack.setProgress(i / 40);
        pack.group.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || !m.geometry?.boundingSphere) return;
          const { radius, center } = m.geometry.boundingSphere;
          smallestRadius = Math.min(smallestRadius, radius);
          const pos = m.geometry.attributes.position.array as Float32Array;
          for (let v = 0; v < pos.length; v += 3) {
            const d = Math.hypot(pos[v] - center.x, pos[v + 1] - center.y, pos[v + 2] - center.z);
            if (d > worstDistance) worstDistance = d;
          }
        });
      }
      expect(worstDistance).toBeLessThan(smallestRadius);
    } finally {
      pack.dispose();
    }
  });

  it("reports the shadow as dirty only when the pack actually moved", () => {
    const pack = buildPackObject(cardPackPersonality, null);
    try {
      pack.setProgress(0.3);
      expect(pack.shadowDirty()).toBe(true);

      // Same progress, nothing released — nothing for the shadow map to redraw.
      pack.setProgress(0.3);
      expect(pack.shadowDirty()).toBe(false);

      pack.setProgress(0.55);
      expect(pack.shadowDirty()).toBe(true);
    } finally {
      pack.dispose();
    }
  });
});
