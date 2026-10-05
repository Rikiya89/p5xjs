"use strict";

// VILLARCEAU CIRCLES — TORUS ∩ OBLIQUE PLANE
// Ring torus about the z axis:  P(u, v) = ((R + r cos v) cos u, (R + r cos v) sin u, r sin v).
// Slicing plane through the centre, hinged on the x axis:  z cos α − y sin α = 0.
// α = 0 is the equatorial slice (concentric circles R ± r). At α = θᵥ = asin(r / R)
// the plane is tangent to the torus at two points and the section is two circles
// of radius R centred at (±r, 0, 0):  C±(t) = (±r + R cos t, √(R² − r²) sin t, r sin t).
// The live section is extracted numerically from the (u, v) domain, never drawn
// from the closed form, so its convergence onto C± is a real result.

const W = 1080;
const H = 1920;
const FPS = 60;

const MAX_DURATION = 10;
const MAX_FRAMES = FPS * MAX_DURATION;
const LOOP_FRAMES = MAX_FRAMES;
const TAU = Math.PI * 2;

const BG = { r: 3, g: 3, b: 5 };
const INK = { r: 255, g: 255, b: 255 };
const CYAN = { r: 0, g: 229, b: 255 };
const MAGENTA = { r: 255, g: 61, b: 191 };
const ACID = { r: 182, g: 255, b: 61 };

const HUD = {
  safeX: 56,
  stageTextX: 84,
  rightTextX: 140,
  stageY: 374,
  trackY: 418,
  titleY: 210,
  formulaY: 276,
  exponentY: 319,
  subtitleY: 348,
  bottomTextY: 1322,
  citationY: 1404,
  bottomMainAlpha: 235,
  citationAlpha: 190,
};

// Torus parameters. r is clamped to [minRatio, maxRatio]·R so R > r > 0 always
// holds and √(R² − r²), asin(r / R) stay finite.
const TORUS = {
  R: 1,
  r: 0.42,
  minR: 0.5,
  maxR: 2,
  minRatio: 0.06,
  maxRatio: 0.92,
};

const DEG = 180 / Math.PI;

// Visual parameters.
const VIEW = {
  focal: 2950,
  centerX: W / 2,
  centerY: 918,
  near: 0.5,
  maskTop: 446,
  maskBottom: 1296,
  maskLeft: 120,
  maskRight: 960,
  feather: 64,
  meridians: 36,
  meridianSegments: 72,
  parallels: 12,
  parallelSegments: 192,
  circleSegments: 288,
  planeHalfU: 1.34,
  planeHalfW: 1.2,
  planeLayers: 7,
  planeRulings: 8,
  arcRadius: 0.3,
  wireDepthAlpha: [1, 0.9, 0.78, 0.66],
  curveDepthAlpha: [1, 0.96, 0.9, 0.82],
  sectionWeight: 2.6,
  circleWeight: 3.4,
};

// Marching-squares grid over the periodic (u, v) square. u is offset by half a
// cell so no node lands on u = ±π/2, where the Villarceau plane is tangent.
const GRID = { nu: 240, nv: 96 };

// Sphere-traced occlusion against the torus SDF, in units of (R + r).
const OCCLUSION = { steps: 56, epsilon: 2e-5, tolerance: 0.012 };

// Normalized loop progress 0..1. Plane angle keys are fractions of θᵥ, so the
// timeline follows R and r without being rebuilt.
const TIMELINE = {
  alphaKeys: [
    [0.00, 1],
    [0.15, 1],
    [0.28, 0],
    [0.40, 0],
    [0.66, 1],
    [1.00, 1],
  ],
  torusKeys: [
    [0.00, 0.62],
    [0.12, 0.62],
    [0.22, 1],
    [0.78, 1],
    [0.86, 0.34],
    [0.93, 0.34],
    [1.00, 0.62],
  ],
  planeKeys: [
    [0.00, 0],
    [0.13, 0],
    [0.24, 1],
    [0.80, 1],
    [0.91, 0],
    [1.00, 0],
  ],
  sectionKeys: [
    [0.00, 0],
    [0.16, 0],
    [0.24, 1],
    [0.68, 1],
    [0.78, 0],
    [1.00, 0],
  ],
  circleKeys: [
    [0.00, 1],
    [0.14, 1],
    [0.25, 0.36],
    [0.63, 0.36],
    [0.72, 1],
    [1.00, 1],
  ],
  resolve: [0.65, 0.70, 0.73, 0.86],
};

const CAMERA = {
  // Overhead for the circles, low and to the side while the plane tilts so the
  // hinge rotation reads, then back overhead for the reveal.
  yawKeys: [
    [0.00, -0.3],
    [0.14, -0.3],
    [0.30, -0.95],
    [0.62, -0.95],
    [0.76, -0.3],
    [1.00, -0.3],
  ],
  elevationKeys: [
    [0.00, 0.8],
    [0.14, 0.8],
    [0.30, 0.4],
    [0.62, 0.4],
    [0.76, 0.78],
    [1.00, 0.8],
  ],
  yawSwing: 0.1,
  yawDetail: 0.03,
  elevationSwing: 0.05,
  // Multiples of (R + r), so framing follows the torus size.
  distanceKeys: [
    [0.00, 8.6],
    [0.30, 9.1],
    [0.50, 9.1],
    [0.72, 8.4],
    [0.90, 8.4],
    [1.00, 8.6],
  ],
};

// Hook overlay — independent of the simulation layers.
const OVERLAY = {
  hook: true,
  captions: [
    { window: null, first: "THESE ARE CIRCLES.", second: "ONE TORUS · ONE TILTED PLANE" },
    { window: [0.27, 0.30, 0.39, 0.42], first: "AN ORDINARY SLICE · α = 0", second: "TWO CONCENTRIC RINGS, R ± r" },
    { window: [0.42, 0.45, 0.62, 0.65], first: "TILT THE PLANE", second: "THE SECTION BENDS INTO OVALS" },
    { window: [0.66, 0.69, 0.78, 0.81], first: "α = θᵥ = asin(r / R)", second: "INTERSECTION → TWO CIRCLES" },
    { window: [0.81, 0.84, 0.93, 0.96], first: "VILLARCEAU CIRCLES", second: "TWO CIRCLES OF RADIUS R" },
  ],
};

let canvasEl;
let grainPg;
let hudPg;
let geometryPg;
let loopProgress = 0;
let phase = 0;
let muxer = null;
let encoder = null;
let isRecording = false;
let isFinalizing = false;
let recFrameCount = 0;

const sim = {
  auto: true,
  paused: false,
  playhead: 0,
  manualAlpha: 0,
  dragYaw: 0,
  dragElevation: 0,
  layers: { torus: true, plane: true, section: true, circles: true, math: true },
  frameCost: 0,
};

function setup() {
  const cnv = createCanvas(W, H, WEBGL);
  canvasEl = cnv.elt;
  pixelDensity(1);
  frameRate(FPS);
  colorMode(RGB, 255, 255, 255, 255);
  strokeCap(ROUND);
  grainPg = createGraphics(W, H);
  hudPg = createGraphics(W, H);
  geometryPg = createGraphics(W, H);
  for (const graphics of [grainPg, hudPg, geometryPg]) graphics.pixelDensity(1);
  bakeGrain();
  setTorus(Number(urlParam("R") ?? TORUS.R), Number(urlParam("r") ?? TORUS.r));
  if (urlParam("hook") === "0") OVERLAY.hook = false;
  bindUI();
  updateStaticUI();
  syncControls();
  if (auditParam !== null) window.villarceauAudit = runAudit();
  window.villarceau = { setTorus, setLoop, torus, scene, sim };
}

// ================================================================
// TORUS GEOMETRY
// ================================================================

const torus = {
  R: TORUS.R,
  r: TORUS.r,
  c: 0,
  thetaV: 0,
  scale: 1,
};

// Grid nodes: positions and unit normals, rebuilt only when R or r change.
const NODE_COUNT = GRID.nu * GRID.nv;
const NODE_U = new Float64Array(GRID.nu);
const NODE_V = new Float64Array(GRID.nv);
const NODE_X = new Float64Array(NODE_COUNT);
const NODE_Y = new Float64Array(NODE_COUNT);
const NODE_Z = new Float64Array(NODE_COUNT);
const NODE_NX = new Float64Array(NODE_COUNT);
const NODE_NY = new Float64Array(NODE_COUNT);
const NODE_NZ = new Float64Array(NODE_COUNT);

