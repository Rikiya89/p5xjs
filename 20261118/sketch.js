"use strict";

// BARTH SEXTIC — ICOSAHEDRAL SINGULARITY
// F(x, y, z) = 4(φ²x² − y²)(φ²y² − z²)(φ²z² − x²) − (1 + 2φ)(x² + y² + z² − 1)²,  φ = (1 + √5) / 2.
// Projective form (MathWorld): 4Π(φ²x² − y²) − (1 + 2φ)(x² + y² + z² − w²)² w² = 0; the render is the chart w = 1.
// 65 ordinary double points = 65 projective nodes (the maximum for a sextic):
//   50 finite — 30 at |p| = 1 (icosidodecahedron), 20 at |p| = √3 (dodecahedron, side 2/φ);
//   15 at infinity (w = 0) — the directions where two of the six planes φx = ±y, φy = ±z, φz = ±x meet,
//   i.e. the 15 two-fold axes. They never appear in a finite view; the clip ball |p| ≤ R only shows the 50.
// On the unit sphere F = 4·Π, so the surface meets |p| = 1 in exactly six great circles (one per plane);
// their 15 pairwise crossings (× 2 antipodes) are the 30 inner nodes. Each plane is ⊥ to a five-fold axis.
// The surface is invariant under the icosahedral rotation group (order 60): a spin of 2π/n about an n-fold
// axis carries the image onto itself, which closes the loop.

const W = 1080;
const H = 1920;
const FPS = 60;

const MAX_DURATION = 10;
const MAX_FRAMES = FPS * MAX_DURATION;
const LOOP_FRAMES = MAX_FRAMES;
const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

// Neo-Swiss palette, same { r, g, b } structure as the rest of the series.
const BG = { r: 242, g: 240, b: 234 };      // #F2F0EA off-white
const INK = { r: 17, g: 17, b: 17 };        // #111111 near-black
const CHARCOAL = { r: 32, g: 32, b: 32 };   // #202020
const MUTED = { r: 168, g: 166, b: 159 };   // #A8A69F
const COBALT = { r: 36, g: 71, b: 255 };    // #2447FF

// Asymmetric 12-column grid: 84 px margins, 54 px columns, 24 px gutters.
const GRID = {
  left: 84,
  right: W - 84,
  colStep: 78,
};

function gridX(column) {
  return GRID.left + GRID.colStep * column;
}

const HUD = {
  safeX: 56,
  headerY: 214,
  ruleTopY: 252,
  titleY: 278,
  titleLead: 76,
  columnY: 288,
  columnLead: 34,
  trackY: 470,
  readoutY: 486,
  ruleBottomY: 1268,
  formulaY: 1284,
  citationY: 1410,
};

// Vertical radius ruler in the left column: |p| ∈ [0, R] mapped to [rulerBottom, rulerTop].
const RULER = {
  x: 112,
  top: 640,
  bottom: 1120,
  tick: 8,
};

// ================================================================
// BARTH SEXTIC — the same polynomial runs here and in GLSL
// ================================================================

const PHI = (1 + Math.sqrt(5)) / 2;
const PHI2 = PHI * PHI;
const BARTH_K = 1 + 2 * PHI;
const SQRT3 = Math.sqrt(3);

// Adjustable parameters.
//   radius     — clip ball |p| ≤ R (the surface is unbounded: 15 nodes sit at infinity)
//   quality    — ray budget × supersampling, see QUALITY
//   contours   — |p| = k / contours level curves (k = contours is the node-circle sphere |p| = 1)
//   distance   — camera distance relative to the fitted framing
//   tilt       — camera elevation over the spin axis
//   spinTurns  — symmetry periods 2π/n per loop
const PARAMS = {
  radius: 2,
  quality: 3,
  contours: 4,
  distance: 1,
  tilt: 0.3,
  spinTurns: 1,
  light: 1,
};

// Adaptive ray stepping (see trace()): `steps` is the step budget, `samples` the per-pixel rays.
const QUALITY = [
  { steps: 128, samples: 1 },
  { steps: 192, samples: 1 },
  { steps: 192, samples: 4 },
  { steps: 256, samples: 4 },
];

const RAY = {
  maxStepDiv: 48,
  minStepDiv: 2000,
  refine: 14,
};

// View presets: the spin axis is a five-, three- or two-fold axis of the icosahedral group.
const PRESETS = [
  { key: "c5", label: "C5", order: 5, axis: [PHI, 1, 0] },
  { key: "c3", label: "C3", order: 3, axis: [1, 1, 1] },
  { key: "c2", label: "C2", order: 2, axis: [0, 0, 1] },
];

// Stage box the sculpture is fitted into once per parameter set (never per frame).
const STAGE = {
  left: 176,
  right: GRID.right,
  top: 548,
  bottom: 1212,
  fov: 0.5,
  tiltSwing: 0.06,
  yawSwing: 0.05,
  fitSamples: 60,
  fitDirections: 1200,
  // Spin at t = 0 as a fraction of the symmetry period 2π/n.
  spinPhase: 0.1,
  axisAbove: 0.3,
  axisBelow: 0.12,
};

// The cobalt sweep sphere |p| = r(t) oscillates 1 ± (√3 − 1 + 0.06): it sits on the node circles at t = 0
// and grazes the 20 outer nodes at t = 1/4.
const SWEEP = { centre: 1, amp: SQRT3 - 1 + 0.06 };

function barthF(x, y, z) {
  const a = PHI2 * x * x - y * y, b = PHI2 * y * y - z * z, c = PHI2 * z * z - x * x;
  const s = x * x + y * y + z * z - 1;
  return 4 * a * b * c - BARTH_K * s * s;
}

// Analytic gradient (same expression as barthGrad in the fragment shader).
function barthGrad(x, y, z, out = [0, 0, 0]) {
  const a = PHI2 * x * x - y * y, b = PHI2 * y * y - z * z, c = PHI2 * z * z - x * x;
  const s4 = 4 * BARTH_K * (x * x + y * y + z * z - 1);
  out[0] = 8 * x * (PHI2 * b * c - a * b) - s4 * x;
  out[1] = 8 * y * (PHI2 * a * c - b * c) - s4 * y;
  out[2] = 8 * z * (PHI2 * a * b - a * c) - s4 * z;
  return out;
}

// Homogeneous form from MathWorld, used as an independent reference by the audit.
function barthHomogeneous(x, y, z, w) {
  const r = x * x + y * y + z * z - w * w;
  return 4 * (PHI2 * x * x - y * y) * (PHI2 * y * y - z * z) * (PHI2 * z * z - x * x) - BARTH_K * r * r * w * w;
}

function cyclic(point) {
  const [x, y, z] = point;
  return [[x, y, z], [z, x, y], [y, z, x]];
}

function signed(point) {
  const list = [];
  for (const sx of point[0] ? [1, -1] : [1]) {
    for (const sy of point[1] ? [1, -1] : [1]) {
      for (const sz of point[2] ? [1, -1] : [1]) list.push([sx * point[0], sy * point[1], sz * point[2]]);
    }
  }
  return list;
}

function orbit(seed) {
  return cyclic(seed).flatMap(signed);
}

// 30 inner nodes (icosidodecahedron, |p| = 1) and 20 outer nodes (dodecahedron, |p| = √3).
const NODES_INNER = [...orbit([1, 0, 0]), ...orbit([0.5, PHI / 2, 1 / (2 * PHI)])];
const NODES_OUTER = [...signed([1, 1, 1]), ...orbit([0, 1 / PHI, PHI])];

// Icosahedron with vertices on the five-fold axes ⊥ the six planes: cyclic (±1, ±1/φ, 0), circumradius
// √(1 + φ⁻²). Its 30 edge midpoints are exactly the 30 inner nodes (checked by the audit).
const ICOSA_VERTICES = orbit([1, 1 / PHI, 0]);
const ICOSA_EDGES = (() => {
  const edges = [];
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      const d = Math.hypot(...ICOSA_VERTICES[i].map((v, k) => v - ICOSA_VERTICES[j][k]));
      if (Math.abs(d - 2 / PHI) < 1e-9) edges.push([i, j]);
    }
  }
  return edges;
})();

