// Geometry helpers for The Obsidian Vault — ported from the design's own `roundedRect`, `slab`,
// `mesh`, `ribbonGeometry` and `lerpPts` (the-obsidian-vault/project/apex-vault.html, lines
// 108-157).
//
// WHY THESE ARE NOT THE RESERVE'S HELPERS
//
// The Reserve's `extrudeShape`/`ringBox` (../../reserveReveal/engine/reserveGeometry.ts) look
// superficially similar and are genuinely different in ways that matter:
//
//   - `slab` clamps its bevel to a fraction of the slab's own height (`min(bevel, h*0.32, r*0.6)`)
//     rather than taking it as an absolute. This vault is built almost entirely from very thin
//     plates — gold inlay lines 0.9mm thick, 1.1mm deco steps — and an absolute bevel larger than
//     half the thickness produces degenerate, self-intersecting geometry. That clamp is what makes
//     a 0.0009m-thick gold line extrudable at all.
//   - `slab` calls `.center()`, so a slab's origin is its own centre; the Reserve's `roundedBox` is
//     base-aligned because its parts stack upward from a floor. Both conventions are correct for
//     their own design, and mixing them silently offsets every part by half its thickness.
//
// Rather than generalise one helper with flags for both behaviours, each tier keeps the helper its
// own design was authored against. The shared abstraction in this system is the choreography
// contract, not the geometry primitives — forcing those to converge would make both harder to diff
// against their sources for no gain.
import * as THREE from "three";

/** A rounded rectangle in XY, radius clamped so it can never exceed half the shorter side. */
export function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const rad = Math.min(r, Math.min(w, h) / 2 - 1e-4);
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + rad, -h / 2);
  s.lineTo(w / 2 - rad, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rad);
  s.lineTo(w / 2, h / 2 - rad);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - rad, h / 2);
  s.lineTo(-w / 2 + rad, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rad);
  s.lineTo(-w / 2, -h / 2 + rad);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rad, -h / 2);
  return s;
}

/**
 * A rounded slab: `w` along x, `d` along z, `h` along y, centred on its own origin.
 *
 * The workhorse of this entire design — the vault shell, every wall, every gold line, the lid, the
 * cushion, the dial indices and the bracelet links are all slabs. The bevel clamp (see the file
 * header) is load-bearing for the thin ones.
 */
