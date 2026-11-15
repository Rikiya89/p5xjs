"use strict";

// SCHWARZ LANTERN — A PARADOX OF SURFACE AREA
// Rings k = 0 … M of N vertices on the cylinder of radius R, height H:
//   θ(j, k) = 2πj/N + (k mod 2)π/N,   P(j, k) = (R cos θ, R sin θ, −H/2 + kH/M)
// Each band k → k+1 holds N "up" triangles (base on ring k) and N "down" triangles (base on
// ring k+1): 2N isosceles faces per band, T = 2NM in total. Every face has
//   base b = 2R sin(π/N),  height h = √[(H/M)² + R²(1 − cos π/N)²],
// so the lateral area (no end caps) is A = 2MNR sin(π/N) · √[(H/M)² + R²(1 − cos π/N)²].
// Max gap to the cylinder R(1 − cos π/N) → 0 for any refinement, yet with M/N² → c:
//   A / 2πRH → √(1 + π⁴c²R² / 4H²)   — 1 for c = 0, a wrong finite limit for c > 0, ∞ if M/N² → ∞.

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

// Area-ratio chart strip under the lantern: x = N (log), y = A / 2πRH (log).
const CHART = {
  headerY: 1112,
  x0: 150,
  x1: W - 84,
  y0: 1148,
  y1: 1276,
  nMin: 4,
  nMax: 32,
};

const PARAMS = {
  N: 4,
  M: 8,
  R: 1,
  H: 2.4,
  spinTurns: 1,
  light: 1,
  mode: "auto",
  preset: "C",
  reference: false,
};

const LIMITS = {
  minN: 3,
  maxN: 96,
  minM: 1,
  maxM: 2048,
  maxTriangles: 100000,
  minR: 0.5,
  maxR: 2,
  minH: 0.5,
  maxH: 4,
};

// Refinement laws. The steps are what gets rendered; the chart curves use the same law
// for real-valued N up to CHART.nMax (computed only — never drawn as a mesh).
const PRESETS = {
  A: {
    name: "A · CONVERGENCE",
    law: "M = N/2",
    limit: "M/N² → 0",
    m: (n) => n / 2,
    steps: [[4, 2], [6, 3], [8, 4], [12, 6], [16, 8], [24, 12], [32, 16]],
  },
  B: {
    name: "B · FINITE EXCESS",
    law: "M = N²/2",
    limit: "M/N² → 1/2",
    c: 0.5,
    m: (n) => n * n / 2,
    steps: [[4, 8], [6, 18], [8, 32], [10, 50], [12, 72], [16, 128], [24, 288], [32, 512]],
  },
  C: {
    name: "C · DIVERGENCE",
    law: "M = N³/8",
    limit: "M/N² → ∞",
    m: (n) => n * n * n / 8,
    steps: [[4, 8], [6, 27], [8, 64], [10, 125], [12, 216], [14, 343], [16, 512]],
  },
};
const PRESET_KEYS = ["A", "B", "C"];

// Camera in display units (default lantern: radius 1, height 2.4). Target = (tx, ty, 0); the eye
// sits at distance d along (sin az cos el, −sin el, cos az cos el); roll turns the up vector.
const CAMERA = {
  fov: 0.66,
  near: 0.05,
  far: 600,
  base: { tx: 0, ty: 1.0, az: 0, el: 0.3, d: 15.5, roll: 0 },
  swayEl: 0.05,
  revealDolly: 0.06,
};

// Display box: the lantern is scaled uniformly to fit radius ≤ 1 and height ≤ 2.4.
const DISPLAY = { radius: 1, height: 2.4 };

// Loop timeline (p ∈ [0, 1)): hold → refine → reveal → unrefine → hold.
const TIMELINE = {
  growStart: 0.06,
  growEnd: 0.58,
  shrinkStart: 0.8,
  shrinkEnd: 0.94,
  fade: 0.016,
};

// ================================================================
// SCHWARZ LANTERN — closed forms and the procedural mesh
// ================================================================

function ringAngle(j, k, N) {
  return TAU * j / N + (k % 2) * Math.PI / N;
}

function ringPoint(j, k, N, M, R, Hc) {
  const theta = ringAngle(j, k, N);
  return [R * Math.cos(theta), R * Math.sin(theta), -Hc / 2 + k * Hc / M];
}

function facetBase(N, R) {
  return 2 * R * Math.sin(Math.PI / N);
}

function facetHeight(N, M, R, Hc) {
  return Math.hypot(Hc / M, R * (1 - Math.cos(Math.PI / N)));
}

function lanternArea(N, M, R, Hc) {
  return 2 * M * N * R * Math.sin(Math.PI / N) * Math.sqrt((Hc / M) ** 2 + (R * (1 - Math.cos(Math.PI / N))) ** 2);
}

function cylinderArea(R, Hc) {
  return TAU * R * Hc;
}

function areaRatio(N, M, R, Hc) {
  return lanternArea(N, M, R, Hc) / cylinderArea(R, Hc);
}

function maxGap(N, R) {
  return R * (1 - Math.cos(Math.PI / N));
}

// Limit of A / 2πRH along a preset's law (Infinity for divergence).
function regimeLimit(key, R, Hc) {
  if (key === "A") return 1;
  if (key === "B") return Math.sqrt(1 + Math.PI ** 4 * PRESETS.B.c ** 2 * R * R / (4 * Hc * Hc));
  return Infinity;
}

// Vertex (j, k) has index k·N + (j mod N). Up faces (v0, v1, apex) and down faces (w1, w0, apex)
// are wound counter-clockwise seen from outside, so (b − a) × (c − a) points away from the axis.
function lanternFaces(N, M) {
  const faces = new Int32Array(6 * N * M);
  const id = (j, k) => k * N + ((j % N) + N) % N;
  let f = 0;
  for (let k = 0; k < M; k++) {
    const odd = k % 2;
    for (let j = 0; j < N; j++) {
      faces[f++] = id(j, k); faces[f++] = id(j + 1, k); faces[f++] = id(j + odd, k + 1);
      faces[f++] = id(j + 1, k + 1); faces[f++] = id(j, k + 1); faces[f++] = id(j + 1 - odd, k);
    }
  }
  return faces;
}

function lanternVertices(N, M, R, Hc) {
  const vertices = new Float64Array(3 * N * (M + 1));
  for (let k = 0; k <= M; k++) {
    for (let j = 0; j < N; j++) vertices.set(ringPoint(j, k, N, M, R, Hc), 3 * (k * N + j));
  }
  return vertices;
}

function triangleCount(N, M) {
  return 2 * N * M;
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

function fitScale(R, Hc) {
  return Math.min(DISPLAY.radius / R, DISPLAY.height / Hc);
}

// Lantern → world: spin about the cylinder axis, map z (axis) to −y (p5's y points down),
// then scale to the display box. The vertex shader applies the identical transform.
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
  stepA: 0,
  stepB: 0,
  mix: 0,
  level: 0,
  reveal: 0,
  surf: 0.55,
  wire: 1,
  ref: 0,
  cam: { ...CAMERA.base },
};

let modeIndex = 0;

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function envelope(p, window) {
  return smoothstep(window[0], window[1], p) * (1 - smoothstep(window[2], window[3], p));
}