// Six unit plane normals (φ, ±1, 0), (0, φ, ±1), (±1, 0, φ) / |…| — the five-fold axes.
const PLANE_NORMALS = [[PHI, 1, 0], [PHI, -1, 0], [0, PHI, 1], [0, PHI, -1], [1, 0, PHI], [-1, 0, PHI]]
  .map((n) => normalize3(n));

function normalize3(p) {
  const length = Math.hypot(p[0], p[1], p[2]);
  return [p[0] / length, p[1] / length, p[2] / length];
}

function cross(p, q) {
  return [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
}

function dot(p, q) {
  return p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
}

// Ray–surface intersection inside the clip ball. F is not a distance field, so the step is the first-order
// root estimate |F| / |∇F|, clamped to [chord / 2000, chord / 48]; a sign change is refined by bisection.
// Line-by-line port of trace() in the fragment shader. Returns t ≥ 0 or −1.
const traceScratch = [0, 0, 0];

function traceRay(ro, rd, radius, steps) {
  const b = dot(ro, rd), c = dot(ro, ro) - radius * radius, h = b * b - c;
  if (h <= 0) return -1;
  const sq = Math.sqrt(h), t0 = -b - sq, t1 = -b + sq;
  const chord = t1 - t0, hMax = chord / RAY.maxStepDiv, hMin = chord / RAY.minStepDiv;
  const at = (t) => barthF(ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t);
  let ta = t0, fa = at(t0);
  for (let i = 0; i < steps; i++) {
    const g = barthGrad(ro[0] + rd[0] * ta, ro[1] + rd[1] * ta, ro[2] + rd[2] * ta, traceScratch);
    const gl = Math.hypot(g[0], g[1], g[2]);
    const step = clamp(Math.abs(fa) / Math.max(gl, 1e-12), hMin, hMax);
    const tb = Math.min(ta + step, t1), fb = at(tb);
    if ((fa < 0) !== (fb < 0)) {
      let lo = ta, hi = tb, flo = fa;
      for (let j = 0; j < RAY.refine; j++) {
        const m = 0.5 * (lo + hi), fm = at(m);
        if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m;
      }
      return 0.5 * (lo + hi);
    }
    if (tb >= t1) break;
    ta = tb; fa = fb;
  }
  return -1;
}

// ================================================================
// FRAME STATE — a pure function of loop progress, shared by draw and audit
// ================================================================

const frameState = {
  spin: 0,
  tilt: 0,
  yaw: 0,
  level: 1,
  light: 0,
};

// Framing: fixed for a parameter set, solved over the whole loop by fitStage().
const fit = { scale: 200, tx: 0, ty: 0, depthSpan: 1, key: "" };

let presetIndex = 0;

function preset() {
  return PRESETS[presetIndex];
}

function computeFrameState(p) {
  const phase = p * TAU;
  // 2π/n per loop: frame 600 is frame 0 carried onto itself by the n-fold rotation.
  frameState.spin = TAU / preset().order * (STAGE.spinPhase + PARAMS.spinTurns * p);
  frameState.tilt = PARAMS.tilt + STAGE.tiltSwing * Math.sin(phase);
  frameState.yaw = STAGE.yawSwing * Math.sin(phase + 0.7);
  frameState.level = SWEEP.centre + SWEEP.amp * Math.sin(phase);
  frameState.light = 0.12 * Math.sin(phase - 0.6);
}

// Alignment A: the preset's symmetry axis becomes model +Z (rows e1, e2, axis; right-handed).
const align = { rows: null, key: -1 };

function alignment() {
  if (align.key === presetIndex) return align.rows;
  const axis = normalize3(preset().axis);
  const helper = Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const e1 = normalize3(cross(axis, helper)), e2 = cross(axis, e1);
  align.rows = [e1, e2, axis];
  align.key = presetIndex;
  return align.rows;
}

// Same pose renderFrame applies: alignment, spin about Z, tilt (elevation), yaw. Input in Barth coordinates.
function posePoint(point, out) {
  const A = alignment(), spin = frameState.spin, tilt = HALF_PI - frameState.tilt, yaw = frameState.yaw;
  let x = dot(A[0], point), y = dot(A[1], point), z = dot(A[2], point);
  let c = Math.cos(spin), s = Math.sin(spin);
  [x, y] = [c * x - s * y, s * x + c * y];
  c = Math.cos(tilt); s = Math.sin(tilt);
  [y, z] = [c * y - s * z, s * y + c * z];
  c = Math.cos(yaw); s = Math.sin(yaw);
  [x, z] = [c * x + s * z, -s * x + c * z];
  out[0] = x; out[1] = y; out[2] = z;
  return out;
}

// Model → world rotation M (columns = posed basis vectors), row-major.
function poseMatrix() {
  const columns = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e) => posePoint(e, [0, 0, 0]));
  return [0, 1, 2].map((row) => columns.map((column) => column[row]));
}

function cameraDistance() {
  return (H / 2) / Math.tan(STAGE.fov / 2);
}

// Exact perspective projection of a posed model point (matches renderFrame and the shader).
function projectToScreen(posed, out) {
  const distance = cameraDistance();
  const x = fit.tx + posed[0] * fit.scale, y = fit.ty + posed[1] * fit.scale, z = posed[2] * fit.scale;
  const k = distance / (distance - z);
  out[0] = W / 2 + x * k;
  out[1] = H / 2 + y * k;
  return out;
}

// Camera position in Barth coordinates: q = Mᵀ((0, 0, D) − (tx, ty, 0)) / s.
function cameraInModel(M) {
  const world = [-fit.tx, -fit.ty, cameraDistance()];
  return [0, 1, 2].map((i) => (M[0][i] * world[0] + M[1][i] * world[1] + M[2][i] * world[2]) / fit.scale);
}

// Surface sample cloud for framing: every radial root of F inside the ball along a Fibonacci set of directions.
const surfaceCloud = { key: "", points: [] };

function surfaceSamples() {
  const R = PARAMS.radius;
  if (surfaceCloud.key === `${R}`) return surfaceCloud.points;
  const points = [], n = STAGE.fitDirections, steps = 240;
  for (let i = 0; i < n; i++) {
    const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5));
    const d = [r * Math.cos(a), y, r * Math.sin(a)];
    const f = (t) => barthF(d[0] * t, d[1] * t, d[2] * t);
    let ta = 0, fa = f(0);
    for (let j = 1; j <= steps; j++) {
      const tb = R * j / steps, fb = f(tb);
      if ((fa < 0) !== (fb < 0)) {
        let lo = ta, hi = tb, flo = fa;
        for (let k = 0; k < 24; k++) {
          const m = 0.5 * (lo + hi), fm = f(m);
          if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m;
        }
        const t = 0.5 * (lo + hi);
        points.push([d[0] * t, d[1] * t, d[2] * t]);
      }
      ta = tb; fa = fb;
    }
  }
  surfaceCloud.points = points;
  surfaceCloud.key = `${R}`;
  return points;
}

function axisEnds() {
  const axis = normalize3(preset().axis), R = PARAMS.radius;
  return [axis.map((v) => v * (R + STAGE.axisAbove)), axis.map((v) => -v * (R + STAGE.axisBelow))];
}

// Calls visit(point) for every drawn feature that can reach the silhouette: surface cloud, icosahedron, axis.
function forEachExtremePoint(visit) {
  for (const point of surfaceSamples()) visit(point);
  for (const point of ICOSA_VERTICES) visit(point);
  for (const point of axisEnds()) visit(point);
}

function fitStage() {
  const key = [PARAMS.radius, PARAMS.tilt, PARAMS.spinTurns, PARAMS.distance, presetIndex].join();
  if (key === fit.key) return;
  const posed = [0, 0, 0];
  let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity, extent = 0;
  for (let k = 0; k < STAGE.fitSamples; k++) {
    computeFrameState(k / STAGE.fitSamples);
    forEachExtremePoint((point) => {
      posePoint(point, posed);
      xLo = Math.min(xLo, posed[0]); xHi = Math.max(xHi, posed[0]);
      yLo = Math.min(yLo, posed[1]); yHi = Math.max(yHi, posed[1]);
      extent = Math.max(extent, Math.abs(posed[2]));
    });
  }
  // 0.94 leaves room for perspective growth of the near side (the audit measures the true bbox).
  const boxW = STAGE.right - STAGE.left, boxH = STAGE.bottom - STAGE.top;
  fit.scale = 0.94 * Math.min(boxW / (xHi - xLo), boxH / (yHi - yLo)) / PARAMS.distance;
  fit.tx = (STAGE.left + STAGE.right) / 2 - W / 2 - fit.scale * (xLo + xHi) / 2;
  fit.ty = (STAGE.top + STAGE.bottom) / 2 - H / 2 - fit.scale * (yLo + yHi) / 2;
  fit.depthSpan = 2.2 * fit.scale * extent;
  fit.key = key;
}

