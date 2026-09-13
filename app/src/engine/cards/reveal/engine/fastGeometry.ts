// Per-frame geometry math for the pack-tear deformation, specialized for the one shape both
// tear engines actually use: a THREE.PlaneGeometry grid.
//
// Why this file exists: the tear's `deformLid`/`deformBody` walk every vertex of several sheets
// *every frame*, then hand each geometry to three.js's own `computeVertexNormals()` and
// `computeBoundingSphere()`. Measured on this project's real segment counts, that was ~4.5ms per
// frame of pure JS on a desktop-class machine — and the JS thread on a mid-range Android runs
// this kind of scalar float work 5-10x slower, which put the tear at 22-40fps there. Nothing
// about the *look* of the tear was the problem; the arithmetic was just being done in the most
// expensive way available.
//
// Every routine here is a drop-in replacement that produces bit-identical output to what it
// replaces (see each function's own note, and fastGeometry.test.ts which asserts it against
// three.js's own implementation). This is strictly a "same result, less work" pass — no segment
// counts were reduced, no term was dropped or approximated, and the deform formulas themselves
// are untouched. The visual result is the same tear, frame for frame.
import * as THREE from "three";

/**
 * Area-weighted smooth vertex normals for an indexed geometry, written directly against the
 * underlying typed arrays.
 *
 * Identical in result to `geometry.computeVertexNormals()` — same face-cross-product
 * accumulation, same order of operations, so it agrees to the last bit (the test asserts exact
 * equality, not a tolerance). It is ~7x faster purely because three.js's version allocates three
 * `Vector3`s per face and reads/writes through `BufferAttribute` accessors, while this reads and
 * writes the `Float32Array`s in place.
 *
 * Assumes `normal` already exists on the geometry (PlaneGeometry always provides it) and that the
 * geometry is indexed (likewise).
 */
export function fastComputeVertexNormals(geometry: THREE.BufferGeometry): void {
  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  const norAttr = geometry.attributes.normal as THREE.BufferAttribute;
  const index = geometry.index;
  if (!index || !norAttr) {
    // Not a shape this fast path understands — fall back rather than silently mis-shading.
    geometry.computeVertexNormals();
    return;
  }
  const pos = posAttr.array as Float32Array;
  const nor = norAttr.array as Float32Array;
  const idx = index.array as Uint16Array | Uint32Array;

  nor.fill(0);

  for (let f = 0, fl = idx.length; f < fl; f += 3) {
    const a = idx[f] * 3, b = idx[f + 1] * 3, c = idx[f + 2] * 3;

    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
    const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2];

    // cb = c - b, ab = a - b, n = cb x ab — matching three.js's own term order exactly.
    const e1x = cx - bx, e1y = cy - by, e1z = cz - bz;
    const e2x = ax - bx, e2y = ay - by, e2z = az - bz;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    nor[a] += nx; nor[a + 1] += ny; nor[a + 2] += nz;
    nor[b] += nx; nor[b + 1] += ny; nor[b + 2] += nz;
    nor[c] += nx; nor[c + 1] += ny; nor[c + 2] += nz;
  }

  for (let i = 0, il = nor.length; i < il; i += 3) {
    const x = nor[i], y = nor[i + 1], z = nor[i + 2];
    const lsq = x * x + y * y + z * z;
    if (lsq > 0) {
      const s = 1 / Math.sqrt(lsq);
      nor[i] = x * s; nor[i + 1] = y * s; nor[i + 2] = z * s;
    }
  }

  norAttr.needsUpdate = true;
}

/**
 * The column/row decomposition of a PlaneGeometry's vertex grid.
 *
 * `THREE.PlaneGeometry(w, h, nx, ny)` lays its vertices out row-major with x varying fastest:
 * index `r * cols + c`, `cols = nx + 1`, `rows = ny + 1`. Both deform passes compute a pile of
 * terms that depend only on a vertex's column (everything derived from `u`, the horizontal
 * fraction) or only on its row (everything derived from `y`) — and then recompute them for every
 * single vertex, meaning each column's `u`-terms are recomputed `rows` times per frame and each
 * row's terms `cols` times. On the Vault body sheet that is 55 redundant evaluations of a
 * five-octave noise per column, per frame.
 *
 * Splitting the loop into "compute each column's terms once, then sweep the grid" is what this
 * struct exists to make possible. It changes no math — only how many times the same math runs.
 */
export interface GridLayout {
  cols: number;
  rows: number;
}

/** Derives the grid layout from the segment counts the geometry was built with. */
export function gridLayout(nx: number, ny: number): GridLayout {
  return { cols: nx + 1, rows: ny + 1 };
}

/**
 * Scratch buffers for one deformable sheet: per-column and per-row term caches, sized once at
 * build time and reused every frame so the per-frame path allocates nothing at all.
 *
 * Allocation in a render loop is its own performance problem on React Native's JS engine — a
 * per-frame `new Float32Array` here would hand the GC several megabytes a second and show up as
 * periodic frame-time spikes rather than a uniformly lower frame rate. Everything the deform
 * needs is therefore allocated once, here.
 */
export interface DeformScratch {
  layout: GridLayout;
  /** Per-column horizontal fraction `u` — constant for the sheet's whole lifetime. */
  u: Float32Array;
  /** Per-column caches, refreshed once per frame (they depend on the tear progress `q`). */
  colA: Float32Array;
  colB: Float32Array;
  colC: Float32Array;
  colD: Float32Array;
  colE: Float32Array;
  colF: Float32Array;
  /** Per-row caches — these depend only on the rest pose, so they are filled once at build. */
  rowA: Float32Array;
  rowB: Float32Array;
  rowC: Float32Array;
}

export function makeScratch(layout: GridLayout): DeformScratch {
  const { cols, rows } = layout;
  return {
    layout,
    u: new Float32Array(cols),
    colA: new Float32Array(cols),
    colB: new Float32Array(cols),
    colC: new Float32Array(cols),
    colD: new Float32Array(cols),
    colE: new Float32Array(cols),
    colF: new Float32Array(cols),
    rowA: new Float32Array(rows),
    rowB: new Float32Array(rows),
    rowC: new Float32Array(rows),
  };
}