const MODES = {
  hybrid: { surf: 0.55, wire: 1, ref: 0 },
  solid: { surf: 0.96, wire: 0, ref: 0 },
  wire: { surf: 0, wire: 1, ref: 0 },
  compare: { surf: 0.5, wire: 0.8, ref: 1 },
};
const MODE_KEYS = ["auto", "hybrid", "solid", "wire", "compare"];

// The (N, M) steps the loop walks through: the active preset, or the single manual (N, M).
function activeSteps() {
  return PARAMS.preset === "manual" ? [[PARAMS.N, PARAMS.M]] : PRESETS[PARAMS.preset].steps;
}

// Step changes: forward over [growStart, growEnd], backward over [shrinkStart, shrinkEnd].
function stepEvents(count) {
  const events = [];
  if (count < 2) return events;
  const span = Math.max(1, count - 2);
  for (let i = 1; i < count; i++) {
    events.push({ t: lerp1(TIMELINE.growStart, TIMELINE.growEnd, (i - 1) / span), from: i - 1, to: i });
  }
  for (let i = count - 1; i >= 1; i--) {
    events.push({ t: lerp1(TIMELINE.shrinkStart, TIMELINE.shrinkEnd, (count - 1 - i) / span), from: i, to: i - 1 });
  }
  return events;
}

// {a, b, mix}: crossfade from step a to step b with weight mix (a = b, mix = 0 between events).
function stepState(p, count) {
  let index = 0;
  const half = TIMELINE.fade / 2;
  for (const event of stepEvents(count)) {
    if (p >= event.t + half) index = event.to;
    else if (p > event.t - half) return { a: event.from, b: event.to, mix: smoothstep(event.t - half, event.t + half, p) };
    else break;
  }
  return { a: index, b: index, mix: 0 };
}

function modeTarget(p) {
  if (PARAMS.mode !== "auto") return MODES[PARAMS.mode];
  // Auto: hybrid while refining; solid + reference cylinder for the area reveal.
  const solid = envelope(p, [0.58, 0.64, 0.78, 0.84]);
  return { surf: lerp1(0.55, 0.9, solid), wire: 1 - 0.7 * solid, ref: solid };
}

// Every term is equal at p = 0 and p = 1, so frame 600 ≡ frame 0.
function computeFrameState(p) {
  const fs = frameState;
  fs.spin = PARAMS.spinTurns * TAU * p;
  const steps = activeSteps();
  const state = stepState(p, steps.length);
  fs.stepA = state.a;
  fs.stepB = state.b;
  fs.mix = state.mix;
  fs.level = lerp1(state.a, state.b, state.mix);
  fs.reveal = envelope(p, [0.58, 0.64, 0.78, 0.84]);
  Object.assign(fs.cam, CAMERA.base);
  fs.cam.el += CAMERA.swayEl * Math.sin(TAU * p);
  fs.cam.d *= 1 - CAMERA.revealDolly * fs.reveal;
  const mode = modeTarget(p);
  fs.surf = mode.surf;
  fs.wire = mode.wire;
  fs.ref = PARAMS.reference ? 1 : mode.ref;
}

// The step whose numbers are shown (switches at the crossfade midpoint).
function shownStep() {
  const steps = activeSteps();
  return steps[frameState.mix < 0.5 ? frameState.stepA : frameState.stepB];
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

// Mouse drag orbits the camera; the automatic spin turns the lantern, so the two never fight.
function currentCamera() {
  const cam = { ...frameState.cam };
  if (freeCamera()) {
    cam.az += sim.dragYaw;
    cam.el = clamp(cam.el + sim.dragTilt, -1.2, 1.2);
  }
  return cam;
}

// ================================================================
// MESH CACHE + SHADERS
// ================================================================

// Flat-shaded unit lantern (R = H = 1): three unshared vertices per face carry the face normal
// and barycentric uv corners (1,0), (0,1), (0,0) for the edge lines. R and H are applied in the
// vertex shader, so only N and M ever rebuild a mesh.
function buildLanternGeometry(N, M) {
  const geometry = new p5.Geometry();
  geometry.gid = `lantern-${N}x${M}`;
  const vertices = lanternVertices(N, M, 1, 1);
  const faces = lanternFaces(N, M);
  const corner = (index) => [vertices[3 * index], vertices[3 * index + 1], vertices[3 * index + 2]];
  for (let f = 0; f < faces.length; f += 3) {
    const a = corner(faces[f]), b = corner(faces[f + 1]), c = corner(faces[f + 2]);
    const n = normalize3(cross(b.map((v, i) => v - a[i]), c.map((v, i) => v - a[i])));
    for (const p of [a, b, c]) {
      geometry.vertices.push(new p5.Vector(p[0], p[1], p[2]));
      geometry.vertexNormals.push(new p5.Vector(n[0], n[1], n[2]));
    }
    geometry.uvs.push(1, 0, 0, 1, 0, 0);
    geometry.faces.push([f, f + 1, f + 2]);
  }
  return geometry;
}

// Smooth reference cylinder, also on the unit scale.
function buildCylinderGeometry(segments) {
  const geometry = new p5.Geometry();
  geometry.gid = `reference-cylinder-${segments}`;
  for (let i = 0; i <= segments; i++) {
    const theta = TAU * i / segments;
    for (const z of [-0.5, 0.5]) {
      geometry.vertices.push(new p5.Vector(Math.cos(theta), Math.sin(theta), z));
      geometry.vertexNormals.push(new p5.Vector(Math.cos(theta), Math.sin(theta), 0));
      geometry.uvs.push(i / segments, z + 0.5);
    }
  }
  for (let i = 0; i < segments; i++) {
    const a = 2 * i;
    geometry.faces.push([a, a + 2, a + 3], [a, a + 3, a + 1]);
  }
  return geometry;
}

const meshCache = new Map();

function meshKeyOf(step) {
  return `${step[0]}x${step[1]}`;
}

// Builds every (N, M) the loop needs and frees the rest — nothing rebuilds per frame.
function syncMeshCache() {
  const wanted = new Map(activeSteps().map((step) => [meshKeyOf(step), step]));
  for (const [key, geometry] of meshCache) {
    if (!wanted.has(key)) {
      freeGeometry(geometry);
      meshCache.delete(key);
    }
  }
  for (const [key, step] of wanted) {
    if (!meshCache.has(key)) meshCache.set(key, buildLanternGeometry(step[0], step[1]));
  }
}

function cachedTriangles() {
  let total = 0;
  for (const geometry of meshCache.values()) total += geometry.faces.length;
  return total;
}

const SURFACE_VERTEX = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uScale;
uniform float uSpin;
out vec3 vNormal;
out vec3 vEye;
out vec2 vBary;
out float vZ;

vec3 toWorld(vec3 p) {
  float c = cos(uSpin);
  float s = sin(uSpin);
  return vec3(c * p.x - s * p.y, -p.z, s * p.x + c * p.y);
}

void main() {
  // Diagonal scale (kR, kR, kH): positions scale by it, normals by its inverse (exact for planar faces).
  vec3 p = toWorld(aPosition * uScale);
  vec3 n = toWorld(aNormal / uScale);
  vec4 eye = uModelViewMatrix * vec4(p, 1.0);
  vNormal = mat3(uModelViewMatrix) * n;
  vEye = eye.xyz;
  vBary = aTexCoord;
  vZ = aPosition.z + 0.5;
  gl_Position = uProjectionMatrix * eye;
}
`;

const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vEye;
in vec2 vBary;
in float vZ;
uniform vec3 uBase;
uniform vec3 uInk;
uniform vec3 uRefColor;
uniform float uLight;
uniform float uSurf;
uniform float uWire;
uniform float uAlpha;
uniform float uPass;
uniform float uRef;
uniform float uFogNear;
uniform float uFogFar;
out vec4 outColor;

void main() {
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

  float a;
  vec3 color;
  if (uRef > 0.5) {
    // Reference cylinder: a faint glass sheath — silhouette rim plus the rings z = 0, H/4, …, H.
    float w = max(fwidth(vZ * 4.0), 1e-5);
    float ring = 1.0 - smoothstep(0.4, 1.2, abs(fract(vZ * 4.0 + 0.5) - 0.5) / w);
    a = (0.05 + 0.4 * rim + 0.35 * ring) * mix(0.45, 1.0, side);
    color = uRefColor * a;
  } else {
    // Edge lines from barycentrics; they fade where a facet is under ~3 px across.
    vec3 b = vec3(vBary, 1.0 - vBary.x - vBary.y);
    vec3 fw = max(fwidth(b), vec3(1e-5));
    vec3 d = b / fw;
    float edge = 1.0 - smoothstep(0.35, 1.1, min(min(d.x, d.y), d.z));
    float crowd = 1.0 - smoothstep(0.22, 0.5, max(max(fw.x, fw.y), fw.z));
    float wireA = edge * crowd * uWire * mix(0.55, 0.9, side);
    vec3 wireC = uInk * (0.35 + 0.65 * shade) * mix(0.7, 1.0, side);

    // Where edges crowd out, wire mode falls back to a faint tone so the mesh never vanishes.
    float surfA = max(uSurf, uWire * (1.0 - crowd) * 0.4) * mix(0.8, 1.0, side);
    vec3 surfC = uBase * shade * mix(0.62, 0.8, side);
    surfC += uInk * (0.45 * spec + 0.1 * rim) * uLight * side;

    // Premultiplied: wire layer over surface layer (p5 blends ONE, ONE_MINUS_SRC_ALPHA).
    a = wireA + surfA * (1.0 - wireA);
    color = wireC * wireA + min(surfC, vec3(1.0)) * surfA * (1.0 - wireA);
  }
  float fog = mix(0.35, 1.0, 1.0 - smoothstep(uFogNear, uFogFar, -vEye.z));
  a *= fog * uAlpha;
  color *= fog * uAlpha;
  if (a < 0.004) discard;
  outColor = vec4(min(color, vec3(a)), a);
}
`;

let canvasEl;
let grainPg;
let hudPg;
let surfaceShader;
let referenceMesh = null;
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
  ref: 0,
  layers: { chart: true, facet: true, math: true, loupe: true },
  frameCost: 0,
};