// ================================================================
// RAY-CAST SURFACE — one fullscreen pass, depth written for the guides
// ================================================================

// Unit quad in [0, 1]²; the vertex shader maps it straight to clip space.
function buildScreenQuad() {
  const geometry = new p5.Geometry();
  geometry.gid = "barth-screen-quad";
  geometry.vertices.push(new p5.Vector(0, 0, 0), new p5.Vector(1, 0, 0), new p5.Vector(1, 1, 0), new p5.Vector(0, 1, 0));
  geometry.faces.push([0, 1, 2], [0, 2, 3]);
  return geometry;
}

const SURFACE_VERTEX = `#version 300 es
precision highp float;
in vec3 aPosition;
void main() {
  gl_Position = vec4(aPosition.xy * 2.0 - 1.0, 0.0, 1.0);
}
`;

const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform mat3 uInv;
uniform vec3 uOrigin;
uniform float uDistance;
uniform float uScale;
uniform float uNear;
uniform float uFar;
uniform float uDepthSpan;
uniform float uRadius;
uniform int uSteps;
uniform int uSamples;
uniform vec3 uBg;
uniform vec3 uInk;
uniform vec3 uCharcoal;
uniform vec3 uMuted;
uniform vec3 uCobalt;
uniform vec3 uKey;
uniform float uLight;
uniform float uContourStep;
uniform float uLevel;
uniform float uContourOn;
uniform float uCircleOn;
out vec4 outColor;

const float PHI = 1.618033988749895;
const float PHI2 = PHI * PHI;
const float BARTH_K = 1.0 + 2.0 * PHI;
const int MAX_STEPS = 256;

float barth(vec3 p) {
  vec3 q = p * p;
  float a = PHI2 * q.x - q.y, b = PHI2 * q.y - q.z, c = PHI2 * q.z - q.x;
  float s = q.x + q.y + q.z - 1.0;
  return 4.0 * a * b * c - BARTH_K * s * s;
}

// xyz = ∇F, w = F; the factors a, b, c, s are shared.
vec4 barthGrad(vec3 p) {
  vec3 q = p * p;
  float a = PHI2 * q.x - q.y, b = PHI2 * q.y - q.z, c = PHI2 * q.z - q.x;
  float s = q.x + q.y + q.z - 1.0;
  vec3 g = 8.0 * p * vec3(PHI2 * b * c - a * b, PHI2 * a * c - b * c, PHI2 * a * b - a * c) - 4.0 * BARTH_K * s * p;
  return vec4(g, 4.0 * a * b * c - BARTH_K * s * s);
}

// Port of traceRay(): bounded to the clip ball, step |F| / |∇F| clamped to [chord/2000, chord/48],
// bisection on the first sign change. Returns −1 on a miss.
float trace(vec3 ro, vec3 rd) {
  float b = dot(ro, rd), c = dot(ro, ro) - uRadius * uRadius, h = b * b - c;
  if (h <= 0.0) return -1.0;
  h = sqrt(h);
  float t0 = -b - h, t1 = -b + h;
  float chord = t1 - t0, hMax = chord / 48.0, hMin = chord / 2000.0;
  float ta = t0;
  vec4 ga = barthGrad(ro + rd * t0);
  for (int i = 0; i < MAX_STEPS; i++) {
    if (i >= uSteps) break;
    float hs = clamp(abs(ga.w) / max(length(ga.xyz), 1e-12), hMin, hMax);
    float tb = min(ta + hs, t1);
    vec4 gb = barthGrad(ro + rd * tb);
    if ((ga.w < 0.0) != (gb.w < 0.0)) {
      float lo = ta, hi = tb, flo = ga.w;
      for (int j = 0; j < 14; j++) {
        float m = 0.5 * (lo + hi), fm = barth(ro + rd * m);
        if ((fm < 0.0) == (flo < 0.0)) { lo = m; flo = fm; } else { hi = m; }
      }
      return 0.5 * (lo + hi);
    }
    if (tb >= t1) break;
    ta = tb;
    ga = gb;
  }
  return -1.0;
}

// Antialiased line at distance d (pixels) with the given width.
float pxLine(float d, float width) {
  return 1.0 - smoothstep(0.5 * width, 0.5 * width + 0.8, d);
}

vec3 shade(vec3 p, vec3 rd, vec3 dw, float t) {
  vec4 gf = barthGrad(p);
  float gl = length(gf.xyz);
  // Nodes: ∇F = 0 exactly at the 50 finite double points; fall back to the view direction.
  vec3 nq = gl > 1e-7 ? gf.xyz / gl : -rd;
  vec3 n = normalize(nq * uInv);
  vec3 v = -dw;
  // Viewer on the F > 0 side → charcoal; on the F < 0 side → ink. F is global, so the loop seam is safe.
  float positive = step(0.0, dot(n, v));
  if (dot(n, v) < 0.0) { n = -n; nq = -nq; }
  vec3 key = normalize(uKey);
  vec3 fill = normalize(vec3(0.75, 0.2, 0.6));
  float diffuse = max(dot(n, key), 0.0);
  float soft = max(dot(n, fill), 0.0);
  float spec = pow(max(dot(reflect(-key, n), v), 0.0), 36.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.5);

  vec3 base = mix(uInk, uCharcoal, positive);
  vec3 color = mix(base, uMuted, uLight * (0.34 * diffuse + 0.1 * soft) * (0.6 + 0.4 * positive));

  // |p| level curves. fp = model units per pixel at depth t; gt = |∇_surface |p||.
  float r = length(p);
  float fp = t / uDistance;
  float gt = max(sqrt(max(1.0 - pow(dot(p / max(r, 1e-6), nq), 2.0), 0.0)), 0.08);
  float px = gt * fp;
  float spacing = uContourStep / px;
  float k = floor(r / uContourStep + 0.5);
  float contour = pxLine(abs(r - k * uContourStep) / px, 1.0) * smoothstep(2.5, 5.0, spacing);
  contour *= 1.0 - step(abs(k * uContourStep - 1.0), 1e-4);
  // |p| = 1: the six great circles where the surface meets the unit sphere (30 inner nodes on them).
  float circle = pxLine(abs(r - 1.0) / px, 1.6) * uCircleOn;
  color = mix(color, uMuted, 0.85 * circle);
  float near = exp(-pow((r - uLevel) / (1.1 * uContourStep), 2.0));
  float sweep = pxLine(abs(r - uLevel) / px, 2.4);
  color = mix(color, uCobalt, uContourOn * max(0.9 * contour * (0.38 + 0.62 * near), sweep));

  // Cut edge on the clip sphere |p| = R.
  float edge = pxLine((uRadius - r) / px, 1.3);
  color = mix(color, uBg, 0.85 * edge);

  color += vec3(0.16 * spec * uLight + 0.05 * rim);
  // Faint aerial perspective toward the paper (world z of the hit).
  float worldZ = uDistance + dw.z * t * uScale;
  float depth = clamp(0.5 + worldZ / uDepthSpan, 0.0, 1.0);
  color = mix(color, uBg, 0.14 * (1.0 - depth));
  return clamp(color, 0.0, 1.0);
}