function setTorus(R, r) {
  R = clamp(Number.isFinite(R) ? R : TORUS.R, TORUS.minR, TORUS.maxR);
  r = clamp(Number.isFinite(r) ? r : TORUS.r, R * TORUS.minRatio, R * TORUS.maxRatio);
  torus.R = R;
  torus.r = r;
  torus.scale = R + r;
  // Villarceau angle: the plane through the centre tangent to the torus twice.
  torus.c = Math.sqrt(R * R - r * r);
  torus.thetaV = Math.asin(r / R);

  for (let i = 0; i < GRID.nu; i++) NODE_U[i] = (i + 0.5) / GRID.nu * TAU;
  for (let j = 0; j < GRID.nv; j++) NODE_V[j] = j / GRID.nv * TAU;
  for (let j = 0; j < GRID.nv; j++) {
    const cv = Math.cos(NODE_V[j]);
    const sv = Math.sin(NODE_V[j]);
    const w = R + r * cv;
    for (let i = 0; i < GRID.nu; i++) {
      const cu = Math.cos(NODE_U[i]);
      const su = Math.sin(NODE_U[i]);
      const n = j * GRID.nu + i;
      NODE_X[n] = w * cu;
      NODE_Y[n] = w * su;
      NODE_Z[n] = r * sv;
      NODE_NX[n] = cv * cu;
      NODE_NY[n] = cv * su;
      NODE_NZ[n] = sv;
    }
  }
  buildWirePool();
  buildCirclePool();
}

// ================================================================
// LINE POOLS — flat polyline storage with per-frame projection,
// plane side and visibility, so draw() allocates nothing.
// ================================================================

function createPool(maxVerts, maxLines) {
  return {
    maxVerts,
    maxLines,
    count: 0,
    lines: 0,
    P: new Float64Array(maxVerts * 3),
    start: new Int32Array(maxLines),
    len: new Int32Array(maxLines),
    closed: new Uint8Array(maxLines),
    sx: new Float32Array(maxVerts),
    sy: new Float32Array(maxVerts),
    ok: new Uint8Array(maxVerts),
    vis: new Uint8Array(maxVerts),
    depth: new Float32Array(maxVerts),
    side: new Float32Array(maxVerts),
  };
}

function poolReset(pool) {
  pool.count = 0;
  pool.lines = 0;
}

function poolBeginLine(pool) {
  if (pool.lines >= pool.maxLines) return false;
  pool.start[pool.lines] = pool.count;
  return true;
}

function poolPush(pool, x, y, z) {
  if (pool.count >= pool.maxVerts) return;
  const k = pool.count * 3;
  pool.P[k] = x;
  pool.P[k + 1] = y;
  pool.P[k + 2] = z;
  pool.count++;
}

function poolEndLine(pool, closed) {
  const length = pool.count - pool.start[pool.lines];
  if (length < 2) {
    pool.count = pool.start[pool.lines];
    return;
  }
  pool.len[pool.lines] = length;
  pool.closed[pool.lines] = closed ? 1 : 0;
  pool.lines++;
}

const wirePool = createPool(
  VIEW.meridians * VIEW.meridianSegments + VIEW.parallels * VIEW.parallelSegments,
  VIEW.meridians + VIEW.parallels
);
const circlePool = createPool(2 * VIEW.circleSegments, 2);
const sectionPool = createPool(12000, 64);
const contourPool = createPool(12000, 96);

function buildWirePool() {
  const { R, r } = torus;
  poolReset(wirePool);
  for (let i = 0; i < VIEW.meridians; i++) {
    const u = i / VIEW.meridians * TAU;
    poolBeginLine(wirePool);
    for (let k = 0; k < VIEW.meridianSegments; k++) {
      const v = k / VIEW.meridianSegments * TAU;
      const w = R + r * Math.cos(v);
      poolPush(wirePool, w * Math.cos(u), w * Math.sin(u), r * Math.sin(v));
    }
    poolEndLine(wirePool, true);
  }
  for (let j = 0; j < VIEW.parallels; j++) {
    const v = j / VIEW.parallels * TAU;
    const w = R + r * Math.cos(v);
    poolBeginLine(wirePool);
    for (let k = 0; k < VIEW.parallelSegments; k++) {
      const u = k / VIEW.parallelSegments * TAU;
      poolPush(wirePool, w * Math.cos(u), w * Math.sin(u), r * Math.sin(v));
    }
    poolEndLine(wirePool, true);
  }
}

// Analytical Villarceau circles. Line 0 is C₊ (centre (+r, 0, 0)), line 1 is C₋.
function buildCirclePool() {
  const { R, r, c } = torus;
  poolReset(circlePool);
  for (const sign of [1, -1]) {
    poolBeginLine(circlePool);
    for (let k = 0; k < VIEW.circleSegments; k++) {
      const t = k / VIEW.circleSegments * TAU;
      poolPush(circlePool, sign * r + R * Math.cos(t), c * Math.sin(t), r * Math.sin(t));
    }
    poolEndLine(circlePool, true);
  }
}

// ================================================================
// PLANE + LEVEL-SET SOLVER
// ================================================================

const scene = {
  alpha: 0,
  cosA: 1,
  sinA: 0,
  cameraSide: 1,
  torusAlpha: 1,
  planeAlpha: 0,
  sectionAlpha: 0,
  circleAlpha: 1,
  resolve: 0,
  deviation: 0,
  sectionPoints: 0,
  nonFinite: 0,
};

// Plane z cos α − y sin α = 0 → unit normal (0, −sin α, cos α), in-plane
// basis e₁ = (1, 0, 0) (the hinge) and e₂ = (0, cos α, sin α).
function setPlaneAngle(alpha) {
  scene.alpha = alpha;
  scene.cosA = Math.cos(alpha);
  scene.sinA = Math.sin(alpha);
}

function planeValue(x, y, z) {
  return z * scene.cosA - y * scene.sinA;
}

const FIELD_PLANE = 0;
const FIELD_CONTOUR = 1;

// Scalar fields on the torus domain. The section is the zero set of the plane
// equation; the visible outline is the zero set of n · (P − eye).
function fieldAt(kind, u, v) {
  const cu = Math.cos(u);
  const su = Math.sin(u);
  const cv = Math.cos(v);
  const sv = Math.sin(v);
  const w = torus.R + torus.r * cv;
  const x = w * cu;
  const y = w * su;
  const z = torus.r * sv;
  if (kind === FIELD_PLANE) return z * scene.cosA - y * scene.sinA;
  return cv * cu * (x - eye.x) + cv * su * (y - eye.y) + sv * (z - eye.z);
}

const FIELD = new Float64Array(NODE_COUNT);
const EDGE_COUNT = 2 * NODE_COUNT;
const EDGE_STAMP = new Int32Array(EDGE_COUNT);
const EDGE_X = new Float64Array(EDGE_COUNT);
const EDGE_Y = new Float64Array(EDGE_COUNT);
const EDGE_Z = new Float64Array(EDGE_COUNT);
const LINK_STAMP = new Int32Array(EDGE_COUNT);
const LINK_0 = new Int32Array(EDGE_COUNT);
const LINK_1 = new Int32Array(EDGE_COUNT);
const SEG_MAX = 16384;
const SEG_A = new Int32Array(SEG_MAX);
const SEG_B = new Int32Array(SEG_MAX);
const SEG_DONE = new Uint8Array(SEG_MAX);
const CHAIN = new Int32Array(SEG_MAX + 2);
const CHAIN_BACK = new Int32Array(SEG_MAX + 2);
let solverStamp = 0;
let segmentCount = 0;

// Edge ids: 2n is the +u edge leaving node n, 2n + 1 the +v edge. Indices wrap
// mod nu / nv, so the u = 0 / 2π and v = 0 / 2π seams are ordinary edges.
function solveEdge(kind, e) {
  if (EDGE_STAMP[e] === solverStamp) return;
  EDGE_STAMP[e] = solverStamp;
  const n = e >> 1;
  const i = n % GRID.nu;
  const j = (n - i) / GRID.nu;
  const vertical = e & 1;
  const n1 = vertical
    ? ((j + 1) % GRID.nv) * GRID.nu + i
    : j * GRID.nu + (i + 1) % GRID.nu;
  const u0 = NODE_U[i];
  const v0 = NODE_V[j];
  const du = vertical ? 0 : TAU / GRID.nu;
  const dv = vertical ? TAU / GRID.nv : 0;
  // Illinois regula falsi along the edge on the analytic field, so every
  // crossing sits on the true intersection, not on a linear guess.
  let s0 = 0;
  let g0 = FIELD[n];
  let s1 = 1;
  let g1 = FIELD[n1];
  let s = g0 === g1 ? 0.5 : g0 / (g0 - g1);
  let last = 0;
  for (let k = 0; k < 12; k++) {
    const gs = fieldAt(kind, u0 + du * s, v0 + dv * s);
    if (gs === 0 || s1 - s0 < 1e-13) break;
    if ((gs >= 0) === (g1 >= 0)) {
      s1 = s;
      g1 = gs;
      if (last === -1) g0 *= 0.5;
      last = -1;
    } else {
      s0 = s;
      g0 = gs;
      if (last === 1) g1 *= 0.5;
      last = 1;
    }
    s = g1 === g0 ? 0.5 * (s0 + s1) : (s0 * g1 - s1 * g0) / (g1 - g0);
  }
  const u = u0 + du * s;
  const v = v0 + dv * s;
  const w = torus.R + torus.r * Math.cos(v);
  EDGE_X[e] = w * Math.cos(u);
  EDGE_Y[e] = w * Math.sin(u);
  EDGE_Z[e] = torus.r * Math.sin(v);
}