function setup() {
  createCanvas(W, H, WEBGL);
  // Multisampling for the faceted silhouette; size and density are untouched.
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
  referenceMesh = buildCylinderGeometry(128);
  syncMeshCache();
  bindUI();
  updateStaticUI();
  syncControls();
  if (auditParam !== null) window.lanternAudit = runAudit();
  window.lantern = {
    PARAMS, PRESETS, frameState, computeFrameState, stepState, lanternArea, cylinderArea, areaRatio,
    lanternFaces, lanternVertices, regimeLimit, cameraBasis, projectPoint, toWorld, setLoop, runAudit, meshCache,
  };
}

// ================================================================
// RENDERING
// ================================================================

function colorVector(colorValue) {
  return [colorValue.r / 255, colorValue.g / 255, colorValue.b / 255];
}

// Free play eases between modes; recording and ?preview use the pure function of p.
function updateModeMix() {
  if (!freeCamera()) {
    sim.surf = frameState.surf;
    sim.wire = frameState.wire;
    sim.ref = frameState.ref;
    return;
  }
  const k = 1 - Math.exp(-Math.min(deltaTime, 100) / 1000 / 0.3);
  sim.surf += (frameState.surf - sim.surf) * k;
  sim.wire += (frameState.wire - sim.wire) * k;
  sim.ref += (frameState.ref - sim.ref) * k;
}

function renderFrame() {
  background(BG.r, BG.g, BG.b);
  computeFrameState(loopProgress);
  updateModeMix();
  const fs = frameState;
  const basis = cameraBasis(currentCamera());
  perspective(CAMERA.fov, W / H, CAMERA.near, CAMERA.far);
  // Stroke widths in screen pixels, independent of the small scene units.
  linePerspective(false);
  camera(...basis.eye, ...basis.target, ...basis.up);
  const eyeDistance = Math.hypot(...basis.eye.map((value, i) => value - basis.target[i]));
  const k = fitScale(PARAMS.R, PARAMS.H);
  drawLantern(k, eyeDistance * 0.92, eyeDistance * 1.25, sim.ref);
  resetShader();
  push();
  drawGuides(k);
  pop();
  renderLoupe();
}

// The active mesh (two crossfading meshes around a step change), then the reference sheath.
function drawLantern(k, fogNear, fogFar, refAlpha) {
  const fs = frameState;
  const steps = activeSteps();
  const layers = fs.mix > 0
    ? [{ step: steps[fs.stepA], alpha: 1 - fs.mix }, { step: steps[fs.stepB], alpha: fs.mix }]
    : [{ step: steps[fs.stepA], alpha: 1 }];
  noStroke();
  fill(255);
  shader(surfaceShader);
  surfaceShader.setUniform("uSpin", fs.spin);
  surfaceShader.setUniform("uScale", [k * PARAMS.R, k * PARAMS.R, k * PARAMS.H]);
  surfaceShader.setUniform("uBase", colorVector(CYAN));
  surfaceShader.setUniform("uInk", colorVector(INK));
  surfaceShader.setUniform("uRefColor", colorVector(ACID));
  surfaceShader.setUniform("uLight", PARAMS.light);
  surfaceShader.setUniform("uSurf", sim.surf);
  surfaceShader.setUniform("uWire", sim.wire);
  surfaceShader.setUniform("uFogNear", fogNear);
  surfaceShader.setUniform("uFogFar", fogFar);
  surfaceShader.setUniform("uRef", 0);
  for (const pass of [0, 1]) {
    surfaceShader.setUniform("uPass", pass);
    for (const layer of layers) {
      const mesh = meshCache.get(meshKeyOf(layer.step));
      if (!mesh || layer.alpha <= 0.002) continue;
      surfaceShader.setUniform("uAlpha", layer.alpha);
      model(mesh);
    }
  }
  if (refAlpha > 0.01) {
    // Inscribed lantern sits inside the sheath: its depth hides the far wall's covered parts.
    // depthMask is restored right away — background() does not clear a masked depth buffer.
    drawingContext.depthMask(false);
    surfaceShader.setUniform("uRef", 1);
    surfaceShader.setUniform("uAlpha", refAlpha);
    for (const pass of [0, 1]) {
      surfaceShader.setUniform("uPass", pass);
      model(referenceMesh);
    }
    drawingContext.depthMask(true);
  }
  resetShader();
}

