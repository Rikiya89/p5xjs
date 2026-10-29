// DESCARTES BLOOM — Apollonian gasket from Descartes' circle theorem, revealed by size over a seamless loop.
const W = 1080;
const H = 1920;
const FPS = 60;
const MAX_DURATION = 8;               // loop length in seconds — the animation speed
const MAX_FRAMES = FPS * MAX_DURATION;
const LOOP_FRAMES = MAX_FRAMES;
const TAU = Math.PI * 2;
const BG_R = 3, BG_G = 3, BG_B = 5;
const INK_R = 255, INK_G = 255, INK_B = 255;

// ── Tunables ────────────────────────────────────────────────────────────────────────────────────────
// Recursion: a circle is generated only while its radius stays ≥ MIN_RADIUS_PX and depth ≤ MAX_DEPTH.
const MAX_DEPTH = 24;
const MIN_RADIUS_PX = 1.6;
// Bloom timing as fractions of the loop: Genesis → rise (Recursion) → hold (Bloom) → fall (Return) → Genesis.
const BLOOM = {
  riseStart: 0.08, riseEnd: 0.50,
  fallStart: 0.70, fallEnd: 0.94,
  soft: 0.10,                         // width of the reveal front, in normalised log-radius
  coreLead: 0.12,                     // circles inside the central A·B·C gap emerge this much earlier
  sweepLead: 1.4,                     // an outline draws on from the side facing its host centre, ahead of its fade
  coverPhase: 0.60,                   // C key captures this loop position (bloom peak)
};
// Outline: width falls from LINE_WEIGHT on the root circles to STROKE_MIN at MIN_RADIUS_PX.
const LINE_WEIGHT = 2.2;
const STROKE_MIN = 0.55, STROKE_EXP = 1.6, STROKE_RADIUS_CAP = 0.4;
const GLOW_PASSES = [                 // stroke-alpha layering, widest first (large circles only)
  { w: 4.6, a: 20 },
  { w: 2.2, a: 54 },
  { w: 1.0, a: 240 },
];
const GLOW_LEVEL = 0.3;               // circles with level below this get all GLOW_PASSES, others only the last
const TONE_FLOOR = 0.4;               // brightness at the smallest level
const PERIPHERY_TONE = 0.8;           // outside the central gap → slightly dimmer, keeps the centre focal
const LEVEL_BUCKETS = 48;
// Nesting: every circle with radius ≥ NEST_MIN_PX hosts its own gasket, NEST_LEVELS deep.
const NEST_LEVELS = 2, NEST_MIN_PX = 37;
const NEST_SPIN = [-2, 2];            // integer 120° steps per loop relative to the host, per nesting level
const NEST_TONE = [1, 0.62, 0.42];    // nested gaskets sit back in brightness; only nest 0 gets glow passes
// The six kissing points of the four root circles, lit at Genesis and dissolved as the recursion starts.
const KISS = { radius: 2.4, halo: 7, alpha: 0.9, haloAlpha: 0.16, fadeBy: 0.4 };
// Dual lace: every gap's orthogonal circle, drawn as its arcs inside the gasket's circles. Spun from one kissing
// point to the next as LACE rises, unspun as it falls; arcs shorter than minChordPx or deeper than maxNest are skipped.
const LACE = { minChordPx: 12, maxNest: 1, width: 0.8, alpha: 0.45, riseStart: 0.34, riseEnd: 0.50, fallStart: 0.70, fallEnd: 0.86 };
const ROT_TURNS = 1;                  // integer: 120° steps per loop (gasket is D3-symmetric)
const BREATH = 0.025;
const LOOP_PHASE_OFFSET = 0;          // shift the loop start (0 = Genesis first, as briefed)
const GASKET_RADIUS = 380;
const SAFE_MARGIN_TOP = 250, SAFE_MARGIN_BOTTOM = 440, SAFE_MARGIN_RIGHT = 140;
const CX = W / 2;                     // frame-centred; CX + COLUMN_HALF still clears SAFE_MARGIN_RIGHT
// One column: the gasket and every HUD line share the axis x = CX and the gasket's breathing width.
const COLUMN_HALF = GASKET_RADIUS * (1 + BREATH);
const TRACK_Y = 551, GASKET_GAP = 32;
const CY = TRACK_Y + GASKET_GAP + COLUMN_HALF;
const TANGENCY_EPS = 1e-9;
let SAFE_ZONE_DEBUG = false;
let TEXT_OVERLAY = true;
let DEBUG = true;

let canvasEl = null, grainPg = null, finishImg = null, debugImg = null;
let muxer = null, encoder = null, isRecording = false, recFrameCount = 0;
let loopProgress = 0, phase = 0, env = 0, coverRequested = false;
let circles = [], gaskets = [], buckets = [], kisses = [], rootLevel = 0;
let gaps = [], duals = [], laceBuckets = [];