function linkEdge(e, segment) {
  if (LINK_STAMP[e] !== solverStamp) {
    LINK_STAMP[e] = solverStamp;
    LINK_0[e] = segment;
    LINK_1[e] = -1;
  } else {
    LINK_1[e] = segment;
  }
}

function addSegment(kind, ea, eb) {
  if (segmentCount >= SEG_MAX) return;
  solveEdge(kind, ea);
  solveEdge(kind, eb);
  SEG_A[segmentCount] = ea;
  SEG_B[segmentCount] = eb;
  SEG_DONE[segmentCount] = 0;
  linkEdge(ea, segmentCount);
  linkEdge(eb, segmentCount);
  segmentCount++;
}

function nextSegment(e, current) {
  if (LINK_STAMP[e] !== solverStamp) return -1;
  return LINK_0[e] === current ? LINK_1[e] : LINK_0[e];
}

// Marching squares over the periodic grid, then chains segments into
// polylines through their shared edges.
function extractLevelSet(kind, pool) {
  solverStamp++;
  segmentCount = 0;
  const { nu, nv } = GRID;
  if (kind === FIELD_PLANE) {
    for (let n = 0; n < NODE_COUNT; n++) {
      FIELD[n] = NODE_Z[n] * scene.cosA - NODE_Y[n] * scene.sinA;
    }
  } else {
    for (let n = 0; n < NODE_COUNT; n++) {
      FIELD[n] = NODE_NX[n] * (NODE_X[n] - eye.x)
        + NODE_NY[n] * (NODE_Y[n] - eye.y)
        + NODE_NZ[n] * (NODE_Z[n] - eye.z);
    }
  }

  for (let j = 0; j < nv; j++) {
    const j1 = (j + 1) % nv;
    for (let i = 0; i < nu; i++) {
      const i1 = (i + 1) % nu;
      const a = j * nu + i;
      const b = j * nu + i1;
      const c = j1 * nu + i1;
      const d = j1 * nu + i;
      const fa = FIELD[a];
      const fb = FIELD[b];
      const fc = FIELD[c];
      const fd = FIELD[d];
      const index = (fa >= 0 ? 1 : 0) | (fb >= 0 ? 2 : 0) | (fc >= 0 ? 4 : 0) | (fd >= 0 ? 8 : 0);
      if (index === 0 || index === 15) continue;
      const e0 = 2 * a;
      const e1 = 2 * b + 1;
      const e2 = 2 * d;
      const e3 = 2 * a + 1;
      switch (index) {
        case 1: case 14: addSegment(kind, e3, e0); break;
        case 2: case 13: addSegment(kind, e0, e1); break;
        case 3: case 12: addSegment(kind, e3, e1); break;
        case 4: case 11: addSegment(kind, e1, e2); break;
        case 6: case 9: addSegment(kind, e0, e2); break;
        case 7: case 8: addSegment(kind, e2, e3); break;
        case 5:
        case 10: {
          // Saddle: the cell-centre average decides which diagonal is joined.
          const centre = 0.25 * (fa + fb + fc + fd);
          const cutAroundBD = (centre >= 0) === (index === 5);
          if (cutAroundBD) {
            addSegment(kind, e0, e1);
            addSegment(kind, e2, e3);
          } else {
            addSegment(kind, e3, e0);
            addSegment(kind, e1, e2);
          }
          break;
        }
        default: break;
      }
    }
  }

  poolReset(pool);
  for (let s = 0; s < segmentCount; s++) {
    if (SEG_DONE[s]) continue;
    SEG_DONE[s] = 1;
    let n = 0;
    CHAIN[n++] = SEG_A[s];
    CHAIN[n++] = SEG_B[s];
    let closed = false;
    let current = s;
    let e = SEG_B[s];
    for (;;) {
      const next = nextSegment(e, current);
      if (next < 0 || SEG_DONE[next]) break;
      SEG_DONE[next] = 1;
      e = SEG_A[next] === e ? SEG_B[next] : SEG_A[next];
      current = next;
      if (e === CHAIN[0]) {
        closed = true;
        break;
      }
      CHAIN[n++] = e;
    }
    let back = 0;
    if (!closed) {
      current = s;
      e = SEG_A[s];
      for (;;) {
        const next = nextSegment(e, current);
        if (next < 0 || SEG_DONE[next]) break;
        SEG_DONE[next] = 1;
        e = SEG_A[next] === e ? SEG_B[next] : SEG_A[next];
        current = next;
        CHAIN_BACK[back++] = e;
      }
    }
    if (!poolBeginLine(pool)) break;
    for (let k = back - 1; k >= 0; k--) {
      const edge = CHAIN_BACK[k];
      poolPush(pool, EDGE_X[edge], EDGE_Y[edge], EDGE_Z[edge]);
    }
    for (let k = 0; k < n; k++) {
      const edge = CHAIN[k];
      poolPush(pool, EDGE_X[edge], EDGE_Y[edge], EDGE_Z[edge]);
    }
    poolEndLine(pool, closed);
  }
}

// Distance from p to circle C± (centre (±r, 0, 0), plane normal at θᵥ, radius R).
function distanceToVillarceau(x, y, z) {
  const { R, r, c } = torus;
  const my = -r / R;
  const mz = c / R;
  let best = Infinity;
  for (let sign = -1; sign <= 1; sign += 2) {
    const qx = x - sign * r;
    const h = y * my + z * mz;
    const px = qx;
    const py = y - h * my;
    const pz = z - h * mz;
    const radial = Math.sqrt(px * px + py * py + pz * pz) - R;
    best = Math.min(best, Math.sqrt(h * h + radial * radial));
  }
  return best;
}

function measureSection() {
  let worst = 0;
  let nonFinite = 0;
  const P = sectionPool.P;
  for (let k = 0; k < sectionPool.count; k++) {
    const d = distanceToVillarceau(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]);
    if (!Number.isFinite(d)) nonFinite++;
    else if (d > worst) worst = d;
  }
  scene.deviation = worst;
  scene.sectionPoints = sectionPool.count;
  scene.nonFinite = nonFinite;
}

// ================================================================
// ANIMATION + CAMERA
// ================================================================

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function envelope(p, window) {
  return smoothstep(window[0], window[1], p) * (1 - smoothstep(window[2], window[3], p));
}

function keyframeValue(keys, p) {
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [p0, v0] = keys[i - 1];
      const [p1, v1] = keys[i];
      return v0 + (v1 - v0) * smootherstep(clamp((p - p0) / (p1 - p0), 0, 1));
    }
  }
  return keys[keys.length - 1][1];
}

function isAtVillarceau() {
  return Math.abs(scene.alpha - torus.thetaV) < 1e-6;
}

function updateAnimation() {
  const p = loopProgress;
  if (sim.auto || isRecording) {
    setPlaneAngle(torus.thetaV * keyframeValue(TIMELINE.alphaKeys, p));
    scene.torusAlpha = keyframeValue(TIMELINE.torusKeys, p);
    scene.planeAlpha = keyframeValue(TIMELINE.planeKeys, p);
    scene.sectionAlpha = keyframeValue(TIMELINE.sectionKeys, p);
    scene.circleAlpha = keyframeValue(TIMELINE.circleKeys, p);
    scene.resolve = envelope(p, TIMELINE.resolve);
  } else {
    setPlaneAngle(sim.manualAlpha);
    const atV = isAtVillarceau();
    scene.torusAlpha = 1;
    scene.planeAlpha = 1;
    scene.sectionAlpha = 1;
    scene.circleAlpha = atV ? 1 : 0.34;
    scene.resolve = 0;
  }
  if (!sim.layers.torus) scene.torusAlpha = 0;
  if (!sim.layers.plane) scene.planeAlpha = 0;
  if (!sim.layers.section) scene.sectionAlpha = 0;
  if (!sim.layers.circles) scene.circleAlpha = 0;
}