// LOUPE — at M ≫ N² the folds are thinner than a pixel and the lantern reads as a smooth
// cylinder. The loupe frames ~10 bands of the wall facing the camera, obliquely, so the
// pleats that carry the extra area stay visible. Same mesh, same shader, own camera.
const LOUPE = { x: 190, y: 908, size: 232, fov: 0.5, bands: 10, lean: 1.2, lift: 0 };

function loupeView() {
  const fs = frameState;
  const k = fitScale(PARAMS.R, PARAMS.H);
  const steps = activeSteps();
  const m = Math.exp(lerp1(Math.log(steps[fs.stepA][1]), Math.log(steps[fs.stepB][1]), fs.mix));
  const patch = clamp(LOUPE.bands * k * PARAMS.H / m, 0.05, 0.7);
  const basis = cameraBasis(currentCamera());
  const out = normalize3([basis.eye[0], 0, basis.eye[2]]);
  const tangent = [out[2], 0, -out[0]];
  const spot = out.map((value) => value * k * PARAMS.R);
  const dir = normalize3([0, 1, 2].map((i) => out[i] + LOUPE.lean * tangent[i] + (i === 1 ? LOUPE.lift : 0)));
  const dist = (patch / 2) / Math.tan(LOUPE.fov / 2);
  const eye = spot.map((value, i) => value + dir[i] * dist);
  const main = projectPoint(basis, spot);
  const mainPx = (H / 2) * basis.f / main[2];
  return { k, patch, spot, eye, dist, main, mainPx, mag: LOUPE.size / patch / mainPx };
}

let loupeFb = null;

function renderLoupe() {
  if (!sim.layers.loupe) return;
  if (!loupeFb) loupeFb = createFramebuffer({ width: LOUPE.size, height: LOUPE.size, density: 1, antialias: true });
  const view = loupeView();
  loupeFb.begin();
  background(BG.r, BG.g, BG.b);
  perspective(LOUPE.fov, 1, view.dist * 0.2, view.dist * 20);
  camera(...view.eye, ...view.spot, 0, 1, 0);
  drawLantern(view.k, 1e6, 2e6, 0);
  loupeFb.end();
}

// The highlighted facet: up-triangle j = 0 in the middle band, in lantern coordinates.
function facetCorners(N, M, R, Hc) {
  const k = Math.floor(M / 2);
  return [ringPoint(0, k, N, M, R, Hc), ringPoint(1, k, N, M, R, Hc), ringPoint(k % 2, k + 1, N, M, R, Hc)];
}

// Axis, cylinder rims and one outlined facet — strokes, so they stay crisp at any density.
function drawGuides(k) {
  const fs = frameState;
  const R = PARAMS.R, Hc = PARAMS.H;
  noFill();
  stroke(INK.r, INK.g, INK.b, 70);
  strokeWeight(1.2);
  line(0, -k * Hc * 0.5, 0, 0, k * Hc * 0.5, 0);
  if (sim.ref > 0.01) {
    for (const z of [-Hc / 2, Hc / 2]) {
      stroke(ACID.r, ACID.g, ACID.b, 200 * sim.ref);
      strokeWeight(2);
      beginShape();
      for (let i = 0; i <= 128; i++) vertex(...toWorld([R * Math.cos(TAU * i / 128), R * Math.sin(TAU * i / 128), z], fs.spin, k));
      endShape();
    }
  }
  if (!sim.layers.facet) return;
  const [N, M] = shownStep();
  const lift = 1.006;
  stroke(ACID.r, ACID.g, ACID.b, 235);
  strokeWeight(2.4);
  beginShape();
  for (const p of [...facetCorners(N, M, R, Hc), facetCorners(N, M, R, Hc)[0]]) {
    vertex(...toWorld([p[0] * lift, p[1] * lift, p[2]], fs.spin, k));
  }
  endShape();
}

// ================================================================
// HUD
// ================================================================

const OVERLAY = {
  hook: true,
  captions: [
    { window: null, first: "A CYLINDER BUILT FROM FLAT TRIANGLES", second: "EVERY VERTEX LIES ON THE CYLINDER" },
    { window: [0.07, 0.1, 0.3, 0.33], first: "REFINE: N AROUND · M UP · T = 2NM", second: () => `${presetName()} — ${presetLaw()}` },
    { window: [0.33, 0.36, 0.55, 0.58], first: "THE MESH CLOSES IN ON THE CYLINDER", second: "MAX GAP R(1 − cos π/N) → 0" },
    { window: [0.6, 0.63, 0.77, 0.8], first: () => revealLine(0), second: () => revealLine(1) },
    { window: [0.82, 0.85, 0.92, 0.95], first: "SHAPE CONVERGES · AREA NEED NOT", second: "THE FOLDS STEEPEN WHEN M ≫ N²" },
  ],
};

function presetName() {
  return PARAMS.preset === "manual" ? "MANUAL" : PRESETS[PARAMS.preset].name;
}

function presetLaw() {
  if (PARAMS.preset !== "manual") return PRESETS[PARAMS.preset].law;
  return `N = ${PARAMS.N} · M = ${PARAMS.M}`;
}

function presetLimit() {
  if (PARAMS.preset !== "manual") return PRESETS[PARAMS.preset].limit;
  return `M/N² = ${(PARAMS.M / PARAMS.N ** 2).toFixed(3)}`;
}

function revealLine(index) {
  const key = PARAMS.preset;
  if (key === "A") return ["AREA → 2πRH: BOTH SHAPE AND AREA CONVERGE", "M/N² → 0 KEEPS THE FACETS UPRIGHT"][index];
  if (key === "B") return [`AREA → ${regimeLimit("B", PARAMS.R, PARAMS.H).toFixed(3)} × 2πRH`, "A FINITE LIMIT — AND THE WRONG ONE"][index];
  if (key === "C") return ["AREA RATIO GROWS WITHOUT BOUND", "SAME CYLINDER · UNBOUNDED AREA"][index];
  const ratio = areaRatio(PARAMS.N, PARAMS.M, PARAMS.R, PARAMS.H);
  return [`A / 2πRH = ${ratio.toFixed(4)}`, `M/N² = ${(PARAMS.M / PARAMS.N ** 2).toFixed(3)}`][index];
}

function captionText(value) {
  return typeof value === "function" ? value() : value;
}

const HUD_TEXT = {
  title: "SCHWARZ LANTERN",
  subtitle: "A PARADOX OF SURFACE AREA",
  formula: "θ(j,k) = 2πj/N + (k mod 2)π/N · z = −H/2 + kH/M",
  condition: "T = 2NM  ·  A_cyl = 2πRH",
  citation: "A = 2MNR sin(π/N) √[(H/M)² + R²(1 − cos π/N)²]",
};

function readoutText(N) {
  return `MAX GAP R(1 − cos π/N) = ${maxGap(N, PARAMS.R).toFixed(4)}`;
}