export function slab(w: number, d: number, h: number, r = 0.01, bevel = 0.004): THREE.BufferGeometry {
  const bev = Math.min(bevel, h * 0.32, r * 0.6);
  const g = new THREE.ExtrudeGeometry(roundedRect(w, d, r), {
    depth: Math.max(h - 2 * bev, 1e-4),
    bevelEnabled: bev > 1e-4,
    bevelThickness: bev,
    bevelSize: bev,
    bevelSegments: 3,
    curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2);
  g.center();
  g.computeVertexNormals();
  return g;
}

/**
 * A flat silk strip swept along a CatmullRom curve through `pts`.
 *
 * This is the ribbon, and it is the most unusual piece of geometry in any of the three tiers: a
 * ribbon cannot be a tube (it has no thickness) and cannot be a plane (it follows a 3D path and
 * twists), so it is generated as a two-vertex-wide triangle strip whose cross-axis rotates along
 * the curve.
 *
 * `fall` blends the strip's cross-axis from world-X toward the curve's own horizontal perpendicular.
 * At 0 the ribbon keeps a consistent facing — correct while it is wrapped taut around a box, where
 * its flat face lies against each surface. At 1 it twists naturally along its path — correct once
 * it has slipped off and is lying in a loose coil, where a fixed facing would look like a rigid
 * metal band. Animating `fall` from 0 to 1 as the ribbon falls is what sells it as fabric.
 *
 * `seg` is the sample count: the design uses 150 for the band and 64 for the tails. Kept, because
 * a swept strip with too few samples creases visibly at the corners it wraps.
 */
export function ribbonGeometry(
  pts: [number, number, number][],
  width: number,
  seg: number,
  fall = 0
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    "catmullrom",
    0.4
  );
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const X = new THREE.Vector3(1, 0, 0);
  const UP = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const hp = new THREE.Vector3().crossVectors(tg, UP);
    // Where the tangent is parallel to UP the cross product degenerates; fall back to world X so
    // the strip keeps a defined width instead of collapsing to a line.
    if (hp.lengthSq() < 1e-7) hp.copy(X);
    else hp.normalize();
    const b = X.clone().lerp(hp, fall).normalize();
    const n = new THREE.Vector3().crossVectors(b, tg).normalize();
    for (const s of [-0.5, 0.5]) {
      const v = p.clone().addScaledVector(b, s * width);
      pos.push(v.x, v.y, v.z);
      nor.push(n.x, n.y, n.z);
      uv.push(t, s + 0.5);
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export type Pt3 = [number, number, number];

/** Component-wise interpolation between two equal-length point lists — how the ribbon morphs
 * between its wrapped, slack and fallen shapes. */
export function lerpPts(a: Pt3[], b: Pt3[], t: number): Pt3[] {
  return a.map((p, i) => [
    p[0] + (b[i][0] - p[0]) * t,
    p[1] + (b[i][1] - p[1]) * t,
    p[2] + (b[i][2] - p[2]) * t,
  ] as Pt3);
}

/**
 * Collects geometries and materials for disposal.
 *
 * The same discipline as the Reserve's `GeometryBin`, with one addition this tier needs: the ribbon
 * is *rebuilt every frame* while the user draws it (its geometry is a function of the drag), so the
 * builder must dispose the previous geometry on each rebuild or leak a buffer per frame. `swap`
 * below is that operation, kept here so the rule travels with the bin rather than living in a
 * comment at the call site.
 */
export class ObsidianBin {
  private readonly geo: THREE.BufferGeometry[] = [];
  private readonly mat: THREE.Material[] = [];

  add<T extends THREE.BufferGeometry>(g: T): T {
    this.geo.push(g);
    return g;
  }

  addMat<T extends THREE.Material>(m: T): T {
    this.mat.push(m);
    return m;
  }

  slab(w: number, d: number, h: number, r?: number, bevel?: number): THREE.BufferGeometry {
    return this.add(slab(w, d, h, r, bevel));
  }

  cyl(r1: number, r2: number, h: number, s = 32, open = false): THREE.CylinderGeometry {
    return this.add(new THREE.CylinderGeometry(r1, r2, h, s, 1, open));
  }

  torus(r: number, t: number, rs: number, ts: number): THREE.TorusGeometry {
    return this.add(new THREE.TorusGeometry(r, t, rs, ts));
  }

  sphere(r: number, w = 24, h = 16): THREE.SphereGeometry {
    return this.add(new THREE.SphereGeometry(r, w, h));
  }

  ring(ri: number, ro: number, s = 72): THREE.RingGeometry {
    return this.add(new THREE.RingGeometry(ri, ro, s));
  }

  plane(w: number, h: number): THREE.PlaneGeometry {
    return this.add(new THREE.PlaneGeometry(w, h));
  }

  lathe(points: THREE.Vector2[], s: number): THREE.LatheGeometry {
    return this.add(new THREE.LatheGeometry(points, s));
  }

  /**
   * Replaces a mesh's geometry, disposing the old one.
   *
   * For per-frame regenerated geometry (the ribbon). The replacement is NOT tracked by the bin —
   * it is owned by the mesh and disposed by the next swap or by `disposeMesh` at teardown, which
   * avoids the bin growing by one entry per frame across a multi-second gesture.
   */
  swap(mesh: THREE.Mesh, next: THREE.BufferGeometry): void {
    const previous = mesh.geometry;
    mesh.geometry = next;
    previous?.dispose();
  }

  dispose(): void {
    for (const g of this.geo) g.dispose();
    for (const m of this.mat) m.dispose();
    this.geo.length = 0;
    this.mat.length = 0;
  }
}

/** Builds a named mesh and parents it. Shadows are off by default, as the design does — this scene
 * enables them on exactly four meshes rather than globally. */
export function put(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
  pos?: Pt3,
  rot?: Pt3
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.name = name;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = false;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}
