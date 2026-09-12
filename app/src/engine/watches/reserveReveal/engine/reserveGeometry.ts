// Shape-and-extrude geometry helpers — ported from the design handoff's own helpers
// (heritage-case-watch-reveal/project/heritage-case.js lines 159-207, and watch-builder.js lines
// 10-36).
//
// WHY THIS MODULE IS THE CORE OF THE TIER-1 REBUILD
//
// This is the single largest thing the previous tier-1 implementation left out, and the reason its
// case read as a brown box rather than a presentation case. The design builds the Reserve out of
// *extruded profiles with real holes*: the case body is a walled ring with a rounded-rectangle
// cavity punched clean through it, the lid rim is another, the brass inlay is a third. The
// previous build substituted `boxGeometry` — so where the design has an actual open box with
// visible wall thickness and a bevelled top edge, it had a solid cuboid with a smaller cuboid
// sitting in a dent, and every edge was a hard 90° corner where the design bevels every one.
//
// Hard edges are the specific tell. A real object's edges catch light along their bevel, giving a
// bright thin line that reads as machined or hand-finished; a zero-radius box edge catches nothing
// and reads as untextured CG. `bevelEnabled` on every extrusion below is what buys that back, and
// it is cheap — a bevel adds a handful of triangles per corner, not a pass.
//
// COST, STATED PLAINLY
//
// `ExtrudeGeometry` is more expensive to *construct* than `BoxGeometry` (it triangulates a shape
// with holes on the CPU), and `curveSegments`/`bevelSegments` multiply that. It is not more
// expensive to *draw* — once built it is an ordinary indexed buffer. Since every one of these is
// built once at mount and never rebuilt, the cost lands in the same dead time the texture bakes
// use, and the per-frame budget is unaffected. The segment counts below are the design's own.
import * as THREE from "three";

/**
 * A rounded rectangle in the XY plane, as a THREE.Shape.
 *
 * Built with `quadraticCurveTo` corners exactly as the source does rather than with arcs — a
 * quadratic corner is subtly flatter than a circular one, which is what gives these cases their
 * slightly squared, cabinet-made look instead of a pill shape.
 *
 * Note the coordinate convention: the shape is authored in XY and every extrusion below rotates it
 * -90° about X, so the shape's own "y" becomes world Z (depth). That is why the parameters are
 * named `w`/`d` rather than `w`/`h`.
 */
export function roundedRectShape(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  s.moveTo(x0 + r, z0);
  s.lineTo(x1 - r, z0);
  s.quadraticCurveTo(x1, z0, x1, z0 + r);
  s.lineTo(x1, z1 - r);
  s.quadraticCurveTo(x1, z1, x1 - r, z1);
  s.lineTo(x0 + r, z1);
  s.quadraticCurveTo(x0, z1, x0, z1 - r);
  s.lineTo(x0, z0 + r);
  s.quadraticCurveTo(x0, z0, x0 + r, z0);
  return s;
}

/**
 * Extrudes a shape to height `h`, lying flat (Y-up), centred on its own vertical midpoint.
 *
 * The centring matters: `ExtrudeGeometry` builds along +Z from the shape plane, so without the
 * rotate-and-translate below every extruded part would need its own compensating offset at the
 * call site, and the design's measurements (which assume a part's origin is its middle) would all
 * be wrong by half a thickness.
 *
 * This is `watch-builder.js`'s own `extrudeShape` — used for watch cases, where parts are centred.
 */
export function extrudeShape(shape: THREE.Shape, h: number, bevel = 0.0006): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0002, h - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 12,
  });
  g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();
  const bb = g.boundingBox;
  if (bb) g.translate(0, -(bb.min.y + bb.max.y) / 2, 0);
  return g;
}

/**
 * Extrudes a shape to height `h`, lying flat, with its base at y=0.
 *
 * The case-building counterpart to `extrudeShape` — `heritage-case.js`'s own `roundedBox`. Base-
 * aligned rather than centre-aligned because the case's parts stack upward from a floor (body sits
 * on feet, lid sits on the body), and expressing that stack in base-aligned parts is what makes
 * the design's height arithmetic (`BODY_H`, `LID_RIM`, `FLOOR`) read directly.
 */
export function roundedBox(w: number, h: number, d: number, r: number, bevel = 0.002): THREE.BufferGeometry {
  const s = roundedRectShape(w, d, r);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h - bevel * 2,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();
  const bb = g.boundingBox;
  if (bb) g.translate(0, -bb.min.y, 0);
  return g;
}