function formatInt(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function dataRows(N, M) {
  const R = PARAMS.R, Hc = PARAMS.H;
  const ratio = areaRatio(N, M, R, Hc);
  const error = (ratio - 1) * 100;
  return {
    left: [
      ["ANGULAR SEGMENTS", `N = ${N}`],
      ["VERTICAL LAYERS", `M = ${M}`],
      ["TRIANGLE COUNT", `T = ${formatInt(triangleCount(N, M))}`],
      ["M / N²", (M / (N * N)).toFixed(3)],
    ],
    right: [
      ["MESH AREA", lanternArea(N, M, R, Hc).toFixed(3)],
      ["CYLINDER AREA", cylinderArea(R, Hc).toFixed(3)],
      ["AREA RATIO", ratio.toFixed(4)],
      ["AREA ERROR", `${error >= 0 ? "+" : "−"}${Math.abs(error).toFixed(2)}%`],
    ],
  };
}

function drawDataColumns(graphics) {
  const [N, M] = shownStep();
  const rows = dataRows(N, M);
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
      const highlight = label === "AREA RATIO" || label === "AREA ERROR";
      if (highlight) graphics.fill(ACID.r, ACID.g, ACID.b, 240);
      else graphics.fill(INK.r, INK.g, INK.b, 235);
      graphics.text(value, x, y + 26);
    });
  };
  column(rows.left, HUD.stageTextX, LEFT);
  column(rows.right, W - HUD.stageTextX, RIGHT);
}

// A / 2πRH against N for the three laws. Solid where meshes are rendered, dotted beyond
// (computed only); the dot rides the active preset's steps.
function chartFrame() {
  const R = PARAMS.R, Hc = PARAMS.H;
  const lo = Math.min(areaRatio(CHART.nMin, Math.max(1, PRESETS.A.m(CHART.nMin)), R, Hc), 1) * 0.97;
  const hi = Math.max(areaRatio(CHART.nMax, PRESETS.C.m(CHART.nMax), R, Hc), regimeLimit("B", R, Hc) * 1.2);
  const x = (n) => lerp1(CHART.x0, CHART.x1, Math.log(n / CHART.nMin) / Math.log(CHART.nMax / CHART.nMin));
  const y = (ratio) => lerp1(CHART.y1, CHART.y0, Math.log(ratio / lo) / Math.log(hi / lo));
  return { x, y, lo, hi };
}

function drawChart(graphics) {
  if (!sim.layers.chart) return;
  const R = PARAMS.R, Hc = PARAMS.H;
  const frame = chartFrame();
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(22);
  graphics.noStroke();
  graphics.textAlign(LEFT, CENTER);
  graphics.fill(INK.r, INK.g, INK.b, 150);
  graphics.text("A / 2πRH  vs  N", HUD.stageTextX, CHART.headerY);
  // Legend: active preset in ACID.
  graphics.textAlign(RIGHT, CENTER);
  let x = CHART.x1;
  for (const key of [...PRESET_KEYS].reverse()) {
    const limit = regimeLimit(key, R, Hc);
    const label = `${key} → ${Number.isFinite(limit) ? limit.toFixed(limit === 1 ? 0 : 3) : "∞"}`;
    if (key === PARAMS.preset) graphics.fill(ACID.r, ACID.g, ACID.b, 240);
    else graphics.fill(INK.r, INK.g, INK.b, 150);
    graphics.text(label, x, CHART.headerY);
    x -= graphics.textWidth(label) + 28;
  }
  // Axes: ratio = 1 (the true area) dashed, N ticks.
  graphics.stroke(INK.r, INK.g, INK.b, 60);
  graphics.strokeWeight(1);
  graphics.line(CHART.x0, CHART.y1, CHART.x1, CHART.y1);
  const one = frame.y(1);
  for (let px = CHART.x0; px < CHART.x1; px += 14) graphics.line(px, one, Math.min(px + 7, CHART.x1), one);
  graphics.noStroke();
  graphics.fill(INK.r, INK.g, INK.b, 150);
  graphics.textAlign(RIGHT, CENTER);
  graphics.text("1", CHART.x0 - 14, one);
  graphics.textAlign(CENTER, TOP);
  for (const n of [4, 8, 16, 32]) {
    graphics.stroke(INK.r, INK.g, INK.b, 80);
    graphics.line(frame.x(n), CHART.y1, frame.x(n), CHART.y1 + 6);
    graphics.noStroke();
    graphics.text(n === 4 ? "N 4" : String(n), frame.x(n), CHART.y1 + 9);
  }
  for (const key of PRESET_KEYS) {
    const preset = PRESETS[key];
    const active = key === PARAMS.preset;
    const lastN = preset.steps[preset.steps.length - 1][0];
    const colorValue = active ? ACID : INK;
    const points = [];
    for (let i = 0; i <= 120; i++) {
      const n = CHART.nMin * Math.pow(CHART.nMax / CHART.nMin, i / 120);
      points.push([frame.x(n), frame.y(Math.min(areaRatio(n, preset.m(n), R, Hc), frame.hi)), n <= lastN + 1e-9]);
    }
    graphics.noFill();
    graphics.stroke(colorValue.r, colorValue.g, colorValue.b, active ? 230 : 95);
    graphics.strokeWeight(active ? 2.4 : 1.4);
    for (let i = 1; i < points.length; i++) {
      // Rendered range solid; computed-only range dotted.
      if (!points[i][2] && i % 2) continue;
      graphics.line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
    }
    graphics.noStroke();
    graphics.fill(colorValue.r, colorValue.g, colorValue.b, active ? 230 : 110);
    for (const [n, m] of preset.steps) graphics.circle(frame.x(n), frame.y(areaRatio(n, m, R, Hc)), active ? 6 : 4);
  }
  // Current mesh: interpolates in (log N, log ratio) during a crossfade.
  const steps = activeSteps();
  const fs = frameState;
  const pa = steps[fs.stepA], pb = steps[fs.stepB];
  const ra = areaRatio(pa[0], pa[1], R, Hc), rb = areaRatio(pb[0], pb[1], R, Hc);
  const n = Math.exp(lerp1(Math.log(pa[0]), Math.log(pb[0]), fs.mix));
  const ratio = Math.exp(lerp1(Math.log(ra), Math.log(rb), fs.mix));
  const px = frame.x(clamp(n, CHART.nMin, CHART.nMax));
  const py = frame.y(clamp(ratio, frame.lo, frame.hi));
  graphics.noFill();
  graphics.stroke(ACID.r, ACID.g, ACID.b, 240);
  graphics.strokeWeight(2);
  graphics.circle(px, py, 18);
  graphics.noStroke();
  graphics.fill(INK.r, INK.g, INK.b, 245);
  graphics.circle(px, py, 8);
}

// Facet label pinned beside the outlined triangle while it faces the camera.
function drawFacetLabel(graphics) {
  if (!sim.layers.facet) return;
  const [N, M] = shownStep();
  const R = PARAMS.R, Hc = PARAMS.H;
  const k = fitScale(R, Hc);
  const basis = cameraBasis(currentCamera());
  const corners = facetCorners(N, M, R, Hc).map((p) => toWorld(p, frameState.spin, k));
  const center = [0, 1, 2].map((i) => (corners[0][i] + corners[1][i] + corners[2][i]) / 3);
  const radial = normalize3([center[0], 0, center[2]]);
  const toEye = normalize3(basis.eye.map((value, i) => value - center[i]));
  const facing = smoothstep(0.15, 0.45, dot(radial, toEye));
  if (facing <= 0.01) return;
  // Label parked in the free right column (under the data rows), with a leader to the facet.
  const p = projectPoint(basis, center);
  const lx = W - HUD.stageTextX;
  const ly = clamp(p[1], HUD.dataY + 4 * HUD.dataRow + 50, CHART.headerY - 70);
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(22);
  graphics.textAlign(RIGHT, CENTER);
  const labelLeft = lx - Math.max(graphics.textWidth(`b ${facetBase(N, R).toFixed(3)}`), graphics.textWidth(`h ${facetHeight(N, M, R, Hc).toFixed(4)}`));
  graphics.stroke(ACID.r, ACID.g, ACID.b, 150 * facing);
  graphics.strokeWeight(1);
  graphics.line(p[0], p[1], labelLeft - 12, ly);
  graphics.noStroke();
  graphics.fill(ACID.r, ACID.g, ACID.b, 235 * facing);
  graphics.text(`b ${facetBase(N, R).toFixed(3)}`, lx, ly - 14);
  graphics.text(`h ${facetHeight(N, M, R, Hc).toFixed(4)}`, lx, ly + 14);
}

