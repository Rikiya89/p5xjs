"use strict";

// CATENOID — THE MINIMAL SURFACE OF REVOLUTION
//   X(u, v) = (a cosh(v/a) cos u, a cosh(v/a) sin u, v),   u ∈ [0, 2π),  v ∈ [−d/2, d/2],  a > 0.
// X_u × X_v = a cosh(v/a) · (cos u, sin u, −sinh(v/a)), so the outward unit normal is
//   n = (cos u, sin u, −sinh(v/a)) / cosh(v/a)   and   dA = a cosh²(v/a) du dv.
// Principal curvatures (meridian, parallel): κ₁ = +1 / a cosh²(v/a), κ₂ = −κ₁, hence
//   H = (κ₁ + κ₂) / 2 = 0   and   K = κ₁κ₂ = −1 / a² cosh⁴(v/a).
// Area between the rings: A = 2π ∫ a cosh²(v/a) dv = πa (d + a sinh(d/a)).
// Boundary problem — two coaxial rings of radius R a distance d apart: R = a cosh(d / 2a).
// With t = d / 2a this is cosh t / t = 2R / d. cosh t / t is minimal at t*, where t tanh t = 1
// (t* ≈ 1.19968), so a catenoid exists only for d / R ≤ 2t* / cosh t* ≈ 1.32549. Below that there
// are two: the wide one (t < t*) is stable, the thin one (t > t*) is not. Past it the film snaps into
// two flat disks (the Goldschmidt solution, area 2πR²).

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
  dataY: 456,
  dataRow: 66,
};

// Generating-catenary strip under the surface: z horizontal, r = a cosh(z/a) up from the axis.
const PROFILE = {
  headerY: 1112,
  x0: 150,
  x1: W - 84,
  y0: 1148,
  y1: 1276,
};

const PARAMS = {
  geometry: "boundary",
  // Parametric mode: waist a and surface height d are free; the ring radius R follows.
  a: 0.7,
  height: 2.4,
  // Boundary mode: ring radius fixed, separation free; a is solved from R = a cosh(d / 2a).
  R: 1,
  sep: 0.9,
  res: 24,
  spinTurns: 1,
  light: 1,
  surface: true,
  wire: true,
  rings: true,
  catenary: true,
  probe: true,
  animate: true,
};

const LIMITS = {
  minA: 0.5,
  maxA: 1.5,
  minHeight: 0.5,
  maxHeight: 3,
  minSep: 0.2,
  maxSep: 1.6,
  minRes: 8,
  maxRes: 72,
  minSegU: 144,
  minSegV: 96,
};

const GEOMETRY_KEYS = ["parametric", "boundary"];

// Camera in display units (surface fitted to radius ≤ 1, height ≤ 2.4). Target = (tx, ty, 0); the eye
// sits at distance d along (sin az cos el, −sin el, cos az cos el); roll turns the up vector.
const CAMERA = {
  fov: 0.66,
  near: 0.05,
  far: 600,
  base: { tx: 0, ty: 1.0, az: 0, el: 0.3, d: 15.5, roll: 0 },
  swayEl: 0.05,
  stretchDolly: 0.06,
};

// Display box: the catenoid is scaled uniformly to fit radius ≤ 1 and height ≤ 2.4.
const DISPLAY = { radius: 1, height: 2.4 };

// Loop timeline (p ∈ [0, 1)): unwind to the catenary → revolve back → stretch toward d* → relax.
const TIMELINE = {
  sweep: [0.07, 0.2, 0.25, 0.42],
  stretch: [0.46, 0.66, 0.74, 0.94],
  stretchCap: 0.985,
};

// Curvature probe: slides along the meridian facing the camera, offset right of the axis.
const PROBE = { offset: 0.45, reach: 0.8, arc: 0.2, lift: 0.008 };

const RING_LIFT = 1.004;

// ================================================================
// CATENOID — closed forms, boundary solver and the parametric grid
// ================================================================

function catenoidPoint(u, v, a) {
  const r = a * Math.cosh(v / a);
  return [r * Math.cos(u), r * Math.sin(u), v];
}

function catenoidNormal(u, v, a) {
  const ch = Math.cosh(v / a);
  return [Math.cos(u) / ch, Math.sin(u) / ch, -Math.sinh(v / a) / ch];
}

function ringRadius(a, d) {
  return a * Math.cosh(d / (2 * a));
}

function catenoidArea(a, d) {
  return Math.PI * a * (d + a * Math.sinh(d / a));
}

function disksArea(R) {
  return 2 * Math.PI * R * R;
}

// |κ₁| = |κ₂| = 1 / a cosh²(v/a), the analytic value the numeric check is compared with.
function principalCurvature(v, a) {
  const ch = Math.cosh(v / a);
  return 1 / (a * ch * ch);
}