// ── Geometry (unit space: outer circle k = −1 centred at 0) ─────────────────────────────────────────
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
function csqrt(z) {
  const m = Math.hypot(z[0], z[1]);
  const re = Math.sqrt(Math.max(0, (m + z[0]) / 2));
  const im = Math.sqrt(Math.max(0, (m - z[0]) / 2));
  return [re, z[1] < 0 ? -im : im];
}
// |zi − zj| − |1/ki + 1/kj|: zero when tangent (signed radii make the outer circle's tangency internal).
function tangencyError(a, b) {
  return Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - Math.abs(1 / a.k + 1 / b.k));
}
function makeCircle(k, x, y, depth, core, parents) {
  return { k, kx: k * x, ky: k * y, x, y, r: Math.abs(1 / k), depth, core, parents, level: 0 };
}
// Complex Descartes: both circles tangent to c1, c2, c3. The ± of k and of kz are not independently
// paired, so all four combinations are tried and only geometrically tangent ones are kept.
// Near a double root √(Σ kᵢkⱼzᵢzⱼ) amplifies roundoff to ~√ε, so candidates are selected at SOLVE_EPS and the
// coinciding ± pair is merged to its mean, which cancels the √ term exactly.
const SOLVE_EPS = 1e-6;
function solveDescartes(c1, c2, c3) {
  const kSum = c1.k + c2.k + c3.k;
  const kRoot = 2 * Math.sqrt(Math.max(0, c1.k * c2.k + c2.k * c3.k + c3.k * c1.k));
  const z = [[c1.x, c1.y], [c2.x, c2.y], [c3.x, c3.y]];
  const kz = [[c1.kx, c1.ky], [c2.kx, c2.ky], [c3.kx, c3.ky]];
  const ks = [c1.k, c2.k, c3.k];
  const wSum = [kz[0][0] + kz[1][0] + kz[2][0], kz[0][1] + kz[1][1] + kz[2][1]];
  let inner = [0, 0];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3, p = cmul(z[i], z[j]), kk = ks[i] * ks[j];
    inner = [inner[0] + kk * p[0], inner[1] + kk * p[1]];
  }
  const zRoot = csqrt(inner);
  const found = [];
  for (const sk of [1, -1]) {
    const k = kSum + sk * kRoot;
    if (Math.abs(k) < 1e-12) continue;
    for (const sz of [1, -1]) {
      const c = makeCircle(k, (wSum[0] + 2 * sz * zRoot[0]) / k, (wSum[1] + 2 * sz * zRoot[1]) / k, 0, false, null);
      const err = Math.max(tangencyError(c, c1), tangencyError(c, c2), tangencyError(c, c3));
      if (err > SOLVE_EPS) continue;
      const twin = found.find((f) => Math.abs(f.k - c.k) < SOLVE_EPS && Math.hypot(f.x - c.x, f.y - c.y) < SOLVE_EPS);
      if (twin) Object.assign(twin, makeCircle(k, (twin.x + c.x) / 2, (twin.y + c.y) / 2, 0, false, null));
      else found.push(c);
    }
  }
  return found;
}
function buildGasket() {
  circles = [];
  const rA = 2 * Math.sqrt(3) - 3;    // three equal circles in the unit circle
  const O = makeCircle(-1, 0, 0, 0, false, null);
  circles.push(O);
  for (let j = 0; j < 3; j++) {
    const ang = -Math.PI / 2 + TAU * j / 3;
    circles.push(makeCircle(1 / rA, (1 - rA) * Math.cos(ang), (1 - rA) * Math.sin(ang), 0, false, null));
  }
  // The two solutions for (A,B,C) are the outer circle (k = −1) and the centre circle D.
  const sol = solveDescartes(circles[1], circles[2], circles[3]);
  const D = sol.find((c) => c.k > 0);
  if (!D || !sol.some((c) => Math.abs(c.k + 1) < 1e-9)) throw new Error("Root configuration is not a Descartes quadruple");
  Object.assign(D, { depth: 1, core: true, parents: [1, 2, 3, 0] });
  circles.push(D);
  const queue = [[1, 2, 4, 3, 1, true], [2, 3, 4, 1, 1, true], [1, 3, 4, 2, 1, true],
    [0, 1, 2, 3, 0, false], [0, 2, 3, 1, 0, false], [0, 1, 3, 2, 0, false]];
  const minR = MIN_RADIUS_PX / GASKET_RADIUS;
  gaps = [[1, 2, 3, 0]];
  for (let q = 0; q < queue.length; q++) {
    const [i, j, l, o, depth, core] = queue[q];
    const a = circles[i], b = circles[j], c = circles[l], old = circles[o];
    gaps.push([i, j, l, o]);
    const k = 2 * (a.k + b.k + c.k) - old.k;
    if (k <= 0 || 1 / k < minR || depth + 1 > MAX_DEPTH) continue;
    const kx = 2 * (a.kx + b.kx + c.kx) - old.kx, ky = 2 * (a.ky + b.ky + c.ky) - old.ky;
    const n = circles.length;
    circles.push(makeCircle(k, kx / k, ky / k, depth + 1, core, [i, j, l, o]));
    queue.push([i, j, n, l, depth + 1, core], [j, l, n, i, depth + 1, core], [i, l, n, j, depth + 1, core]);
  }
  buildDuals();
}
// Tangency point of two circles with signed curvatures: (kₐzₐ + k_b z_b) / (kₐ + k_b).
const kissPoint = (a, b) => [(a.kx + b.kx) / (a.k + b.k), (a.ky + b.ky) / (a.k + b.k)];
// Dual circle of each gap: through its three kissing points, orthogonal to its three circles.
// The dual of a Descartes quadruple is again one: k⊥ = (kᵢ + kⱼ + kₗ − kₒ) / 2, and (kz)⊥ the same way.
// Inside each member circle the dual leaves one arc — a hyperbolic geodesic between two of its kissing points.
function buildDuals() {
  duals = [];
  for (const [i, j, l, o] of gaps) {
    const t = [circles[i], circles[j], circles[l]], old = circles[o];
    const k = (t[0].k + t[1].k + t[2].k - old.k) / 2;
    if (Math.abs(k) < 1e-9) continue;
    const x = (t[0].kx + t[1].kx + t[2].kx - old.kx) / 2 / k, y = (t[0].ky + t[1].ky + t[2].ky - old.ky) / 2 / k;
    const d = { k, x, y, r: Math.abs(1 / k), members: [i, j, l], arcs: [] };
    for (let m = 0; m < 3; m++) {
      const c = t[m];
      if (c.k <= 0) continue;     // the outer circle's arc lies outside the gasket
      const p = kissPoint(c, t[(m + 1) % 3]), q = kissPoint(c, t[(m + 2) % 3]);
      const a1 = Math.atan2(p[1] - y, p[0] - x), a2 = Math.atan2(q[1] - y, q[0] - x);
      const sweep = ((a2 - a1) % TAU + TAU) % TAU, mid = a1 + sweep / 2;
      const inside = Math.hypot(x + d.r * Math.cos(mid) - c.x, y + d.r * Math.sin(mid) - c.y) < c.r;
      d.arcs.push({ m: [i, j, l][m], a0: inside ? a1 : a2, sweep: inside ? sweep : TAU - sweep,
        chord: Math.hypot(p[0] - q[0], p[1] - q[1]) });
    }
    duals.push(d);
  }
}
// Every circle ≥ NEST_MIN_PX is the outer circle (k < 0) of its own gasket: the unit template scaled to the host,
// one root circle pointing away from the parent's centre. Gaskets are listed parents-first.
function buildScene() {
  const span = Math.log(GASKET_RADIUS / MIN_RADIUS_PX);
  rootLevel = Math.log(1 / circles[1].r) / span;
  gaskets = [];
  const addGasket = (parent, nest, R, hostX, hostY, base, spin) => {
    const g = { parent, nest, R, hostX, hostY, base, spin, items: [], lace: [] }, gi = gaskets.length;
    const levelOf = new Map();
    gaskets.push(g);
    circles.forEach((c, n) => {
      if ((nest > 0 && n === 0) || c.r * R < MIN_RADIUS_PX) return;
      const core = nest === 0 && c.core;
      let level = Math.log(GASKET_RADIUS / (c.r * R)) / span - (core ? BLOOM.coreLead : 0);
      // coreLead must not pull any recursion circle into the Genesis state.
      if (nest > 0 || n > 3) level = Math.max(level, rootLevel + BLOOM.soft + 1e-3);
      g.items.push({ gi, nest, x: c.x * R, y: c.y * R, r: c.r * R, level, core, reveal: level, start: Math.atan2(-c.y, -c.x) });
      levelOf.set(n, level);
    });
    for (const d of nest <= LACE.maxNest ? duals : []) {
      // A nested gasket's outer circle is its host, drawn by the parent gasket.
      const members = d.members.filter((n) => !(nest > 0 && n === 0));
      if (members.some((n) => !levelOf.has(n))) continue;
      const level = Math.max(...members.map((n) => levelOf.get(n)));
      for (const a of d.arcs) {
        if (a.chord * R < LACE.minChordPx) continue;
        g.lace.push({ gi, nest, x: d.x * R, y: d.y * R, r: d.r * R, a0: a.a0, sweep: a.sweep, level });
      }
    }
    if (nest >= NEST_LEVELS) return;
    circles.forEach((c, n) => {
      if (n === 0 || c.r * R < NEST_MIN_PX) return;
      const away = Math.hypot(c.x, c.y) > 1e-9 ? Math.atan2(c.y, c.x) + Math.PI / 2 : 0;
      addGasket(gi, nest + 1, c.r * R, c.x * R, c.y * R, away, NEST_SPIN[nest]);
    });
  };
  addGasket(-1, 0, GASKET_RADIUS, 0, 0, 0, 0);
  buckets = buildBuckets(gaskets.flatMap((g) => g.items));
  laceBuckets = buildLaceBuckets(gaskets.flatMap((g) => g.lace));
  // Tangency point of two circles with signed curvatures: (kₐzₐ + k_b z_b) / (kₐ + k_b).
  kisses = [];
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      const ca = circles[a], cb = circles[b], k = ca.k + cb.k;
      kisses.push([(ca.kx + cb.kx) / k * GASKET_RADIUS, (ca.ky + cb.ky) / k * GASKET_RADIUS]);
    }
  }
}