// Loupe ring, the leader to the magnified spot and the magnification.
function drawLoupeFrame(graphics) {
  if (!sim.layers.loupe) return;
  const view = loupeView();
  const r = LOUPE.size / 2;
  const spot = view.main;
  const ring = Math.max(5, view.patch * view.mainPx / 2);
  const dx = spot[0] - LOUPE.x, dy = spot[1] - LOUPE.y;
  const dl = Math.hypot(dx, dy) || 1;
  graphics.noFill();
  graphics.stroke(INK.r, INK.g, INK.b, 150);
  graphics.strokeWeight(1.2);
  graphics.circle(LOUPE.x, LOUPE.y, LOUPE.size);
  graphics.stroke(ACID.r, ACID.g, ACID.b, 200);
  graphics.circle(spot[0], spot[1], 2 * ring);
  graphics.stroke(INK.r, INK.g, INK.b, 90);
  graphics.line(LOUPE.x + dx / dl * r, LOUPE.y + dy / dl * r, spot[0] - dx / dl * ring, spot[1] - dy / dl * ring);
  graphics.noStroke();
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(22);
  graphics.textAlign(CENTER, TOP);
  graphics.fill(INK.r, INK.g, INK.b, 150);
  graphics.text(`LOUPE ×${view.mag.toFixed(view.mag < 10 ? 1 : 0)}`, LOUPE.x, LOUPE.y + r + 14);
}