// Camera basis lives in the y-up render frame; eye is the same point in the
// torus (z-up) frame, used by the contour field and occlusion tests.
const cam = {
  ex: 0, ey: 0, ez: 0,
  rx: 1, ry: 0, rz: 0,
  ux: 0, uy: 1, uz: 0,
  fx: 0, fy: 0, fz: -1,
  centerDepth: 1,
};
const eye = { x: 0, y: 0, z: 0 };

function updateCamera() {
  const free = !isRecording && !Number.isFinite(previewProgress);
  const yaw = keyframeValue(CAMERA.yawKeys, loopProgress)
    + CAMERA.yawSwing * Math.sin(phase)
    + CAMERA.yawDetail * Math.sin(2 * phase)
    + (free ? sim.dragYaw : 0);
  const elevation = clamp(
    keyframeValue(CAMERA.elevationKeys, loopProgress)
      + CAMERA.elevationSwing * (0.5 - 0.5 * Math.cos(phase))
      + (free ? sim.dragElevation : 0),
    -1.35,
    1.35
  );
  const distance = keyframeValue(CAMERA.distanceKeys, loopProgress) * torus.scale;
  cam.ex = distance * Math.cos(elevation) * Math.sin(yaw);
  cam.ey = distance * Math.sin(elevation);
  cam.ez = distance * Math.cos(elevation) * Math.cos(yaw);
  cam.fx = -cam.ex / distance;
  cam.fy = -cam.ey / distance;
  cam.fz = -cam.ez / distance;
  // right = forward × worldUp, up = right × forward
  const rLength = Math.hypot(cam.fz, cam.fx);
  cam.rx = -cam.fz / rLength;
  cam.ry = 0;
  cam.rz = cam.fx / rLength;
  cam.ux = cam.ry * cam.fz - cam.rz * cam.fy;
  cam.uy = cam.rz * cam.fx - cam.rx * cam.fz;
  cam.uz = cam.rx * cam.fy - cam.ry * cam.fx;
  cam.centerDepth = distance;
  // Render (X, Y, Z) = torus (x, z, −y).
  eye.x = cam.ex;
  eye.y = -cam.ez;
  eye.z = cam.ey;
  scene.cameraSide = Math.sign(planeValue(eye.x, eye.y, eye.z)) || 1;
}

// ================================================================
// PROJECTION + VISIBILITY
// ================================================================

let projX = 0;
let projY = 0;
let projDepth = 0;

// Takes torus-frame coordinates; render frame is (x, z, −y).
function projectPoint(x, y, z) {
  const dx = x - cam.ex;
  const dy = z - cam.ey;
  const dz = -y - cam.ez;
  const depth = dx * cam.fx + dy * cam.fy + dz * cam.fz;
  if (!(depth > VIEW.near)) return false;
  const scale = VIEW.focal / depth;
  projX = VIEW.centerX + (dx * cam.rx + dy * cam.ry + dz * cam.rz) * scale;
  projY = VIEW.centerY - (dx * cam.ux + dy * cam.uy + dz * cam.uz) * scale;
  projDepth = depth;
  return true;
}

// Sphere-trace the torus SDF from the eye; the point is hidden if the ray
// meets the surface clearly before reaching it.
function isOccluded(px, py, pz) {
  const dx = px - eye.x;
  const dy = py - eye.y;
  const dz = pz - eye.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const ix = dx / dist;
  const iy = dy / dist;
  const iz = dz / dist;
  const limit = dist - OCCLUSION.tolerance * torus.scale;
  const epsilon = OCCLUSION.epsilon * torus.scale;
  let t = 0;
  for (let k = 0; k < OCCLUSION.steps; k++) {
    const x = eye.x + ix * t;
    const y = eye.y + iy * t;
    const z = eye.z + iz * t;
    const q = Math.sqrt(x * x + y * y) - torus.R;
    const d = Math.sqrt(q * q + z * z) - torus.r;
    if (d < epsilon) return t < limit;
    t += d;
    if (t >= limit) return false;
  }
  return false;
}

function poolShade(pool, withVisibility) {
  const P = pool.P;
  for (let k = 0; k < pool.count; k++) {
    const x = P[k * 3];
    const y = P[k * 3 + 1];
    const z = P[k * 3 + 2];
    pool.ok[k] = projectPoint(x, y, z) ? 1 : 0;
    pool.sx[k] = projX;
    pool.sy[k] = projY;
    pool.depth[k] = projDepth;
    pool.side[k] = planeValue(x, y, z) * scene.cameraSide;
    pool.vis[k] = withVisibility && isOccluded(x, y, z) ? 0 : 1;
  }
}

function depthBucket(depth) {
  const n = (depth - cam.centerDepth) / torus.scale;
  return n < -0.45 ? 0 : n < 0 ? 1 : n < 0.45 ? 2 : 3;
}

// Adds the pool's segments matching (line, visibility, plane side, depth bucket)
// to the current path. sideFilter: 0 any, 1 camera side, −1 far side; a segment
// crossing the plane is cut exactly at the crossing.
function tracePool(ctx, pool, line, visClass, sideFilter, bucket) {
  const firstLine = line < 0 ? 0 : line;
  const lastLine = line < 0 ? pool.lines : line + 1;
  for (let l = firstLine; l < lastLine; l++) {
    const start = pool.start[l];
    const length = pool.len[l];
    const segments = pool.closed[l] ? length : length - 1;
    let penDown = false;
    for (let k = 0; k < segments; k++) {
      const a = start + k;
      const b = start + (k + 1) % length;
      if (!pool.ok[a] || !pool.ok[b]) {
        penDown = false;
        continue;
      }
      if (visClass >= 0 && (pool.vis[a] & pool.vis[b]) !== visClass) {
        penDown = false;
        continue;
      }
      if (bucket >= 0 && depthBucket(0.5 * (pool.depth[a] + pool.depth[b])) !== bucket) {
        penDown = false;
        continue;
      }
      const sa = sideFilter === 0 ? 1 : pool.side[a] * sideFilter;
      const sb = sideFilter === 0 ? 1 : pool.side[b] * sideFilter;
      if (sa >= 0 && sb >= 0) {
        if (!penDown) ctx.moveTo(pool.sx[a], pool.sy[a]);
        ctx.lineTo(pool.sx[b], pool.sy[b]);
        penDown = true;
        continue;
      }
      if (sa < 0 && sb < 0) {
        penDown = false;
        continue;
      }
      const t = sa / (sa - sb);
      const P = pool.P;
      if (!projectPoint(
        P[a * 3] + (P[b * 3] - P[a * 3]) * t,
        P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * t,
        P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t
      )) {
        penDown = false;
        continue;
      }
      if (sa >= 0) {
        if (!penDown) ctx.moveTo(pool.sx[a], pool.sy[a]);
        ctx.lineTo(projX, projY);
        penDown = false;
      } else {
        ctx.moveTo(projX, projY);
        ctx.lineTo(pool.sx[b], pool.sy[b]);
        penDown = true;
      }
    }
  }
}

function rgba(colorValue, alpha) {
  return `rgba(${colorValue.r},${colorValue.g},${colorValue.b},${clamp(alpha, 0, 255) / 255})`;
}

// Same three-pass glow ratios as the house orbit stroke.
function glowStroke(ctx, colorValue, alpha, weight, glow = 1) {
  if (alpha <= 0.5) return;
  if (glow > 0) {
    ctx.lineWidth = weight * 4.6;
    ctx.strokeStyle = rgba(colorValue, alpha * 0.085 * glow);
    ctx.stroke();
    ctx.lineWidth = weight * 2.1;
    ctx.strokeStyle = rgba(colorValue, alpha * 0.24 * glow);
    ctx.stroke();
  }
  ctx.lineWidth = weight;
  ctx.strokeStyle = rgba(colorValue, alpha);
  ctx.stroke();
}

function glowDot(ctx, x, y, colorValue, alpha, radius) {
  for (const [scale, amount] of GLOW_DOT_PASSES) {
    ctx.beginPath();
    ctx.arc(x, y, radius * scale, 0, TAU);
    ctx.fillStyle = rgba(colorValue, alpha * amount);
    ctx.fill();
  }
}

const GLOW_DOT_PASSES = [[4.8, 0.07], [2.3, 0.28], [1, 1]];

// ================================================================
// RENDERING
// ================================================================