// ── Level buckets: one cached Path2D per (level, family); only the reveal front is rebuilt per frame ──
const smootherstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10));
function strokeWidth(level, rPx) {
  const t = Math.min(1, Math.max(0, level));
  const w = STROKE_MIN + (LINE_WEIGHT - STROKE_MIN) * Math.pow(1 - t, STROKE_EXP);
  return Math.max(STROKE_MIN, Math.min(w, rPx * STROKE_RADIUS_CAP));
}
function buildBuckets(items) {
  const map = new Map();
  for (const c of items) {
    const b = Math.min(LEVEL_BUCKETS - 1, Math.max(0, Math.floor(c.level * LEVEL_BUCKETS)));
    const key = (b * 2 + (c.core ? 1 : 0)) * 4 + c.nest;
    if (!map.has(key)) map.set(key, { level: 0, core: c.core, nest: c.nest, minR: Infinity, list: [] });
    const bucket = map.get(key);
    bucket.list.push(c);
    bucket.minR = Math.min(bucket.minR, c.r);
  }
  return [...map.values()].map((bucket) => {
    // A bucket reveals at its earliest member's level, so no child shows before its parent.
    bucket.level = Math.min(...bucket.list.map((c) => c.level));
    for (const c of bucket.list) c.reveal = bucket.level;
    const t = Math.min(1, Math.max(0, bucket.level));
    bucket.width = strokeWidth(bucket.level, bucket.minR);
    bucket.tone = (1 - (1 - TONE_FLOOR) * t) * (bucket.core ? 1 : PERIPHERY_TONE) * NEST_TONE[bucket.nest];
    bucket.passes = bucket.nest === 0 && bucket.level < GLOW_LEVEL ? GLOW_PASSES : GLOW_PASSES.slice(-1);
    bucket.count = bucket.list.length;
    // [gasket, x, y, r, start angle] per circle, in the host gasket's local frame.
    bucket.data = new Float64Array(bucket.list.length * 5);
    bucket.list.forEach((c, i) => bucket.data.set([c.gi, c.x, c.y, c.r, c.start], i * 5));
    delete bucket.list;
    return bucket;
  }).sort((a, b) => a.level - b.level);
}