/**
 * A walled ring: an outer rounded rectangle with an inner rounded rectangle punched through it.
 *
 * This is the one that makes a presentation case a *case*. The hole is a genuine hole in the
 * triangulation, so the resulting part has an inner wall face with real thickness that catches
 * light separately from the outer face — you can see into the box and see that its walls are
 * 10mm of walnut. The previous build's nested-cuboid approximation had no inner wall at all.
 *
 * The hole path must wind opposite to the outer contour or the triangulator treats it as a second
 * solid island rather than a void; `.reverse()` on the sampled points is how the source ensures
 * that, and sampling at 24 points is its own figure (enough that a 5-8mm corner radius reads as
 * curved, few enough to keep the triangulation cheap).
 */
export function ringBox(
  w: number,
  h: number,
  d: number,
  r: number,
  iw: number,
  id: number,
  ir: number,
  bevel = 0.0015
): THREE.BufferGeometry {
  const s = roundedRectShape(w, d, r);
  const hole = roundedRectShape(iw, id, ir);
  s.holes.push(new THREE.Path(hole.getPoints(24).reverse()));
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h - bevel * 2,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();
  const bb = g.boundingBox;
  if (bb) g.translate(0, -bb.min.y, 0);
  return g;
}

/**
 * The watch-scale walled ring — `watch-builder.js`'s own `frameGeo`.
 *
 * Same construction as `ringBox` but centred (see `extrudeShape`) and with a finer bevel, because
 * at watch scale a 1.5mm bevel would be a visible chamfer rather than a crisp edge. Used for the
 * integrated and rectangular bezels, which are frames around a dial aperture.
 */
export function frameGeo(
  w: number,
  d: number,
  h: number,
  r: number,
  iw: number,
  id: number,
  ir: number
): THREE.BufferGeometry {
  const s = roundedRectShape(w, d, r);
  s.holes.push(new THREE.Path(roundedRectShape(iw, id, ir).getPoints(28).reverse()));
  return extrudeShape(s, h, 0.0004);
}

/**
 * Collects geometries for disposal.
 *
 * Every builder in this folder allocates dozens of geometries, and an r3f Canvas that unmounts
 * without disposing them leaks GPU buffers — which matters here because this app remounts reveal
 * Canvases repeatedly within a session. A tiny helper rather than each builder hand-rolling the
 * same array, so the pattern is impossible to forget partway through a 400-line builder.
 */
export class GeometryBin {
  private readonly items: THREE.BufferGeometry[] = [];

  add<T extends THREE.BufferGeometry>(g: T): T {
    this.items.push(g);
    return g;
  }

  box(x: number, y: number, z: number): THREE.BoxGeometry {
    return this.add(new THREE.BoxGeometry(x, y, z));
  }

  cyl(r1: number, r2: number, h: number, s = 48, open = false): THREE.CylinderGeometry {
    return this.add(new THREE.CylinderGeometry(r1, r2, h, s, 1, open));
  }

  sphere(r: number, w = 8, h = 6): THREE.SphereGeometry {
    return this.add(new THREE.SphereGeometry(r, w, h));
  }

  /** A partial sphere — the domed crystal's cap. */
  dome(r: number, w: number, h: number, phiLength: number): THREE.SphereGeometry {
    return this.add(new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, phiLength));
  }

  torus(r: number, t: number, rs: number, ts: number, arc?: number): THREE.TorusGeometry {
    return this.add(new THREE.TorusGeometry(r, t, rs, ts, arc));
  }

  ring(ri: number, ro: number, s = 56): THREE.RingGeometry {
    return this.add(new THREE.RingGeometry(ri, ro, s));
  }

  plane(w: number, h: number): THREE.PlaneGeometry {
    return this.add(new THREE.PlaneGeometry(w, h));
  }

  capsule(r: number, len: number, cs = 8, rs = 16): THREE.CapsuleGeometry {
    return this.add(new THREE.CapsuleGeometry(r, len, cs, rs));
  }

  /** A cone, built as a zero-top-radius cylinder — matches the source's own construction. */
  cone(r: number, h: number, s: number): THREE.CylinderGeometry {
    return this.add(new THREE.CylinderGeometry(0, r, h, s));
  }

  dispose(): void {
    for (const g of this.items) g.dispose();
    this.items.length = 0;
  }
}

/** Builds a named mesh and parents it, mirroring the source's own `mesh`/`put` shorthands. Named
 * meshes throughout because the design names every part, and those names are how a later reader
 * (or a debugger) tells `lining_wall_back` from `lid_lining_back`. */
export function put(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
  pos?: [number, number, number],
  rot?: [number, number, number]
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.name = name;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
  return m;
}