// t* solves t tanh t = 1; t tanh t increases on t > 0, so bisection on [1, 1.5] is exact.
function criticalT() {
  let lo = 1, hi = 1.5;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if (mid * Math.tanh(mid) < 1) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

const T_STAR = criticalT();
// d* / R: the widest ring separation a catenoid can span.
const SEP_CRITICAL = 2 * T_STAR / Math.cosh(T_STAR);

function bisectRoot(f, lo, hi) {
  let flo = f(lo);
  for (let i = 0; i < 200 && hi - lo > 1e-15 * Math.max(1, hi); i++) {
    const mid = 0.5 * (lo + hi);
    const fm = f(mid);
    if ((fm > 0) === (flo > 0)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// Both catenoids spanning rings of radius R at distance d, or null when d / R > d* / R.
// f(t) = cosh t / t − 2R/d falls on (0, t*] and rises on [t*, ∞). Since cosh t / t > 1/t, f > 0 at
// t = d / 2R (the small-d stable root sits just above it), and f grows without bound for large t.
function solveBoundary(R, d) {
  if (!(R > 0) || !(d > 0)) return null;
  const c = 2 * R / d;
  const f = (t) => Math.cosh(t) / t - c;
  const fStar = f(T_STAR);
  // Within rounding of d = d* the two roots merge into the double root t*.
  if (fStar > 1e-12 * c) return null;
  const branch = (t) => ({ t, a: d / (2 * t) });
  if (fStar >= 0) return { stable: branch(T_STAR), unstable: branch(T_STAR) };
  const lo = Math.min(1 / c, T_STAR);
  let hi = T_STAR * 2;
  while (f(hi) <= 0) hi *= 2;
  return { stable: branch(bisectRoot(f, lo, T_STAR)), unstable: branch(bisectRoot(f, T_STAR, hi)) };
}

// Mean and Gaussian curvature of catenoidPoint from its first and second fundamental forms, every
// derivative by central differences — an independent numeric check of H = 0, not the closed form.
function numericCurvature(u, v, a) {
  const e = 1e-3 * a;
  const P = (du, dv) => catenoidPoint(u + du, v + dv, a);
  const p0 = P(0, 0), pu = P(e, 0), pm = P(-e, 0), qv = P(0, e), qm = P(0, -e);
  const pp = P(e, e), pn = P(e, -e), np = P(-e, e), nn = P(-e, -e);
  const Xu = [0, 1, 2].map((i) => (pu[i] - pm[i]) / (2 * e));
  const Xv = [0, 1, 2].map((i) => (qv[i] - qm[i]) / (2 * e));
  const Xuu = [0, 1, 2].map((i) => (pu[i] - 2 * p0[i] + pm[i]) / (e * e));
  const Xvv = [0, 1, 2].map((i) => (qv[i] - 2 * p0[i] + qm[i]) / (e * e));
  const Xuv = [0, 1, 2].map((i) => (pp[i] - pn[i] - np[i] + nn[i]) / (4 * e * e));
  const n = normalize3(cross(Xu, Xv));
  const E = dot(Xu, Xu), F = dot(Xu, Xv), G = dot(Xv, Xv);
  const L = dot(Xuu, n), M = dot(Xuv, n), N = dot(Xvv, n);
  const det = E * G - F * F;
  const meanH = (E * N - 2 * F * M + G * L) / (2 * det);
  const K = (L * N - M * M) / det;
  const root = Math.sqrt(Math.max(0, meanH * meanH - K));
  return { H: meanH, K, k1: meanH + root, k2: meanH - root, normal: n };
}

// Unit parametric grid: column i ↦ u = i / segU (seam column duplicated so uv never wraps inside a
// triangle), row j ↦ s = −1 + 2j / segV. Segment counts are multiples of the meridian / parallel line
// counts, so every wire line runs along mesh edges whose vertices sit exactly on the surface.
function gridLines(res) {
  return { meridians: res, parallels: Math.max(4, res / 2) };
}

function catenoidGrid(res) {
  const { meridians, parallels } = gridLines(res);
  const segU = meridians * Math.ceil(LIMITS.minSegU / meridians);
  const segV = parallels * Math.ceil(LIMITS.minSegV / parallels);
  const params = new Float64Array(2 * (segU + 1) * (segV + 1));
  const faces = new Int32Array(6 * segU * segV);
  for (let j = 0; j <= segV; j++) {
    for (let i = 0; i <= segU; i++) {
      const index = j * (segU + 1) + i;
      params[2 * index] = i / segU;
      params[2 * index + 1] = -1 + 2 * j / segV;
    }
  }
  let f = 0;
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1;
      faces[f++] = a; faces[f++] = b; faces[f++] = d;
      faces[f++] = a; faces[f++] = d; faces[f++] = c;
    }
  }
  return { segU, segV, meridians, parallels, params, faces };
}

// Area of the inscribed triangle mesh on the grid (audit: converges to the closed form as O(1/n²)).
function meshArea(grid, a, d) {
  const point = (index) => catenoidPoint(TAU * grid.params[2 * index], grid.params[2 * index + 1] * d / 2, a);
  let area = 0;
  for (let f = 0; f < grid.faces.length; f += 3) {
    const [p, q, r] = [grid.faces[f], grid.faces[f + 1], grid.faces[f + 2]].map(point);
    area += Math.hypot(...cross(q.map((value, i) => value - p[i]), r.map((value, i) => value - p[i]))) / 2;
  }
  return area;
}

function cross(p, q) {
  return [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
}

function dot(p, q) {
  return p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
}

function normalize3(p) {
  const length = Math.hypot(...p);
  return [p[0] / length, p[1] / length, p[2] / length];
}

function lerp1(a, b, t) {
  return a + (b - a) * t;
}

function fitScale(R, d) {
  return Math.min(DISPLAY.radius / R, DISPLAY.height / d);
}

// Catenoid → world: spin about the axis, map z (axis) to −y (p5's y points down), then scale to the
// display box. The vertex shader applies the identical transform.
function toWorld(p, spin, k) {
  const c = Math.cos(spin), s = Math.sin(spin);
  const x = c * p[0] - s * p[1];
  const y = s * p[0] + c * p[1];
  return [k * x, -k * p[2], k * y];
}

// ================================================================
// FRAME STATE — a pure function of loop progress, shared by draw and audit
// ================================================================

const frameState = {
  spin: 0,
  sweep: 1,
  stretch: 0,
  a: 1,
  d: 1,
  R: 1,
  valid: true,
  branch: "stable",
  altA: NaN,
  probeV: 0,
  cam: { ...CAMERA.base },
};

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function envelope(p, window) {
  return smoothstep(window[0], window[1], p) * (1 - smoothstep(window[2], window[3], p));
}

function sweepOn() {
  return PARAMS.animate && PARAMS.catenary;
}

function stretchOn() {
  return PARAMS.animate && PARAMS.geometry === "boundary";
}

// Geometry for a stretch weight w ∈ [0, 1]. Parametric: (a, d) given, R derived. Boundary: R fixed,
// d = separation (pulled toward 0.985 d* by w), a solved — every frame is an exact catenoid.
function geometryAt(w) {
  if (PARAMS.geometry === "parametric") {
    const a = PARAMS.a, d = PARAMS.height;
    return { a, d, R: ringRadius(a, d), valid: true, branch: d / (2 * a) <= T_STAR ? "stable" : "unstable", altA: NaN };
  }
  const R = PARAMS.R;
  const base = PARAMS.sep * R;
  const cap = TIMELINE.stretchCap * SEP_CRITICAL * R;
  const d = base < cap ? lerp1(base, cap, w) : base;
  const solution = solveBoundary(R, d);
  if (!solution) return { a: 0, d, R, valid: false, branch: "none", altA: NaN };
  return { a: solution.stable.a, d, R, valid: true, branch: "stable", altA: solution.unstable.a };
}

// Every term is equal at p = 0 and p = 1, so frame 600 ≡ frame 0.
function computeFrameState(p) {
  const fs = frameState;
  fs.spin = PARAMS.spinTurns * TAU * p;
  fs.sweep = sweepOn() ? 1 - envelope(p, TIMELINE.sweep) : 1;
  fs.stretch = stretchOn() ? envelope(p, TIMELINE.stretch) : 0;
  Object.assign(fs, geometryAt(fs.stretch));
  fs.probeV = PROBE.reach * (fs.d / 2) * Math.sin(TAU * p);
  Object.assign(fs.cam, CAMERA.base);
  fs.cam.el += CAMERA.swayEl * Math.sin(TAU * p);
  fs.cam.d *= 1 - CAMERA.stretchDolly * fs.stretch;
}

// Look-at basis matching p5's camera() + perspective() (p5 maps +y_cam down the screen).
function cameraBasis(cam) {
  const target = [cam.tx, cam.ty, 0];
  const ce = Math.cos(cam.el);
  const offset = [Math.sin(cam.az) * ce, -Math.sin(cam.el), Math.cos(cam.az) * ce];
  const eye = target.map((value, i) => value + cam.d * offset[i]);
  const fwd = normalize3(target.map((value, i) => value - eye[i]));
  let side = normalize3(cross(fwd, [0, 1, 0]));
  let up = cross(side, fwd);
  const cr = Math.cos(cam.roll), sr = Math.sin(cam.roll);
  up = up.map((value, i) => value * cr + side[i] * sr);
  side = normalize3(cross(fwd, up));
  up = cross(side, fwd);
  return { eye, target, fwd, side, up, f: 1 / Math.tan(CAMERA.fov / 2) };
}

// World → canvas pixels; returns [x, y, depth].
function projectPoint(basis, world) {
  const q = world.map((value, i) => value - basis.eye[i]);
  const depth = dot(q, basis.fwd);
  const k = (H / 2) * basis.f / depth;
  return [W / 2 + k * dot(q, basis.side), H / 2 + k * dot(q, basis.up), depth];
}

function freeCamera() {
  return !isRecording && !Number.isFinite(previewProgress);
}

// Mouse / touch drag orbits the camera; the automatic spin turns the surface, so the two never fight.
function currentCamera() {
  const cam = { ...frameState.cam };
  if (freeCamera()) {
    cam.az += sim.dragYaw;
    cam.el = clamp(cam.el + sim.dragTilt, -1.2, 1.2);
  }
  return cam;
}

// The probe sits on the meridian facing the camera (world angle π/2 − az, nudged right), so it
// scans v while the surface turns beneath it. Returns catenoid coordinates (u, v).
function probeParams(cam) {
  const fs = frameState;
  return { u: Math.PI / 2 - cam.az - PROBE.offset - fs.spin, v: fs.probeV };
}

// ================================================================
// MESH CACHE + SHADERS
// ================================================================

// The grid stores (u / 2π, s) only; a, d and the display scale are uniforms, so the mesh rebuilds
// for a resolution change and never for a geometry change.
function buildCatenoidGeometry(res) {
  const grid = catenoidGrid(res);
  const geometry = new p5.Geometry();
  geometry.gid = `catenoid-${grid.segU}x${grid.segV}`;
  const count = grid.params.length / 2;
  for (let index = 0; index < count; index++) {
    const u = grid.params[2 * index], s = grid.params[2 * index + 1];
    geometry.vertices.push(new p5.Vector(u, s, 0));
    geometry.vertexNormals.push(new p5.Vector(0, 0, 1));
    geometry.uvs.push(u, (s + 1) / 2);
  }
  for (let f = 0; f < grid.faces.length; f += 3) geometry.faces.push([grid.faces[f], grid.faces[f + 1], grid.faces[f + 2]]);
  return { geometry, grid };
}

let catenoidMesh = null;

function syncMesh() {
  if (catenoidMesh && catenoidMesh.res === PARAMS.res) return;
  if (catenoidMesh) freeGeometry(catenoidMesh.geometry);
  catenoidMesh = { res: PARAMS.res, ...buildCatenoidGeometry(PARAMS.res) };
}

const SURFACE_VERTEX = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uA;
uniform float uHalf;
uniform float uK;
uniform float uSpin;
out vec3 vNormal;
out vec3 vEye;
out vec2 vUV;

const float TAU = 6.283185307179586;

vec3 toWorld(vec3 p) {
  float c = cos(uSpin);
  float s = sin(uSpin);
  return vec3(c * p.x - s * p.y, -p.z, s * p.x + c * p.y);
}

void main() {
  // X(u, v) = (a cosh(v/a) cos u, a cosh(v/a) sin u, v) with v = s · d/2 — exact at every vertex.
  float u = aPosition.x * TAU;
  float v = aPosition.y * uHalf;
  float ch = cosh(v / uA);
  vec3 p = vec3(uA * ch * cos(u), uA * ch * sin(u), v);
  vec3 n = vec3(cos(u), sin(u), -sinh(v / uA)) / ch;
  vec4 eye = uModelViewMatrix * vec4(toWorld(p * uK), 1.0);
  vNormal = mat3(uModelViewMatrix) * toWorld(n);
  vEye = eye.xyz;
  vUV = aTexCoord;
  gl_Position = uProjectionMatrix * eye;
}
`;

const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vEye;
in vec2 vUV;
uniform vec3 uBase;
uniform vec3 uInk;
uniform float uLight;
uniform float uSurf;
uniform float uWire;
uniform float uPass;
uniform float uFogNear;
uniform float uFogFar;
uniform float uMeridians;
uniform float uParallels;
uniform float uSweep;
out vec4 outColor;

void main() {
  // Revolution sweep: only u ∈ [0, 2π · uSweep] is drawn.
  if (vUV.x > uSweep + 1e-4) discard;
  vec3 n = normalize(vNormal);
  vec3 v = normalize(-vEye);
  bool front = dot(n, v) > 0.0;
  // Pass 0: interior (back-facing) fragments; pass 1: exterior.
  if ((uPass > 0.5) != front) discard;
  if (!front) n = -n;
  float side = front ? 1.0 : 0.0;

  vec3 key = normalize(vec3(-0.55, -0.7, 0.75));
  vec3 fill = normalize(vec3(0.8, 0.35, 0.45));
  float diffuse = max(dot(n, key), 0.0);
  float soft = max(dot(n, fill), 0.0);
  float spec = pow(max(dot(reflect(-key, n), v), 0.0), 42.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  float shade = uLight * (0.08 + 0.62 * diffuse + 0.18 * soft);

  // Parametric grid: meridians u = 2πi/n and parallels v = −d/2 + jd/m; they fade where cells
  // shrink under ~4 px (near the silhouette and a thin waist).
  vec2 g = vUV * vec2(uMeridians, uParallels);
  vec2 fw = max(fwidth(g), vec2(1e-5));
  vec2 dist = abs(fract(g + 0.5) - 0.5) / fw;
  float line = 1.0 - smoothstep(0.35, 1.1, min(dist.x, dist.y));
  float crowd = 1.0 - smoothstep(0.22, 0.5, max(fw.x, fw.y));
  float wireA = line * crowd * uWire * mix(0.55, 0.9, side);
  vec3 wireC = uInk * (0.35 + 0.65 * shade) * mix(0.7, 1.0, side);

  // Where lines crowd out, wire mode falls back to a faint tone so the surface never vanishes.
  float surfA = max(uSurf, uWire * (1.0 - crowd) * 0.4) * mix(0.8, 1.0, side);
  vec3 surfC = uBase * shade * mix(0.62, 0.8, side);
  surfC += uInk * (0.45 * spec + 0.1 * rim) * uLight * side;

  // Premultiplied: wire layer over surface layer (p5 blends ONE, ONE_MINUS_SRC_ALPHA).
  float a = wireA + surfA * (1.0 - wireA);
  vec3 color = wireC * wireA + min(surfC, vec3(1.0)) * surfA * (1.0 - wireA);
  float fog = mix(0.35, 1.0, 1.0 - smoothstep(uFogNear, uFogFar, -vEye.z));
  a *= fog;
  color *= fog;
  if (a < 0.004) discard;
  outColor = vec4(min(color, vec3(a)), a);
}
`;

let canvasEl;
let grainPg;
let hudPg;
let surfaceShader;
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
  surf: 0.55,
  wire: 1,
  layers: { math: true },
  frameCost: 0,
};

function setup() {
  createCanvas(W, H, WEBGL);
  // Multisampling for the silhouette and strokes; size and density are untouched.
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
  syncMesh();
  bindUI();
  updateStaticUI();
  syncControls();
  if (auditParam !== null) window.catenoidAudit = runAudit();
  window.catenoid = {
    PARAMS, frameState, computeFrameState, geometryAt, solveBoundary, numericCurvature, catenoidPoint,
    catenoidArea, ringRadius, catenoidGrid, meshArea, T_STAR, SEP_CRITICAL, cameraBasis, projectPoint, toWorld,
    setLoop, runAudit,
  };
}

// ================================================================
// RENDERING
// ================================================================

function colorVector(colorValue) {
  return [colorValue.r / 255, colorValue.g / 255, colorValue.b / 255];
}

// Surface alone reads denser than surface + wire, as in the series' solid mode.
function layerTargets() {
  return { surf: PARAMS.surface ? (PARAMS.wire ? 0.55 : 0.9) : 0, wire: PARAMS.wire ? 1 : 0 };
}

// Free play eases toggles; recording and ?preview use the targets directly.
function updateLayerMix() {
  const target = layerTargets();
  if (!freeCamera()) {
    sim.surf = target.surf;
    sim.wire = target.wire;
    return;
  }
  const k = 1 - Math.exp(-Math.min(deltaTime, 100) / 1000 / 0.3);
  sim.surf += (target.surf - sim.surf) * k;
  sim.wire += (target.wire - sim.wire) * k;
}

function renderFrame() {
  background(BG.r, BG.g, BG.b);
  computeFrameState(loopProgress);
  updateLayerMix();
  const fs = frameState;
  const basis = cameraBasis(currentCamera());
  perspective(CAMERA.fov, W / H, CAMERA.near, CAMERA.far);
  // Stroke widths in screen pixels, independent of the small scene units.
  linePerspective(false);
  camera(...basis.eye, ...basis.target, ...basis.up);
  const eyeDistance = Math.hypot(...basis.eye.map((value, i) => value - basis.target[i]));
  const k = fitScale(fs.R, fs.d);
  // No catenoid past d*: nothing invalid ever reaches the shader.
  if (fs.valid) drawSurface(k, eyeDistance * 0.92, eyeDistance * 1.25);
  push();
  drawGuides(k);
  pop();
}

function drawSurface(k, fogNear, fogFar) {
  const fs = frameState;
  if (sim.surf < 0.002 && sim.wire < 0.002) return;
  noStroke();
  fill(255);
  shader(surfaceShader);
  surfaceShader.setUniform("uSpin", fs.spin);
  surfaceShader.setUniform("uA", fs.a);
  surfaceShader.setUniform("uHalf", fs.d / 2);
  surfaceShader.setUniform("uK", k);
  surfaceShader.setUniform("uBase", colorVector(CYAN));
  surfaceShader.setUniform("uInk", colorVector(INK));
  surfaceShader.setUniform("uLight", PARAMS.light);
  surfaceShader.setUniform("uSurf", sim.surf);
  surfaceShader.setUniform("uWire", sim.wire);
  surfaceShader.setUniform("uFogNear", fogNear);
  surfaceShader.setUniform("uFogFar", fogFar);
  surfaceShader.setUniform("uMeridians", catenoidMesh.grid.meridians);
  surfaceShader.setUniform("uParallels", catenoidMesh.grid.parallels);
  surfaceShader.setUniform("uSweep", fs.sweep);
  for (const pass of [0, 1]) {
    surfaceShader.setUniform("uPass", pass);
    model(catenoidMesh.geometry);
  }
  resetShader();
}

function polyline(points) {
  beginShape();
  for (const p of points) vertex(...p);
  endShape();
}

function ringPoints(R, z, spin, k) {
  const points = [];
  for (let i = 0; i <= 160; i++) points.push(toWorld([R * Math.cos(TAU * i / 160), R * Math.sin(TAU * i / 160), z], spin, k));
  return points;
}

// Meridian u = const between the rings, lifted a hair off the surface.
function meridianPoints(u, a, d, spin, k, lift) {
  const points = [];
  for (let i = 0; i <= 96; i++) {
    const p = catenoidPoint(u, -d / 2 + d * i / 96, a);
    points.push(toWorld([p[0] * lift, p[1] * lift, p[2]], spin, k));
  }
  return points;
}

// Axis, boundary rings, the generating catenary and the curvature probe — strokes, crisp at any size.
function drawGuides(k) {
  const fs = frameState;
  const { a, d, R } = fs;
  noFill();
  stroke(INK.r, INK.g, INK.b, 70);
  strokeWeight(1.2);
  line(0, -k * d * 0.5, 0, 0, k * d * 0.5, 0);
  if (!fs.valid) {
    // Goldschmidt solution: the film has collapsed onto the two flat disks.
    drawingContext.depthMask(false);
    noStroke();
    fill(ACID.r, ACID.g, ACID.b, 30);
    for (const z of [-d / 2, d / 2]) {
      beginShape(TRIANGLE_FAN);
      vertex(...toWorld([0, 0, z], fs.spin, k));
      for (const p of ringPoints(R, z, fs.spin, k)) vertex(...p);
      endShape();
    }
    drawingContext.depthMask(true);
    noFill();
  }
  if (PARAMS.rings || !fs.valid) {
    stroke(INK.r, INK.g, INK.b, 235);
    strokeWeight(2.6);
    for (const z of [-d / 2, d / 2]) polyline(ringPoints(R * RING_LIFT, z, fs.spin, k));
  }
  if (!fs.valid) return;
  if (PARAMS.catenary) {
    // The generator rides the sweep's leading edge (u = 0 once the surface is whole).
    stroke(ACID.r, ACID.g, ACID.b, 240);
    strokeWeight(2.6);
    polyline(meridianPoints(TAU * fs.sweep, a, d, fs.spin, k, RING_LIFT));
  }
  const visibility = smoothstep(0.85, 1, fs.sweep);
  if (PARAMS.probe && visibility > 0.01) drawProbe(k, visibility);
}

// Probe: the meridian arc (κ₁ > 0, ACID) and the parallel arc (κ₂ < 0, MAGENTA) through one point,
// lifted along the normal — the two bends that cancel.
function drawProbe(k, visibility) {
  const fs = frameState;
  const { a, d } = fs;
  const { u, v } = probeParams(currentCamera());
  const lift = PROBE.lift / k;
  const onSurface = (uu, vv) => {
    const p = catenoidPoint(uu, vv, a);
    const n = catenoidNormal(uu, vv, a);
    return toWorld(p.map((value, i) => value + n[i] * lift), fs.spin, k);
  };
  const arc = PROBE.arc * d / 2;
  const r = a * Math.cosh(v / a);
  const meridian = [], parallel = [];
  for (let i = 0; i <= 24; i++) {
    const t = -1 + 2 * i / 24;
    meridian.push(onSurface(u, clamp(v + t * arc, -d / 2, d / 2)));
    parallel.push(onSurface(u + t * arc / r, v));
  }
  strokeWeight(2.4);
  stroke(ACID.r, ACID.g, ACID.b, 240 * visibility);
  polyline(meridian);
  stroke(MAGENTA.r, MAGENTA.g, MAGENTA.b, 240 * visibility);
  polyline(parallel);
  stroke(INK.r, INK.g, INK.b, 245 * visibility);
  strokeWeight(9);
  point(...onSurface(u, v));
}

// ================================================================
// HUD
// ================================================================

const OVERLAY = {
  hook: true,
  captions: [
    {
      // A real soap film only holds the stable branch; the parametric surface may be the thin one.
      window: null,
      first: () => PARAMS.geometry === "boundary" ? "A SOAP FILM SPANNING TWO RINGS" : "A MINIMAL SURFACE BETWEEN TWO RINGS",
      second: "MEAN CURVATURE H = 0 AT EVERY POINT",
    },
    {
      window: [0.07, 0.1, 0.22, 0.25],
      first: () => sweepOn() ? "UNWIND IT: ONE CATENARY r = a cosh(z/a)" : "κ₁ = 1 / a cosh²(v/a) ALONG THE MERIDIAN",
      second: () => sweepOn() ? "THE CURVE OF A HANGING CHAIN" : "κ₂ = −κ₁ AROUND THE PARALLEL",
    },
    {
      window: [0.25, 0.28, 0.4, 0.43],
      first: () => sweepOn() ? "REVOLVE IT ABOUT THE AXIS" : "THE TWO BENDS CANCEL EXACTLY",
      second: () => sweepOn() ? "u ∈ [0, 2π) SWEEPS OUT THE CATENOID" : "H = (κ₁ + κ₂) / 2 = 0",
    },
    {
      window: [0.46, 0.49, 0.62, 0.65],
      first: () => PARAMS.geometry === "boundary" ? "PULL THE RINGS APART: R = a cosh(d / 2a)" : "FREE WAIST a · HEIGHT d",
      second: () => PARAMS.geometry === "boundary" ? "THE WAIST a THINS TO KEEP H = 0" : "THE RINGS FOLLOW: R = a cosh(d / 2a)",
    },
    {
      window: [0.66, 0.69, 0.8, 0.83],
      first: () => PARAMS.geometry === "boundary" ? `PAST d/R = ${SEP_CRITICAL.toFixed(4)} NO CATENOID EXISTS` : `STABLE ONLY WHILE d / 2a < ${T_STAR.toFixed(4)}`,
      second: () => PARAMS.geometry === "boundary" ? "THE FILM WOULD SNAP INTO TWO DISKS" : "THE ROOT OF t tanh t = 1",
    },
    { window: [0.84, 0.87, 0.92, 0.95], first: "BESIDES THE PLANE, THE ONLY", second: "MINIMAL SURFACE OF REVOLUTION" },
  ],
  invalid: {
    first: `NO CATENOID FOR d/R > ${SEP_CRITICAL.toFixed(4)}`,
    second: "THE FILM SNAPS INTO TWO DISKS · A = 2πR²",
  },
};

function captionText(value) {
  return typeof value === "function" ? value() : value;
}

const HUD_TEXT = {
  title: "CATENOID",
  subtitle: "MINIMAL SURFACE · H = 0",
  formula: "X(u,v) = (a cosh(v/a) cos u, a cosh(v/a) sin u, v)",
  condition: "H = (κ₁ + κ₂) / 2 = 0  ·  R = a cosh(d / 2a)",
  citation: "A = πa (d + a sinh(d/a))  ·  K = −1 / a² cosh⁴(v/a)",
};

function readoutText(fs) {
  if (PARAMS.geometry === "boundary") return `d/R = ${(fs.d / fs.R).toFixed(3)} · d*/R = ${SEP_CRITICAL.toFixed(4)}`;
  return `d/2a = ${(fs.d / (2 * fs.a)).toFixed(3)} · t* = ${T_STAR.toFixed(4)}`;
}

function branchText(fs) {
  if (!fs.valid) return "NO CATENOID";
  return fs.branch === "stable" ? "STABLE BRANCH" : "UNSTABLE BRANCH";
}

function formatInt(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Signed fixed-point that never prints "−0.0000".
function formatSigned(value, digits) {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return (0).toFixed(digits);
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(digits)}`;
}

function probeCurvature() {
  const fs = frameState;
  const { u, v } = probeParams(currentCamera());
  return { v, ...numericCurvature(u, v, fs.a) };
}

function dataRows(fs) {
  const grid = gridLines(PARAMS.res);
  const left = [
    ["WAIST RADIUS", fs.valid ? `a = ${fs.a.toFixed(4)}` : "a = —"],
    ["RING RADIUS", `R = ${fs.R.toFixed(4)}`],
    ["RING SEPARATION", `d = ${fs.d.toFixed(4)}`],
    ["PARAMETRIC GRID", `${grid.meridians} × ${grid.parallels}`],
  ];
  if (!fs.valid) {
    return {
      left,
      right: [
        ["SURFACE AREA", "A = —"],
        ["TWO DISKS", `2πR² = ${disksArea(fs.R).toFixed(4)}`],
        ["AREA / 2πR²", "—"],
        ["MEAN CURVATURE", "H = —"],
      ],
    };
  }
  const area = catenoidArea(fs.a, fs.d);
  const curvature = probeCurvature();
  return {
    left,
    right: [
      ["SURFACE AREA", `A = ${area.toFixed(4)}`],
      ["TWO DISKS", `2πR² = ${disksArea(fs.R).toFixed(4)}`],
      ["AREA / 2πR²", (area / disksArea(fs.R)).toFixed(4)],
      ["MEAN CURVATURE", `H = ${formatSigned(curvature.H, 4)}`],
    ],
  };
}

function drawDataColumns(graphics) {
  const rows = dataRows(frameState);
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  const column = (list, x, align) => {
    graphics.textAlign(align, TOP);
    list.forEach(([label, value], i) => {
      const y = HUD.dataY + i * HUD.dataRow;
      graphics.textSize(22);
      graphics.fill(INK.r, INK.g, INK.b, 150);
      graphics.text(label, x, y);
      graphics.textSize(26);
      const highlight = label === "AREA / 2πR²" || label === "MEAN CURVATURE";
      if (highlight) graphics.fill(ACID.r, ACID.g, ACID.b, 240);
      else graphics.fill(INK.r, INK.g, INK.b, 235);
      graphics.text(value, x, y + 26);
    });
  };
  column(rows.left, HUD.stageTextX, LEFT);
  column(rows.right, W - HUD.stageTextX, RIGHT);
}

// Generating catenary r(z) = a cosh(z/a) in the meridian plane, axis of revolution along the bottom.
// Boundary mode keeps z fixed to the widest separation, so the rings visibly move apart, and adds the
// unstable thin branch (dotted). Past d* only the two disks (vertical bars) remain.
function profileFrame(fs) {
  const zMax = PARAMS.geometry === "boundary" ? LIMITS.maxSep * fs.R / 2 : fs.d / 2;
  const rMax = fs.R * 1.1;
  const x = (z) => lerp1(PROFILE.x0, PROFILE.x1, (z + zMax) / (2 * zMax));
  const y = (r) => lerp1(PROFILE.y1, PROFILE.y0, r / rMax);
  return { x, y };
}

function drawProfile(graphics) {
  if (!PARAMS.catenary) return;
  const fs = frameState;
  const frame = profileFrame(fs);
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(22);
  graphics.noStroke();
  graphics.textAlign(LEFT, CENTER);
  graphics.fill(INK.r, INK.g, INK.b, 150);
  graphics.text("CATENARY r = a cosh(z/a)", HUD.stageTextX, PROFILE.headerY);
  graphics.textAlign(RIGHT, CENTER);
  if (!fs.valid) {
    graphics.fill(ACID.r, ACID.g, ACID.b, 240);
    graphics.text("NO SOLUTION", PROFILE.x1, PROFILE.headerY);
  } else if (PARAMS.geometry === "boundary") {
    const unstable = `THIN a ${fs.altA.toFixed(3)}`;
    graphics.fill(INK.r, INK.g, INK.b, 150);
    graphics.text(unstable, PROFILE.x1, PROFILE.headerY);
    graphics.fill(ACID.r, ACID.g, ACID.b, 240);
    graphics.text(`WIDE a ${fs.a.toFixed(3)}`, PROFILE.x1 - graphics.textWidth(unstable) - 28, PROFILE.headerY);
  } else {
    graphics.fill(ACID.r, ACID.g, ACID.b, 240);
    graphics.text(`a ${fs.a.toFixed(3)} · R ${fs.R.toFixed(3)}`, PROFILE.x1, PROFILE.headerY);
  }
  // Axis of revolution (r = 0) and the ring radius, dashed.
  graphics.stroke(INK.r, INK.g, INK.b, 60);
  graphics.strokeWeight(1);
  const yR = frame.y(fs.R);
  for (let px = PROFILE.x0; px < PROFILE.x1; px += 14) {
    graphics.line(px, PROFILE.y1, Math.min(px + 7, PROFILE.x1), PROFILE.y1);
    graphics.line(px, yR, Math.min(px + 7, PROFILE.x1), yR);
  }
  graphics.noStroke();
  graphics.fill(INK.r, INK.g, INK.b, 150);
  graphics.textAlign(RIGHT, CENTER);
  graphics.text("R", PROFILE.x0 - 14, yR);
  graphics.text("0", PROFILE.x0 - 14, PROFILE.y1);
  const xL = frame.x(-fs.d / 2), xR = frame.x(fs.d / 2);
  // The rings seen edge-on: bars from the axis up to R (solid ACID once they are the whole film).
  if (fs.valid) graphics.stroke(INK.r, INK.g, INK.b, 60);
  else graphics.stroke(ACID.r, ACID.g, ACID.b, 230);
  graphics.strokeWeight(fs.valid ? 1 : 2.4);
  graphics.line(xL, PROFILE.y1, xL, yR);
  graphics.line(xR, PROFILE.y1, xR, yR);
  if (fs.valid) {
    const curve = (a) => {
      const points = [];
      for (let i = 0; i <= 120; i++) {
        const z = -fs.d / 2 + fs.d * i / 120;
        points.push([frame.x(z), frame.y(a * Math.cosh(z / a))]);
      }
      return points;
    };
    graphics.noFill();
    if (Number.isFinite(fs.altA)) {
      const thin = curve(fs.altA);
      graphics.stroke(INK.r, INK.g, INK.b, 110);
      graphics.strokeWeight(1.4);
      for (let i = 1; i < thin.length; i++) if (i % 2) graphics.line(...thin[i - 1], ...thin[i]);
    }
    const wide = curve(fs.a);
    graphics.stroke(ACID.r, ACID.g, ACID.b, 230);
    graphics.strokeWeight(2.4);
    for (let i = 1; i < wide.length; i++) graphics.line(...wide[i - 1], ...wide[i]);
    // Waist a at z = 0.
    graphics.stroke(INK.r, INK.g, INK.b, 80);
    graphics.strokeWeight(1);
    graphics.line(frame.x(0), PROFILE.y1, frame.x(0), frame.y(fs.a));
    if (PARAMS.probe) {
      graphics.noStroke();
      graphics.fill(MAGENTA.r, MAGENTA.g, MAGENTA.b, 240 * smoothstep(0.85, 1, fs.sweep));
      graphics.circle(frame.x(fs.probeV), frame.y(fs.a * Math.cosh(fs.probeV / fs.a)), 9);
    }
  }
  graphics.noStroke();
  graphics.fill(INK.r, INK.g, INK.b, 245);
  for (const px of [xL, xR]) graphics.circle(px, yR, 8);
}

// Probe readout parked in the free right column (under the data rows), with a leader to the point.
function drawProbeLabel(graphics) {
  const fs = frameState;
  const visibility = smoothstep(0.85, 1, fs.sweep);
  if (!PARAMS.probe || !fs.valid || visibility <= 0.01) return;
  const curvature = probeCurvature();
  const k = fitScale(fs.R, fs.d);
  const cam = currentCamera();
  const basis = cameraBasis(cam);
  const { u, v } = probeParams(cam);
  const p = projectPoint(basis, toWorld(catenoidPoint(u, v, fs.a), fs.spin, k));
  const lx = W - HUD.stageTextX;
  const ly = clamp(p[1], HUD.dataY + 4 * HUD.dataRow + 70, PROFILE.headerY - 100);
  const lines = [
    [`κ₁ ${formatSigned(curvature.k1, 4)}`, ACID],
    [`κ₂ ${formatSigned(curvature.k2, 4)}`, MAGENTA],
    [`H  ${formatSigned(curvature.H, 4)}`, INK],
  ];
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(22);
  graphics.textAlign(RIGHT, CENTER);
  const labelLeft = lx - Math.max(...lines.map(([text]) => graphics.textWidth(text)));
  graphics.stroke(INK.r, INK.g, INK.b, 120 * visibility);
  graphics.strokeWeight(1);
  graphics.line(p[0], p[1], labelLeft - 12, ly);
  graphics.noStroke();
  lines.forEach(([text, colorValue], i) => {
    graphics.fill(colorValue.r, colorValue.g, colorValue.b, 235 * visibility);
    graphics.text(text, lx, ly + (i - 1) * 28);
  });
}

// HUD — fonts, sizes, hierarchy, and anchors retained from the series.
function drawScreenFinish() {
  const graphics = hudPg;
  const fs = frameState;
  graphics.clear();
  graphics.image(grainPg, 0, 0);
  drawCornerGuides(graphics);
  graphics.noStroke();
  graphics.textAlign(CENTER, CENTER);
  graphics.textFont("Georgia");
  graphics.textStyle(BOLD);
  graphics.textSize(72);
  graphics.fill(INK.r, INK.g, INK.b, 245);
  graphics.text(HUD_TEXT.title, W / 2, HUD.titleY);
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(34);
  graphics.fill(INK.r, INK.g, INK.b, 228);
  graphics.text(HUD_TEXT.subtitle, W / 2, HUD.formulaY);
  graphics.textSize(23);
  graphics.fill(CYAN.r, CYAN.g, CYAN.b, 220);
  graphics.text(HUD_TEXT.formula, W / 2, HUD.exponentY);
  graphics.textSize(26);
  graphics.fill(INK.r, INK.g, INK.b, 215);
  graphics.text(HUD_TEXT.condition, W / 2, HUD.subtitleY);

  graphics.textAlign(LEFT, TOP);
  graphics.fill(INK.r, INK.g, INK.b, 235);
  graphics.text(readoutText(fs), HUD.stageTextX, HUD.stageY);
  graphics.fill(ACID.r, ACID.g, ACID.b, 240);
  graphics.textAlign(RIGHT, TOP);
  graphics.textSize(22);
  graphics.text(branchText(fs), W - HUD.rightTextX, HUD.stageY + 3);
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

  if (sim.layers.math) drawDataColumns(graphics);
  drawProfile(graphics);
  drawProbeLabel(graphics);

  graphics.noStroke();
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textAlign(CENTER, CENTER);
  graphics.textSize(28);
  if (!fs.valid) {
    graphics.fill(INK.r, INK.g, INK.b, HUD.bottomMainAlpha);
    graphics.text(OVERLAY.invalid.first, W / 2, HUD.bottomTextY);
    graphics.text(OVERLAY.invalid.second, W / 2, HUD.bottomTextY + 38);
  } else if (OVERLAY.hook) {
    const p = loopProgress;
    for (const caption of OVERLAY.captions) {
      const weight = caption.window
        ? envelope(p, caption.window)
        : 1 - smoothstep(0.04, 0.07, p) + smoothstep(0.95, 0.99, p);
      if (weight <= 0.01) continue;
      graphics.fill(INK.r, INK.g, INK.b, HUD.bottomMainAlpha * weight);
      graphics.text(captionText(caption.first), W / 2, HUD.bottomTextY);
      graphics.text(captionText(caption.second), W / 2, HUD.bottomTextY + 38);
    }
  }
  graphics.textSize(22);
  graphics.fill(INK.r, INK.g, INK.b, HUD.citationAlpha);
  graphics.text(HUD_TEXT.citation, W / 2, HUD.citationY);
  compositeHUD(graphics);
}

// ================================================================
// AUDIT — ?audit=1 checks t*, the boundary solver on both branches, H = 0 and K by finite differences,
// normals, mesh-area convergence, the grid, framing, typography fit and the loop seam
// (report stored on window.catenoidAudit).
// ================================================================

function auditMath() {
  const critical = {
    tStar: T_STAR,
    residual: Math.abs(T_STAR * Math.tanh(T_STAR) - 1),
    sepCritical: SEP_CRITICAL,
  };
  critical.ok = critical.residual < 1e-14 && Math.abs(SEP_CRITICAL - 1.3254868) < 1e-6;

  const solver = { maxResidual: 0, solved: 0, rejected: 0, misses: 0, branchOrder: true, nonFinite: 0 };
  for (const R of [0.5, 1, 2]) {
    for (let i = 1; i <= 800; i++) {
      const ratio = 1.6 * i / 800;
      const solution = solveBoundary(R, ratio * R);
      if (ratio < SEP_CRITICAL * (1 - 1e-9)) {
        if (!solution) { solver.misses++; continue; }
        solver.solved++;
        for (const branch of [solution.stable, solution.unstable]) {
          if (!Number.isFinite(branch.a) || branch.a <= 0) solver.nonFinite++;
          solver.maxResidual = Math.max(solver.maxResidual, Math.abs(ringRadius(branch.a, ratio * R) - R) / R);
        }
        if (!(solution.stable.a > solution.unstable.a && solution.stable.t <= T_STAR && solution.unstable.t >= T_STAR)) solver.branchOrder = false;
      } else if (ratio > SEP_CRITICAL * (1 + 1e-9)) {
        if (solution) solver.misses++;
        else solver.rejected++;
      }
    }
  }
  solver.ok = solver.maxResidual < 1e-12 && solver.misses === 0 && solver.branchOrder && solver.nonFinite === 0 && solver.rejected > 0;

  const curvature = { maxMeanTimesA: 0, maxGaussError: 0, maxKappaError: 0, maxNormalError: 0, samples: 0 };
  for (const a of [0.5, 0.85, 1.5]) {
    for (let i = -10; i <= 10; i++) {
      const v = 0.3 * i * a;
      for (const u of [0, 0.7, 2.1, 4.4]) {
        const c = numericCurvature(u, v, a);
        const kappa = principalCurvature(v, a);
        curvature.maxMeanTimesA = Math.max(curvature.maxMeanTimesA, Math.abs(c.H) * a);
        curvature.maxGaussError = Math.max(curvature.maxGaussError, Math.abs(c.K + kappa * kappa) / (kappa * kappa));
        curvature.maxKappaError = Math.max(curvature.maxKappaError, Math.abs(c.k1 - kappa) / kappa, Math.abs(c.k2 + kappa) / kappa);
        const n = catenoidNormal(u, v, a);
        curvature.maxNormalError = Math.max(curvature.maxNormalError, Math.abs(Math.hypot(...n) - 1), Math.hypot(...n.map((value, j) => value - c.normal[j])));
        curvature.samples++;
      }
    }
  }
  curvature.ok = curvature.maxMeanTimesA < 1e-5 && curvature.maxGaussError < 1e-4 && curvature.maxKappaError < 1e-4 && curvature.maxNormalError < 1e-6;

  // Inscribed mesh area → closed form, error ∝ 1/n²: doubling both segment counts cuts it ~4×.
  const area = { cases: [] };
  for (const [a, d] of [[0.85, 1.2], [0.5, 3], [1.5, 0.5]]) {
    const exact = catenoidArea(a, d);
    const errors = [12, 24, 48].map((res) => {
      const grid = catenoidGrid(res);
      return (exact - meshArea(grid, a, d)) / exact;
    });
    area.cases.push({ a, d, exact, errors, ratios: [errors[0] / errors[1], errors[1] / errors[2]] });
  }
  // catenoidGrid keeps ≥ 144 × 96 segments, so refine the grid directly for the convergence rate.
  const rate = [];
  for (const [segU, segV] of [[24, 16], [48, 32], [96, 64]]) {
    const grid = { params: new Float64Array(2 * (segU + 1) * (segV + 1)), faces: new Int32Array(6 * segU * segV) };
    for (let j = 0; j <= segV; j++) for (let i = 0; i <= segU; i++) {
      const index = j * (segU + 1) + i;
      grid.params[2 * index] = i / segU;
      grid.params[2 * index + 1] = -1 + 2 * j / segV;
    }
    let f = 0;
    for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
      const c0 = j * (segU + 1) + i;
      grid.faces.set([c0, c0 + 1, c0 + segU + 2, c0, c0 + segU + 2, c0 + segU + 1], f);
      f += 6;
    }
    rate.push((catenoidArea(0.85, 1.2) - meshArea(grid, 0.85, 1.2)) / catenoidArea(0.85, 1.2));
  }
  area.rateErrors = rate;
  area.rateRatios = [rate[0] / rate[1], rate[1] / rate[2]];
  area.ok = area.rateRatios.every((ratio) => ratio > 3.5 && ratio < 4.5) &&
    area.cases.every((c) => c.errors.every((e) => e > 0 && e < 1e-3));

  // Where the stable catenoid stops beating the two disks (R = 1): A(d) = 2π.
  const excess = (d) => catenoidArea(solveBoundary(1, d).stable.a, d) - disksArea(1);
  const crossover = excess(0.2) < 0 && excess(SEP_CRITICAL * (1 - 1e-9)) > 0
    ? bisectRoot(excess, 0.2, SEP_CRITICAL * (1 - 1e-9))
    : NaN;

  // Mirror symmetry z ↦ −z about the waist and closure of the seam u = 0 ≡ 2π.
  let symmetry = 0;
  for (const v of [0.1, 0.4, 0.9]) {
    const p = catenoidPoint(1.3, v, 0.8), q = catenoidPoint(1.3, -v, 0.8);
    symmetry = Math.max(symmetry, Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] + q[2]));
    const s0 = catenoidPoint(0, v, 0.8), s1 = catenoidPoint(TAU, v, 0.8);
    symmetry = Math.max(symmetry, ...s0.map((value, i) => Math.abs(value - s1[i])));
  }

  return {
    critical, solver, curvature, area, crossover, symmetry,
    ok: critical.ok && solver.ok && curvature.ok && area.ok && Number.isFinite(crossover) && symmetry < 1e-12,
  };
}

function auditGrid() {
  const rows = [];
  for (let res = LIMITS.minRes; res <= LIMITS.maxRes; res += 4) {
    const grid = catenoidGrid(res);
    let finite = true;
    for (const [a, d] of [[0.5, 3], [1.5, 0.5]]) {
      for (let index = 0; index < grid.params.length / 2; index++) {
        const p = catenoidPoint(TAU * grid.params[2 * index], grid.params[2 * index + 1] * d / 2, a);
        if (!p.every(Number.isFinite)) finite = false;
      }
    }
    rows.push({
      res, segU: grid.segU, segV: grid.segV, triangles: grid.faces.length / 3,
      aligned: grid.segU % grid.meridians === 0 && grid.segV % grid.parallels === 0 && grid.parallels % 2 === 0,
      finite,
    });
  }
  return { rows, ok: rows.every((row) => row.aligned && row.finite) };
}

function captionRows() {
  const rows = [];
  const saved = { geometry: PARAMS.geometry, animate: PARAMS.animate };
  for (const geometry of GEOMETRY_KEYS) {
    for (const animate of [true, false]) {
      PARAMS.geometry = geometry;
      PARAMS.animate = animate;
      for (const caption of OVERLAY.captions) rows.push(captionText(caption.first), captionText(caption.second));
    }
  }
  Object.assign(PARAMS, saved);
  rows.push(OVERLAY.invalid.first, OVERLAY.invalid.second);
  return rows;
}

function auditTypography() {
  const graphics = hudPg;
  const rows = [
    ["Georgia", BOLD, 72, HUD_TEXT.title],
    ["monospace", NORMAL, 34, HUD_TEXT.subtitle],
    ["monospace", NORMAL, 23, HUD_TEXT.formula],
    ["monospace", NORMAL, 26, HUD_TEXT.condition],
    ["monospace", NORMAL, 22, HUD_TEXT.citation],
    ...captionRows().map((text) => ["monospace", NORMAL, 28, text]),
  ];
  let widest = 0;
  for (const [font, style, size, text] of rows) {
    graphics.textFont(font);
    graphics.textStyle(style);
    graphics.textSize(size);
    widest = Math.max(widest, graphics.textWidth(text));
  }
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  // Widest stage readout / branch label and data values at the extremes the sliders reach.
  const savedState = { ...frameState };
  const saved = { geometry: PARAMS.geometry, a: PARAMS.a, height: PARAMS.height, sep: PARAMS.sep, res: PARAMS.res };
  let left = 0, leftColumn = 0, rightColumn = 0;
  const states = [
    { geometry: "parametric", a: 0.5, height: 3, res: 72 },
    { geometry: "parametric", a: 1.5, height: 3, res: 72 },
    { geometry: "boundary", sep: 1.32, res: 72 },
    { geometry: "boundary", sep: 1.6, res: 72 },
  ];
  for (const state of states) {
    Object.assign(PARAMS, state);
    Object.assign(frameState, geometryAt(0));
    graphics.textSize(26);
    left = Math.max(left, HUD.stageTextX + graphics.textWidth(readoutText(frameState)));
    const rowsData = dataRows(frameState);
    for (const [list, side] of [[rowsData.left, "l"], [rowsData.right, "r"]]) {
      for (const [label, value] of list) {
        graphics.textSize(22);
        let width = graphics.textWidth(label);
        graphics.textSize(26);
        width = Math.max(width, graphics.textWidth(value));
        if (side === "l") leftColumn = Math.max(leftColumn, width);
        else rightColumn = Math.max(rightColumn, width);
      }
    }
  }
  Object.assign(PARAMS, saved);
  Object.assign(frameState, savedState);
  graphics.textSize(22);
  const right = W - HUD.rightTextX - Math.max(...["NO CATENOID", "STABLE BRANCH", "UNSTABLE BRANCH"].map((text) => graphics.textWidth(text)));
  return {
    widestLine: Math.round(widest),
    available: W - 2 * HUD.safeX,
    stageGap: Math.round(right - left),
    leftColumnEnd: Math.round(HUD.stageTextX + leftColumn),
    rightColumnStart: Math.round(W - HUD.stageTextX - rightColumn),
  };
}

// Projected bbox of the surface and rings over the loop, against the HUD bands and the data columns.
function auditFraming(config, typography) {
  const saved = { ...PARAMS };
  Object.assign(PARAMS, config);
  const framing = { ...config, top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity };
  const dataBottom = HUD.dataY + 4 * HUD.dataRow;
  for (let frame = 0; frame < LOOP_FRAMES; frame += 6) {
    computeFrameState(frame / LOOP_FRAMES);
    const fs = frameState;
    const basis = cameraBasis(fs.cam);
    const k = fitScale(fs.R, fs.d);
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j < 48; j++) {
        const v = -fs.d / 2 + fs.d * i / 8;
        const point = fs.valid ? catenoidPoint(TAU * j / 48, v, fs.a) : [fs.R * Math.cos(TAU * j / 48), fs.R * Math.sin(TAU * j / 48), v];
        const p = projectPoint(basis, toWorld(point, fs.spin, k));
        framing.top = Math.min(framing.top, Math.round(p[1]));
        framing.bottom = Math.max(framing.bottom, Math.round(p[1]));
        framing.left = Math.min(framing.left, Math.round(p[0]));
        framing.right = Math.max(framing.right, Math.round(p[0]));
      }
    }
  }
  Object.assign(PARAMS, saved);
  framing.clearsTrack = framing.top > HUD.trackY + 12;
  framing.clearsProfile = framing.bottom < PROFILE.headerY - 20;
  framing.clearsColumns = framing.left > typography.leftColumnEnd + 12 && framing.right < typography.rightColumnStart - 12 ||
    framing.top > dataBottom;
  return framing;
}

function runAudit() {
  const t0 = performance.now();
  const typography = auditTypography();
  const report = {
    math: auditMath(),
    grid: auditGrid(),
    typography,
    framing: [
      { geometry: PARAMS.geometry },
      { geometry: "parametric", a: 0.5, height: 3 },
      { geometry: "parametric", a: 1.5, height: 3 },
      { geometry: "parametric", a: 1.5, height: 0.5 },
      { geometry: "parametric", a: 0.5, height: 0.5 },
      { geometry: "boundary", sep: 0.2 },
      { geometry: "boundary", sep: 0.9 },
      { geometry: "boundary", sep: 1.6 },
    ].map((config) => auditFraming(config, typography)),
    loop: {},
  };
  const saved = { geometry: PARAMS.geometry, animate: PARAMS.animate, catenary: PARAMS.catenary };
  const snapshot = () => {
    const fs = frameState;
    return [Math.cos(fs.spin), Math.sin(fs.spin), fs.sweep, fs.stretch, fs.a, fs.d, fs.R, fs.probeV, ...Object.values(fs.cam)];
  };
  const step = (p, q) => Math.max(...p.map((value, i) => Math.abs(value - q[i])));
  for (const geometry of GEOMETRY_KEYS) {
    Object.assign(PARAMS, { geometry, animate: true, catenary: true });
    let previous = null, first = null, maxInteriorStep = 0, maxDStep = 0, valid = true;
    for (let frame = 0; frame < LOOP_FRAMES; frame++) {
      computeFrameState(frame / LOOP_FRAMES);
      const current = snapshot();
      valid = valid && frameState.valid && Number.isFinite(frameState.a) && frameState.a > 0;
      if (previous) {
        maxInteriorStep = Math.max(maxInteriorStep, step(current, previous));
        maxDStep = Math.max(maxDStep, Math.abs(current[5] - previous[5]));
      } else first = current;
      previous = current;
    }
    report.loop[geometry] = { seamStep: step(first, previous), maxInteriorStep, maxDStep, allValid: valid };
  }
  Object.assign(PARAMS, saved);
  report.loop.frames = LOOP_FRAMES;
  report.loop.seconds = LOOP_FRAMES / FPS;
  report.auditMs = performance.now() - t0;
  report.ok = report.math.ok && report.grid.ok &&
    report.framing.every((f) => f.clearsTrack && f.clearsProfile && f.clearsColumns) &&
    typography.widestLine <= typography.available && typography.stageGap > 20 &&
    GEOMETRY_KEYS.every((key) => report.loop[key].seamStep <= report.loop[key].maxInteriorStep * 1.01 && report.loop[key].allValid);
  computeFrameState(loopProgress);
  console.log("[catenoid audit]", JSON.stringify(report, null, 2));
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

// ?geo=parametric&a=0.6&height=2.4 — or ?geo=boundary&sep=1.2; also res, spin, light, animate=0, hook=0.
function applyUrlParams() {
  const geometry = (urlParam("geo") || "").toLowerCase();
  if (GEOMETRY_KEYS.includes(geometry)) PARAMS.geometry = geometry;
  const numeric = (name, key) => {
    const value = Number(urlParam(name));
    if (urlParam(name) !== null && Number.isFinite(value)) PARAMS[key] = value;
  };
  numeric("a", "a");
  numeric("height", "height");
  numeric("sep", "sep");
  numeric("res", "res");
  numeric("spin", "spinTurns");
  numeric("light", "light");
  for (const key of ["surface", "wire", "rings", "catenary", "probe", "animate"]) {
    if (urlParam(key) === "0") PARAMS[key] = false;
  }
  if (urlParam("hook") === "0") OVERLAY.hook = false;
  sanitizeParams();
  computeFrameState(0);
  const target = layerTargets();
  sim.surf = target.surf;
  sim.wire = target.wire;
}

function sanitizeParams() {
  if (!GEOMETRY_KEYS.includes(PARAMS.geometry)) PARAMS.geometry = "boundary";
  PARAMS.a = clamp(PARAMS.a, LIMITS.minA, LIMITS.maxA);
  PARAMS.height = clamp(PARAMS.height, LIMITS.minHeight, LIMITS.maxHeight);
  PARAMS.sep = clamp(PARAMS.sep, LIMITS.minSep, LIMITS.maxSep);
  // Multiples of 4 keep the parallel count even, so the waist v = 0 is always a grid line.
  PARAMS.res = clamp(Math.round(PARAMS.res / 4) * 4, LIMITS.minRes, LIMITS.maxRes);
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
  aSlider: ["a", (v) => v.toFixed(2)],
  heightSlider: ["height", (v) => v.toFixed(2)],
  sepSlider: ["sep", (v) => `${v.toFixed(2)}  (d/R)`],
  resSlider: ["res", (v) => `${v} × ${gridLines(v).parallels} lines`],
  spinSlider: ["spinTurns", (v) => `${v.toFixed(0)} turn / loop`],
  lightSlider: ["light", (v) => v.toFixed(2)],
};

// In each mode the constrained quantities are read-only: they show the live derived value.
function derivedSliderIds() {
  return PARAMS.geometry === "boundary" ? ["aSlider", "heightSlider"] : ["sepSlider"];
}

const TOGGLES = {
  showSurface: "surface",
  showWire: "wire",
  showRings: "rings",
  showCatenary: "catenary",
  showProbe: "probe",
  showAnimate: "animate",
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
      sanitizeParams();
      syncMesh();
      computeFrameState(loopProgress);
      syncControls();
    };
  }
  const onClick = (id, handler) => {
    const element = getElement(id);
    if (element) element.onclick = handler;
  };
  GEOMETRY_KEYS.forEach((key) => onClick(`geo-${key}`, () => selectGeometry(key)));
  onClick("pauseBtn", togglePause);
  onClick("cameraBtn", resetCamera);
  onClick("resetBtn", resetSimulator);
  for (const [id, key] of Object.entries(TOGGLES)) {
    const element = getElement(id);
    if (element) element.onchange = () => {
      PARAMS[key] = element.checked;
      computeFrameState(loopProgress);
      syncControls();
    };
  }
  const hook = getElement("showHook");
  if (hook) hook.onchange = () => { OVERLAY.hook = hook.checked; };
  const math = getElement("showMath");
  if (math) math.onchange = () => {
    sim.layers.math = math.checked;
    syncControls();
  };
}

const DEFAULT_PARAMS = { ...PARAMS };

// Switching hands over the current (unstretched) surface: boundary → parametric keeps a and d
// (R = 1 exactly); parametric → boundary keeps d/R and shows the stable catenoid on those rings,
// which differs when the parametric surface was on the thin, unstable branch.
function selectGeometry(key) {
  if (isRecording || key === PARAMS.geometry) return;
  const current = geometryAt(0);
  if (key === "parametric" && current.valid) {
    PARAMS.a = current.a;
    PARAMS.height = current.d;
  } else if (key === "boundary") {
    PARAMS.sep = current.d / current.R;
  }
  PARAMS.geometry = key;
  sanitizeParams();
  computeFrameState(loopProgress);
  syncControls();
}

function togglePause() {
  if (isRecording) return;
  sim.paused = !sim.paused;
  syncControls();
}

function resetCamera() {
  if (isRecording) return;
  sim.dragYaw = 0;
  sim.dragTilt = 0;
}

function resetSimulator() {
  if (isRecording) return;
  Object.assign(PARAMS, DEFAULT_PARAMS);
  syncMesh();
  Object.assign(sim, { paused: false, playhead: 0, dragYaw: 0, dragTilt: 0 });
  sim.layers.math = true;
  OVERLAY.hook = true;
  computeFrameState(0);
  syncControls();
}

const CONTROL_IDS = [
  ...Object.keys(SLIDERS),
  ...GEOMETRY_KEYS.map((key) => `geo-${key}`),
  ...Object.keys(TOGGLES),
  "pauseBtn", "cameraBtn", "resetBtn", "showHook", "showMath",
];

function syncDerivedSliders() {
  const fs = frameState;
  for (const id of derivedSliderIds()) {
    const element = getElement(id);
    let value, label;
    if (id === "aSlider") {
      value = fs.valid ? fs.a : LIMITS.minA;
      label = fs.valid ? `${fs.a.toFixed(3)}  (solved)` : "—  (no solution)";
    } else if (id === "heightSlider") {
      value = fs.d;
      label = `${fs.d.toFixed(2)}  (= d)`;
    } else {
      value = fs.d / fs.R;
      label = `${fs.d.toFixed(2)}  (d/R ${(fs.d / fs.R).toFixed(3)})`;
    }
    if (element) element.value = value;
    setText(id.replace("Slider", "Value"), label);
  }
}

function syncControls() {
  for (const [id, [key, format]] of Object.entries(SLIDERS)) {
    const element = getElement(id);
    if (element) element.value = PARAMS[key];
    setText(id.replace("Slider", "Value"), format(PARAMS[key]));
  }
  syncDerivedSliders();
  GEOMETRY_KEYS.forEach((key) => {
    const element = getElement(`geo-${key}`);
    if (element) element.style.borderColor = key === PARAMS.geometry ? "rgba(255,255,255,0.6)" : "";
  });
  setText("modeValue", PARAMS.geometry === "boundary"
    ? "boundary rings — R = 1 fixed · a solved"
    : "parametric — a, d free · R derived");
  for (const [id, key] of Object.entries(TOGGLES)) {
    const element = getElement(id);
    if (element) element.checked = PARAMS[key];
  }
  const hook = getElement("showHook");
  if (hook) hook.checked = OVERLAY.hook;
  const mathToggle = getElement("showMath");
  if (mathToggle) mathToggle.checked = sim.layers.math;
  setText("pauseBtn", sim.paused ? "Play" : "Pause");
  const math = getElement("math");
  if (math) math.hidden = !sim.layers.math;
  const derived = derivedSliderIds();
  for (const id of CONTROL_IDS) setDisabled(id, isRecording || derived.includes(id));
}

function updateLiveUI() {
  if (frameCount % 6 !== 0) return;
  syncDerivedSliders();
  if (!sim.layers.math) return;
  const fs = frameState;
  const grid = catenoidMesh ? catenoidMesh.grid : catenoidGrid(PARAMS.res);
  setText("geoValue", fs.valid
    ? `a ${fs.a.toFixed(5)} · R ${fs.R.toFixed(5)} · d ${fs.d.toFixed(5)}`
    : `no catenoid · R ${fs.R.toFixed(5)} · d ${fs.d.toFixed(5)}`);
  if (PARAMS.geometry === "boundary") {
    setText("solveValue", fs.valid
      ? `|a cosh(d/2a) − R| = ${Math.abs(ringRadius(fs.a, fs.d) - fs.R).toExponential(1)} · thin a ${fs.altA.toFixed(5)}`
      : `d/R ${(fs.d / fs.R).toFixed(4)} > d*/R ${SEP_CRITICAL.toFixed(5)}`);
  } else {
    setText("solveValue", `d/2a ${(fs.d / (2 * fs.a)).toFixed(4)} ${fs.branch === "stable" ? "≤" : ">"} t* ${T_STAR.toFixed(5)} · ${fs.branch}`);
  }
  if (fs.valid) {
    const c = probeCurvature();
    setText("curvValue", `v ${formatSigned(c.v, 3)} · κ₁ ${c.k1.toFixed(5)} · κ₂ ${c.k2.toFixed(5)} · H ${c.H.toExponential(1)}`);
    const area = catenoidArea(fs.a, fs.d);
    setText("areaValue", `A ${area.toFixed(5)} · 2πR² ${disksArea(fs.R).toFixed(5)} · ratio ${(area / disksArea(fs.R)).toFixed(4)}`);
  } else {
    setText("curvValue", "—");
    setText("areaValue", `two disks · 2πR² ${disksArea(fs.R).toFixed(5)}`);
  }
  setText("meshValue", `${grid.meridians} × ${grid.parallels} lines · ${grid.segU} × ${grid.segV} cells · ${formatInt(grid.faces.length / 3)} triangles`);
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

// Debug orbit — ignored while recording or previewing a fixed frame. Touch drags arrive here too
// (p5 forwards touchmove to mouseDragged); they carry no movementX, so fall back to the delta.
function mouseDragged(event) {
  if (isRecording || !event || event.target !== canvasEl) return true;
  const touch = typeof TouchEvent !== "undefined" && event instanceof TouchEvent;
  const dx = touch || !Number.isFinite(movedX) ? mouseX - pmouseX : movedX;
  const dy = touch || !Number.isFinite(movedY) ? mouseY - pmouseY : movedY;
  sim.dragYaw += dx * 0.005;
  sim.dragTilt = clamp(sim.dragTilt + dy * 0.004, -0.9, 0.9);
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
    saveCanvas(`catenoid_${getTimestamp()}`, "png");
    return false;
  }
  if (key === "p" || key === "P") {
    togglePause();
    return false;
  }
  if (key === "c" || key === "C") {
    resetCamera();
    return false;
  }
  const digit = Number(key);
  if (digit >= 1 && digit <= GEOMETRY_KEYS.length) {
    selectGeometry(GEOMETRY_KEYS[digit - 1]);
    return false;
  }
  return true;
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

// ================================================================
// SCREEN FINISH — retained grain, corner guides and HUD composite
// ================================================================

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
    anchor.download = `catenoid_${getTimestamp()}.mp4`;
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
  // mp4-muxer rejects chunks without a duration (the seed's copy produced an empty MP4).
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