void main() {
  // p5 world: +y points down the screen; gl_FragCoord counts from the bottom.
  vec2 frag = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 offsets[4] = vec2[4](vec2(0.125, 0.375), vec2(0.375, -0.125), vec2(-0.125, -0.375), vec2(-0.375, 0.125));
  vec3 accum = vec3(0.0);
  float cover = 0.0;
  float depthOut = 1.0;
  for (int i = 0; i < 4; i++) {
    if (i >= uSamples) break;
    vec2 pixel = frag + (uSamples == 1 ? vec2(0.0) : offsets[i]);
    vec3 dw = normalize(vec3(pixel - 0.5 * uResolution, -uDistance));
    vec3 rd = uInv * dw;
    float t = trace(uOrigin, rd);
    if (t < 0.0) continue;
    accum += shade(uOrigin + rd * t, rd, dw, t);
    cover += 1.0;
    float ze = dw.z * t * uScale;
    float ndc = (uFar + uNear) / (uFar - uNear) + 2.0 * uFar * uNear / ((uFar - uNear) * ze);
    depthOut = min(depthOut, 0.5 * ndc + 0.5);
  }
  if (cover == 0.0) discard;
  float samples = float(uSamples);
  gl_FragDepth = depthOut;
  // p5 BLEND is premultiplied.
  outColor = vec4(accum / samples, cover / samples);
}
`;

let canvasEl;
let grainPg;
let hudPg;
let surfaceShader;
let screenQuad;
let loopProgress = 0;
let phase = 0;
let muxer = null;
let encoder = null;
let isRecording = false;
let isFinalizing = false;
let recFrameCount = 0;

const sim = {
  paused: false,
  playhead: 0,
  dragYaw: 0,
  dragTilt: 0,
  layers: { circles: true, contours: true, guides: true, notes: true, math: true },
  frameCost: 0,
};

function setup() {
  createCanvas(W, H, WEBGL);
  // Multisampling for the guide strokes; size and density are untouched.
  setAttributes("antialias", true);
  canvasEl = drawingContext.canvas;
  pixelDensity(1);
  frameRate(FPS);
  colorMode(RGB, 255, 255, 255, 255);
  strokeCap(ROUND);
  grainPg = createGraphics(W, H);
  hudPg = createGraphics(W, H);
  for (const graphics of [grainPg, hudPg]) graphics.pixelDensity(1);
  bakeGrain();
  applyUrlParams();
  surfaceShader = createShader(SURFACE_VERTEX, SURFACE_FRAGMENT);
  screenQuad = buildScreenQuad();
  fitStage();
  bindUI();
  updateStaticUI();
  syncControls();
  if (auditParam !== null) window.barthAudit = runAudit();
  window.barth = { PARAMS, frameState, fit, computeFrameState, barthF, traceRay, poseMatrix, cameraInModel, projectToScreen, posePoint, setLoop, runAudit, NODES_INNER, NODES_OUTER };
}

// ================================================================
// ICOSAHEDRAL GUIDES — icosahedron (edge midpoints = 30 inner nodes) and the spin axis
// ================================================================

const guides = { key: "", edges: [], axis: null };

// Vertices in model space (alignment applied, fitted pixel scale); the pose is applied by p5 transforms.
function rebuildGuides() {
  const key = [presetIndex, PARAMS.radius, fit.scale].join();
  if (key === guides.key) return;
  const A = alignment(), s = fit.scale;
  const toModel = (q) => [dot(A[0], q) * s, dot(A[1], q) * s, dot(A[2], q) * s];
  guides.edges = ICOSA_EDGES.map(([i, j]) => [...toModel(ICOSA_VERTICES[i]), ...toModel(ICOSA_VERTICES[j])]);
  const [top, bottom] = axisEnds();
  guides.axis = [...toModel(top), ...toModel(bottom)];
  guides.key = key;
}

// Hidden-line drawing: a faint pass without the depth test, then the visible pass against the surface depth.
function drawGuides() {
  push();
  noFill();
  const gl = drawingContext;
  for (const visible of [false, true]) {
    if (visible) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
    stroke(INK.r, INK.g, INK.b, visible ? 150 : 40);
    strokeWeight(1.2);
    line(...guides.axis);
    if (sim.layers.guides) {
      stroke(MUTED.r, MUTED.g, MUTED.b, visible ? 230 : 70);
      strokeWeight(visible ? 1 : 0.8);
      for (const edge of guides.edges) line(...edge);
    }
  }
  gl.enable(gl.DEPTH_TEST);
  pop();
}

// ================================================================
// RENDERING
// ================================================================

function colorVector(colorValue) {
  return [colorValue.r / 255, colorValue.g / 255, colorValue.b / 255];
}

function qualitySetting() {
  return QUALITY[clamp(Math.round(PARAMS.quality), 1, QUALITY.length) - 1];
}

function renderFrame() {
  background(BG.r, BG.g, BG.b);
  computeFrameState(loopProgress);
  const free = !isRecording && !Number.isFinite(previewProgress);
  if (free) {
    frameState.yaw += sim.dragYaw;
    frameState.tilt += sim.dragTilt;
  }
  const distance = cameraDistance(), near = distance * 0.5, far = distance * 2;
  perspective(STAGE.fov, W / H, near, far);
  camera(0, 0, distance, 0, 0, 0, 0, 1, 0);

  const M = poseMatrix(), quality = qualitySetting();
  push();
  noStroke();
  shader(surfaceShader);
  surfaceShader.setUniform("uResolution", [W, H]);
  // Row-major M arrives column-major in GLSL, i.e. as Mᵀ = M⁻¹ (world → Barth).
  surfaceShader.setUniform("uInv", M.flat());
  surfaceShader.setUniform("uOrigin", cameraInModel(M));
  surfaceShader.setUniform("uDistance", distance);
  surfaceShader.setUniform("uScale", fit.scale);
  surfaceShader.setUniform("uNear", near);
  surfaceShader.setUniform("uFar", far);
  surfaceShader.setUniform("uDepthSpan", fit.depthSpan);
  surfaceShader.setUniform("uRadius", PARAMS.radius);
  surfaceShader.setUniform("uSteps", quality.steps);
  surfaceShader.setUniform("uSamples", quality.samples);
  surfaceShader.setUniform("uBg", colorVector(BG));
  surfaceShader.setUniform("uInk", colorVector(INK));
  surfaceShader.setUniform("uCharcoal", colorVector(CHARCOAL));
  surfaceShader.setUniform("uMuted", colorVector(MUTED));
  surfaceShader.setUniform("uCobalt", colorVector(COBALT));
  surfaceShader.setUniform("uKey", [-0.5 + frameState.light, -0.75, 0.62]);
  surfaceShader.setUniform("uLight", PARAMS.light);
  surfaceShader.setUniform("uContourStep", 1 / PARAMS.contours);
  surfaceShader.setUniform("uLevel", frameState.level);
  surfaceShader.setUniform("uContourOn", sim.layers.contours ? 1 : 0);
  surfaceShader.setUniform("uCircleOn", sim.layers.circles ? 1 : 0);
  model(screenQuad);
  resetShader();
  pop();

  rebuildGuides();
  push();
  translate(fit.tx, fit.ty, 0);
  rotateY(frameState.yaw);
  // Z (the symmetry axis) points up the screen, tipped toward the viewer by the elevation.
  rotateX(HALF_PI - frameState.tilt);
  rotateZ(frameState.spin);
  drawGuides();
  pop();
}

// ================================================================
// NODE MARKERS — the 50 finite nodes, ray-tested for visibility on the CPU (same stepper as the shader)
// ================================================================

const nodeScratch = { posed: [0, 0, 0], screen: [0, 0], dir: [0, 0, 0] };

function visibleNodes() {
  const M = poseMatrix(), origin = cameraInModel(M), steps = qualitySetting().steps;
  const result = [];
  const test = (node, outer) => {
    const d = nodeScratch.dir;
    for (let i = 0; i < 3; i++) d[i] = node[i] - origin[i];
    const distance = Math.hypot(d[0], d[1], d[2]);
    for (let i = 0; i < 3; i++) d[i] /= distance;
    if (Math.hypot(...node) > PARAMS.radius) return;
    const t = traceRay(origin, d, PARAMS.radius, steps);
    if (t >= 0 && t < distance - 0.03) return;
    projectToScreen(posePoint(node, nodeScratch.posed), nodeScratch.screen);
    result.push([nodeScratch.screen[0], nodeScratch.screen[1], outer]);
  };
  for (const node of NODES_INNER) test(node, false);
  for (const node of NODES_OUTER) test(node, true);
  return result;
}

function drawNodes(graphics) {
  if (!sim.layers.guides) return;
  graphics.noFill();
  for (const [x, y, outer] of visibleNodes()) {
    graphics.stroke(COBALT.r, COBALT.g, COBALT.b, 235);
    graphics.strokeWeight(1.4);
    graphics.circle(x, y, outer ? 16 : 11);
    if (outer) {
      graphics.line(x - 12, y, x - 5, y);
      graphics.line(x + 5, y, x + 12, y);
    }
  }
}

// Silhouette of the clip ball |p| = R: a sphere at distance D projects to a circle of radius D·Rs / √(D² − Rs²).
function drawClipCircle(graphics) {
  if (!sim.layers.guides) return;
  const distance = cameraDistance(), rs = PARAMS.radius * fit.scale;
  const radius = distance * rs / Math.sqrt(distance * distance - rs * rs);
  graphics.noFill();
  graphics.stroke(INK.r, INK.g, INK.b, 70);
  graphics.strokeWeight(0.8);
  graphics.circle(W / 2 + fit.tx, H / 2 + fit.ty, 2 * radius);
}

// ================================================================
// HUD — Neo-Swiss editorial layer (existing fonts and size scale: 72 / 34 / 28 / 26 / 23 / 22)
// ================================================================

function pad2(value) {
  return String(value).padStart(2, "0");
}

function spinLabel() {
  const turns = PARAMS.spinTurns, n = preset().order;
  if (turns === 0) return "0";
  const sign = turns < 0 ? "−" : "";
  const coefficient = Math.abs(turns) === 1 ? "" : `${Math.abs(turns)}·`;
  return `${sign}${coefficient}2πt / ${n}`;
}

function qualityLabel() {
  const quality = qualitySetting();
  return `Q${Math.round(PARAMS.quality)} ${quality.steps} STEPS × ${quality.samples}`;
}

function hudText() {
  return {
    header: "MATHEMATICAL STUDIES / 002",
    headerRight: `BARTH SEXTIC / 0${pad2(presetIndex + 1)}`,
    title: ["BARTH", "SEXTIC"],
    column: [
      ["ICOSAHEDRAL SINGULARITY", 26, INK],
      ["DEGREE / 06", 22, INK],
      ["SYMMETRY / ICOSAHEDRAL", 22, CHARCOAL],
      ["NODES / 65 = 50 + 15 AT ∞", 22, CHARCOAL],
    ],
    weierstrass: "SURFACE F(x, y, z) = 0",
    data: "F = 4P − (1+2φ)(r²−1)²",
    integral: "P = (φ²x²−y²)(φ²y²−z²)(φ²z²−x²)",
    legend: [
      [MUTED, "NODE CIRCLES / |p| = 1", "6 GREAT CIRCLES · 30 NODES"],
      [COBALT, "CONTOURS / |p| = const", `Δ = 1/${PARAMS.contours} · SWEEP r(t)`],
    ],
    citation: `φ = 1.6180339887 · |p| ≤ ${PARAMS.radius.toFixed(2)}`,
    citationRight: `${MAX_DURATION} S / ${LOOP_FRAMES} F`,
    axis: `${preset().label} AXIS`,
  };
}

function setType(graphics, font, style, size) {
  graphics.textFont(font);
  graphics.textStyle(style);
  graphics.textSize(size);
}

function fillColor(graphics, colorValue, alpha) {
  graphics.fill(colorValue.r, colorValue.g, colorValue.b, alpha);
}

function drawScreenFinish() {
  const graphics = hudPg;
  const text = hudText();
  graphics.clear();
  graphics.image(grainPg, 0, 0);
  drawCornerGuides(graphics);
  drawClipCircle(graphics);
  drawNodes(graphics);
  graphics.noStroke();

  // Header row + top rule.
  setType(graphics, "monospace", NORMAL, 22);
  graphics.textAlign(LEFT, TOP);
  fillColor(graphics, INK, 235);
  graphics.text(text.header, GRID.left, HUD.headerY);
  graphics.textAlign(RIGHT, TOP);
  graphics.text(text.headerRight, GRID.right, HUD.headerY);
  hairline(graphics, GRID.left, HUD.ruleTopY, GRID.right, HUD.ruleTopY, INK, 200, 1);

  // Title block, flush left on column 0.
  setType(graphics, "Georgia", BOLD, 72);
  graphics.textAlign(LEFT, TOP);
  fillColor(graphics, INK, 250);
  text.title.forEach((line, i) => graphics.text(line, GRID.left - 4, HUD.titleY + i * HUD.titleLead));

  // Technical column, flush left on column 7.
  if (sim.layers.notes) {
    text.column.forEach(([line, size, colorValue], i) => {
      setType(graphics, "monospace", NORMAL, size);
      fillColor(graphics, colorValue, 235);
      graphics.text(line, gridX(7), HUD.columnY + i * HUD.columnLead + (size === 26 ? 0 : 6));
    });
  }

  // Loop track.
  const progress = clamp(Math.round(loopProgress * LOOP_FRAMES) / (LOOP_FRAMES - 1), 0, 1);
  const indicatorX = GRID.left + (GRID.right - GRID.left) * progress;
  hairline(graphics, GRID.left, HUD.trackY, GRID.right, HUD.trackY, MUTED, 255, 1);
  hairline(graphics, GRID.left, HUD.trackY, indicatorX, HUD.trackY, INK, 230, 2);
  graphics.noStroke();
  fillColor(graphics, COBALT, 255);
  graphics.rect(indicatorX - 1, HUD.trackY - 7, 2, 14);
  setType(graphics, "monospace", NORMAL, 22);
  graphics.textAlign(LEFT, TOP);
  fillColor(graphics, CHARCOAL, 220);
  graphics.text(`t = ${progress.toFixed(3)}`, GRID.left, HUD.readoutY);
  graphics.textAlign(RIGHT, TOP);
  graphics.text(`θ(t) = ${spinLabel()}`, GRID.right, HUD.readoutY);

  drawRadiusRuler(graphics);
  drawAxisLabel(graphics, text.axis);
  drawRegistrationMark(graphics, GRID.right - 14, STAGE.top);
  drawRegistrationMark(graphics, gridX(0) + 14, HUD.ruleBottomY - 40);

  // Lower band: equations (columns 0–6) + legend (columns 7–11).
  hairline(graphics, GRID.left, HUD.ruleBottomY, GRID.right, HUD.ruleBottomY, INK, 200, 1);
  graphics.noStroke();
  graphics.textAlign(LEFT, TOP);
  setType(graphics, "monospace", NORMAL, 22);
  fillColor(graphics, CHARCOAL, 230);
  graphics.text(text.weierstrass, GRID.left, HUD.formulaY);
  setType(graphics, "monospace", NORMAL, 34);
  fillColor(graphics, COBALT, 255);
  graphics.text(text.data, GRID.left, HUD.formulaY + 32);
  setType(graphics, "monospace", NORMAL, 23);
  fillColor(graphics, INK, 235);
  graphics.text(text.integral, GRID.left, HUD.formulaY + 78);

  if (sim.layers.notes) {
    text.legend.forEach(([colorValue, label, detail], i) => {
      const y = HUD.formulaY + i * 52;
      hairline(graphics, gridX(7), y + 11, gridX(7) + 30, y + 11, colorValue, 255, colorValue === COBALT ? 2.4 : 2);
      graphics.noStroke();
      setType(graphics, "monospace", NORMAL, 22);
      fillColor(graphics, INK, 235);
      graphics.text(label, gridX(7) + 42, y);
      fillColor(graphics, CHARCOAL, 200);
      graphics.text(detail, gridX(7) + 42, y + 24);
    });
  }

  setType(graphics, "monospace", NORMAL, 22);
  fillColor(graphics, CHARCOAL, 200);
  graphics.textAlign(LEFT, TOP);
  graphics.text(text.citation, GRID.left, HUD.citationY);
  graphics.textAlign(RIGHT, TOP);
  graphics.text(text.citationRight, GRID.right, HUD.citationY);
  compositeHUD(graphics);
}

function hairline(graphics, x0, y0, x1, y1, colorValue, alpha, weight) {
  graphics.stroke(colorValue.r, colorValue.g, colorValue.b, alpha);
  graphics.strokeWeight(weight);
  graphics.line(x0, y0, x1, y1);
}

// |p| ruler: one tick per contour step, long ticks at the node radii 1 and √3, cobalt marker at the sweep.
function drawRadiusRuler(graphics) {
  const R = PARAMS.radius;
  const toY = (r) => RULER.bottom - (RULER.bottom - RULER.top) * r / R;
  hairline(graphics, RULER.x, RULER.top, RULER.x, RULER.bottom, INK, 200, 1);
  const step = 1 / PARAMS.contours;
  for (let k = 0; k * step <= R + 1e-9; k++) {
    hairline(graphics, RULER.x - RULER.tick, toY(k * step), RULER.x, toY(k * step), INK, 200, 1);
  }
  for (const r of [1, SQRT3]) {
    if (r > R) continue;
    hairline(graphics, RULER.x - 2 * RULER.tick, toY(r), RULER.x, toY(r), INK, 230, 1.4);
    graphics.noFill();
    graphics.stroke(COBALT.r, COBALT.g, COBALT.b, 235);
    graphics.strokeWeight(1.4);
    graphics.circle(RULER.x - 2 * RULER.tick - 8, toY(r), r === 1 ? 7 : 10);
  }
  graphics.noStroke();
  setType(graphics, "monospace", NORMAL, 22);
  fillColor(graphics, CHARCOAL, 220);
  graphics.textAlign(LEFT, BOTTOM);
  graphics.text("|p|", GRID.left, RULER.top - 12);
  graphics.textAlign(LEFT, TOP);
  graphics.text("0", GRID.left, RULER.bottom + 12);
  const y = toY(clamp(frameState.level, 0, R));
  hairline(graphics, RULER.x - 18, y, RULER.x + 18, y, COBALT, 255, 2.4);
  graphics.noStroke();
  fillColor(graphics, COBALT, 255);
  graphics.textAlign(LEFT, CENTER);
  graphics.text(frameState.level.toFixed(2), RULER.x + 24, y - 1);
}

// Label at the top of the symmetry axis, projected with the live pose.
const axisScratch = [[0, 0, 0], [0, 0, 0]];
const AXIS_LABEL = { dx: 8, dy: -2, height: 24 };

function axisLabelAnchor() {
  return projectToScreen(posePoint(axisEnds()[0], axisScratch[0]), axisScratch[1]);
}

function drawAxisLabel(graphics, label) {
  if (!sim.layers.notes) return;
  const screen = axisLabelAnchor();
  graphics.noStroke();
  setType(graphics, "monospace", NORMAL, 22);
  fillColor(graphics, INK, 230);
  graphics.textAlign(LEFT, BOTTOM);
  graphics.text(label, screen[0] + AXIS_LABEL.dx, screen[1] + AXIS_LABEL.dy);
}

function drawRegistrationMark(graphics, x, y) {
  graphics.noFill();
  graphics.stroke(INK.r, INK.g, INK.b, 170);
  graphics.strokeWeight(0.8);
  graphics.circle(x, y, 14);
  graphics.line(x - 13, y, x + 13, y);
  graphics.line(x, y - 13, x, y + 13);
}

// ================================================================
// AUDIT — ?audit=1 checks the polynomial against MathWorld's homogeneous form, the analytic gradient, the
// 50 finite + 15 infinite ordinary double points, icosahedral invariance, the icosahedron ↔ node alignment,
// the six great circles on |p| = 1, the ray stepper against a dense reference, framing, typography fit and
// the loop seam (report stored on window.barthAudit).
// ================================================================

function seededRandom(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function rotateAbout(axis, angle, p) {
  const u = normalize3(axis), c = Math.cos(angle), s = Math.sin(angle), d = dot(u, p), x = cross(u, p);
  return [0, 1, 2].map((i) => p[i] * c + x[i] * s + u[i] * d * (1 - c));
}

function hessianDet(f, p) {
  const h = 1e-4, n = p.length, H = [];
  for (let i = 0; i < n; i++) {
    H.push([]);
    for (let j = 0; j < n; j++) {
      const at = (a, b) => { const q = [...p]; q[i] += a; q[j] += b; return f(q); };
      H[i][j] = (at(h, h) - at(h, -h) - at(-h, h) + at(-h, -h)) / (4 * h * h);
    }
  }
  return H[0][0] * (H[1][1] * H[2][2] - H[1][2] * H[2][1]) - H[0][1] * (H[1][0] * H[2][2] - H[1][2] * H[2][0]) +
    H[0][2] * (H[1][0] * H[2][1] - H[1][1] * H[2][0]);
}

function auditGeometry() {
  const random = seededRandom(20261118);
  const report = { formulaMax: 0, gradRelMax: 0, symmetryMax: 0, finiteNodes: 0, nodeResidualMax: 0, nodeHessianMin: Infinity, infiniteNodes: 0, infiniteHessianMin: Infinity, icosaEdges: ICOSA_EDGES.length, icosaMidpointMax: 0, unitSphereMax: 0 };
  const g = [0, 0, 0];
  for (let s = 0; s < 400; s++) {
    const p = [0, 1, 2].map(() => 2.4 * (2 * random() - 1));
    const f = barthF(...p);
    report.formulaMax = Math.max(report.formulaMax, Math.abs(f - barthHomogeneous(...p, 1)) / Math.max(1, Math.abs(f)));
    barthGrad(...p, g);
    const h = 1e-6;
    const numeric = [0, 1, 2].map((i) => { const a = [...p], b = [...p]; a[i] += h; b[i] -= h; return (barthF(...a) - barthF(...b)) / (2 * h); });
    report.gradRelMax = Math.max(report.gradRelMax, Math.hypot(...numeric.map((v, i) => v - g[i])) / Math.max(1, Math.hypot(...g)));
    // Rotation group generators: five-fold about (φ, 1, 0), three-fold about (1, 1, 1), two-fold about z.
    for (const [axis, n] of [[[PHI, 1, 0], 5], [[1, 1, 1], 3], [[0, 0, 1], 2]]) {
      report.symmetryMax = Math.max(report.symmetryMax, Math.abs(barthF(...rotateAbout(axis, TAU / n, p)) - f) / Math.max(1, Math.abs(f)));
    }
    // On |p| = 1 the surface is the union of the six planes ⊥ the five-fold axes.
    const u = normalize3(p);
    const planes = PLANE_NORMALS.reduce((product, n) => product * dot(n, u), 1);
    report.unitSphereMax = Math.max(report.unitSphereMax, Math.abs(barthF(...u) - 4 * planes * Math.pow(PHI2 + 1, 3)));
  }
  const affine = (q) => barthF(q[0], q[1], q[2]);
  for (const node of [...NODES_INNER, ...NODES_OUTER]) {
    report.finiteNodes++;
    barthGrad(...node, g);
    report.nodeResidualMax = Math.max(report.nodeResidualMax, Math.abs(barthF(...node)), Math.hypot(...g));
    report.nodeHessianMin = Math.min(report.nodeHessianMin, Math.abs(hessianDet(affine, node)));
  }
  // Nodes at infinity: w = 0 on the line where two planes meet; Hessian taken in the chart of the largest coordinate.
  const normals = [[PHI, 1, 0], [PHI, -1, 0], [0, PHI, 1], [0, PHI, -1], [1, 0, PHI], [-1, 0, PHI]];
  for (let i = 0; i < 6; i++) {
    for (let j = i + 1; j < 6; j++) {
      const d = cross(normals[i], normals[j]);
      const m = [0, 1, 2].reduce((a, b) => Math.abs(d[b]) > Math.abs(d[a]) ? b : a);
      const others = [0, 1, 2].filter((k) => k !== m);
      const chart = ([a, b, w]) => {
        const P = [0, 0, 0];
        P[m] = 1; P[others[0]] = d[others[0]] / d[m] + a; P[others[1]] = d[others[1]] / d[m] + b;
        return barthHomogeneous(P[0], P[1], P[2], w);
      };
      const h = 1e-6, grad = [0, 1, 2].map((k) => { const a = [0, 0, 0], b = [0, 0, 0]; a[k] = h; b[k] = -h; return (chart(a) - chart(b)) / (2 * h); });
      if (Math.abs(chart([0, 0, 0])) < 1e-9 && Math.hypot(...grad) < 1e-6) report.infiniteNodes++;
      report.infiniteHessianMin = Math.min(report.infiniteHessianMin, Math.abs(hessianDet(chart, [0, 0, 0])));
    }
  }
  for (const [i, j] of ICOSA_EDGES) {
    const mid = ICOSA_VERTICES[i].map((v, k) => (v + ICOSA_VERTICES[j][k]) / 2);
    report.icosaMidpointMax = Math.max(report.icosaMidpointMax, Math.min(...NODES_INNER.map((n) => Math.hypot(...n.map((v, k) => v - mid[k])))));
  }
  const radii = { inner: NODES_INNER.every((n) => Math.abs(Math.hypot(...n) - 1) < 1e-12), outer: NODES_OUTER.every((n) => Math.abs(Math.hypot(...n) - SQRT3) < 1e-12) };
  report.radii = radii;
  report.ok = report.formulaMax < 1e-12 && report.gradRelMax < 1e-6 && report.symmetryMax < 1e-9 && report.finiteNodes === 50 &&
    report.nodeResidualMax < 1e-9 && report.nodeHessianMin > 1 && report.infiniteNodes === 15 && report.infiniteHessianMin > 1 &&
    report.icosaEdges === 30 && report.icosaMidpointMax < 1e-12 && report.unitSphereMax < 1e-9 && radii.inner && radii.outer;
  return report;
}

// Ray stepper vs. a dense uniform reference (20 000 samples per chord), including rays aimed at nodes.
function auditStepper() {
  const random = seededRandom(1118);
  const R = PARAMS.radius, steps = qualitySetting().steps;
  const dense = (ro, rd) => {
    const b = dot(ro, rd), c = dot(ro, ro) - R * R, h = b * b - c;
    if (h <= 0) return -1;
    const t0 = -b - Math.sqrt(h), t1 = -b + Math.sqrt(h), n = 20000, dt = (t1 - t0) / n;
    const at = (t) => barthF(ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t);
    let ta = t0, fa = at(t0);
    for (let i = 1; i <= n; i++) {
      const tb = t0 + dt * i, fb = at(tb);
      if ((fa < 0) !== (fb < 0)) {
        let lo = ta, hi = tb, flo = fa;
        for (let j = 0; j < 30; j++) { const m = 0.5 * (lo + hi), fm = at(m); if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m; }
        return 0.5 * (lo + hi);
      }
      ta = tb; fa = fb;
    }
    return -1;
  };
  const result = { rays: 0, wrong: 0, nodeRays: 0, nodeWrong: 0, depthErrMax: 0 };
  for (let s = 0; s < 1600; s++) {
    const th = Math.acos(2 * random() - 1), ph = TAU * random();
    const ro = [8 * Math.sin(th) * Math.cos(ph), 8 * Math.sin(th) * Math.sin(ph), 8 * Math.cos(th)];
    const aimNode = s % 2 === 1;
    const nodes = s % 4 === 1 ? NODES_INNER : NODES_OUTER;
    const target = aimNode ? nodes[Math.floor(random() * nodes.length)].map((v) => v + 0.01 * (2 * random() - 1)) : [0, 1, 2].map(() => R * (2 * random() - 1));
    const rd = normalize3(target.map((v, i) => v - ro[i]));
    const ref = dense(ro, rd), got = traceRay(ro, rd, R, steps);
    if (ref < 0 && got < 0) continue;
    result.rays++;
    if (aimNode) result.nodeRays++;
    const bad = ref < 0 || got < 0 || Math.abs(got - ref) > 1e-3;
    if (bad) { result.wrong++; if (aimNode) result.nodeWrong++; } else result.depthErrMax = Math.max(result.depthErrMax, Math.abs(got - ref));
  }
  result.randomWrongPct = 100 * (result.wrong - result.nodeWrong) / Math.max(1, result.rays - result.nodeRays);
  result.nodeWrongPct = 100 * result.nodeWrong / Math.max(1, result.nodeRays);
  result.ok = result.randomWrongPct < 0.5 && result.nodeWrongPct < 3 && result.depthErrMax < 1e-4;
  return result;
}

function auditTypography() {
  const graphics = hudPg;
  const text = hudText();
  const measure = (font, style, size, line) => {
    setType(graphics, font, style, size);
    return graphics.textWidth(line);
  };
  const title = Math.max(...text.title.map((line) => measure("Georgia", BOLD, 72, line)));
  const column = Math.max(...text.column.map(([line, size]) => measure("monospace", NORMAL, size, line)));
  const legend = 42 + Math.max(...text.legend.map(([, label, detail]) => Math.max(measure("monospace", NORMAL, 22, label), measure("monospace", NORMAL, 22, detail))));
  const integral = measure("monospace", NORMAL, 23, text.integral);
  const data = measure("monospace", NORMAL, 34, text.data);
  const label = measure("monospace", NORMAL, 22, text.weierstrass);
  const citation = measure("monospace", NORMAL, 22, text.citation) + 24 + measure("monospace", NORMAL, 22, text.citationRight);
  const header = measure("monospace", NORMAL, 22, text.header) + 24 + measure("monospace", NORMAL, 22, text.headerRight);
  return {
    titleRight: Math.round(GRID.left + title),
    columnLeft: gridX(7),
    columnRight: Math.round(gridX(7) + column),
    legendRight: Math.round(gridX(7) + legend),
    lowerLeftRight: Math.round(GRID.left + Math.max(integral, data, label)),
    citationWidth: Math.round(citation),
    headerWidth: Math.round(header),
    axisLabelWidth: Math.round(measure("monospace", NORMAL, 22, text.axis)),
    available: GRID.right - GRID.left,
  };
}

function runAudit() {
  const t0 = performance.now();
  const report = { geometry: auditGeometry(), stepper: auditStepper(), typography: auditTypography(), framing: null, loop: null };
  const framing = { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity, labelTop: Infinity, labelRight: -Infinity };
  const posed = [0, 0, 0], screen = [0, 0];
  let previous = null, first = null, maxInteriorStep = 0;
  // Symmetry-reduced pose: the image depends on the spin only modulo 2π/n.
  const n = preset().order;
  const snapshot = () => [
    Math.cos(n * frameState.spin), Math.sin(n * frameState.spin), frameState.tilt, frameState.yaw,
    frameState.level, frameState.light,
  ];
  const step = (p, q) => Math.max(...p.map((value, i) => Math.abs(value - q[i])));
  for (let frame = 0; frame < LOOP_FRAMES; frame++) {
    computeFrameState(frame / LOOP_FRAMES);
    const current = snapshot();
    if (previous) maxInteriorStep = Math.max(maxInteriorStep, step(current, previous));
    else first = current;
    previous = current;
    if (frame % 6 !== 0) continue;
    forEachExtremePoint((point) => {
      projectToScreen(posePoint(point, posed), screen);
      framing.top = Math.min(framing.top, Math.round(screen[1]));
      framing.bottom = Math.max(framing.bottom, Math.round(screen[1]));
      framing.left = Math.min(framing.left, Math.round(screen[0]));
      framing.right = Math.max(framing.right, Math.round(screen[0]));
    });
    const anchor = axisLabelAnchor();
    framing.labelTop = Math.min(framing.labelTop, Math.round(anchor[1] + AXIS_LABEL.dy - AXIS_LABEL.height));
    framing.labelRight = Math.max(framing.labelRight, Math.round(anchor[0] + AXIS_LABEL.dx + report.typography.axisLabelWidth));
  }
  framing.clearsTop = framing.top > HUD.readoutY + 40 && framing.labelTop > HUD.readoutY + 32;
  framing.clearsBottom = framing.bottom < HUD.ruleBottomY - 12;
  framing.clearsRuler = framing.left > RULER.x + 24;
  framing.clearsRight = framing.right <= GRID.right + 4 && framing.labelRight <= GRID.right;
  report.framing = framing;
  report.loop = {
    frames: LOOP_FRAMES,
    seconds: LOOP_FRAMES / FPS,
    seamStep: step(first, previous),
    maxInteriorStep,
    auditMs: performance.now() - t0,
  };
  const ty = report.typography;
  report.ok = report.geometry.ok && report.stepper.ok &&
    framing.clearsTop && framing.clearsBottom && framing.clearsRuler && framing.clearsRight &&
    ty.titleRight < ty.columnLeft - 24 && ty.columnRight <= GRID.right && ty.legendRight <= GRID.right &&
    ty.lowerLeftRight < ty.columnLeft - 16 && ty.citationWidth <= ty.available && ty.headerWidth <= ty.available &&
    report.loop.seamStep <= report.loop.maxInteriorStep * 1.01;
  console.log("[barth audit]", JSON.stringify(report, null, 2));
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

// ?preset=2&R=2.1&q=1&contours=6 — handy for stills, shader checks and headless probes.
function applyUrlParams() {
  const index = Number(urlParam("preset")) - 1;
  if (urlParam("preset") !== null && PRESETS[index]) presetIndex = index;
  const numeric = (name, key) => {
    const value = Number(urlParam(name));
    if (urlParam(name) !== null && Number.isFinite(value)) PARAMS[key] = value;
  };
  numeric("R", "radius");
  numeric("q", "quality");
  numeric("contours", "contours");
  numeric("dist", "distance");
  numeric("tilt", "tilt");
  numeric("spin", "spinTurns");
  numeric("light", "light");
  if (urlParam("notes") === "0") sim.layers.notes = false;
  sanitizeParams();
}

function sanitizeParams() {
  PARAMS.radius = clamp(PARAMS.radius, 1.8, 2.4);
  PARAMS.quality = clamp(Math.round(PARAMS.quality), 1, QUALITY.length);
  PARAMS.contours = clamp(Math.round(PARAMS.contours), 2, 8);
  PARAMS.distance = clamp(PARAMS.distance, 1, 1.4);
  PARAMS.tilt = clamp(PARAMS.tilt, 0.1, 0.8);
  PARAMS.spinTurns = clamp(Math.round(PARAMS.spinTurns), -2, 2);
  PARAMS.light = clamp(PARAMS.light, 0.4, 1.6);
}

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

const SLIDERS = {
  radiusSlider: ["radius", (v) => `|p| ≤ ${v.toFixed(2)}`],
  qualitySlider: ["quality", (v) => { const q = QUALITY[v - 1]; return `${q.steps} steps × ${q.samples}`; }],
  contourSlider: ["contours", (v) => `Δ = 1/${v.toFixed(0)}`],
  distanceSlider: ["distance", (v) => `${v.toFixed(2)} ×`],
  tiltSlider: ["tilt", (v) => `${(v * 180 / Math.PI).toFixed(0)}°`],
  spinSlider: ["spinTurns", (v) => `${v.toFixed(0)} × 2π/${preset().order}`],
  lightSlider: ["light", (v) => v.toFixed(2)],
};

function applyParams() {
  sanitizeParams();
  fitStage();
  syncControls();
}

function bindUI() {
  const startButton = getElement("startBtn");
  const stopButton = getElement("stopBtn");
  if (startButton) startButton.onclick = startRecording;
  if (stopButton) stopButton.onclick = stopRecording;

  for (const [id, [key]] of Object.entries(SLIDERS)) {
    const element = getElement(id);
    if (!element) continue;
    element.oninput = () => {
      PARAMS[key] = Number(element.value);
      applyParams();
    };
  }
  const onClick = (id, handler) => {
    const element = getElement(id);
    if (element) element.onclick = handler;
  };
  PRESETS.forEach((item, index) => onClick(`preset-${item.key}`, () => selectPreset(index)));
  onClick("pauseBtn", togglePause);
  onClick("resetBtn", resetSimulator);
  for (const [id, layer] of Object.entries(TOGGLES)) {
    const element = getElement(id);
    if (element) element.onchange = () => {
      sim.layers[layer] = element.checked;
      syncControls();
    };
  }
}

const TOGGLES = { showCircles: "circles", showContours: "contours", showGuides: "guides", showNotes: "notes", showMath: "math" };
const DEFAULT_PARAMS = { ...PARAMS };
const DEFAULT_PRESET = presetIndex;

function selectPreset(index) {
  if (isRecording) return;
  presetIndex = index;
  applyParams();
}

function togglePause() {
  if (isRecording) return;
  sim.paused = !sim.paused;
  syncControls();
}

function resetSimulator() {
  if (isRecording) return;
  Object.assign(PARAMS, DEFAULT_PARAMS);
  presetIndex = DEFAULT_PRESET;
  Object.assign(sim, { paused: false, playhead: 0, dragYaw: 0, dragTilt: 0 });
  for (const layer of Object.keys(sim.layers)) sim.layers[layer] = true;
  for (const id of Object.keys(TOGGLES)) {
    const element = getElement(id);
    if (element) element.checked = true;
  }
  applyParams();
}

const CONTROL_IDS = [
  ...Object.keys(SLIDERS),
  ...PRESETS.map((item) => `preset-${item.key}`),
  "pauseBtn", "resetBtn", ...Object.keys(TOGGLES),
];

function syncControls() {
  for (const [id, [key, format]] of Object.entries(SLIDERS)) {
    const element = getElement(id);
    if (element) element.value = PARAMS[key];
    setText(id.replace("Slider", "Value"), format(PARAMS[key]));
  }
  PRESETS.forEach((item, index) => {
    const element = getElement(`preset-${item.key}`);
    if (element) element.style.borderColor = index === presetIndex ? "rgba(255,255,255,0.6)" : "";
  });
  setText("pauseBtn", sim.paused ? "Play" : "Pause");
  const math = getElement("math");
  if (math) math.hidden = !sim.layers.math;
  for (const id of CONTROL_IDS) setDisabled(id, isRecording);
}

function updateLiveUI() {
  if (frameCount % 6 !== 0 || !sim.layers.math) return;
  const p = preset();
  setText("phiInfo", `φ = ${PHI.toFixed(10)} · 1 + 2φ = ${BARTH_K.toFixed(6)}`);
  setText("nodesValue", `30 @ |p| = 1 · 20 @ √3 · 15 at ∞ (not drawn)`);
  setText("levelValue", `|p| = ${frameState.level.toFixed(3)}`);
  setText("rayValue", `${p.label} view · ${qualityLabel().toLowerCase()} · 1 surface pass`);
  setText("costValue", `${sim.frameCost.toFixed(1)} ms CPU · ${frameRate().toFixed(0)} fps`);
}

function updateStaticUI() {
  setText("maxDuration", MAX_DURATION);
  setText("canvasSize", `${W} × ${H}`);
  setText("maxFrames", MAX_FRAMES);
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
    if (!sim.paused) sim.playhead++;
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
  sim.dragYaw += movedX * 0.005;
  sim.dragTilt = clamp(sim.dragTilt + movedY * 0.004, -0.6, 0.9);
  return false;
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
    saveCanvas(`barth_sextic_${getTimestamp()}`, "png");
    return false;
  }
  if (key === "p" || key === "P") {
    togglePause();
    return false;
  }
  const digit = Number(key);
  if (digit >= 1 && digit <= PRESETS.length) {
    selectPreset(digit - 1);
    return false;
  }
  return true;
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

// ================================================================
// SCREEN FINISH — paper grain, corner guides and HUD composite
// ================================================================

// Dark specks at very low alpha: print grain on off-white paper.
function bakeGrain() {
  grainPg.clear();
  grainPg.noStroke();
  randomSeed(20260904);
  const subtleCount = Math.floor(W * H * 0.0016);
  for (let i = 0; i < subtleCount; i++) {
    const value = random(40, 110);
    grainPg.fill(value, value, value, random(2, 6));
    grainPg.circle(random(W), random(H), random(0.15, 0.85));
  }
  const darkCount = Math.floor(W * H * 0.000035);
  for (let i = 0; i < darkCount; i++) {
    const value = random(10, 60);
    grainPg.fill(value, value, value, random(8, 20));
    grainPg.circle(random(W), random(H), random(0.4, 1.2));
  }
}

function drawCornerGuides(graphics) {
  graphics.noFill();
  graphics.stroke(INK.r, INK.g, INK.b, 110);
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

// ================================================================
// RECORDING — retained mp4-muxer + WebCodecs pipeline
// ================================================================

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
    anchor.download = `barth_sextic_${getTimestamp()}.mp4`;
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
  // mp4-muxer rejects chunks without a duration; same frame duration as the series' capture.js.
  const frame = new VideoFrame(canvasEl, { timestamp, duration: Math.round(1_000_000 / FPS) });
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
