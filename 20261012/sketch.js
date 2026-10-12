"use strict";

// SPHERICAL HARMONICS — A SCULPTURE FROM ONE EQUATION
// Real spherical harmonics Yₗᵐ(θ, φ) = Nₗₘ · Pₗ^|m|(cos θ) · Aₘ(φ), with
// Nₗₘ = √((2l + 1) / 4π · (l − |m|)! / (l + |m|)!), A₀ = 1, Aₘ = √2 cos mφ (m > 0),
// Aₘ = √2 sin |m|φ (m < 0); no Condon–Shortley phase. The surface is the radial graph
//   r(θ, φ, t) = R · [1 + a · F(θ, φ, t)],   F = Σ wₖ(t) · cₖ · Yₗₖᵐₖ,
// where l and m stay integers and only the weights wₖ(t) morph. Every structure is
// rescaled so max |F| ≤ 1 and the weights are convex, so r ≥ R(1 − a) > 0 always.
// Evaluation uses the Cartesian form sinᵐθ · e^{imφ} = (x + iy)ᵐ, which is a polynomial
// in the unit direction: no pole singularity and no longitude seam.

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

// Adjustable parameters. Integer l, m only ever select a harmonic; nothing
// interpolates them. R is clamped so R(1 + a) stays inside the stage.
const PARAMS = {
  l: 6,
  m: 5,
  mix: 0,
  radius: 262,
  amplitude: 0.5,
  rows: 150,
  spinTurns: 1,
  light: 1,
};

const LIMITS = {
  maxL: 16,
  minRadius: 140,
  maxAmplitude: 0.7,
  minRows: 48,
  maxRows: 180,
  terms: 16,
};

// Stage: the sculpture's bounding ball R(1 + a) must clear the progress track
// (y 418) and the captions (y 1322); the camera maps z = 0 one unit per pixel.
const STAGE = {
  centerY: 872,
  boundRadius: 400,
  fov: 0.5,
  tilt: 0.78,
  tiltSwing: 0.05,
  yawSwing: 0.07,
  breath: 0.06,
};

const DEG = 180 / Math.PI;

// ================================================================
// REAL SPHERICAL HARMONICS — the same algorithm runs here and in GLSL
// ================================================================