function buildLaceBuckets(arcs) {
  const map = new Map();
  for (const a of arcs) {
    const key = Math.min(LEVEL_BUCKETS - 1, Math.max(0, Math.floor(a.level * LEVEL_BUCKETS))) * 4 + a.nest;
    if (!map.has(key)) map.set(key, { nest: a.nest, list: [] });
    map.get(key).list.push(a);
  }
  return [...map.values()].map((bucket) => {
    // Revealed with the last of its arcs' circles, so no arc shows before the circles it joins.
    bucket.level = Math.max(...bucket.list.map((a) => a.level));
    const t = Math.min(1, Math.max(0, bucket.level));
    bucket.tone = (1 - (1 - TONE_FLOOR) * t) * NEST_TONE[bucket.nest];
    bucket.width = Math.max(STROKE_MIN * 0.8, LACE.width * (1 - 0.5 * t));
    bucket.count = bucket.list.length;
    // [gasket, x, y, r, start angle, sweep] per arc, in the host gasket's local frame.
    bucket.data = new Float64Array(bucket.list.length * 6);
    bucket.list.forEach((a, i) => bucket.data.set([a.gi, a.x, a.y, a.r, a.a0, a.sweep], i * 6));
    delete bucket.list;
    return bucket;
  }).sort((a, b) => a.level - b.level);
}

// ── Loop state: every term is periodic in u ∈ [0,1) ─────────────────────────────────────────────────
function bloomEnvelope(u, { riseStart, riseEnd, fallStart, fallEnd } = BLOOM) {
  if (u < riseStart || u >= fallEnd) return 0;
  if (u < riseEnd) return smootherstep((u - riseStart) / (riseEnd - riseStart));
  if (u < fallStart) return 1;
  return 1 - smootherstep((u - fallStart) / (fallEnd - fallStart));
}
function frameState(u) {
  u = (((u + LOOP_PHASE_OFFSET) % 1) + 1) % 1;
  const e = bloomEnvelope(u);
  const f0 = rootLevel + BLOOM.soft, f1 = 1 + BLOOM.soft;
  // Eased 0 → 1 ramp with zero velocity at the seam; rotations use whole 120° steps of it.
  const ramp = u - Math.sin(TAU * u) / TAU;
  return {
    envelope: e,
    lace: bloomEnvelope(u, LACE),
    frontier: f0 + (f1 - f0) * e,
    ramp,
    theta: ROT_TURNS * (TAU / 3) * ramp,
    scale: 1 + BREATH * e,
  };
}
// Each gasket's centre and angle in the main gasket's frame; a nested gasket spins rigidly inside its host.
function gasketTransforms(state) {
  const out = [];
  for (const g of gaskets) {
    if (g.parent < 0) { out.push({ x: 0, y: 0, ang: 0 }); continue; }
    const p = out[g.parent], c = Math.cos(p.ang), s = Math.sin(p.ang);
    out.push({ x: p.x + c * g.hostX - s * g.hostY, y: p.y + s * g.hostX + c * g.hostY,
      ang: p.ang + g.base + g.spin * (TAU / 3) * state.ramp });
  }
  return out;
}
// Reveal amount of a bucket → stroke alpha and the drawn fraction of each outline (radius never changes).
function emergence(frontier, level) {
  const t = (frontier - level) / BLOOM.soft;
  return { alpha: smootherstep(t), sweep: smootherstep(Math.min(1, t * BLOOM.sweepLead)) };
}