function renderFrame() {
  background(BG.r, BG.g, BG.b);
  updateAnimation();
  updateCamera();

  extractLevelSet(FIELD_PLANE, sectionPool);
  measureSection();
  const torusOn = scene.torusAlpha > 0.004;
  if (torusOn) {
    extractLevelSet(FIELD_CONTOUR, contourPool);
    poolShade(wirePool, true);
    poolShade(contourPool, true);
  }
  poolShade(sectionPool, true);
  poolShade(circlePool, true);

  const graphics = geometryPg;
  const ctx = graphics.drawingContext;
  graphics.clear();
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Painter's order around the slicing plane: torus behind it, the translucent
  // plane, then the torus in front. Curves lie in the plane and go last.
  if (scene.planeAlpha > 0.004) {
    if (torusOn) drawTorus(ctx, -1);
    drawSlicingPlane(ctx);
    if (torusOn) drawTorus(ctx, 1);
  } else if (torusOn) {
    drawTorus(ctx, 0);
  }
  drawCurvePool(ctx, sectionPool, -1, ACID, 245 * scene.sectionAlpha, VIEW.sectionWeight, 1);
  drawVillarceauCircles(ctx);
  ctx.restore();
  drawGeometryLabels(graphics);
  applyStageMask(ctx);
  compositeHUD(graphics);
}

function drawTorus(ctx, sideFilter) {
  const alpha = scene.torusAlpha;
  for (let bucket = 3; bucket >= 0; bucket--) {
    const depthAlpha = VIEW.wireDepthAlpha[bucket];
    ctx.beginPath();
    tracePool(ctx, wirePool, -1, 0, sideFilter, bucket);
    glowStroke(ctx, INK, 32 * alpha * depthAlpha, 1, 0);
    ctx.beginPath();
    tracePool(ctx, wirePool, -1, 1, sideFilter, bucket);
    glowStroke(ctx, INK, 112 * alpha * depthAlpha, 1.2, 0);
  }
  ctx.beginPath();
  tracePool(ctx, contourPool, -1, 1, sideFilter, -1);
  glowStroke(ctx, INK, 215 * alpha, 1.8, 0.7);
}

function drawCurvePool(ctx, pool, line, colorValue, alpha, weight, glow) {
  if (alpha <= 0.5) return;
  for (let bucket = 3; bucket >= 0; bucket--) {
    ctx.beginPath();
    tracePool(ctx, pool, line, 0, 0, bucket);
    glowStroke(ctx, colorValue, alpha * 0.72 * VIEW.curveDepthAlpha[bucket], weight * 0.75, 0);
  }
  for (let bucket = 3; bucket >= 0; bucket--) {
    ctx.beginPath();
    tracePool(ctx, pool, line, 1, 0, bucket);
    glowStroke(ctx, colorValue, alpha * VIEW.curveDepthAlpha[bucket], weight, glow);
  }
}

function drawVillarceauCircles(ctx) {
  const alpha = scene.circleAlpha;
  if (alpha <= 0.004) return;
  // Ghost targets stay thin; at full emphasis they carry glow, plus a pulse
  // as the live section resolves onto them.
  const emphasis = smoothstep(0.3, 1, alpha);
  const weight = VIEW.circleWeight * (0.45 + 0.55 * emphasis) * (1 + 0.35 * scene.resolve);
  const glow = emphasis * (1 + 0.8 * scene.resolve);
  drawCurvePool(ctx, circlePool, 1, CYAN, 250 * alpha, weight, glow);
  drawCurvePool(ctx, circlePool, 0, MAGENTA, 250 * alpha, weight, glow);

  // The two points where the plane at θᵥ touches the torus — the circles cross there.
  const { R, c, r } = torus;
  for (let sign = -1; sign <= 1; sign += 2) {
    const y = sign * c * c / R;
    const z = sign * r * c / R;
    const hidden = isOccluded(0, y, z);
    if (projectPoint(0, y, z)) {
      glowDot(ctx, projX, projY, INK, 230 * emphasis * (hidden ? 0.6 : 1), 3.6 + 2 * scene.resolve);
    }
  }
}

function drawPlaneQuad(ctx, hu, hw) {
  const { cosA, sinA } = scene;
  let first = true;
  for (let k = 0; k < 5; k++) {
    const su = k === 1 || k === 2 ? 1 : -1;
    const sw = k === 2 || k === 3 ? 1 : -1;
    if (!projectPoint(hu * su, hw * sw * cosA, hw * sw * sinA)) return;
    if (first) ctx.moveTo(projX, projY);
    else ctx.lineTo(projX, projY);
    first = false;
  }
}

function drawSegment3D(ctx, ax, ay, az, bx, by, bz) {
  if (!projectPoint(ax, ay, az)) return;
  ctx.moveTo(projX, projY);
  if (projectPoint(bx, by, bz)) ctx.lineTo(projX, projY);
}

function drawSlicingPlane(ctx) {
  const alpha = scene.planeAlpha;
  const s = torus.scale;
  const { cosA, sinA } = scene;
  const hu = VIEW.planeHalfU * s;
  const hw = VIEW.planeHalfW * s;
  // Stacked translucent layers feather the plane edge instead of cutting it.
  for (let i = 0; i < VIEW.planeLayers; i++) {
    const scale = 1 - i / VIEW.planeLayers * 0.62;
    ctx.beginPath();
    drawPlaneQuad(ctx, hu * scale, hw * scale);
    ctx.fillStyle = rgba(INK, 5 * alpha);
    ctx.fill();
  }

  const extentU = hu * 0.94;
  const extentW = hw * 0.94;
  for (let i = -VIEW.planeRulings; i <= VIEW.planeRulings; i++) {
    const amount = i / VIEW.planeRulings;
    const falloff = Math.pow(1 - Math.abs(amount), 1.6);
    const w = amount * extentW;
    ctx.beginPath();
    drawSegment3D(ctx, -extentU * 0.8, w * cosA, w * sinA, extentU * 0.8, w * cosA, w * sinA);
    glowStroke(ctx, INK, 64 * falloff * alpha, 1.1, 0);
    const u = amount * extentU;
    if (i === 0) continue;
    ctx.beginPath();
    drawSegment3D(ctx, u, -extentW * 0.8 * cosA, -extentW * 0.8 * sinA, u, extentW * 0.8 * cosA, extentW * 0.8 * sinA);
    glowStroke(ctx, INK, 50 * falloff * alpha, 1.1, 0);
  }

  // Hinge: the x axis the plane rotates about.
  ctx.setLineDash([6, 10]);
  ctx.beginPath();
  drawSegment3D(ctx, -extentU, 0, 0, extentU, 0, 0);
  glowStroke(ctx, INK, 175 * alpha, 1.5, 0);
  ctx.setLineDash([]);
  if (projectPoint(0, 0, 0)) glowDot(ctx, projX, projY, INK, 160 * alpha, 2.6);

  drawAngleGauge(ctx, alpha);
}

// α measured at the hinge centre, inside the torus hole: horizontal reference (α = 0), the live plane
// direction, and a tick where the arc reaches θᵥ.
function drawAngleGauge(ctx, alpha) {
  const x0 = 0;
  const radius = VIEW.arcRadius * torus.scale;
  const { cosA, sinA } = scene;
  ctx.beginPath();
  drawSegment3D(ctx, x0, 0, 0, x0, radius * 1.3, 0);
  glowStroke(ctx, INK, 150 * alpha, 1.3, 0);
  ctx.beginPath();
  drawSegment3D(ctx, x0, 0, 0, x0, radius * 1.3 * cosA, radius * 1.3 * sinA);
  glowStroke(ctx, ACID, 200 * alpha, 1.6, 0.5);
  ctx.beginPath();
  let penDown = false;
  for (let k = 0; k <= 32; k++) {
    const a = scene.alpha * k / 32;
    if (!projectPoint(x0, radius * Math.cos(a), radius * Math.sin(a))) continue;
    if (penDown) ctx.lineTo(projX, projY);
    else ctx.moveTo(projX, projY);
    penDown = true;
  }
  glowStroke(ctx, ACID, 220 * alpha, 2, 0.6);
  const tv = torus.thetaV;
  ctx.beginPath();
  drawSegment3D(
    ctx,
    x0, radius * 0.86 * Math.cos(tv), radius * 0.86 * Math.sin(tv),
    x0, radius * 1.14 * Math.cos(tv), radius * 1.14 * Math.sin(tv)
  );
  glowStroke(ctx, INK, 200 * alpha, 1.6, 0.4);
}

function drawGeometryLabel(graphics, label, x, y, alpha, colorValue) {
  graphics.noStroke();
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(26);
  graphics.textAlign(CENTER, CENTER);
  graphics.fill(colorValue.r, colorValue.g, colorValue.b, 225 * alpha);
  graphics.text(label, x, y);
}