function factorial(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

function doubleFactorial(n) {
  let f = 1;
  for (let i = n; i > 1; i -= 2) f *= i;
  return f;
}

// Nₗₘ · (2|m| − 1)!! · (√2 for m ≠ 0): the reduced Legendre recurrence below
// starts at 1 instead of (2|m| − 1)!!, and (x + iy)ᵐ already carries sinᵐθ.
function harmonicConstant(l, m) {
  const a = Math.abs(m);
  const n = Math.sqrt((2 * l + 1) / (4 * Math.PI) * factorial(l - a) / factorial(l + a));
  return n * doubleFactorial(2 * a - 1) * (m === 0 ? 1 : Math.SQRT2);
}

// Qₗᵐ(z) = (dᵐPₗ / dzᵐ)(z) / (2m − 1)!!, so Pₗᵐ = (2m − 1)!! · sinᵐθ · Qₗᵐ.
function reducedLegendre(l, a, z) {
  if (l === a) return 1;
  let q0 = 1;
  let q1 = (2 * a + 1) * z;
  for (let k = a + 2; k <= l; k++) {
    const q2 = ((2 * k - 1) * z * q1 - (k + a - 1) * q0) / (k - a);
    q0 = q1;
    q1 = q2;
  }
  return q1;
}

// Unit-direction form used everywhere the sculpture is evaluated.
function harmonicAt(l, m, x, y, z) {
  const a = Math.abs(m);
  let re = 1;
  let im = 0;
  for (let k = 0; k < a; k++) {
    const next = re * x - im * y;
    im = re * y + im * x;
    re = next;
  }
  const angular = m > 0 ? re : m < 0 ? im : 1;
  return harmonicConstant(l, m) * reducedLegendre(l, a, z) * angular;
}

// Textbook (θ, φ) form — the audit's independent reference.
function harmonicSpherical(l, m, theta, phi) {
  const a = Math.abs(m);
  const z = Math.cos(theta);
  const s = Math.sin(theta);
  let pmm = 1;
  for (let k = 1; k <= a; k++) pmm *= (2 * k - 1) * s;
  let p = pmm;
  if (l > a) {
    let p0 = pmm;
    let p1 = z * (2 * a + 1) * pmm;
    for (let k = a + 2; k <= l; k++) {
      const p2 = ((2 * k - 1) * z * p1 - (k + a - 1) * p0) / (k - a);
      p0 = p1;
      p1 = p2;
    }
    p = p1;
  }
  const n = Math.sqrt((2 * l + 1) / (4 * Math.PI) * factorial(l - a) / factorial(l + a));
  const angular = m > 0 ? Math.SQRT2 * Math.cos(a * phi) : m < 0 ? Math.SQRT2 * Math.sin(a * phi) : 1;
  return n * p * angular;
}

// ================================================================
// STRUCTURES — symmetric combinations of integer (l, m) harmonics
// ================================================================

// Point-group invariants with the 4-fold (cubic) or 5-fold (icosahedral) axis
// on z, solved by least squares over random rotations; residual ~1e-15.
const CUBIC_4 = [[4, 0, 1], [4, 4, Math.sqrt(5 / 7)]];
const CUBIC_6 = [[6, 0, 1], [6, 4, -Math.sqrt(7)]];
const ICOSA_6 = [[6, 0, 1], [6, 5, Math.sqrt(14 / 11)]];
const ICOSA_10 = [[10, 0, 1], [10, 5, -2.253202848596433], [10, 10, 1.2305161683154886]];
const ICOSA_12 = [[12, 0, 1], [12, 5, 0.7308079766848337], [12, 10, 1.1763305238752242]];
const ICOSA_16 = [[16, 0, 1], [16, 5, -1.0442511797052392], [16, 10, -1.341885946992828], [16, 15, 1.040617184961247]];

// Unit L² norm per invariant, then a weighted sum.
function combine(...parts) {
  const terms = [];
  for (const [weight, invariant] of parts) {
    const norm = Math.sqrt(invariant.reduce((sum, term) => sum + term[2] * term[2], 0));
    for (const [l, m, c] of invariant) terms.push([l, m, weight * c / norm]);
  }
  return terms;
}

const STRUCTURES = [
  {
    key: "flower",
    name: "FLOWER",
    detail: "8-FOLD CROWN",
    formula: "F ∝ Y₈⁸ + 0.55·Y₉⁸ + 0.45·Y₄⁰",
    terms: [[8, 8, 1], [9, 8, 0.55], [4, 0, 0.45]],
  },
  {
    key: "cubic",
    name: "CUBIC",
    detail: "l = 4 + 6 · Oₕ",
    formula: "K₄ ∝ Y₄⁰ + √(5/7)·Y₄⁴",
    terms: combine([0.78, CUBIC_4], [0.62, CUBIC_6]),
  },
  {
    key: "icosa",
    name: "ICOSAHEDRAL",
    detail: "l = 6 + 10 · Iₕ",
    formula: "I₆ ∝ Y₆⁰ + √(14/11)·Y₆⁵",
    terms: combine([0.8, ICOSA_6], [0.6, ICOSA_10]),
  },
  {
    key: "urchin",
    name: "HIGH FREQUENCY",
    detail: "l = 12 + 16 · Iₕ",
    formula: "I₁₆ = Y₁₆⁰ + Σ c·Y₁₆⁵ᵏ",
    terms: combine([0.42, ICOSA_12], [0.9, ICOSA_16]),
  },
];

// Presets A–D. A–C hold one structure; D morphs through all four.
const PRESETS = [
  { key: "morph", label: "D · Morph", sequence: [0, 1, 2, 3] },
  { key: "icosa", label: "A · Organic", sequence: [2] },
  { key: "flower", label: "B · Flower", sequence: [0] },
  { key: "urchin", label: "C · Intricate", sequence: [3] },
  { key: "cubic", label: "Cubic", sequence: [1] },
];

// Morph timeline (loop progress 0..1). The 9 s beat sheet is stretched over the
// existing 10 s recording: hold the opening structure, three increasingly
// complex states, a long return, and the exact opening state at the end.
const MORPH = [
  [0.00, 0],
  [0.06, 0],
  [0.20, 1],
  [0.27, 1],
  [0.37, 2],
  [0.45, 2],
  [0.56, 3],
  [0.67, 3],
  [0.89, 0],
  [1.00, 0],
];

// Hook captions, timed to the morph holds.
const OVERLAY = {
  hook: true,
  captions: [
    { window: null, first: "NO NOISE. ONLY HARMONICS.", second: "r = R · [1 + a · Σ c · Yₗᵐ]" },
    { window: [0.19, 0.21, 0.26, 0.28], first: "CUBIC INVARIANT", second: "Y₄⁰ + √(5/7)·Y₄⁴ · Y₆⁰ − √7·Y₆⁴" },
    { window: [0.36, 0.38, 0.44, 0.46], first: "ICOSAHEDRAL INVARIANT", second: "Y₆⁰ + √(14/11)·Y₆⁵" },
    { window: [0.55, 0.57, 0.65, 0.67], first: "DEGREE 16 · 12 FIVEFOLD AXES", second: "HIGHER l → FINER STRUCTURE" },
    { window: [0.71, 0.73, 0.84, 0.86], first: "l AND m STAY INTEGERS", second: "ONLY THE WEIGHTS MORPH" },
  ],
};

// max |F| of each structure, sampled on a Fibonacci sphere with a small margin
// so the rescaled field satisfies |F| ≤ 1 between samples too.
const SCALE_SAMPLES = 60000;
const SCALE_MARGIN = 1.015;
const scaleCache = new Map();

function fieldOfTerms(terms, x, y, z) {
  let f = 0;
  for (const [l, m, c] of terms) f += c * harmonicAt(l, m, x, y, z);
  return f;
}

function fibonacciPoint(i, n, out) {
  const z = 1 - 2 * (i + 0.5) / n;
  const s = Math.sqrt(1 - z * z);
  const a = i * Math.PI * (3 - Math.sqrt(5));
  out[0] = s * Math.cos(a);
  out[1] = s * Math.sin(a);
  out[2] = z;
  return out;
}

function structureScale(terms) {
  const key = terms.map((t) => t.join(",")).join(";");
  if (scaleCache.has(key)) return scaleCache.get(key);
  const d = [0, 0, 0];
  let peak = 0;
  for (let i = 0; i < SCALE_SAMPLES; i++) {
    fibonacciPoint(i, SCALE_SAMPLES, d);
    peak = Math.max(peak, Math.abs(fieldOfTerms(terms, d[0], d[1], d[2])));
  }
  const scale = peak > 0 ? 1 / (peak * SCALE_MARGIN) : 0;
  scaleCache.set(key, scale);
  return scale;
}

// ================================================================
// FRAME STATE — a pure function of loop progress, shared by draw and audit
// ================================================================

const frameState = {
  count: 0,
  L: new Float32Array(LIMITS.terms),
  M: new Float32Array(LIMITS.terms),
  K: new Float32Array(LIMITS.terms),
  coef: new Float64Array(LIMITS.terms),
  weights: new Float64Array(STRUCTURES.length),
  amplitude: 0,
  radius: 0,
  spin: 0,
  tilt: 0,
  yaw: 0,
  dominant: 0,
  holding: true,
};

let presetIndex = 0;

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

// Structure weights: convex, C² crossfades between consecutive keys.
function structureWeights(p, out) {
  out.fill(0);
  const sequence = PRESETS[presetIndex].sequence;
  if (sequence.length === 1) {
    out[sequence[0]] = 1;
    return true;
  }
  for (let i = 1; i < MORPH.length; i++) {
    if (p <= MORPH[i][0]) {
      const [p0, s0] = MORPH[i - 1];
      const [p1, s1] = MORPH[i];
      const t = smootherstep(clamp((p - p0) / (p1 - p0), 0, 1));
      out[sequence[s0]] += 1 - t;
      out[sequence[s1]] += t;
      return s0 === s1;
    }
  }
  out[sequence[0]] = 1;
  return true;
}

function effectiveRadius() {
  return Math.min(PARAMS.radius, STAGE.boundRadius / (1 + PARAMS.amplitude));
}

function pushTerm(l, m, c) {
  if (Math.abs(c) < 1e-9) return;
  for (let k = 0; k < frameState.count; k++) {
    if (frameState.L[k] === l && frameState.M[k] === m) {
      frameState.coef[k] += c;
      frameState.K[k] = frameState.coef[k] * harmonicConstant(l, m);
      return;
    }
  }
  if (frameState.count >= LIMITS.terms) return;
  const k = frameState.count++;
  frameState.L[k] = l;
  frameState.M[k] = m;
  frameState.coef[k] = c;
  frameState.K[k] = c * harmonicConstant(l, m);
}

function computeFrameState(p) {
  const phase = p * TAU;
  frameState.holding = structureWeights(p, frameState.weights);
  frameState.count = 0;
  const keep = 1 - PARAMS.mix;
  let best = 0;
  for (let s = 0; s < STRUCTURES.length; s++) {
    const w = frameState.weights[s] * keep;
    if (frameState.weights[s] > frameState.weights[best]) best = s;
    if (w <= 0) continue;
    const terms = STRUCTURES[s].terms;
    const scale = structureScale(terms);
    for (const [l, m, c] of terms) pushTerm(l, m, w * scale * c);
  }
  frameState.dominant = best;
  if (PARAMS.mix > 0) {
    const custom = [[PARAMS.l, PARAMS.m, 1]];
    pushTerm(PARAMS.l, PARAMS.m, PARAMS.mix * structureScale(custom));
  }
  for (let k = frameState.count; k < LIMITS.terms; k++) {
    frameState.L[k] = 0;
    frameState.M[k] = 0;
    frameState.K[k] = 0;
  }
  // Breathing only ever lowers a, so the clipping bound R(1 + a) still holds.
  frameState.amplitude = PARAMS.amplitude * (1 - STAGE.breath * (0.5 - 0.5 * Math.cos(2 * phase)));
  frameState.radius = effectiveRadius();
  frameState.spin = PARAMS.spinTurns * phase;
  frameState.tilt = STAGE.tilt + STAGE.tiltSwing * Math.sin(phase);
  frameState.yaw = STAGE.yawSwing * Math.sin(phase + 0.7);
}

// Same F the shader sees (unit direction in the harmonic frame).
function frameField(x, y, z) {
  let f = 0;
  for (let k = 0; k < frameState.count; k++) {
    const l = frameState.L[k];
    const m = frameState.M[k];
    f += frameState.coef[k] * harmonicAt(l, m, x, y, z);
  }
  return f;
}

// ================================================================
// SURFACE MESH + SHADERS
// ================================================================

// Unit-direction lattice: one vertex per pole, rows − 1 latitude rings of
// 2·rows longitudes, faces wrap the last column onto the first (no seam).
function buildSphereMesh(rows) {
  const cols = 2 * rows;
  const geometry = new p5.Geometry();
  geometry.gid = `harmonic-sphere-${rows}`;
  geometry.vertices.push(new p5.Vector(0, 0, 1));
  for (let i = 1; i < rows; i++) {
    const theta = i / rows * Math.PI;
    const s = Math.sin(theta);
    const z = Math.cos(theta);
    for (let j = 0; j < cols; j++) {
      const phi = j / cols * TAU;
      geometry.vertices.push(new p5.Vector(s * Math.cos(phi), s * Math.sin(phi), z));
    }
  }
  const south = geometry.vertices.length;
  geometry.vertices.push(new p5.Vector(0, 0, -1));
  const ring = (i, j) => 1 + (i - 1) * cols + (j % cols);
  for (let j = 0; j < cols; j++) {
    geometry.faces.push([0, ring(1, j), ring(1, j + 1)]);
    geometry.faces.push([south, ring(rows - 1, j + 1), ring(rows - 1, j)]);
  }
  for (let i = 1; i < rows - 1; i++) {
    for (let j = 0; j < cols; j++) {
      const a = ring(i, j);
      const b = ring(i, j + 1);
      const c = ring(i + 1, j + 1);
      const d = ring(i + 1, j);
      geometry.faces.push([a, d, c], [a, c, b]);
    }
  }
  return geometry;
}

const SURFACE_VERTEX = `#version 300 es
precision highp float;
in vec3 aPosition;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uL[${LIMITS.terms}];
uniform float uM[${LIMITS.terms}];
uniform float uK[${LIMITS.terms}];
uniform int uCount;
uniform float uRadius;
uniform float uAmp;
out vec3 vNormal;
out vec3 vEye;
out float vField;

// Line-by-line port of harmonicAt(): Kₗₘ · Qₗ^|m|(z) · {Re, Im}(x + iy)^|m|.
float harmonicField(vec3 d) {
  float f = 0.0;
  for (int t = 0; t < ${LIMITS.terms}; t++) {
    if (t >= uCount) break;
    int l = int(uL[t] + 0.5);
    int m = int(uM[t] + (uM[t] < 0.0 ? -0.5 : 0.5));
    int a = abs(m);
    float q = 1.0;
    if (l > a) {
      float q0 = 1.0;
      float q1 = float(2 * a + 1) * d.z;
      for (int k = a + 2; k <= l; k++) {
        float q2 = (float(2 * k - 1) * d.z * q1 - float(k + a - 1) * q0) / float(k - a);
        q0 = q1;
        q1 = q2;
      }
      q = q1;
    }
    float re = 1.0;
    float im = 0.0;
    for (int k = 0; k < a; k++) {
      float next = re * d.x - im * d.y;
      im = re * d.y + im * d.x;
      re = next;
    }
    f += uK[t] * q * (m > 0 ? re : (m < 0 ? im : 1.0));
  }
  return f;
}

vec3 surfacePoint(vec3 d) {
  d = normalize(d);
  return d * (1.0 + uAmp * harmonicField(d));
}

void main() {
  vec3 d = normalize(aPosition);
  float f = harmonicField(d);
  vec3 p = d * uRadius * (1.0 + uAmp * f);
  // Central differences along a tangent frame of the unit sphere; the frame
  // switches reference axis near the poles so it never degenerates.
  vec3 ref = abs(d.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 t1 = normalize(cross(ref, d));
  vec3 t2 = cross(d, t1);
  const float e = 1.5e-3;
  vec3 du = surfacePoint(d + e * t1) - surfacePoint(d - e * t1);
  vec3 dv = surfacePoint(d + e * t2) - surfacePoint(d - e * t2);
  vec3 n = normalize(cross(du, dv));
  // A radial graph with r > 0 always has an outward normal with n · d > 0.
  if (dot(n, d) < 0.0) n = -n;
  vec4 eye = uModelViewMatrix * vec4(p, 1.0);
  vNormal = mat3(uModelViewMatrix) * n;
  vEye = eye.xyz;
  vField = f;
  gl_Position = uProjectionMatrix * eye;
}
`;

const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vEye;
in float vField;
uniform vec3 uPositive;
uniform vec3 uNegative;
uniform vec3 uNodal;
uniform vec3 uInk;
uniform float uLight;
uniform float uNodalOn;
uniform float uContourOn;
out vec4 outColor;

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(-vEye);
  if (dot(n, v) < 0.0) n = -n;
  vec3 key = normalize(vec3(-0.55, -0.7, 0.75));
  vec3 fill = normalize(vec3(0.8, 0.35, 0.45));
  float diffuse = max(dot(n, key), 0.0);
  float soft = max(dot(n, fill), 0.0);
  float spec = pow(max(dot(reflect(-key, n), v), 0.0), 42.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  float shade = uLight * (0.07 + 0.8 * diffuse + 0.2 * soft);

  // Sign of F picks the palette colour: a one-pixel antialiased switch that
  // sits under the nodal line, never a blended in-between colour.
  float w = max(fwidth(vField), 1e-6);
  float positive = smoothstep(-w, w, vField);
  vec3 base = positive > 0.5 ? uPositive : uNegative;
  vec3 color = base * shade;

  // Level sets F = ±1/3, ±2/3 in INK, the nodal set F = 0 in ACID.
  float level = vField * 3.0;
  float contour = abs(fract(level + 0.5) - 0.5) / max(fwidth(level), 1e-6);
  float contourLine = (1.0 - smoothstep(0.4, 1.3, contour)) * step(0.5, abs(level)) * uContourOn;
  color = mix(color, uInk * (0.25 + 0.6 * shade), 0.2 * contourLine);
  float nodal = 1.0 - smoothstep(0.6, 1.7, abs(vField) / w);
  color = mix(color, uNodal * (0.35 + 0.75 * shade), 0.92 * nodal * uNodalOn);

  color += uInk * (0.5 * spec * uLight + 0.09 * rim * uLight);
  outColor = vec4(min(color, vec3(1.0)), 1.0);
}
`;

let canvasEl;
let grainPg;
let hudPg;
let surfaceShader;
let sphereMesh;
let meshRows = 0;
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
  layers: { nodal: true, contours: true, math: true },
  frameCost: 0,
};

function setup() {
  createCanvas(W, H, WEBGL);
  // Multisampling for the shaded silhouette; size and density are untouched.
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
  rebuildMesh();
  for (const structure of STRUCTURES) structureScale(structure.terms);
  bindUI();
  updateStaticUI();
  syncControls();
  if (auditParam !== null) window.harmonicsAudit = runAudit();
  window.harmonics = { PARAMS, STRUCTURES, frameState, computeFrameState, harmonicAt, setLoop, runAudit };
}

function rebuildMesh() {
  const rows = clamp(Math.round(PARAMS.rows), LIMITS.minRows, LIMITS.maxRows);
  if (rows === meshRows) return;
  if (sphereMesh) freeGeometry(sphereMesh);
  sphereMesh = buildSphereMesh(rows);
  meshRows = rows;
}

// ================================================================
// RENDERING
// ================================================================

function colorVector(colorValue) {
  return [colorValue.r / 255, colorValue.g / 255, colorValue.b / 255];
}

function renderFrame() {
  background(BG.r, BG.g, BG.b);
  computeFrameState(loopProgress);
  const free = !isRecording && !Number.isFinite(previewProgress);
  const distance = (H / 2) / Math.tan(STAGE.fov / 2);
  perspective(STAGE.fov, W / H, distance * 0.5, distance * 2);
  camera(0, 0, distance, 0, 0, 0, 0, 1, 0);

  push();
  translate(0, STAGE.centerY - H / 2, 0);
  rotateY(frameState.yaw + (free ? sim.dragYaw : 0));
  // Harmonic z axis points up the screen, tipped toward the viewer by tilt.
  rotateX(Math.PI / 2 - frameState.tilt - (free ? sim.dragTilt : 0));
  rotateZ(frameState.spin);
  noStroke();
  shader(surfaceShader);
  surfaceShader.setUniform("uL", frameState.L);
  surfaceShader.setUniform("uM", frameState.M);
  surfaceShader.setUniform("uK", frameState.K);
  surfaceShader.setUniform("uCount", frameState.count);
  surfaceShader.setUniform("uRadius", frameState.radius);
  surfaceShader.setUniform("uAmp", frameState.amplitude);
  surfaceShader.setUniform("uPositive", colorVector(CYAN));
  surfaceShader.setUniform("uNegative", colorVector(MAGENTA));
  surfaceShader.setUniform("uNodal", colorVector(ACID));
  surfaceShader.setUniform("uInk", colorVector(INK));
  surfaceShader.setUniform("uLight", PARAMS.light);
  surfaceShader.setUniform("uNodalOn", sim.layers.nodal ? 1 : 0);
  surfaceShader.setUniform("uContourOn", sim.layers.contours ? 1 : 0);
  model(sphereMesh);
  resetShader();
  pop();
}

// ================================================================
// HUD
// ================================================================

function degreeLabel() {
  const degrees = [];
  for (let k = 0; k < frameState.count; k++) {
    if (!degrees.includes(frameState.L[k])) degrees.push(frameState.L[k]);
  }
  degrees.sort((a, b) => a - b);
  return `l = ${degrees.join(" + ")}`;
}

function stageName() {
  if (PARAMS.mix >= 1) return `Y(${PARAMS.l}, ${PARAMS.m})`;
  return STRUCTURES[frameState.dominant].name;
}

function stageFormula() {
  if (PARAMS.mix >= 1) return `Nₗₘ · Pₗ^|m|(cos θ) · Aₘ(φ) · l ${PARAMS.l} · m ${PARAMS.m}`;
  return STRUCTURES[frameState.dominant].formula;
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
  graphics.text("SPHERICAL HARMONICS", W / 2, HUD.titleY);
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(34);
  graphics.fill(INK.r, INK.g, INK.b, 228);
  graphics.text("r = R · [1 + a · F(θ, φ, t)]", W / 2, HUD.formulaY);
  graphics.textSize(23);
  graphics.fill(CYAN.r, CYAN.g, CYAN.b, 220);
  graphics.text(stageFormula(), W / 2, HUD.exponentY);
  graphics.textSize(26);
  graphics.fill(INK.r, INK.g, INK.b, 215);
  const R = frameState.radius;
  const a = PARAMS.amplitude;
  graphics.text(`a ${a.toFixed(2)} · r ∈ [${(1 - a).toFixed(2)}R, ${(1 + a).toFixed(2)}R]`, W / 2, HUD.subtitleY);

  const holding = frameState.holding && PARAMS.mix === 0;
  graphics.textAlign(LEFT, TOP);
  if (holding) graphics.fill(ACID.r, ACID.g, ACID.b, 240);
  else graphics.fill(INK.r, INK.g, INK.b, 235);
  graphics.text(stageName(), HUD.stageTextX, HUD.stageY);
  graphics.fill(INK.r, INK.g, INK.b, 235);
  graphics.textAlign(RIGHT, TOP);
  graphics.textSize(22);
  graphics.text(degreeLabel(), W - HUD.rightTextX, HUD.stageY + 3);
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
  const morphing = PRESETS[presetIndex].sequence.length > 1 && PARAMS.mix === 0;
  if (OVERLAY.hook && morphing) {
    const p = loopProgress;
    for (const caption of OVERLAY.captions) {
      const weight = caption.window
        ? envelope(p, caption.window)
        : 1 - smoothstep(0.05, 0.09, p) + smoothstep(0.90, 0.985, p);
      if (weight <= 0.01) continue;
      graphics.fill(INK.r, INK.g, INK.b, HUD.bottomMainAlpha * weight);
      graphics.text(caption.first, W / 2, HUD.bottomTextY);
      graphics.text(caption.second, W / 2, HUD.bottomTextY + 38);
    }
  } else if (OVERLAY.hook) {
    graphics.fill(INK.r, INK.g, INK.b, HUD.bottomMainAlpha);
    const custom = PARAMS.mix >= 1;
    graphics.text(stageName(), W / 2, HUD.bottomTextY);
    graphics.text(custom ? degreeLabel() : STRUCTURES[frameState.dominant].detail, W / 2, HUD.bottomTextY + 38);
  }
  graphics.textSize(22);
  graphics.fill(INK.r, INK.g, INK.b, HUD.citationAlpha);
  graphics.text(`R ${R.toFixed(0)} px · Nₗₘ = √((2l+1)/4π · (l−|m|)!/(l+|m|)!)`, W / 2, HUD.citationY);
  compositeHUD(graphics);
}

// ================================================================
// AUDIT — ?audit=1 checks the harmonic math, symmetry, radius bounds,
// framing and loop seam, storing the report on window.harmonicsAudit.
// ================================================================

function rotationMatrix(axis, angle) {
  const [u, v, w] = axis;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    [t * u * u + c, t * u * v - s * w, t * u * w + s * v],
    [t * u * v + s * w, t * v * v + c, t * v * w - s * u],
    [t * u * w - s * v, t * v * w + s * u, t * w * w + c],
  ];
}

function rotateVector(matrix, d) {
  return matrix.map((row) => row[0] * d[0] + row[1] * d[1] + row[2] * d[2]);
}

// Gauss–Legendre nodes in z × uniform φ: exact for every product Yₗᵐ · Yₗ'ᵐ'
// with l, l' ≤ 16, so the Gram matrix must be the identity to rounding.
function gaussLegendre(n) {
  const nodes = [];
  for (let i = 0; i < n; i++) {
    let x = Math.cos(Math.PI * (i + 0.75) / (n + 0.5));
    let dp = 1;
    for (let iter = 0; iter < 60; iter++) {
      let p0 = 1;
      let p1 = x;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      dp = n * (x * p1 - p0) / (x * x - 1);
      const dx = p1 / dp;
      x -= dx;
      if (Math.abs(dx) < 1e-15) break;
    }
    nodes.push([x, 2 / ((1 - x * x) * dp * dp)]);
  }
  return nodes;
}

function auditOrthonormality() {
  const basis = [];
  for (let l = 0; l <= LIMITS.maxL; l++) {
    for (let m = -l; m <= l; m++) basis.push([l, m]);
  }
  const zNodes = gaussLegendre(24);
  const nPhi = 40;
  const samples = [];
  for (const [z, weight] of zNodes) {
    const s = Math.sqrt(1 - z * z);
    for (let j = 0; j < nPhi; j++) {
      const phi = j / nPhi * TAU;
      samples.push([s * Math.cos(phi), s * Math.sin(phi), z, weight * TAU / nPhi]);
    }
  }
  const values = basis.map(([l, m]) => samples.map(([x, y, z]) => harmonicAt(l, m, x, y, z)));
  let diagonal = 0;
  let offDiagonal = 0;
  for (let i = 0; i < basis.length; i++) {
    for (let j = i; j < basis.length; j++) {
      let sum = 0;
      for (let k = 0; k < samples.length; k++) sum += values[i][k] * values[j][k] * samples[k][3];
      if (i === j) diagonal = Math.max(diagonal, Math.abs(sum - 1));
      else offDiagonal = Math.max(offDiagonal, Math.abs(sum));
    }
  }
  return { functions: basis.length, maxDiagonalError: diagonal, maxOffDiagonal: offDiagonal };
}

function auditHarmonics() {
  const report = {};
  report.orthonormality = auditOrthonormality();
  // Cartesian polynomial form vs textbook (θ, φ) form, including both poles.
  let formError = 0;
  for (let l = 0; l <= LIMITS.maxL; l++) {
    for (let m = -l; m <= l; m++) {
      for (let i = 0; i <= 24; i++) {
        const theta = i / 24 * Math.PI;
        for (let j = 0; j < 12; j++) {
          const phi = j / 12 * TAU + 0.1;
          const d = [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
          formError = Math.max(formError, Math.abs(harmonicAt(l, m, ...d) - harmonicSpherical(l, m, theta, phi)));
        }
      }
    }
  }
  report.cartesianVsSpherical = formError;
  // Closed forms: Y₁⁰ = √(3/4π) z, Y₂⁰ = √(5/16π)(3z² − 1), Y₂² = √(15/16π)(x² − y²), Y₂⁻² = √(15/4π) xy.
  const d = [0.3, -0.5, Math.sqrt(1 - 0.34)];
  const [x, y, z] = d;
  report.closedForms = Math.max(
    Math.abs(harmonicAt(1, 0, x, y, z) - Math.sqrt(3 / (4 * Math.PI)) * z),
    Math.abs(harmonicAt(2, 0, x, y, z) - Math.sqrt(5 / (16 * Math.PI)) * (3 * z * z - 1)),
    Math.abs(harmonicAt(2, 2, x, y, z) - Math.sqrt(15 / (16 * Math.PI)) * (x * x - y * y)),
    Math.abs(harmonicAt(2, -2, x, y, z) - Math.sqrt(15 / (4 * Math.PI)) * x * y)
  );
  // Point-group invariance F(Rd) = F(d) for each symmetric structure.
  const cubic = [rotationMatrix([1, 0, 0], Math.PI / 2), rotationMatrix([0, 1, 0], Math.PI / 2)];
  const axis = [Math.sin(Math.atan(2)), 0, Math.cos(Math.atan(2))];
  const icosa = [rotationMatrix([0, 0, 1], TAU / 5), rotationMatrix(axis, TAU / 5)];
  const groups = { cubic, icosa, urchin: icosa, flower: [rotationMatrix([0, 0, 1], TAU / 8)] };
  report.symmetry = {};
  const point = [0, 0, 0];
  for (const structure of STRUCTURES) {
    let worst = 0;
    for (let i = 0; i < 3000; i++) {
      fibonacciPoint(i, 3000, point);
      const f0 = fieldOfTerms(structure.terms, ...point);
      for (const matrix of groups[structure.key]) {
        worst = Math.max(worst, Math.abs(fieldOfTerms(structure.terms, ...rotateVector(matrix, point)) - f0));
      }
    }
    report.symmetry[structure.key] = worst;
  }
  return report;
}

function runAudit() {
  const t0 = performance.now();
  const report = { harmonics: auditHarmonics(), presets: [], loop: null };
  const savedPreset = presetIndex;
  const samples = 2500;
  const point = [0, 0, 0];
  const distance = (H / 2) / Math.tan(STAGE.fov / 2);
  for (let preset = 0; preset < PRESETS.length; preset++) {
    presetIndex = preset;
    const entry = {
      preset: PRESETS[preset].key,
      maxAbsF: 0,
      minRadius: Infinity,
      maxRadius: 0,
      nonFinite: 0,
      screenTop: Infinity,
      screenBottom: -Infinity,
      screenLeft: Infinity,
      screenRight: -Infinity,
      seamStep: 0,
      maxInteriorStep: 0,
    };
    let previous = null;
    let first = null;
    const snapshot = () => {
      const values = [frameState.amplitude, Math.cos(frameState.spin), Math.sin(frameState.spin), frameState.tilt, frameState.yaw];
      for (let s = 0; s < STRUCTURES.length; s++) values.push(frameState.weights[s]);
      return values;
    };
    const step = (a, b) => Math.max(...a.map((value, i) => Math.abs(value - b[i])));
    for (let frame = 0; frame < LOOP_FRAMES; frame++) {
      computeFrameState(frame / LOOP_FRAMES);
      const current = snapshot();
      if (previous) entry.maxInteriorStep = Math.max(entry.maxInteriorStep, step(current, previous));
      else first = current;
      previous = current;
      if (frame % 4 !== 0) continue;
      // Exact framing: rotate each surface sample like renderFrame and project.
      const spin = rotationMatrix([0, 0, 1], frameState.spin);
      const tilt = rotationMatrix([1, 0, 0], Math.PI / 2 - frameState.tilt);
      const yaw = rotationMatrix([0, 1, 0], frameState.yaw);
      for (let i = 0; i < samples; i++) {
        fibonacciPoint(i, samples, point);
        const f = frameField(point[0], point[1], point[2]);
        const rho = 1 + frameState.amplitude * f;
        if (!Number.isFinite(rho)) {
          entry.nonFinite++;
          continue;
        }
        entry.maxAbsF = Math.max(entry.maxAbsF, Math.abs(f));
        entry.minRadius = Math.min(entry.minRadius, rho);
        entry.maxRadius = Math.max(entry.maxRadius, rho);
        const p = rotateVector(yaw, rotateVector(tilt, rotateVector(spin, point.map((value) => value * rho * frameState.radius))));
        const depth = distance - p[2];
        const sx = W / 2 + p[0] * distance / depth;
        const sy = STAGE.centerY + (p[1] * distance + (STAGE.centerY - H / 2) * p[2]) / depth;
        entry.screenTop = Math.min(entry.screenTop, Math.round(sy));
        entry.screenBottom = Math.max(entry.screenBottom, Math.round(sy));
        entry.screenLeft = Math.min(entry.screenLeft, Math.round(sx));
        entry.screenRight = Math.max(entry.screenRight, Math.round(sx));
      }
    }
    // Wrap step 599 → 0 must look like any other consecutive step.
    entry.seamStep = step(first, previous);
    report.presets.push(entry);
  }
  presetIndex = savedPreset;
  report.loop = { frames: LOOP_FRAMES, fps: FPS, seconds: LOOP_FRAMES / FPS, auditMs: performance.now() - t0 };
  console.log("[harmonics audit]", JSON.stringify(report, null, 2));
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

// ?preset=flower&l=2&m=2&mix=1&a=0.5 — handy for stills and shader checks.
function applyUrlParams() {
  const preset = PRESETS.findIndex((entry) => entry.key === urlParam("preset"));
  if (preset >= 0) presetIndex = preset;
  const numeric = (name, key) => {
    const value = Number(urlParam(name));
    if (urlParam(name) !== null && Number.isFinite(value)) PARAMS[key] = value;
  };
  numeric("l", "l");
  numeric("m", "m");
  numeric("mix", "mix");
  numeric("a", "amplitude");
  numeric("rows", "rows");
  numeric("spin", "spinTurns");
  if (urlParam("hook") === "0") OVERLAY.hook = false;
  sanitizeParams();
}

function sanitizeParams() {
  PARAMS.l = clamp(Math.round(PARAMS.l), 0, LIMITS.maxL);
  PARAMS.m = clamp(Math.round(PARAMS.m), -PARAMS.l, PARAMS.l);
  PARAMS.mix = clamp(PARAMS.mix, 0, 1);
  PARAMS.amplitude = clamp(PARAMS.amplitude, 0, LIMITS.maxAmplitude);
  PARAMS.radius = clamp(PARAMS.radius, LIMITS.minRadius, STAGE.boundRadius);
  PARAMS.rows = clamp(Math.round(PARAMS.rows), LIMITS.minRows, LIMITS.maxRows);
  PARAMS.spinTurns = clamp(Math.round(PARAMS.spinTurns), -2, 2);
  PARAMS.light = clamp(PARAMS.light, 0.3, 1.8);
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
  lSlider: ["l", (v) => v.toFixed(0)],
  mSlider: ["m", (v) => v.toFixed(0)],
  mixSlider: ["mix", (v) => v.toFixed(2)],
  radiusSlider: ["radius", (v) => `${v.toFixed(0)} px`],
  ampSlider: ["amplitude", (v) => v.toFixed(2)],
  rowsSlider: ["rows", (v) => `${v.toFixed(0)} × ${(2 * v).toFixed(0)}`],
  spinSlider: ["spinTurns", (v) => `${v.toFixed(0)} / loop`],
  lightSlider: ["light", (v) => v.toFixed(2)],
};

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
      // Picking a harmonic shows it: bring it in if the mix is still zero.
      if ((key === "l" || key === "m") && PARAMS.mix === 0) PARAMS.mix = 1;
      sanitizeParams();
      if (key === "rows") rebuildMesh();
      syncControls();
    };
  }
  const onClick = (id, handler) => {
    const element = getElement(id);
    if (element) element.onclick = handler;
  };
  PRESETS.forEach((preset, index) => onClick(`preset-${preset.key}`, () => selectPreset(index)));
  onClick("pauseBtn", togglePause);
  onClick("resetBtn", resetSimulator);
  const toggles = { showNodal: "nodal", showContours: "contours", showMath: "math" };
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

function selectPreset(index) {
  if (isRecording) return;
  presetIndex = index;
  PARAMS.mix = 0;
  syncControls();
}

function togglePause() {
  if (isRecording) return;
  sim.paused = !sim.paused;
  syncControls();
}

const DEFAULT_PARAMS = { ...PARAMS };

function resetSimulator() {
  if (isRecording) return;
  Object.assign(PARAMS, DEFAULT_PARAMS);
  rebuildMesh();
  presetIndex = 0;
  Object.assign(sim, { paused: false, playhead: 0, dragYaw: 0, dragTilt: 0 });
  for (const layer of Object.keys(sim.layers)) sim.layers[layer] = true;
  OVERLAY.hook = true;
  for (const id of ["showNodal", "showContours", "showHook", "showMath"]) {
    const element = getElement(id);
    if (element) element.checked = true;
  }
  syncControls();
}

const CONTROL_IDS = [
  ...Object.keys(SLIDERS),
  ...PRESETS.map((preset) => `preset-${preset.key}`),
  "pauseBtn", "resetBtn", "showNodal", "showContours", "showHook", "showMath",
];

function syncControls() {
  const mSlider = getElement("mSlider");
  if (mSlider) {
    mSlider.min = -PARAMS.l;
    mSlider.max = PARAMS.l;
  }
  for (const [id, [key, format]] of Object.entries(SLIDERS)) {
    const element = getElement(id);
    if (element) element.value = PARAMS[key];
    setText(id.replace("Slider", "Value"), format(PARAMS[key]));
  }
  setText("radiusValue", `${effectiveRadius().toFixed(0)} px`);
  PRESETS.forEach((preset, index) => {
    const element = getElement(`preset-${preset.key}`);
    if (element) element.style.borderColor = index === presetIndex && PARAMS.mix < 1 ? "rgba(255,255,255,0.6)" : "";
  });
  setText("pauseBtn", sim.paused ? "Play" : "Pause");
  const math = getElement("math");
  if (math) math.hidden = !sim.layers.math;
  for (const id of CONTROL_IDS) setDisabled(id, isRecording);
}

function updateLiveUI() {
  if (frameCount % 6 !== 0 || !sim.layers.math) return;
  const terms = [];
  for (let k = 0; k < frameState.count; k++) {
    terms.push(`${frameState.coef[k] >= 0 ? "+" : "−"}${Math.abs(frameState.coef[k]).toFixed(3)}·Y(${frameState.L[k]},${frameState.M[k]})`);
  }
  setText("termsValue", terms.join(" ") || "0");
  setText("weightsValue", Array.from(frameState.weights, (w) => w.toFixed(2)).join(" / "));
  setText("rminValue", `${(1 - frameState.amplitude).toFixed(3)}R`);
  setText("meshValue", `${(meshRows - 1) * 2 * meshRows + 2} verts`);
  setText("costValue", sim.frameCost.toFixed(1));
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
  sim.dragTilt = clamp(sim.dragTilt + movedY * 0.004, -0.9, 0.9);
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
    saveCanvas(`spherical_harmonics_${getTimestamp()}`, "png");
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
    anchor.download = `spherical_harmonics_${getTimestamp()}.mp4`;
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
