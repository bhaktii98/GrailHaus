// Card stack -> emergence -> fan -> rarity moment -> inspection.
// Everything is spring-driven toward per-phase targets, so inertia and settle
// come out of the simulation rather than being keyframed. Tier configuration
// supplies card count, fan geometry and the reveal timing profile.

import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function buildReveal(opts) {
  const {
    cfg, deck, faceTexes, versoTex, cardW, cardH, restY, packT,
  } = opts;
  const n = deck.length;
  const fan = cfg.fan;
  const timing = cfg.reveal;

  const group = new THREE.Group();
  group.name = 'cardStack';

  // Grail sits inside the fan, not on the end — it has to be noticed, not
  // presented. Slot order maps deck index -> left-to-right fan position.
  const grailIdx = deck.findIndex((c) => c.rarity === 'GRAIL');
  const order = [0, 3, 1, grailIdx < 0 ? 4 : grailIdx, 2, 4].slice(0, n);
  const slots = deck.map((_, i) => order.indexOf(i) >= 0 ? order.indexOf(i) : i);

  const cards = deck.map((data, i) => {
    const g = new THREE.Group();
    g.name = `card${i}_${data.rarity}`;
    const faceMat = new THREE.MeshStandardMaterial({
      name: `cardFace${i}`, map: faceTexes[i], roughness: 0.3 - data.metalBoost * 0.06,
      metalness: 0.2 + (data.rarity === 'GRAIL' ? 0.42 : data.rarity === 'PRIME' ? 0.24 : 0.06),
      emissive: new THREE.Color(0x120a22), emissiveIntensity: 0.1,
      side: THREE.FrontSide,
    });
    const versoMat = new THREE.MeshStandardMaterial({
      name: `cardVerso${i}`, map: versoTex, roughness: 0.4, metalness: 0.2,
      side: THREE.FrontSide,
    });
    const geo = new THREE.PlaneGeometry(cardW, cardH, 1, 1);
    const face = new THREE.Mesh(geo, faceMat);
    face.name = `cardFaceMesh${i}`;
    face.position.z = 0.00012;
    face.castShadow = true;
    const verso = new THREE.Mesh(geo, versoMat);
    verso.name = `cardVersoMesh${i}`;
    verso.position.z = -0.00012;
    verso.rotation.y = Math.PI;
    g.add(face, verso);

    // hit proxy: one box for the whole card, so picking is stable
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(cardW, cardH, 0.0008),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.name = `cardHit${i}`;
    g.add(hit);
    group.add(g);
    return {
      data, obj: g, faceMat, versoMat, hit, index: i, slot: slots[i],
      isGrail: data.rarity === 'GRAIL',
      p: new THREE.Vector3(), v: new THREE.Vector3(),
      r: new THREE.Vector3(), rv: new THREE.Vector3(),
      s: 1, sv: 0,
    };
  });

  // ---- phase machine ----------------------------------------------------
  const P = ['idle', 'stack', 'hold', 'rise', 'separate', 'settle', 'notice', 'approach', 'reveal', 'present', 'ready'];
  const state = {
    phase: 'idle', t: 0, dim: 0, focus: new THREE.Vector3(0, restY, 0),
    hero: -1, ready: false, grailShown: false, running: false, started: false,
  };
  const seq = grailIdx >= 0
    ? [['stack', timing.stack], ['hold', timing.hold], ['rise', timing.rise],
      ['separate', timing.separate], ['settle', timing.settle],
      ['notice', timing.notice], ['approach', timing.approach],
      ['reveal', timing.reveal], ['present', timing.present]]
    : [['stack', timing.stack], ['hold', timing.hold], ['rise', timing.rise],
      ['separate', timing.separate], ['settle', timing.settle]];
  let si = -1, phaseT = 0;

  const start = () => {
    if (state.started) return;                 // the sequence plays once
    state.started = true; state.running = true;
    si = 0; phaseT = 0; state.phase = seq[0][0];
  };

  // How far the presentation has progressed, 0..1, for cross-phase blending.
  const stageK = () => {
    const idx = P.indexOf(state.phase);
    return {
      stack: 0.34, hold: 0.36, rise: 1, separate: 1, settle: 1,
      notice: 1, approach: 1, reveal: 1, present: 1, ready: 1, idle: 0,
    }[state.phase] ?? 0;
  };

  const spread = () => {
    const ph = state.phase;
    if (ph === 'idle' || ph === 'stack' || ph === 'hold') return 0;
    if (ph === 'rise') return clamp(phaseT / timing.rise) * 0.12;
    if (ph === 'separate') return 0.12 + ease(clamp(phaseT / timing.separate)) * 0.88;
    return 1;
  };

  // Per-card target transform for the current phase.
  const target = (c, out) => {
    const k = stageK(), sp = spread();
    const mid = (n - 1) / 2;
    const off = c.slot - mid;
    const jitter = Math.sin(c.index * 2.7) * 0.16;      // symmetrical, not mechanical

    // hero override: selected card comes forward and centres
    if (state.hero === c.index) {
      out.p.set(0, restY + cfg.riseY * 1.15, packT * 3.2 + fan.heroZ);
      out.r.set(0, 0, 0);
      out.s = fan.heroScale;
      return;
    }
    const heroPush = state.hero >= 0 ? 1 : 0;
    const rare = state.phase === 'notice' || state.phase === 'approach'
      || state.phase === 'reveal' || state.phase === 'present';
    // while the grail is being noticed, the other five withdraw
    // during 'notice' nobody moves — only the light changes. The other five
    // withdraw once the grail actually starts coming forward.
    const away = rare && !c.isGrail && state.phase !== 'notice' ? 1 : 0;

    // The stack slides up the inside of the bag: it stays at z~0, behind the
    // front wall, so only the part above the mouth shows. Cards only come
    // forward once they separate into the fan.
    const riseY = restY + cfg.riseY * k + sp * fan.liftY;
    const arc = -Math.abs(off) * fan.arcDrop * sp;
    const ang = -off * fan.angle * sp;
    const x = off * fan.stepX * sp;
    const z = sp * packT * 3.1 + (c.slot - mid) * 0.00022
      + sp * 0.0016 * (1 - Math.abs(off) / (mid + 0.001));

    out.p.set(
      x * (1 + jitter * 0.04) - heroPush * off * 0.004,
      riseY + arc + jitter * 0.0008 * sp - heroPush * 0.006,
      z - heroPush * 0.012,
    );
    out.p.x *= 1 + away * 0.12;
    out.p.y -= away * 0.006;
    out.p.z -= away * 0.011;
    out.r.set(sp * 0.06 * Math.sign(off || 1) * -1, sp * off * 0.05, ang + jitter * 0.01 * sp);
    out.s = (1 - heroPush * 0.06) * (1 - away * 0.07);

    // once revealed, the grail keeps a little prominence in the fan
    if (c.isGrail && state.grailShown) {
      out.p.z += 0.0078; out.p.y += 0.005; out.s *= 1.06;
    }
    // presented: the grail holds the room on its own before the fan relaxes
    if (c.isGrail && state.phase === 'present') {
      const q = ease(clamp(phaseT / timing.present));
      out.p.x = out.p.x * (1 - q);
      out.p.z += fan.grailZ * 0.9 * q;
      out.p.y += 0.014 * q;
      out.r.z *= 1 - q;
      out.s *= 1 + 0.16 * q;
    }

    // the grail holds back: lower, further into the fan, face angled away so
    // only its foil edge catches the key light
    if (c.isGrail && !state.grailShown) {
      const conceal = state.phase === 'notice' ? 1 - ease(clamp(phaseT / timing.notice)) * 0.25
        : state.phase === 'approach' || state.phase === 'reveal' ? 0.2 : 1;
      out.p.y -= 0.019 * sp * conceal;
      out.p.z -= 0.013 * sp * conceal;
      // the turned edge rocks a few degrees: the only thing catching light
      out.r.y += (1.28 + Math.sin(phaseT * 1.9) * 0.07) * sp * conceal;
      if (state.phase === 'approach' || state.phase === 'reveal') {
        const q = state.phase === 'reveal'
          ? ease(clamp(phaseT / timing.reveal))
          : ease(clamp(phaseT / timing.approach)) * 0.34;
        out.p.z += q * (fan.grailZ);
        out.p.y += q * 0.012;
        out.r.y = 1.28 * (1 - q) * (1 - q);
        out.r.z *= 1 - q * 0.8;
        out.s = 1 + q * 0.14;
      }
    }
  };

  const tmp = { p: new THREE.Vector3(), r: new THREE.Vector3(), s: 1 };

  // hero interaction (inertial, user-driven only — never autoplays)
  const hero = { yaw: 0, pitch: 0, vyaw: 0, vpitch: 0, zoom: 1, dragging: false };

  const step = (dt) => {
    if (state.running) {
      phaseT += dt;
      const [, dur] = seq[si];
      if (phaseT >= dur) {
        phaseT = 0;
        if (si < seq.length - 1) {
          si++;
          state.phase = seq[si][0];
          if (state.phase === 'reveal') state.grailShownAt = 0;
        } else {
          state.phase = 'ready'; state.ready = true; state.running = false;
          state.grailShown = true;
        }
      }
      if (state.phase === 'reveal' && phaseT > timing.reveal * 0.55) state.grailShown = true;
    }

    // environment darkening for the rarity moment
    const dimTarget = state.hero >= 0 ? 0.5
      : state.phase === 'notice' ? ease(clamp(phaseT / timing.notice)) * 0.62
        : state.phase === 'approach' ? 0.62
          : state.phase === 'reveal' ? 0.62 - ease(clamp(phaseT / timing.reveal)) * 0.22
            : state.phase === 'ready' ? 0.34 : 0;
    state.dim += (dimTarget - state.dim) * Math.min(1, dt * 3.4);

    cards.forEach((c) => {
      target(c, tmp);
      // critically-damped-ish springs: settle without visible bounce, but
      // still carry a touch of inertia into the stop
      const k = c.index === state.hero ? 52 : 34, damp = 2 * Math.sqrt(k) * 0.82;
      ['x', 'y', 'z'].forEach((ax) => {
        c.v[ax] += ((tmp.p[ax] - c.p[ax]) * k - c.v[ax] * damp) * dt;
        c.p[ax] += c.v[ax] * dt;
        c.rv[ax] += ((tmp.r[ax] - c.r[ax]) * k * 0.92 - c.rv[ax] * damp) * dt;
        c.r[ax] += c.rv[ax] * dt;
      });
      c.sv += ((tmp.s - c.s) * k - c.sv * damp) * dt;
      c.s += c.sv * dt;

      c.obj.position.copy(c.p);
      c.obj.rotation.set(c.r.x, c.r.y, c.r.z);
      c.obj.scale.setScalar(c.s);

      // rarity-tied specular response, lifted while the card is the hero
      const rar = c.data.rarity;
      const base = rar === 'GRAIL' ? 0.3 : rar === 'PRIME' ? 0.16 : 0.06;
      const focusBoost = c.index === state.hero ? 0.34
        : c.isGrail && (state.phase === 'notice' || state.phase === 'approach'
          || state.phase === 'reveal' || state.phase === 'present') ? 0.32 : 0;
      c.faceMat.emissiveIntensity = 0.08 + base * 0.4 + focusBoost * 0.5;
      c.faceMat.envMapIntensity = 1 + base + focusBoost;
    });

    // hero free rotation with inertia
    if (state.hero >= 0) {
      const c = cards[state.hero];
      if (!hero.dragging) {
        hero.vyaw *= Math.pow(0.02, dt);
        hero.vpitch *= Math.pow(0.02, dt);
      }
      hero.yaw += hero.vyaw * dt;
      hero.pitch = clamp(hero.pitch + hero.vpitch * dt, -1.1, 1.1);
      c.obj.rotation.set(hero.pitch, hero.yaw, c.r.z * 0.2);
      c.obj.scale.setScalar(fan.heroScale * hero.zoom);
      state.focus.copy(c.obj.position);
    } else {
      const g = cards[grailIdx >= 0 ? grailIdx : 0];
      const interest = (state.phase === 'notice' || state.phase === 'approach'
        || state.phase === 'reveal' || state.phase === 'present')
        ? g.obj.position : new THREE.Vector3(0, restY + cfg.riseY * stageK(), 0);
      state.focus.lerp(interest, Math.min(1, dt * 2.2));
    }
  };

  // ---- inspection -------------------------------------------------------
  const ray = new THREE.Raycaster();
  const pick = (ndc, camera) => {
    if (!state.ready) return -1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(cards.map((c) => c.hit), false);
    if (!hits.length) return -1;
    const name = hits[0].object.name;
    return Number(name.replace('cardHit', ''));
  };
  const setHero = (i) => {
    if (i === state.hero) return;
    state.hero = i;
    hero.yaw = 0; hero.pitch = 0; hero.vyaw = 0; hero.vpitch = 0; hero.zoom = 1;
  };
  const dragHero = (dx, dy) => {
    if (state.hero < 0) return;
    hero.dragging = true;
    hero.vyaw = dx * 6.5;
    hero.vpitch = -dy * 5.0;
    hero.yaw += dx * 0.9;
    hero.pitch = clamp(hero.pitch - dy * 0.7, -1.1, 1.1);
  };
  const endDrag = () => { hero.dragging = false; };
  const zoomHero = (d) => { hero.zoom = clamp(hero.zoom * (1 - d), 0.85, 2.1); };
  const flipHero = () => { hero.vyaw = 7.2; };

  const reset = () => {
    state.phase = 'idle'; state.running = false; state.started = false; state.ready = false;
    state.hero = -1; state.grailShown = false; state.dim = 0;
    si = -1; phaseT = 0;
    cards.forEach((c) => {
      c.p.set(0, restY, (c.slot - (n - 1) / 2) * 0.0002);
      c.v.set(0, 0, 0); c.r.set(0, 0, 0); c.rv.set(0, 0, 0); c.s = 1; c.sv = 0;
      c.obj.position.copy(c.p); c.obj.rotation.set(0, 0, 0); c.obj.scale.setScalar(1);
    });
  };
  reset();

  return {
    group, cards, state, start, step, pick, setHero, dragHero, endDrag,
    zoomHero, flipHero, reset,
    get heroCard() { return state.hero >= 0 ? cards[state.hero] : null; },
  };
}