function drawGeometryLabels(graphics) {
  const alpha = scene.planeAlpha;
  if (alpha <= 0.02) return;
  const x0 = 0;
  const radius = VIEW.arcRadius * torus.scale * 1.45;
  const mid = scene.alpha * 0.5;
  if (scene.alpha > 0.06 && projectPoint(x0, radius * Math.cos(mid), radius * Math.sin(mid))) {
    drawGeometryLabel(graphics, "α", projX, projY, alpha, ACID);
  }
  const tv = torus.thetaV;
  if (projectPoint(x0, radius * 1.05 * Math.cos(tv * 1.35), radius * 1.05 * Math.sin(tv * 1.35))) {
    drawGeometryLabel(graphics, "θᵥ", projX, projY, alpha * 0.85, INK);
  }
}

// Soft erase outside the Reel-safe stage, so nothing is cut with a hard edge.
function applyStageMask(ctx) {
  const f = VIEW.feather;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (const [x0, y0, x1, y1, rx, ry, rx2, ry2] of MASK_BANDS) {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(rx, ry, rx2 - rx, ry2 - ry);
  }
  ctx.restore();
}

const MASK_BANDS = [
  [0, VIEW.maskTop, 0, VIEW.maskTop + VIEW.feather, 0, 0, W, VIEW.maskTop + VIEW.feather],
  [0, VIEW.maskBottom, 0, VIEW.maskBottom - VIEW.feather, 0, VIEW.maskBottom - VIEW.feather, W, H],
  [VIEW.maskLeft, 0, VIEW.maskLeft + VIEW.feather, 0, 0, 0, VIEW.maskLeft + VIEW.feather, H],
  [VIEW.maskRight, 0, VIEW.maskRight - VIEW.feather, 0, VIEW.maskRight - VIEW.feather, 0, W, H],
];

// ================================================================
// HUD
// ================================================================

function sectionLabel() {
  if (scene.alpha < 1e-4) return "CONCENTRIC CIRCLES";
  if (isAtVillarceau()) return "TWO CIRCLES";
  return scene.alpha < torus.thetaV ? "NESTED OVALS" : "SEPARATE LOOPS";
}

function citationText() {
  if (scene.sectionAlpha > 0.05 && scene.sectionPoints > 0) {
    return `max dist(section, C±) · ${scene.deviation.toFixed(4)}`;
  }
  return "C± = (±r + R cos t, √(R² − r²) sin t, r sin t)";
}

// HUD — existing fonts, sizes, hierarchy, and anchors are retained.
function drawScreenFinish() {
  const graphics = hudPg;
  graphics.clear();
  graphics.image(grainPg, 0, 0);
  drawCornerGuides(graphics);
  graphics.noStroke();
  graphics.textAlign(CENTER, CENTER);
  graphics.textFont("Georgia");
  graphics.textStyle(BOLD);
  graphics.textSize(72);
  graphics.fill(INK.r, INK.g, INK.b, 245);
  graphics.text("VILLARCEAU CIRCLES", W / 2, HUD.titleY);
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(34);
  graphics.fill(INK.r, INK.g, INK.b, 228);
  graphics.text("TORUS ∩ OBLIQUE PLANE", W / 2, HUD.formulaY);
  graphics.textSize(23);
  graphics.fill(CYAN.r, CYAN.g, CYAN.b, 220);
  graphics.text(
    `θᵥ = asin(r / R) = ${(torus.thetaV * DEG).toFixed(2)}°`,
    W / 2,
    HUD.exponentY
  );
  graphics.textSize(26);
  graphics.fill(INK.r, INK.g, INK.b, 215);
  graphics.text(`R ${torus.R.toFixed(2)} · r ${torus.r.toFixed(2)}`, W / 2, HUD.subtitleY);

  const atV = isAtVillarceau();
  graphics.textAlign(LEFT, TOP);
  if (atV) graphics.fill(ACID.r, ACID.g, ACID.b, 240);
  else graphics.fill(INK.r, INK.g, INK.b, 235);
  graphics.text(
    atV ? "α = θᵥ" : `α ${(scene.alpha * DEG).toFixed(1)}°`,
    HUD.stageTextX,
    HUD.stageY
  );
  graphics.fill(INK.r, INK.g, INK.b, 235);
  graphics.textAlign(RIGHT, TOP);
  graphics.textSize(22);
  graphics.text(sectionLabel(), W - HUD.rightTextX, HUD.stageY + 3);
  const progress = clamp(Math.round(loopProgress * LOOP_FRAMES) / (LOOP_FRAMES - 1), 0, 1);
  const indicatorX = HUD.safeX + (W - 2 * HUD.safeX) * progress;
  graphics.stroke(INK.r, INK.g, INK.b, 80);
  graphics.strokeWeight(1);
  graphics.line(HUD.safeX, HUD.trackY, W - HUD.safeX, HUD.trackY);
  graphics.stroke(INK.r, INK.g, INK.b, 184);
  graphics.strokeWeight(2.2);
  graphics.line(HUD.safeX, HUD.trackY, indicatorX, HUD.trackY);
  graphics.noStroke();
  graphics.fill(INK.r, INK.g, INK.b, 235);
  graphics.circle(indicatorX, HUD.trackY, 8);

  graphics.textAlign(CENTER, CENTER);
  graphics.textSize(28);
  if (OVERLAY.hook && (sim.auto || isRecording)) {
    const p = loopProgress;
    for (const caption of OVERLAY.captions) {
      const weight = caption.window
        ? envelope(p, caption.window)
        : 1 - smoothstep(0.2, 0.24, p) + smoothstep(0.96, 0.995, p);
      if (weight <= 0.01) continue;
      graphics.fill(INK.r, INK.g, INK.b, HUD.bottomMainAlpha * weight);
      graphics.text(caption.first, W / 2, HUD.bottomTextY);
      graphics.text(caption.second, W / 2, HUD.bottomTextY + 38);
    }
  } else if (OVERLAY.hook && atV) {
    graphics.fill(INK.r, INK.g, INK.b, HUD.bottomMainAlpha);
    graphics.text("α = θᵥ = asin(r / R)", W / 2, HUD.bottomTextY);
    graphics.text("INTERSECTION → TWO CIRCLES", W / 2, HUD.bottomTextY + 38);
  }
  graphics.textSize(22);
  graphics.fill(INK.r, INK.g, INK.b, HUD.citationAlpha);
  graphics.text(citationText(), W / 2, HUD.citationY);
  compositeHUD(graphics);
}

// ================================================================
// AUDIT — ?audit=1 runs the mathematical checks for several (R, r) and
// every loop frame, storing the report on window.villarceauAudit.
// ================================================================