function updateLoopTime() {
  // Frames 0..479 sample [0,1); u = 1 matches frame 0 without duplicating it.
  const frame = coverRequested ? Math.round(BLOOM.coverPhase * LOOP_FRAMES)
    : isRecording ? recFrameCount : frameCount - 1;
  loopProgress = (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;
  phase = loopProgress * TAU;
  env = bloomEnvelope(loopProgress);
}

// Outlines are rebuilt in the main gasket's frame every frame, so a bucket spans all gaskets in one stroke call.
function drawGasket(state) {
  const ctx = drawingContext, tf = gasketTransforms(state);
  const cosA = tf.map((t) => Math.cos(t.ang)), sinA = tf.map((t) => Math.sin(t.ang));
  ctx.lineCap = "round";
  drawLace(state, tf, cosA, sinA);
  for (const bucket of buckets) {
    const { alpha, sweep } = emergence(state.frontier, bucket.level);
    if (alpha < 1e-3) break;      // buckets are sorted by level
    const path = new Path2D(), d = bucket.data, full = sweep > 0.999;
    for (let i = 0; i < d.length; i += 5) {
      const gi = d[i], t = tf[gi], c = cosA[gi], s = sinA[gi], r = d[i + 3];
      const x = t.x + c * d[i + 1] - s * d[i + 2], y = t.y + s * d[i + 1] + c * d[i + 2];
      const a0 = full ? 0 : d[i + 4] + t.ang - Math.PI * sweep;
      path.moveTo(x + r * Math.cos(a0), y + r * Math.sin(a0));
      path.arc(x, y, r, a0, a0 + TAU * sweep);
    }
    for (const pass of bucket.passes) {
      const a = (pass.a / 255) * bucket.tone * alpha;
      if (a < 2e-3) continue;
      ctx.lineWidth = (bucket.width * pass.w) / state.scale;
      ctx.strokeStyle = `rgba(${INK_R},${INK_G},${INK_B},${a.toFixed(4)})`;
      ctx.stroke(path);
    }
  }
  drawKisses(state);
}
function drawLace(state, tf, cosA, sinA) {
  if (state.lace < 1e-3) return;
  const ctx = drawingContext, spun = smootherstep(Math.min(1, state.lace * 1.3));
  for (const bucket of laceBuckets) {
    const reveal = emergence(state.frontier, bucket.level).alpha;
    if (reveal < 1e-3) break;     // buckets are sorted by level
    const a = LACE.alpha * bucket.tone * reveal * state.lace;
    if (a < 2e-3) continue;
    const path = new Path2D(), d = bucket.data;
    for (let i = 0; i < d.length; i += 6) {
      const gi = d[i], t = tf[gi], c = cosA[gi], s = sinA[gi], r = d[i + 3];
      const x = t.x + c * d[i + 1] - s * d[i + 2], y = t.y + s * d[i + 1] + c * d[i + 2];
      const a0 = d[i + 4] + t.ang;
      path.moveTo(x + r * Math.cos(a0), y + r * Math.sin(a0));
      path.arc(x, y, r, a0, a0 + d[i + 5] * spun);
    }
    ctx.lineWidth = bucket.width / state.scale;
    ctx.strokeStyle = `rgba(${INK_R},${INK_G},${INK_B},${a.toFixed(4)})`;
    ctx.stroke(path);
  }
}
function drawKisses(state) {
  const fade = 1 - smootherstep(state.envelope / KISS.fadeBy);
  if (fade < 1e-3) return;
  const ctx = drawingContext;
  for (const [radius, a] of [[KISS.halo, KISS.haloAlpha], [KISS.radius, KISS.alpha]]) {
    ctx.fillStyle = `rgba(${INK_R},${INK_G},${INK_B},${(a * fade).toFixed(4)})`;
    ctx.beginPath();
    for (const [x, y] of kisses) { ctx.moveTo(x + radius, y); ctx.arc(x, y, radius, 0, TAU); }
    ctx.fill();
  }
}

function draw() {
  updateLoopTime();
  background(BG_R, BG_G, BG_B);
  const state = frameState(loopProgress);
  push();
  translate(CX, CY);
  rotate(state.theta);
  scale(state.scale);
  blendMode(ADD);
  drawGasket(state);
  blendMode(BLEND);
  pop();
  image(finishImg, 0, 0, W, H);
  if (TEXT_OVERLAY) drawHUD(state);
  if (SAFE_ZONE_DEBUG && !isRecording && !coverRequested) image(debugImg, 0, 0, W, H);
  if (coverRequested) {
    coverRequested = false;
    saveCanvas("descartes_bloom_cover", "png");
  }
  if (isRecording) {
    captureFrame();
    recFrameCount++;
    updateRecordingUI();
    if (recFrameCount >= MAX_FRAMES) stopRecording();
  }
}

function setup() {
  const cnv = createCanvas(W, H);
  canvasEl = cnv.elt;
  pixelDensity(1);
  frameRate(FPS);
  colorMode(RGB, 255, 255, 255, 255);
  randomSeed(20261029);
  noiseSeed(20261029);
  grainPg = createGraphics(W, H);
  grainPg.pixelDensity(1);
  bakeGrain();
  bakeFinish();
  buildGasket();
  buildScene();

  const el = (id) => document.getElementById(id);
  if (el("startBtn")) el("startBtn").onclick = startRecording;
  if (el("stopBtn")) el("stopBtn").onclick = stopRecording;
  if (el("maxDuration")) el("maxDuration").textContent = MAX_DURATION;
  if (el("canvasSize")) el("canvasSize").textContent = W + " × " + H;
  if (el("maxFrames")) el("maxFrames").textContent = MAX_FRAMES;
  console.log("CANVAS", width, height, pixelDensity(), "template", circles.length, "gaskets", gaskets.length,
    "circles", gaskets.reduce((n, g) => n + g.items.length, 0), "buckets", buckets.length);
  if (DEBUG) { checkDescartes(); checkLoopClosure(); }
}

// ── HUD: 20261026 layout in this folder's monochrome ink; captions sweep in and out letter by letter ─────
const HUD = {
  left: CX - COLUMN_HALF, right: CX + COLUMN_HALF,
  titleY: 323, formulaY: 389, exponentY: 431, subtitleY: 465, stageY: 503, trackY: TRACK_Y,
  bottomTextY: CY + COLUMN_HALF + 42, citationY: CY + COLUMN_HALF + 128, bottomMainAlpha: 235, citationAlpha: 190,
  titleSize: 64, relationSize: 24,
};
// Caption windows [in0, in1, out0, out1] as loop fractions; the null window holds Genesis across the seam.
const CAPTIONS = [
  { window: null, first: "FOUR CIRCLES · SIX KISSES", second: "THE ONE THAT HOLDS THEM ALL:  k = −1" },
  { window: [0.11, 0.15, 0.30, 0.34], first: "EVERY GAP HOLDS ONE MORE", second: "EACH NEW CIRCLE KISSES THREE OLD ONES" },
  { window: [0.37, 0.41, 0.50, 0.54], first: "THE DUAL LACE", second: "ONE ORTHOGONAL CIRCLE THROUGH EVERY 3 KISSES" },
  { window: [0.55, 0.59, 0.80, 0.84], first: "AN INFINITE UNIVERSE", second: "FROM FOUR TANGENT CIRCLES" },
];
const GENESIS_WINDOW = [0.05, 0.09, 0.90, 0.985]; // hide out, show back in
const TEXT_SPREAD = 6;                // characters in the soft edge of a caption sweep
const TEXT_LIFT = 10;                 // px a character rises while it fades in
const TITLE_TRACKING = [1, 5];        // px between title letters at Genesis → Bloom

const smooth01 = (e0, e1, x) => smootherstep((x - e0) / (e1 - e0));
function captionSweep(c, p) {
  if (c.window) return { rise: smooth01(c.window[0], c.window[1], p), fall: smooth01(c.window[2], c.window[3], p) };
  const [out0, out1, in0, in1] = GENESIS_WINDOW;
  return p < 0.5 ? { rise: 1, fall: smooth01(out0, out1, p) } : { rise: smooth01(in0, in1, p), fall: 0 };
}
// Centred text drawn per character: rise 0 → 1 writes it left → right; fall 0 → 1 fades the whole line upward.
function drawSweptText(str, x, y, rise, fall, alpha) {
  if (rise <= 0 || fall >= 1) return;
  const chars = [...str], n = chars.length, widths = chars.map((ch) => textWidth(ch));
  let cx = x - widths.reduce((sum, w) => sum + w, 0) / 2;
  chars.forEach((ch, i) => {
    const a = smootherstep((rise * (n + TEXT_SPREAD) - i) / TEXT_SPREAD);
    if (a * (1 - fall) > 4e-3 && ch !== " ") {
      fill(INK_R, INK_G, INK_B, alpha * a * (1 - fall));
      text(ch, cx, y + TEXT_LIFT * (1 - a) - TEXT_LIFT * fall);
    }
    cx += widths[i];
  });
}
function drawTrackedText(str, x, y, tracking) {
  const chars = [...str], widths = chars.map((ch) => textWidth(ch));
  let cx = x - (widths.reduce((sum, w) => sum + w, 0) + tracking * (chars.length - 1)) / 2;
  chars.forEach((ch, i) => { text(ch, cx, y); cx += widths[i] + tracking; });
}
const formatK = (k) => {
  const a = Math.abs(k), v = a.toFixed(a < 10 ? 3 : a < 100 ? 2 : 1);
  return k < 0 ? "(−" + v + ")" : v;
};
// The newest fully revealed circle of the main gasket, written as the Vieta step that produced it.
function liveRelation(frontier, lace) {
  const items = gaskets[0].items;
  let best = -1;
  for (let n = 5; n < circles.length; n++) {
    if (items[n].reveal + BLOOM.soft > frontier) continue;
    if (best < 0 || items[n].reveal > items[best].reveal ||
      (items[n].reveal === items[best].reveal && circles[n].k > circles[best].k)) best = n;
  }
  if (best < 0) {
    const [o, a, , , d] = circles;
    return "k = " + [o, a, a, a].map((c) => formatK(c.k)).join(" · ") + "  ⇒  k₄ = " + formatK(d.k);
  }
  const c = circles[best], [i, j, l, o] = c.parents.map((q) => circles[q]);
  if (lace > 0.5) {
    return "k⊥ = (" + [i, j, l].map((q) => formatK(q.k)).join(" + ") + " − " + formatK(o.k) + ") / 2 = " +
      formatK(Math.abs(i.k + j.k + l.k - o.k) / 2);
  }
  return "k₅ = 2(" + [i, j, l].map((q) => formatK(q.k)).join(" + ") + ") − " + formatK(o.k) + " = " + formatK(c.k);
}
function revealStats(frontier) {
  let count = 0, minR = Infinity;
  for (const bucket of buckets) {
    if (emergence(frontier, bucket.level).alpha < 0.5) break;
    count += bucket.count;
    minR = Math.min(minR, bucket.minR);
  }
  return { count, kMax: GASKET_RADIUS / minR };
}

function drawHUD(state) {
  const p = (((loopProgress + LOOP_PHASE_OFFSET) % 1) + 1) % 1;
  const ink = (a) => fill(INK_R, INK_G, INK_B, a);
  push();
  blendMode(BLEND);
  noFill();
  stroke(INK_R, INK_G, INK_B, 80);
  strokeWeight(0.7);
  const m = 34, l = 24;
  line(m, m, m + l, m); line(m, m, m, m + l);
  line(W - m, m, W - m - l, m); line(W - m, m, W - m, m + l);
  line(m, H - m, m + l, H - m); line(m, H - m, m, H - m - l);
  line(W - m, H - m, W - m - l, H - m); line(W - m, H - m, W - m, H - m - l);

  noStroke();
  textAlign(LEFT, CENTER);
  textFont("Georgia");
  textStyle(BOLD);
  textSize(HUD.titleSize);
  ink(245);
  drawTrackedText("DESCARTES BLOOM", CX, HUD.titleY, TITLE_TRACKING[0] + (TITLE_TRACKING[1] - TITLE_TRACKING[0]) * state.envelope);
  textFont("monospace");
  textStyle(NORMAL);
  textAlign(CENTER, CENTER);
  textSize(34);
  ink(228);
  text("APOLLONIAN GASKET", CX, HUD.formulaY);
  textSize(23);
  ink(220);
  text("(k₁ + k₂ + k₃ + k₄)² = 2(k₁² + k₂² + k₃² + k₄²)", CX, HUD.exponentY);
  textSize(HUD.relationSize);
  ink(215);
  text(liveRelation(state.frontier, state.lace), CX, HUD.subtitleY);

  const stats = revealStats(state.frontier), deg = (Math.round(((state.theta * 180 / Math.PI) % 120 + 120) % 120 * 10) / 10) % 120;  // 120.0° reads as 0.0° at the seam
  textAlign(LEFT, TOP);
  ink(235);
  text("N " + stats.count.toLocaleString("en-US").replace(/,/g, " ") + " · k ≤ " + stats.kMax.toFixed(1), HUD.left, HUD.stageY);
  textAlign(RIGHT, TOP);
  textSize(22);
  ink(200);
  text("θ " + deg.toFixed(1) + "° · D₃", HUD.right, HUD.stageY + 3);

  const x = HUD.left + (HUD.right - HUD.left) * p;
  stroke(INK_R, INK_G, INK_B, 80);
  strokeWeight(1);
  line(HUD.left, HUD.trackY, HUD.right, HUD.trackY);
  for (const u of [BLOOM.riseStart, BLOOM.riseEnd, BLOOM.fallStart, BLOOM.fallEnd]) {
    const tx = HUD.left + (HUD.right - HUD.left) * u;
    line(tx, HUD.trackY - 5, tx, HUD.trackY + 5);
  }
  stroke(INK_R, INK_G, INK_B, 184);
  strokeWeight(2.2);
  line(HUD.left, HUD.trackY, x, HUD.trackY);
  noStroke();
  ink(235);
  circle(x, HUD.trackY, 8);

  textAlign(LEFT, CENTER);
  textSize(28);
  for (const c of CAPTIONS) {
    const { rise, fall } = captionSweep(c, p);
    drawSweptText(c.first, CX, HUD.bottomTextY, rise, fall, HUD.bottomMainAlpha);
    drawSweptText(c.second, CX, HUD.bottomTextY + 38, rise, fall, HUD.bottomMainAlpha * 0.82);
  }
  textAlign(CENTER, CENTER);
  textSize(22);
  ink(HUD.citationAlpha);
  text("Descartes 1643 · Soddy 1936 · Lagarias et al. 2002 · " + MAX_DURATION + " s loop", CX, HUD.citationY);
  pop();
}

// ── Checks ─────────────────────────────────────────────────────────────────────────────────────────
function checkDescartes() {
  let maxTangency = 0, maxDescartes = 0, nonMonotone = 0, outside = 0, duplicates = 0;
  const seen = new Set();
  const quad = (cs) => {
    const s = cs.reduce((acc, c) => acc + c.k, 0), s2 = cs.reduce((acc, c) => acc + c.k * c.k, 0);
    return Math.abs(s * s - 2 * s2) / Math.max(1, s * s);
  };
  maxDescartes = quad(circles.slice(0, 4));
  for (let n = 0; n < circles.length; n++) {
    const c = circles[n];
    const key = `${Math.round(c.x * 1e7)},${Math.round(c.y * 1e7)},${Math.round(c.r * 1e8)}`;
    if (seen.has(key)) duplicates++;
    seen.add(key);
    if (n > 0 && Math.hypot(c.x, c.y) + c.r > 1 + 1e-9) outside++;
    if (!c.parents) continue;
    const [i, j, l, o] = c.parents.map((p) => circles[p]);
    maxTangency = Math.max(maxTangency, tangencyError(c, i), tangencyError(c, j), tangencyError(c, l));
    maxDescartes = Math.max(maxDescartes, quad([i, j, l, c]));
    if (c.k <= Math.max(i.k, j.k, l.k)) nonMonotone++;
  }
  // Dual circles: orthogonal to their three circles (|Δz|² = r⊥² + r²).
  let maxDualOrth = 0;
  for (const d of duals) {
    for (const m of d.members) {
      const c = circles[m], s2 = d.r * d.r + c.r * c.r;
      maxDualOrth = Math.max(maxDualOrth, Math.abs((d.x - c.x) ** 2 + (d.y - c.y) ** 2 - s2) / Math.max(1, s2));
    }
  }
  // Nested gaskets: every circle inside its host, and no reveal earlier than its host's.
  for (const g of gaskets) {
    for (const it of g.items) if (it.r < g.R - 1e-9 && Math.hypot(it.x, it.y) + it.r > g.R * (1 + 1e-9)) outside++;
    if (g.parent >= 0) {
      const host = gaskets[g.parent].items.find((it) => Math.abs(it.r - g.R) < 1e-9 &&
        Math.hypot(it.x - g.hostX, it.y - g.hostY) < 1e-9);
      if (!host || Math.min(...g.items.map((it) => it.reveal)) < host.reveal) nonMonotone++;
    }
  }
  const ok = maxTangency < 1e-9 && maxDescartes < 1e-9 && maxDualOrth < 1e-9 && !nonMonotone && !outside && !duplicates;
  console[ok ? "log" : "error"]("DESCARTES CHECK " + (ok ? "PASS" : "FAIL"), { gaskets: gaskets.length,
    circles: circles.length, maxDepth: Math.max(...circles.map((c) => c.depth)), centreK: circles[4].k,
    maxTangency, maxDescartes, maxDualOrth, duals: duals.length,
    laceArcs: laceBuckets.reduce((n, b) => n + b.count, 0), nonMonotone, outside, duplicates,
  });
  return ok;
}
// Visible outlines in screen space at loop position u: [x, y, r, alpha].
function visibleState(u) {
  const s = frameState(u), tf = gasketTransforms(s), cs = Math.cos(s.theta), sn = Math.sin(s.theta), out = [];
  gaskets.forEach((g, gi) => {
    const t = tf[gi], c = Math.cos(t.ang), sa = Math.sin(t.ang);
    for (const it of g.items) {
      const e = emergence(s.frontier, it.reveal);
      if (e.alpha < 1e-3) continue;
      const x = (t.x + c * it.x - sa * it.y) * s.scale, y = (t.y + sa * it.x + c * it.y) * s.scale;
      out.push([CX + cs * x - sn * y, CY + sn * x + cs * y, it.r * s.scale, e.alpha]);
    }
  });
  return out;
}
function matchStates(a, b) {
  if (a.length !== b.length) return Infinity;
  let worst = 0;
  for (const p of a) {
    let best = Infinity;
    for (const q of b) {
      if (Math.abs(p[2] - q[2]) > 1e-3) continue;
      best = Math.min(best, Math.max(Math.hypot(p[0] - q[0], p[1] - q[1]), Math.abs(p[3] - q[3])));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}
function checkLoopClosure() {
  const s0 = visibleState(0), s1 = visibleState(1 - 1e-12);
  const loopError = matchStates(s0, s1);
  // Mid-loop 120° symmetry: what makes the rotation seamless for any LOOP_PHASE_OFFSET.
  const sm = visibleState(0.35), sym = sm.map(([x, y, r, a]) => {
    const dx = x - CX, dy = y - CY, c = Math.cos(TAU / 3), s = Math.sin(TAU / 3);
    return [CX + c * dx - s * dy, CY + s * dx + c * dy, r, a];
  });
  const symmetryError = matchStates(sm, sym);
  let envelopeJump = 0;
  for (let f = 0; f < LOOP_FRAMES; f++) {
    envelopeJump = Math.max(envelopeJump, Math.abs(bloomEnvelope((f + 1) / LOOP_FRAMES % 1) - bloomEnvelope(f / LOOP_FRAMES)));
  }
  const laceSeam = Math.abs(frameState(0).lace - frameState(1 - 1e-12).lace);
  const ok = loopError < 1e-6 && symmetryError < 1e-6 && laceSeam < 1e-6;
  console[ok ? "log" : "error"]("LOOP CHECK " + (ok ? "PASS" : "FAIL"),
    { visibleAt0: s0.length, visibleMid: sm.length, loopError, symmetryError, maxEnvelopeStepPerFrame: envelopeJump });
  return ok;
}

function bakeGrain() {
  grainPg.clear();
  grainPg.noStroke();
  randomSeed(20260901);
  for (let i = 0; i < Math.floor(W * H * 0.0016); i++) {
    const value = random(110, 200);
    grainPg.fill(value, value, value, random(2, 7));
    grainPg.circle(random(W), random(H), random(0.15, 0.85));
  }
  for (let i = 0; i < Math.floor(W * H * 0.000035); i++) {
    const value = random(210, 255);
    grainPg.fill(value, value, value, random(12, 34));
    grainPg.circle(random(W), random(H), random(0.4, 1.2));
  }
}

// Grain is baked once into a p5.Image; the HUD is drawn per frame by drawHUD().
function bakeFinish() {
  const g = createGraphics(W, H);
  g.pixelDensity(1);
  g.image(grainPg, 0, 0);
  finishImg = g.get();
  g.clear();
  g.noStroke();
  g.fill(255, 40, 40, 46);
  g.rect(0, 0, W, SAFE_MARGIN_TOP);
  g.rect(0, H - SAFE_MARGIN_BOTTOM, W, SAFE_MARGIN_BOTTOM);
  g.rect(W - SAFE_MARGIN_RIGHT, SAFE_MARGIN_TOP, SAFE_MARGIN_RIGHT, H - SAFE_MARGIN_TOP - SAFE_MARGIN_BOTTOM);
  g.noFill();
  g.stroke(255, 70, 70, 200);
  g.strokeWeight(2);
  g.rect(1, SAFE_MARGIN_TOP, W - SAFE_MARGIN_RIGHT - 1, H - SAFE_MARGIN_TOP - SAFE_MARGIN_BOTTOM);
  debugImg = g.get();
  g.remove();
}

function keyReleased() {
  if (key === "r" || key === "R") {
    isRecording ? stopRecording() : startRecording();
    return false;
  }
  if (key === "s" || key === "S") {
    saveCanvas("descartes_bloom_" + getTimestamp(), "png");
    return false;
  }
  if (key === "d" || key === "D") {
    SAFE_ZONE_DEBUG = !SAFE_ZONE_DEBUG;
    return false;
  }
  if (key === "t" || key === "T") {
    TEXT_OVERLAY = !TEXT_OVERLAY;
    return false;
  }
  if ((key === "c" || key === "C") && !isRecording) {
    coverRequested = true;
    return false;
  }
  return true;
}

function updateRecordingUI() {
  const el = (id) => document.getElementById(id);
  if (el("duration")) el("duration").textContent = (recFrameCount / FPS).toFixed(1);
  if (el("frameCount")) el("frameCount").textContent = recFrameCount;
  if (el("progressFill")) el("progressFill").style.width = ((recFrameCount / MAX_FRAMES) * 100).toFixed(1) + "%";
}

function startRecording() {
  if (typeof VideoEncoder === "undefined") { alert("WebCodecs not supported."); return; }
  if (typeof Mp4Muxer === "undefined") { alert("mp4-muxer not loaded."); return; }
  muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: "avc", width: W, height: H },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => { console.error(error); isRecording = false; setStatus("Error", "#f44"); },
  });
  encoder.configure({ codec: "avc1.640028", width: W, height: H, bitrate: 18_000_000, framerate: FPS });
  recFrameCount = 0;
  loopProgress = 0;
  phase = 0;
  isRecording = true;
  const el = (id) => document.getElementById(id);
  if (el("duration")) el("duration").textContent = "0.0";
  if (el("frameCount")) el("frameCount").textContent = "0";
  if (el("startBtn")) el("startBtn").disabled = true;
  if (el("stopBtn")) el("stopBtn").disabled = false;
  if (el("progressFill")) el("progressFill").style.width = "0%";
  setStatus("Recording…", "#fff");
}