// HUD — fonts, sizes, hierarchy, and anchors retained from the series.
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
  graphics.text(readoutText(shownStep()[0]), HUD.stageTextX, HUD.stageY);
  graphics.fill(ACID.r, ACID.g, ACID.b, 240);
  graphics.textAlign(RIGHT, TOP);
  graphics.textSize(22);
  graphics.text(presetLimit(), W - HUD.rightTextX, HUD.stageY + 3);
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
  drawChart(graphics);
  drawFacetLabel(graphics);
  drawLoupeFrame(graphics);

  graphics.noStroke();
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textAlign(CENTER, CENTER);
  graphics.textSize(28);
  if (OVERLAY.hook) {
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
// AUDIT — ?audit=1 checks T = 2NM, the closed-form area against the summed faces, winding,
// connectivity, isosceles faces, the three regimes, framing, typography fit and the loop seam
// (report stored on window.lanternAudit).
// ================================================================

function auditMesh(N, M, R, Hc) {
  const vertices = lanternVertices(N, M, R, Hc);
  const faces = lanternFaces(N, M);
  const corner = (index) => [vertices[3 * index], vertices[3 * index + 1], vertices[3 * index + 2]];
  const edges = new Map();
  let area = 0, inwardFaces = 0, degenerate = 0, isoscelesError = 0, onCylinderError = 0;
  for (let f = 0; f < faces.length; f += 3) {
    const ids = [faces[f], faces[f + 1], faces[f + 2]];
    const [a, b, c] = ids.map(corner);
    const n = cross(b.map((v, i) => v - a[i]), c.map((v, i) => v - a[i]));
    const faceArea = Math.hypot(...n) / 2;
    area += faceArea;
    if (faceArea < 1e-14) degenerate++;
    const centroid = [0, 1, 2].map((i) => (a[i] + b[i] + c[i]) / 3);
    if (n[0] * centroid[0] + n[1] * centroid[1] <= 0) inwardFaces++;
    // The base is (a, b) for up faces and (a, b) for down faces: apex c is equidistant.
    const ca = Math.hypot(...c.map((v, i) => v - a[i])), cb = Math.hypot(...c.map((v, i) => v - b[i]));
    isoscelesError = Math.max(isoscelesError, Math.abs(ca - cb));
    for (const p of [a, b, c]) onCylinderError = Math.max(onCylinderError, Math.abs(Math.hypot(p[0], p[1]) - R));
    for (let e = 0; e < 3; e++) {
      const u = ids[e], v = ids[(e + 1) % 3];
      const key = u < v ? `${u}-${v}` : `${v}-${u}`;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  let boundaryEdges = 0, interiorEdges = 0, badEdges = 0;
  for (const count of edges.values()) {
    if (count === 1) boundaryEdges++;
    else if (count === 2) interiorEdges++;
    else badEdges++;
  }
  const analytic = lanternArea(N, M, R, Hc);
  return {
    N, M, R, H: Hc,
    triangles: faces.length / 3,
    expectedTriangles: triangleCount(N, M),
    summedArea: area,
    analyticArea: analytic,
    relativeAreaError: Math.abs(area - analytic) / analytic,
    inwardFaces, degenerate, isoscelesError, onCylinderError,
    boundaryEdges, interiorEdges, badEdges,
    ok: faces.length / 3 === triangleCount(N, M) && Math.abs(area - analytic) / analytic < 1e-10 &&
      inwardFaces === 0 && degenerate === 0 && isoscelesError < 1e-10 && onCylinderError < 1e-12 &&
      boundaryEdges === 2 * N && badEdges === 0 && interiorEdges === 3 * N * M - N,
  };
}

function auditMath() {
  const meshes = [];
  for (const [N, M, R, Hc] of [[3, 1, 1, 1], [4, 2, 1, 2.4], [6, 9, 0.7, 3.1], [16, 512, 1, 2.4], [32, 512, 2, 0.5], [32, 16, 1.3, 4], [7, 13, 1, 1]]) {
    meshes.push(auditMesh(N, M, R, Hc));
  }
  const R = PARAMS.R, Hc = PARAMS.H;
  const regimes = {};
  for (const key of PRESET_KEYS) {
    const sequence = [];
    for (let n = 8; n <= 4096; n *= 2) sequence.push(areaRatio(n, PRESETS[key].m(n), R, Hc));
    const limit = regimeLimit(key, R, Hc);
    regimes[key] = {
      limit,
      last: sequence[sequence.length - 1],
      steps: PRESETS[key].steps.map(([n, m]) => areaRatio(n, m, R, Hc)),
      increasing: sequence.every((value, i) => i === 0 || value > sequence[i - 1]),
    };
  }
  regimes.A.ok = Math.abs(regimes.A.last - 1) < 1e-4;
  regimes.B.ok = Math.abs(regimes.B.last - regimes.B.limit) < 1e-4;
  regimes.C.ok = regimes.C.increasing && regimes.C.last > 100;
  return { meshes, regimes, ok: meshes.every((m) => m.ok) && regimes.A.ok && regimes.B.ok && regimes.C.ok };
}

function auditTypography() {
  const graphics = hudPg;
  const rows = [
    ["Georgia", BOLD, 72, HUD_TEXT.title],
    ["monospace", NORMAL, 34, HUD_TEXT.subtitle],
    ["monospace", NORMAL, 23, HUD_TEXT.formula],
    ["monospace", NORMAL, 26, HUD_TEXT.condition],
    ["monospace", NORMAL, 22, HUD_TEXT.citation],
  ];
  const savedPreset = PARAMS.preset;
  for (const key of PRESET_KEYS) {
    PARAMS.preset = key;
    for (const caption of OVERLAY.captions) rows.push(["monospace", NORMAL, 28, captionText(caption.first)], ["monospace", NORMAL, 28, captionText(caption.second)]);
  }
  PARAMS.preset = savedPreset;
  let widest = 0;
  for (const [font, style, size, text] of rows) {
    graphics.textFont(font);
    graphics.textStyle(style);
    graphics.textSize(size);
    widest = Math.max(widest, graphics.textWidth(text));
  }
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(26);
  const left = HUD.stageTextX + graphics.textWidth(readoutText(3));
  graphics.textSize(22);
  const right = W - HUD.rightTextX - Math.max(...PRESET_KEYS.map((key) => graphics.textWidth(PRESETS[key].limit)));
  // Data columns: widest label / value per side at the largest numbers the presets reach.
  let leftColumn = 0, rightColumn = 0;
  const rowsData = dataRows(32, 512);
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
  return {
    widestLine: Math.round(widest),
    available: W - 2 * HUD.safeX,
    stageGap: Math.round(right - left),
    leftColumnEnd: Math.round(HUD.stageTextX + leftColumn),
    rightColumnStart: Math.round(W - HUD.stageTextX - rightColumn),
  };
}

// Projected bbox of the lantern over the loop, against the HUD bands and the data columns.
function auditFraming(R, Hc, typography) {
  const saved = { R: PARAMS.R, H: PARAMS.H };
  PARAMS.R = R;
  PARAMS.H = Hc;
  const k = fitScale(R, Hc);
  const framing = { R, H: Hc, top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity, columnBandBottom: -Infinity };
  const dataBottom = HUD.dataY + 4 * HUD.dataRow;
  for (let frame = 0; frame < LOOP_FRAMES; frame += 6) {
    computeFrameState(frame / LOOP_FRAMES);
    const basis = cameraBasis(frameState.cam);
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j < 48; j++) {
        const theta = TAU * j / 48;
        const p = projectPoint(basis, toWorld([R * Math.cos(theta), R * Math.sin(theta), -Hc / 2 + Hc * i / 8], frameState.spin, k));
        framing.top = Math.min(framing.top, Math.round(p[1]));
        framing.bottom = Math.max(framing.bottom, Math.round(p[1]));
        framing.left = Math.min(framing.left, Math.round(p[0]));
        framing.right = Math.max(framing.right, Math.round(p[0]));
      }
    }
  }
  Object.assign(PARAMS, saved);
  framing.clearsTrack = framing.top > HUD.trackY + 12;
  framing.clearsChart = framing.bottom < CHART.headerY - 20;
  framing.clearsColumns = framing.left > typography.leftColumnEnd + 12 && framing.right < typography.rightColumnStart - 12 ||
    framing.top > dataBottom;
  framing.clearsLoupe = framing.left > LOUPE.x + LOUPE.size / 2 + 12;
  return framing;
}

function runAudit() {
  const t0 = performance.now();
  const typography = auditTypography();
  const report = {
    math: auditMath(),
    typography,
    framing: [[PARAMS.R, PARAMS.H], [0.5, 4], [2, 0.5], [2, 4], [1.2, 2.4]].map(([R, Hc]) => auditFraming(R, Hc, typography)),
    loop: null,
  };
  const savedPreset = PARAMS.preset;
  report.loop = {};
  const snapshot = () => {
    const fs = frameState;
    // level is the visible state; the raw crossfade weight resets after every step by design.
    return [Math.cos(fs.spin), Math.sin(fs.spin), fs.level / 4, fs.reveal, fs.surf, fs.wire, fs.ref, ...Object.values(fs.cam)];
  };
  const step = (p, q) => Math.max(...p.map((value, i) => Math.abs(value - q[i])));
  for (const key of PRESET_KEYS) {
    PARAMS.preset = key;
    let previous = null, first = null, maxInteriorStep = 0, maxLevelJump = 0, lastLevel = 0;
    for (let frame = 0; frame < LOOP_FRAMES; frame++) {
      computeFrameState(frame / LOOP_FRAMES);
      const current = snapshot();
      if (previous) {
        maxInteriorStep = Math.max(maxInteriorStep, step(current, previous));
        maxLevelJump = Math.max(maxLevelJump, Math.abs(frameState.level - lastLevel));
      } else first = current;
      previous = current;
      lastLevel = frameState.level;
    }
    report.loop[key] = { seamStep: step(first, previous), maxInteriorStep, maxLevelJump, firstLevel: first[2], lastLevel };
  }
  PARAMS.preset = savedPreset;
  report.loop.frames = LOOP_FRAMES;
  report.loop.seconds = LOOP_FRAMES / FPS;
  report.auditMs = performance.now() - t0;
  report.ok = report.math.ok &&
    report.framing.every((f) => f.clearsTrack && f.clearsChart && f.clearsColumns && f.clearsLoupe) &&
    typography.widestLine <= typography.available && typography.stageGap > 20 &&
    PRESET_KEYS.every((key) => report.loop[key].seamStep <= report.loop[key].maxInteriorStep * 1.01 && report.loop[key].maxLevelJump < 0.5);
  computeFrameState(loopProgress);
  console.log("[lantern audit]", JSON.stringify(report, null, 2));
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

// ?preset=B&mode=wire&r=1.2&h=3 — or ?n=12&m=200 for a fixed manual mesh.
function applyUrlParams() {
  const mode = MODE_KEYS.indexOf(urlParam("mode"));
  if (mode >= 0) {
    modeIndex = mode;
    PARAMS.mode = MODE_KEYS[mode];
  }
  const preset = (urlParam("preset") || "").toUpperCase();
  if (PRESET_KEYS.includes(preset)) PARAMS.preset = preset;
  const numeric = (name, key) => {
    const value = Number(urlParam(name));
    if (urlParam(name) !== null && Number.isFinite(value)) PARAMS[key] = value;
  };
  numeric("r", "R");
  numeric("h", "H");
  numeric("spin", "spinTurns");
  numeric("light", "light");
  if (urlParam("n") !== null || urlParam("m") !== null) {
    numeric("n", "N");
    numeric("m", "M");
    PARAMS.preset = "manual";
  }
  if (urlParam("ref") === "1") PARAMS.reference = true;
  if (urlParam("hook") === "0") OVERLAY.hook = false;
  sanitizeParams();
  computeFrameState(0);
  sim.surf = frameState.surf;
  sim.wire = frameState.wire;
  sim.ref = frameState.ref;
}

function sanitizeParams() {
  PARAMS.N = clamp(Math.round(PARAMS.N), LIMITS.minN, LIMITS.maxN);
  // Triangle budget: T = 2NM ≤ maxTriangles.
  const maxM = Math.min(LIMITS.maxM, Math.floor(LIMITS.maxTriangles / (2 * PARAMS.N)));
  PARAMS.M = clamp(Math.round(PARAMS.M), LIMITS.minM, maxM);
  PARAMS.R = clamp(PARAMS.R, LIMITS.minR, LIMITS.maxR);
  PARAMS.H = clamp(PARAMS.H, LIMITS.minH, LIMITS.maxH);
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
  nSlider: ["N", (v) => `${v.toFixed(0)}`],
  mSlider: ["M", (v) => `${v.toFixed(0)}  (T = ${formatInt(2 * PARAMS.N * v)})`],
  rSlider: ["R", (v) => v.toFixed(2)],
  hSlider: ["H", (v) => v.toFixed(1)],
  spinSlider: ["spinTurns", (v) => `${v.toFixed(0)} turn / loop`],
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
      if (key === "N" || key === "M") {
        // Moving N or M fixes the mesh: the loop keeps turning but stops refining.
        if (PARAMS.preset !== "manual") [PARAMS.N, PARAMS.M] = shownStep();
        PARAMS.preset = "manual";
      }
      PARAMS[key] = Number(element.value);
      sanitizeParams();
      syncMeshCache();
      syncControls();
    };
  }
  const onClick = (id, handler) => {
    const element = getElement(id);
    if (element) element.onclick = handler;
  };
  MODE_KEYS.forEach((mode, index) => onClick(`mode-${mode}`, () => selectMode(index)));
  PRESET_KEYS.forEach((key) => onClick(`preset-${key}`, () => selectPreset(key)));
  onClick("pauseBtn", togglePause);
  onClick("cameraBtn", resetCamera);
  onClick("resetBtn", resetSimulator);
  const toggles = { showChart: "chart", showFacet: "facet", showMath: "math", showLoupe: "loupe" };
  for (const [id, layer] of Object.entries(toggles)) {
    const element = getElement(id);
    if (element) element.onchange = () => {
      sim.layers[layer] = element.checked;
      syncControls();
    };
  }
  const reference = getElement("showReference");
  if (reference) reference.onchange = () => { PARAMS.reference = reference.checked; };
  const hook = getElement("showHook");
  if (hook) hook.onchange = () => { OVERLAY.hook = hook.checked; };
}