const AUDIT_PAIRS = [[1, 0.2], [1, 0.42], [1, 0.8], [2, 0.5], [0.7, 0.6]];

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function auditPair(R, r) {
  setTorus(R, r);
  const { c, thetaV } = torus;
  const entry = {
    R, r,
    thetaVDeg: thetaV * DEG,
    circleOnTorus: 0,
    circleOnPlane: 0,
    circleRadius: 0,
    bitangentNormal: 0,
    sectionVsCircles: 0,
    sectionOnTorus: 0,
    sectionOnPlane: 0,
    sectionPoints: 0,
    sectionLoopsAtV: 0,
    sectionLoopsHalf: 0,
    columnRootError: 0,
    nonFinite: 0,
  };
  const worst = (key, value) => {
    if (!Number.isFinite(value)) entry.nonFinite++;
    else entry[key] = Math.max(entry[key], Math.abs(value));
  };
  setPlaneAngle(thetaV);
  for (let sign = -1; sign <= 1; sign += 2) {
    for (let k = 0; k < 720; k++) {
      const t = k / 720 * TAU;
      const x = sign * r + R * Math.cos(t);
      const y = c * Math.sin(t);
      const z = r * Math.sin(t);
      const rho = Math.hypot(x, y) - R;
      worst("circleOnTorus", rho * rho + z * z - r * r);
      worst("circleOnPlane", planeValue(x, y, z));
      worst("circleRadius", Math.hypot(x - sign * r, y, z) - R);
    }
    // Bitangent point: torus normal must be parallel to the plane normal.
    const y = sign * c * c / R;
    const z = sign * r * c / R;
    const v = Math.atan2(z, Math.hypot(0, y) - R);
    const u = Math.atan2(y, 0);
    const nx = Math.cos(v) * Math.cos(u);
    const ny = Math.cos(v) * Math.sin(u);
    const nz = Math.sin(v);
    const cross = Math.hypot(ny * scene.cosA + nz * scene.sinA, nx * scene.cosA, nx * scene.sinA);
    worst("bitangentNormal", cross);
  }

  extractLevelSet(FIELD_PLANE, sectionPool);
  entry.sectionPoints = sectionPool.count;
  entry.sectionLoopsAtV = sectionPool.lines;
  const P = sectionPool.P;
  for (let k = 0; k < sectionPool.count; k++) {
    const x = P[k * 3];
    const y = P[k * 3 + 1];
    const z = P[k * 3 + 2];
    worst("sectionVsCircles", distanceToVillarceau(x, y, z));
    const rho = Math.hypot(x, y) - R;
    worst("sectionOnTorus", rho * rho + z * z - r * r);
    worst("sectionOnPlane", planeValue(x, y, z));
  }

  // Cross-check below θᵥ: for each u, A sin v + B cos v = C has exactly two
  // closed-form roots; every marching-squares point must sit on one of them.
  setPlaneAngle(thetaV * 0.5);
  extractLevelSet(FIELD_PLANE, sectionPool);
  entry.sectionLoopsHalf = sectionPool.lines;
  for (let k = 0; k < sectionPool.count; k++) {
    const x = P[k * 3];
    const y = P[k * 3 + 1];
    const z = P[k * 3 + 2];
    const u = Math.atan2(y, x);
    const v = Math.atan2(z, Math.hypot(x, y) - R);
    const A = r * scene.cosA;
    const B = -r * scene.sinA * Math.sin(u);
    const C = R * scene.sinA * Math.sin(u);
    const rho = Math.hypot(A, B);
    const phi = Math.atan2(B, A);
    const root = Math.asin(clamp(C / rho, -1, 1));
    worst("columnRootError", Math.min(
      Math.abs(wrapAngle(v - (root - phi))),
      Math.abs(wrapAngle(v - (Math.PI - root - phi)))
    ));
  }
  return entry;
}

function runAudit() {
  const savedR = torus.R;
  const savedr = torus.r;
  const savedAuto = sim.auto;
  sim.auto = true;
  const report = { pairs: [], clamps: [], loop: null };
  for (const [R, r] of AUDIT_PAIRS) report.pairs.push(auditPair(R, r));

  for (const [R, r] of [[1, 1.5], [1, 0], [NaN, 0.3], [-1, -1], [5, 5]]) {
    setTorus(R, r);
    report.clamps.push({
      input: [R, r],
      R: torus.R,
      r: torus.r,
      thetaV: torus.thetaV,
      finite: [torus.R, torus.r, torus.c, torus.thetaV].every(Number.isFinite) && torus.R > torus.r && torus.r > 0,
    });
  }

  setTorus(savedR, savedr);
  const loop = { frames: LOOP_FRAMES, nonFinite: 0, maxDeviationAtV: 0, bounds: {}, loopDelta: 0, msPerFrame: 0 };
  const grow = (key) => {
    if (!Number.isFinite(projX) || !Number.isFinite(projY)) {
      loop.nonFinite++;
      return;
    }
    const box = loop.bounds[key] || (loop.bounds[key] = {
      minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity,
    });
    box.minX = Math.min(box.minX, Math.round(projX));
    box.maxX = Math.max(box.maxX, Math.round(projX));
    box.minY = Math.min(box.minY, Math.round(projY));
    box.maxY = Math.max(box.maxY, Math.round(projY));
  };
  const snapshot = () => [
    scene.alpha, scene.torusAlpha, scene.planeAlpha, scene.sectionAlpha,
    scene.circleAlpha, scene.resolve, cam.ex, cam.ey, cam.ez,
  ];
  const t0 = performance.now();
  for (let frame = 0; frame < LOOP_FRAMES; frame++) {
    setLoop(frame / LOOP_FRAMES);
    updateAnimation();
    updateCamera();
    extractLevelSet(FIELD_PLANE, sectionPool);
    measureSection();
    extractLevelSet(FIELD_CONTOUR, contourPool);
    loop.nonFinite += scene.nonFinite;
    if (isAtVillarceau()) loop.maxDeviationAtV = Math.max(loop.maxDeviationAtV, scene.deviation);
    const P = wirePool.P;
    for (let k = 0; k < wirePool.count; k += 7) {
      if (projectPoint(P[k * 3], P[k * 3 + 1], P[k * 3 + 2])) grow("torus");
    }
    for (let k = 0; k < circlePool.count; k += 4) {
      const C = circlePool.P;
      if (projectPoint(C[k * 3], C[k * 3 + 1], C[k * 3 + 2])) grow("circles");
    }
    if (scene.planeAlpha > 0.3) {
      const hu = VIEW.planeHalfU * torus.scale * 0.6;
      const hw = VIEW.planeHalfW * torus.scale * 0.6;
      for (let k = 0; k < 4; k++) {
        const su = k === 1 || k === 2 ? 1 : -1;
        const sw = k >= 2 ? 1 : -1;
        if (projectPoint(hu * su, hw * sw * scene.cosA, hw * sw * scene.sinA)) grow("planeInner");
      }
    }
  }
  loop.msPerFrame = (performance.now() - t0) / LOOP_FRAMES;

  setLoop(0);
  updateAnimation();
  updateCamera();
  const first = snapshot();
  setLoop(1 - 1e-9);
  updateAnimation();
  updateCamera();
  const last = snapshot();
  loop.loopDelta = Math.max(...first.map((value, i) => Math.abs(value - last[i])));
  report.loop = loop;

  sim.auto = savedAuto;
  setLoop(0);
  console.log("[villarceau audit]", JSON.stringify(report, null, 2));
  return report;
}

// ================================================================
// UI + LOOP CLOCK
// ================================================================

function urlParam(name) {
  return typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get(name)
    : null;
}

const previewParam = urlParam("preview");
const previewProgress = previewParam === null ? NaN : Number(previewParam);
const auditParam = urlParam("audit");

function getElement(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = getElement(id);
  if (element) element.textContent = value;
}

function setDisabled(id, disabled) {
  const element = getElement(id);
  if (element) element.disabled = disabled;
}

function setProgress(percent) {
  const element = getElement("progressFill");
  if (element) element.style.width = `${percent.toFixed(1)}%`;
}

function setLoop(progress) {
  loopProgress = progress;
  phase = loopProgress * TAU;
}

function bindUI() {
  const startButton = getElement("startBtn");
  const stopButton = getElement("stopBtn");
  if (startButton) startButton.onclick = startRecording;
  if (stopButton) stopButton.onclick = stopRecording;

  const onRadius = () => {
    setTorus(Number(getElement("RSlider").value), Number(getElement("rSlider").value));
    sim.manualAlpha = Math.min(sim.manualAlpha, Math.PI / 2);
    syncControls();
  };
  for (const id of ["RSlider", "rSlider"]) {
    const element = getElement(id);
    if (element) element.oninput = onRadius;
  }
  const alphaSlider = getElement("alphaSlider");
  if (alphaSlider) {
    alphaSlider.oninput = () => {
      sim.auto = false;
      sim.manualAlpha = Number(alphaSlider.value) / DEG;
      syncControls();
    };
  }
  const onClick = (id, handler) => {
    const element = getElement(id);
    if (element) element.onclick = handler;
  };
  onClick("autoBtn", () => setAuto(!sim.auto));
  onClick("pauseBtn", togglePause);
  onClick("resetBtn", resetSimulator);
  onClick("villarceauBtn", goToVillarceau);
  const toggles = {
    showTorus: "torus", showPlane: "plane", showSection: "section",
    showCircles: "circles", showMath: "math",
  };
  for (const [id, layer] of Object.entries(toggles)) {
    const element = getElement(id);
    if (element) element.onchange = () => {
      sim.layers[layer] = element.checked;
      syncControls();
    };
  }
  const hook = getElement("showHook");
  if (hook) hook.onchange = () => { OVERLAY.hook = hook.checked; };
}

function setAuto(auto) {
  if (isRecording) return;
  if (!auto) sim.manualAlpha = scene.alpha;
  sim.auto = auto;
  syncControls();
}

function togglePause() {
  if (isRecording) return;
  sim.paused = !sim.paused;
  syncControls();
}

function goToVillarceau() {
  if (isRecording) return;
  sim.auto = false;
  sim.manualAlpha = torus.thetaV;
  syncControls();
}

