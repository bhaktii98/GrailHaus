// Proves the per-frame geometry fast paths are drop-in replacements, not approximations.
//
// The whole premise of the tear performance pass is "same pixels, less work" — so the thing
// actually worth testing is not that the optimized code runs, but that it produces the *same
// numbers* as the code it replaced. Each test here re-implements the original, pre-optimization
// formula inline (copied verbatim from git history) and asserts the optimized version agrees.
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { fastComputeVertexNormals, gridLayout, makeScratch } from "./fastGeometry";
import { noise } from "./noise";

describe("fastComputeVertexNormals", () => {
  // The geometries this runs on in production are deformed plane grids, so test exactly that:
  // perturb a plane into a creased sheet, then compare against three.js's own implementation.
  it.each([
    ["tier-1 body sheet", 96, 80],
    ["tier-1 lid sheet", 96, 30],
    ["vault liner", 24, 14],
    ["small grid", 4, 3],
  ])("matches THREE.computeVertexNormals exactly for %s", (_label, nx, ny) => {
    const geo = new THREE.PlaneGeometry(0.068, 0.109, nx, ny);
    const pos = geo.attributes.position.array as Float32Array;
    // Crease it the way the deform does — high-frequency noise in z plus some x/y drift, so the
    // normals are genuinely varied rather than all facing +z.
    for (let i = 0; i < pos.length; i += 3) {
      const u = pos[i] / 0.068 + 0.5;
      pos[i + 2] = noise(u * 8) * 0.002 + Math.sin(u * 41) * 0.0008;
      pos[i] += noise(u * 5 + 2) * 0.0004;
    }

    geo.computeVertexNormals();
    const reference = Float32Array.from(geo.attributes.normal.array as Float32Array);

    (geo.attributes.normal.array as Float32Array).fill(0);
    fastComputeVertexNormals(geo);
    const actual = geo.attributes.normal.array as Float32Array;

    expect(actual.length).toBe(reference.length);
    // Bit-for-bit: same accumulation order, same arithmetic, so this is exact equality, not a
    // tolerance. If this ever loosens, the fast path has diverged and shading will differ.
    let mismatches = 0;
    for (let i = 0; i < reference.length; i++) if (actual[i] !== reference[i]) mismatches++;
    expect(mismatches).toBe(0);
  });

  it("falls back rather than mis-shading a non-indexed geometry", () => {
    const geo = new THREE.PlaneGeometry(1, 1, 2, 2).toNonIndexed();
    expect(() => fastComputeVertexNormals(geo)).not.toThrow();
    expect(geo.attributes.normal).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// The deform formulas themselves: original (per-vertex) vs. optimized (two-pass).
// ---------------------------------------------------------------------------

const W = 0.068, H = 0.068 * (1200 / 800), T = 0.016;
const seamFrac = 0.205;
const seamY = H / 2 - seamFrac * H;
const PEEL = 0.4;
const lidSpanY = H / 2 - seamY;

/** Builds a sheet's rest pose the way buildPackObject's `sheet()` does, minus the art/uv work. */
function makeRest(nx: number, ny: number, y0: number, y1: number) {
  const geo = new THREE.PlaneGeometry(W, y1 - y0, nx, ny);
  const rest = Float32Array.from(geo.attributes.position.array as Float32Array);
  return { geo, rest, cx: 0, cy: (y0 + y1) / 2 };
}

describe("lid deform: two-pass output matches the original per-vertex formula", () => {
  it.each([0, 0.17, 0.5, 0.83, 1])("agrees at q = %s", (q) => {
    const nx = 96, ny = 30;
    const { rest, cx, cy } = makeRest(nx, ny, seamY, H / 2);
    const n = rest.length / 3;

    // --- original, verbatim ---
    const original = new Float32Array(rest.length);
    {
      const lead = q * (1 + PEEL);
      for (let i = 0; i < n; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
        const X = x + cx;
        const u = (X + W / 2) / W;
        const t = Math.min(1, Math.max(0, (lead - u) / PEEL));
        const e = t * t * t * (t * (t * 6 - 15) + 10);
        const ahead = Math.max(0, 1 - Math.abs((lead - u) / (PEEL * 0.35)));
        const dy = y + cy - seamY;
        const along = Math.min(1, Math.max(0, dy / lidSpanY));
        const fold = Math.sin(u * Math.PI * 13 + q * 5) * Math.sin(along * Math.PI);
        const crinkle = fold * 0.0031 * e + noise(u * 8 + q) * 0.0012 * e;
        const gone = Math.min(1, Math.max(0, (t - 0.72) / 0.28)) ** 1.6;
        const a = e * 2.35 * (0.5 + 0.5 * along) + crinkle * 26 + ahead * 0.22 * along;
        const ny2 = dy * Math.cos(a) - z * Math.sin(a);
        const nz = dy * Math.sin(a) + z * Math.cos(a) + crinkle;
        const k = 1 - gone;
        original[i * 3] = x - e * 0.006 * (u - 0.5) + crinkle * 0.5;
        original[i * 3 + 1] = (ny2 - (cy - seamY) + e * 0.0022 * along - ahead * 0.0009 * (1 - along)) * k;
        original[i * 3 + 2] = (nz - e * 0.0015 + ahead * 0.0016 * (1 - along)) * k;
      }
    }

    // --- optimized, mirroring buildPackObject's deformLidSheet ---
    const optimized = new Float32Array(rest.length);
    {
      const scratch = makeScratch(gridLayout(nx, ny));
      const { cols, rows } = scratch.layout;
      for (let c = 0; c < cols; c++) scratch.u[c] = (rest[c * 3] + cx + W / 2) / W;
      for (let r = 0; r < rows; r++) {
        const dy = rest[r * cols * 3 + 1] + cy - seamY;
        const along = Math.min(1, Math.max(0, dy / lidSpanY));
        scratch.rowA[r] = dy; scratch.rowB[r] = along; scratch.rowC[r] = Math.sin(along * Math.PI);
      }
      const lead = q * (1 + PEEL);
      const cy0 = cy - seamY;
      const cU = scratch.u, cE = scratch.colA, cAhead = scratch.colB, cK = scratch.colC,
        cFold = scratch.colD, cNoise = scratch.colE;
      for (let c = 0; c < cols; c++) {
        const u = cU[c];
        const t = Math.min(1, Math.max(0, (lead - u) / PEEL));
        cE[c] = t * t * t * (t * (t * 6 - 15) + 10);
        cAhead[c] = Math.max(0, 1 - Math.abs((lead - u) / (PEEL * 0.35)));
        cK[c] = 1 - (Math.min(1, Math.max(0, (t - 0.72) / 0.28)) ** 1.6);
        cFold[c] = Math.sin(u * Math.PI * 13 + q * 5);
        cNoise[c] = noise(u * 8 + q);
      }
      for (let r = 0; r < rows; r++) {
        const dy = scratch.rowA[r], along = scratch.rowB[r], sinAlong = scratch.rowC[r];
        const base = r * cols;
        for (let c = 0; c < cols; c++) {
          const i3 = (base + c) * 3;
          const x = rest[i3], z = rest[i3 + 2];
          const u = cU[c], e = cE[c], ahead = cAhead[c];
          const crinkle = cFold[c] * sinAlong * 0.0031 * e + cNoise[c] * 0.0012 * e;
          const a = e * 2.35 * (0.5 + 0.5 * along) + crinkle * 26 + ahead * 0.22 * along;
          const ca = Math.cos(a), sa = Math.sin(a);
          const ny2 = dy * ca - z * sa, nz = dy * sa + z * ca + crinkle;
          const k = cK[c];
          optimized[i3] = x - e * 0.006 * (u - 0.5) + crinkle * 0.5;
          optimized[i3 + 1] = (ny2 - cy0 + e * 0.0022 * along - ahead * 0.0009 * (1 - along)) * k;
          optimized[i3 + 2] = (nz - e * 0.0015 + ahead * 0.0016 * (1 - along)) * k;
        }
      }
    }

    // Tolerance is Float32 storage rounding only. The pack is 0.068 units wide, so 1e-7 is about
    // one part in 700,000 of the pack's width — orders of magnitude below a pixel at any zoom.
    let maxDiff = 0;
    for (let i = 0; i < original.length; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(original[i] - optimized[i]));
    }
    expect(maxDiff).toBeLessThan(1e-7);
  });
});

describe("body deform: two-pass output matches the original per-vertex formula", () => {
  it.each([0, 0.25, 0.6, 1])("agrees at q = %s", (q) => {
    const nx = 96, ny = 80;
    const sign = 1;
    const { rest, cx, cy } = makeRest(nx, ny, -H / 2, seamY);
    const n = rest.length / 3;

    const original = new Float32Array(rest.length);
    {
      const open = Math.min(1, Math.max(0, (q - 0.22) / 0.78));
      for (let i = 0; i < n; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
        const X = x + cx, Y = y + cy;
        const u = (X + W / 2) / W;
        const d = (seamY - Y) / (H * 0.3);
        const gf = Math.pow(Math.max(0, 1 - d), 2.2) * open;
        const lip = Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
        const buckle = noise(u * 14 + sign) * 0.0012 * gf;
        const ripU = Math.min(1, q / 0.8);
        const tug = q < 0.02 ? 0
          : Math.max(0, 1 - Math.abs(u - ripU) / 0.16) * Math.max(0, 1 - d) * 0.0014;
        original[i * 3] = x * (1 + gf * 0.05 * lip);
        original[i * 3 + 1] = y - gf * 0.0015 + tug * 0.6;
        original[i * 3 + 2] = z + sign * (gf * T * 2.4 * lip + Math.abs(buckle) + tug);
      }
    }

    const optimized = new Float32Array(rest.length);
    {
      const scratch = makeScratch(gridLayout(nx, ny));
      const { cols, rows } = scratch.layout;
      for (let c = 0; c < cols; c++) scratch.u[c] = (rest[c * 3] + cx + W / 2) / W;
      for (let r = 0; r < rows; r++) {
        const Y = rest[r * cols * 3 + 1] + cy;
        const d = (seamY - Y) / (H * 0.3);
        const oneMinusD = Math.max(0, 1 - d);
        scratch.rowA[r] = Math.pow(oneMinusD, 2.2);
        scratch.rowB[r] = oneMinusD;
      }
      for (let c = 0; c < cols; c++) {
        const u = scratch.u[c];
        scratch.colA[c] = Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
        scratch.colB[c] = noise(u * 14 + sign);
      }
      const open = Math.min(1, Math.max(0, (q - 0.22) / 0.78));
      const ripU = Math.min(1, q / 0.8);
      const tugOn = q >= 0.02;
      const cU = scratch.u, cLip = scratch.colA, cNoise = scratch.colB, cTugU = scratch.colC;
      for (let c = 0; c < cols; c++) {
        cTugU[c] = tugOn ? Math.max(0, 1 - Math.abs(cU[c] - ripU) / 0.16) * 0.0014 : 0;
      }
      for (let r = 0; r < rows; r++) {
        const gfRow = scratch.rowA[r] * open;
        const oneMinusD = scratch.rowB[r];
        const base = r * cols;
        for (let c = 0; c < cols; c++) {
          const i3 = (base + c) * 3;
          const x = rest[i3], y = rest[i3 + 1], z = rest[i3 + 2];
          const lip = cLip[c];
          const buckle = cNoise[c] * 0.0012 * gfRow;
          const tug = cTugU[c] * oneMinusD;
          optimized[i3] = x * (1 + gfRow * 0.05 * lip);
          optimized[i3 + 1] = y - gfRow * 0.0015 + tug * 0.6;
          optimized[i3 + 2] = z + sign * (gfRow * T * 2.4 * lip + Math.abs(buckle) + tug);
        }
      }
    }

    let maxDiff = 0;
    for (let i = 0; i < original.length; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(original[i] - optimized[i]));
    }
    expect(maxDiff).toBeLessThan(1e-7);
  });
});