async function stopRecording() {
  if (!encoder || !muxer) return;
  isRecording = false;
  setStatus("Finalizing…", "#ccc");
  await encoder.flush();
  muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "descartes_bloom_" + getTimestamp() + ".mp4";
  a.click();
  encoder.close();
  encoder = null;
  muxer = null;
  setTimeout(() => URL.revokeObjectURL(url), 6000);
  const el = (id) => document.getElementById(id);
  if (el("startBtn")) el("startBtn").disabled = false;
  if (el("stopBtn")) el("stopBtn").disabled = true;
  if (el("progressFill")) el("progressFill").style.width = "0%";
  setStatus("Complete", "#fff");
  setTimeout(() => setStatus("Ready", "#ccc"), 3000);
}

function captureFrame() {
  if (!encoder || !canvasEl) return;
  // Explicit duration retains the final sample in the full 8-second MP4.
  const frame = new VideoFrame(canvasEl, {
    timestamp: recFrameCount * (1_000_000 / FPS),
    duration: Math.round(1_000_000 / FPS),
  });
  encoder.encode(frame, { keyFrame: recFrameCount % FPS === 0 });
  frame.close();
}

function setStatus(textValue, colorValue) {
  const el = document.getElementById("status");
  if (el) { el.textContent = textValue; el.style.color = colorValue; }
}

function getTimestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + "_" +
    pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds());
}

if (typeof window !== "undefined") {
  window.startRecording = startRecording;
  window.stopRecording = stopRecording;
}