function resetSimulator() {
  if (isRecording) return;
  setTorus(TORUS.R, TORUS.r);
  Object.assign(sim, { auto: true, paused: false, playhead: 0, manualAlpha: 0, dragYaw: 0, dragElevation: 0 });
  for (const layer of Object.keys(sim.layers)) sim.layers[layer] = true;
  OVERLAY.hook = true;
  for (const id of ["showTorus", "showPlane", "showSection", "showCircles", "showHook", "showMath"]) {
    const element = getElement(id);
    if (element) element.checked = true;
  }
  syncControls();
}

const CONTROL_IDS = [
  "RSlider", "rSlider", "alphaSlider", "autoBtn", "pauseBtn", "resetBtn", "villarceauBtn",
  "showTorus", "showPlane", "showSection", "showCircles", "showHook", "showMath",
];

function syncControls() {
  const R = getElement("RSlider");
  const r = getElement("rSlider");
  const alpha = getElement("alphaSlider");
  if (R) R.value = torus.R;
  if (r) r.value = torus.r;
  if (alpha && !sim.auto) alpha.value = sim.manualAlpha * DEG;
  setText("RValue", torus.R.toFixed(2));
  setText("rValue", torus.r.toFixed(2));
  setText("autoBtn", `Auto: ${sim.auto ? "on" : "off"}`);
  setText("pauseBtn", sim.paused ? "Play" : "Pause");
  const math = getElement("math");
  if (math) math.hidden = !sim.layers.math;
  for (const id of CONTROL_IDS) setDisabled(id, isRecording);
}

function updateLiveUI() {
  if (frameCount % 6 !== 0 || !sim.layers.math) return;
  const alpha = getElement("alphaSlider");
  if (alpha && (sim.auto || isRecording)) alpha.value = scene.alpha * DEG;
  setText("alphaValue", `${(scene.alpha * DEG).toFixed(2)}°`);
  setText("thetaValue", `${(torus.thetaV * DEG).toFixed(4)}°`);
  setText("deltaValue", `${((scene.alpha - torus.thetaV) * DEG).toFixed(4)}°`);
  setText("loopsValue", sectionPool.lines);
  setText("pointsValue", scene.sectionPoints);
  setText("devValue", scene.deviation.toExponential(2));
  setText("costValue", sim.frameCost.toFixed(1));
}

function updateStaticUI() {
  setText("maxDuration", MAX_DURATION);
  setText("canvasSize", `${W} × ${H}`);
  setText("maxFrames", MAX_FRAMES);
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function updateLoopTime() {
  if (Number.isFinite(previewProgress) && !isRecording) {
    setLoop(clamp(previewProgress, 0, 0.999999));
  } else if (isRecording) {
    // frame / LOOP_FRAMES: the last recorded frame hands off seamlessly to
    // the first when the Reel loops (no duplicated frame).
    setLoop((recFrameCount % LOOP_FRAMES) / LOOP_FRAMES);
  } else {
    setLoop((sim.playhead % LOOP_FRAMES) / LOOP_FRAMES);
    if (sim.auto && !sim.paused) sim.playhead++;
  }
}

function draw() {
  const t0 = performance.now();
  updateLoopTime();
  renderFrame();
  drawScreenFinish();
  sim.frameCost = 0.9 * sim.frameCost + 0.1 * (performance.now() - t0);
  updateLiveUI();
  if (isRecording) {
    captureFrame();
    recFrameCount++;
    updateRecordingUI();
    if (recFrameCount >= MAX_FRAMES) stopRecording();
  }
}

// Debug orbit — ignored while recording or previewing a fixed frame.
function mouseDragged(event) {
  if (isRecording || !event || event.target !== canvasEl) return true;
  sim.dragYaw -= movedX * 0.005;
  sim.dragElevation = clamp(sim.dragElevation + movedY * 0.004, -0.9, 0.9);
  return false;
}

function bakeGrain() {
  grainPg.clear();
  grainPg.noStroke();
  randomSeed(20260904);
  const subtleCount = Math.floor(W * H * 0.0016);
  for (let i = 0; i < subtleCount; i++) {
    const value = random(110, 200);
    grainPg.fill(value, value, value, random(2, 7));
    grainPg.circle(random(W), random(H), random(0.15, 0.85));
  }
  const brightCount = Math.floor(W * H * 0.000035);
  for (let i = 0; i < brightCount; i++) {
    const value = random(210, 255);
    grainPg.fill(value, value, value, random(12, 34));
    grainPg.circle(random(W), random(H), random(0.4, 1.2));
  }
}

function drawCornerGuides(graphics) {
  graphics.noFill();
  graphics.stroke(255, 255, 255, 80);
  graphics.strokeWeight(0.7);
  const margin = 34;
  const length = 24;
  graphics.line(margin, margin, margin + length, margin);
  graphics.line(margin, margin, margin, margin + length);
  graphics.line(W - margin, margin, W - margin - length, margin);
  graphics.line(W - margin, margin, W - margin, margin + length);
  graphics.line(margin, H - margin, margin + length, H - margin);
  graphics.line(margin, H - margin, margin, H - margin - length);
  graphics.line(W - margin, H - margin, W - margin - length, H - margin);
  graphics.line(W - margin, H - margin, W - margin, H - margin - length);
}

function compositeHUD(graphics) {
  push();
  drawingContext.disable(drawingContext.DEPTH_TEST);
  resetMatrix();
  camera(0, 0, 1, 0, 0, 0, 0, 1, 0);
  ortho(-W / 2, W / 2, -H / 2, H / 2, -10, 10);
  noLights();
  blendMode(BLEND);
  image(graphics, -W / 2, -H / 2, W, H);
  drawingContext.enable(drawingContext.DEPTH_TEST);
  pop();
}

function keyReleased() {
  if (key === "h" || key === "H") {
    const controls = getElement("controls");
    if (controls) controls.hidden = !controls.hidden;
    return false;
  }
  if (key === "r" || key === "R") {
    if (isRecording) stopRecording();
    else startRecording();
    return false;
  }
  if (key === "s" || key === "S") {
    saveCanvas(`villarceau_circles_${getTimestamp()}`, "png");
    return false;
  }
  if (key === "v" || key === "V") {
    goToVillarceau();
    return false;
  }
  if (key === "p" || key === "P") {
    togglePause();
    return false;
  }
  return true;
}

function updateRecordingUI() {
  setText("duration", (recFrameCount / FPS).toFixed(1));
  setText("frameCount", recFrameCount);
  setProgress(recFrameCount / MAX_FRAMES * 100);
}

function startRecording() {
  if (isRecording || isFinalizing) return;
  if (typeof VideoEncoder === "undefined") {
    alert("WebCodecs not supported.");
    return;
  }
  if (typeof Mp4Muxer === "undefined") {
    alert("mp4-muxer not loaded.");
    return;
  }
  muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: "avc", width: W, height: H },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  encoder = new VideoEncoder({
    output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    error: (error) => {
      console.error(error);
      isRecording = false;
      isFinalizing = false;
      setStatus("Error", "#f44");
    },
  });
  encoder.configure({
    codec: "avc1.640028",
    width: W,
    height: H,
    bitrate: 18_000_000,
    framerate: FPS,
  });
  recFrameCount = 0;
  setLoop(0);
  isRecording = true;
  syncControls();
  setText("duration", "0.0");
  setText("frameCount", "0");
  setDisabled("startBtn", true);
  setDisabled("stopBtn", false);
  setProgress(0);
  setStatus("Recording…", "#fff");
}

async function stopRecording() {
  if (!encoder || !muxer || isFinalizing) return;
  isRecording = false;
  isFinalizing = true;
  setDisabled("stopBtn", true);
  setStatus("Finalizing…", "#ccc");
  try {
    await encoder.flush();
    muxer.finalize();
    const buffer = muxer.target.buffer;
    const blob = new Blob([buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `villarceau_circles_${getTimestamp()}.mp4`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Saved", "#8f8");
  } catch (error) {
    console.error(error);
    setStatus("Error", "#f44");
  } finally {
    if (encoder && encoder.state !== "closed") encoder.close();
    encoder = null;
    muxer = null;
    isFinalizing = false;
    setDisabled("startBtn", false);
    setDisabled("stopBtn", true);
    syncControls();
  }
}

function captureFrame() {
  if (!encoder || encoder.state !== "configured") return;
  const timestamp = Math.round(recFrameCount * 1_000_000 / FPS);
  const frame = new VideoFrame(canvasEl, { timestamp });
  encoder.encode(frame, { keyFrame: recFrameCount % FPS === 0 });
  frame.close();
}

function setStatus(textValue, colorValue) {
  const status = getElement("status");
  if (!status) return;
  status.textContent = textValue;
  status.style.color = colorValue;
}

function getTimestamp() {
  const date = new Date();
  const year = date.getFullYear().toString();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hour}${minute}${second}`;
}