const DEFAULT_PARAMS = { ...PARAMS };

function selectMode(index) {
  if (isRecording) return;
  modeIndex = index;
  PARAMS.mode = MODE_KEYS[index];
  syncControls();
}

function selectPreset(key) {
  if (isRecording) return;
  PARAMS.preset = key;
  syncMeshCache();
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
  syncMeshCache();
  modeIndex = 0;
  Object.assign(sim, { paused: false, playhead: 0, dragYaw: 0, dragTilt: 0 });
  for (const layer of Object.keys(sim.layers)) sim.layers[layer] = true;
  OVERLAY.hook = true;
  for (const id of ["showChart", "showFacet", "showHook", "showMath", "showLoupe"]) {
    const element = getElement(id);
    if (element) element.checked = true;
  }
  const reference = getElement("showReference");
  if (reference) reference.checked = false;
  syncControls();
}

const CONTROL_IDS = [
  ...Object.keys(SLIDERS),
  ...MODE_KEYS.map((mode) => `mode-${mode}`),
  ...PRESET_KEYS.map((key) => `preset-${key}`),
  "pauseBtn", "cameraBtn", "resetBtn", "showReference", "showChart", "showFacet", "showHook", "showMath", "showLoupe",
];

function syncControls() {
  for (const [id, [key, format]] of Object.entries(SLIDERS)) {
    const element = getElement(id);
    if (element) {
      if (id === "mSlider") element.max = Math.min(LIMITS.maxM, Math.floor(LIMITS.maxTriangles / (2 * PARAMS.N)));
      element.value = PARAMS[key];
    }
    setText(id.replace("Slider", "Value"), format(PARAMS[key]));
  }
  MODE_KEYS.forEach((mode, index) => {
    const element = getElement(`mode-${mode}`);
    if (element) element.style.borderColor = index === modeIndex ? "rgba(255,255,255,0.6)" : "";
  });
  PRESET_KEYS.forEach((key) => {
    const element = getElement(`preset-${key}`);
    if (element) element.style.borderColor = key === PARAMS.preset ? "rgba(255,255,255,0.6)" : "";
  });
  setText("presetValue", PARAMS.preset === "manual" ? "manual (N, M fixed)" : `${PRESETS[PARAMS.preset].law} · ${PRESETS[PARAMS.preset].limit}`);
  setText("pauseBtn", sim.paused ? "Play" : "Pause");
  const math = getElement("math");
  if (math) math.hidden = !sim.layers.math;
  for (const id of CONTROL_IDS) setDisabled(id, isRecording);
}

function updateLiveUI() {
  if (frameCount % 6 !== 0 || !sim.layers.math) return;
  const [N, M] = shownStep();
  const R = PARAMS.R, Hc = PARAMS.H;
  // The panel's cross-check sums the faces of the shown mesh in double precision.
  const check = summedArea(N, M, R, Hc);
  const analytic = lanternArea(N, M, R, Hc);
  setText("areaValue", `A = ${analytic.toFixed(6)} (closed form)`);
  setText("sumValue", `Σ faces = ${check.toFixed(6)} · Δ ${(Math.abs(check - analytic) / analytic).toExponential(1)}`);
  setText("limitValue", `${presetLimit()} ⇒ A/2πRH → ${PARAMS.preset === "manual" ? "—" : formatLimit(regimeLimit(PARAMS.preset, R, Hc))}`);
  setText("facetValue", `b ${facetBase(N, R).toFixed(4)} · h ${facetHeight(N, M, R, Hc).toFixed(5)} · h/b ${(facetHeight(N, M, R, Hc) / facetBase(N, R)).toFixed(4)}`);
  setText("meshValue", `${meshCache.size} cached · ${formatInt(cachedTriangles())} triangles`);
  setText("costValue", sim.frameCost.toFixed(1));
}

function formatLimit(value) {
  return Number.isFinite(value) ? value.toFixed(4) : "∞ (finite steps only)";
}

const areaSumCache = { key: "", value: 0 };

function summedArea(N, M, R, Hc) {
  const key = `${N}x${M}x${R}x${Hc}`;
  if (areaSumCache.key !== key) {
    const vertices = lanternVertices(N, M, R, Hc);
    const faces = lanternFaces(N, M);
    let area = 0;
    for (let f = 0; f < faces.length; f += 3) {
      const [a, b, c] = [faces[f], faces[f + 1], faces[f + 2]].map((i) => [vertices[3 * i], vertices[3 * i + 1], vertices[3 * i + 2]]);
      area += Math.hypot(...cross(b.map((v, i) => v - a[i]), c.map((v, i) => v - a[i]))) / 2;
    }
    areaSumCache.key = key;
    areaSumCache.value = area;
  }
  return areaSumCache.value;
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
    saveCanvas(`schwarz_lantern_${getTimestamp()}`, "png");
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
  if (digit >= 1 && digit <= MODE_KEYS.length) {
    selectMode(digit - 1);
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
  if (sim.layers.loupe && loupeFb) {
    noStroke();
    texture(loupeFb);
    circle(LOUPE.x - W / 2, LOUPE.y - H / 2, LOUPE.size);
  }
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
    anchor.download = `schwarz_lantern_${getTimestamp()}.mp4`;
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
