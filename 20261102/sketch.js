"use strict";

// DUPIN CYCLIDE — EVERY LINE OF CURVATURE IS A CIRCLE
// With a > μ > c ≥ 0, b² = a² − c², D = a − c cos u cos v (> 0):
//   x = [μ(c − a cos u cos v) + b² cos u] / D
//   y = b sin u (a − μ cos v) / D
//   z = b sin v (c cos u − μ) / D
// which solves (x² + y² + z² − μ² + b²)² = 4(ax − cμ)² + 4b²y² — a ring cyclide.
// Both families u = const and v = const are circles and they are the lines of curvature
// (F = M = 0). The tube radius runs μ − c … μ + c; c = 0 is the torus (R = a, r = μ).
// K > 0 exactly where cos v < 0; the parabolic set K = 0 is the two circles v = π/2, 3π/2.

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

// Adjustable parameters. c(t) = cMid + swing · cos(phase); sanitizeParams() keeps
// cMid + swing ≤ μ − 0.05 and μ ≤ a − 0.05, so every frame stays a ring cyclide.
const PARAMS = {
  a: 1,
  cMid: 0.24,
  swing: 0.18,
  mu: 0.6,
  rows: 96,
  wire: 24,
  tilt: 0.95,
  spinTurns: 1,
  light: 1,
};

const LIMITS = {
  ringGap: 0.05,
  minMu: 0.3,
  maxMu: 0.85,
  minRows: 40,
  maxRows: 120,
};

// Stage: the cyclide is fitted once per parameter set (never per frame) so its
// projection over the whole loop clears the progress track (y 418) and the captions (y 1322).
const STAGE = {
  centerY: 872,
  boundRadius: 400,
  fov: 0.5,
  tiltSwing: 0.06,
  yawSwing: 0.08,
  fitSamples: 60,
};

const HALF_PI = Math.PI / 2;
const NORMAL_STEP = 2e-3;

// ================================================================
// DUPIN CYCLIDE — the same formulas run here and in GLSL
// ================================================================

// Raw parameterisation (x-extent [−(a + c + μ), a − c + μ]).
function cyclideRaw(u, v, c, mu) {
  const a = PARAMS.a;
  const b2 = a * a - c * c;
  const b = Math.sqrt(b2);
  const cu = Math.cos(u), cv = Math.cos(v);
  const D = a - c * cu * cv;
  return [(mu * (c - a * cu * cv) + b2 * cu) / D, b * Math.sin(u) * (a - mu * cv) / D, b * Math.sin(v) * (c * cu - mu) / D];
}

// Shifted by +c so the bounding box (and the spin axis) is centred on the origin.
function cyclidePoint(u, v, c, mu) {
  const p = cyclideRaw(u, v, c, mu);
  p[0] += c;
  return p;
}

// r_u × r_v from central differences — the parameterisation is regular for a ring cyclide.
function cyclideNormal(u, v, c, mu) {
  const h = NORMAL_STEP;
  const pu1 = cyclideRaw(u + h, v, c, mu), pu0 = cyclideRaw(u - h, v, c, mu);
  const pv1 = cyclideRaw(u, v + h, c, mu), pv0 = cyclideRaw(u, v - h, c, mu);
  const ru = [0, 1, 2].map((i) => (pu1[i] - pu0[i]) / (2 * h));
  const rv = [0, 1, 2].map((i) => (pv1[i] - pv0[i]) / (2 * h));
  return cross(ru, rv);
}

function cross(p, q) {
  return [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
}

function dot(p, q) {
  return p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
}

// ================================================================
// FRAME STATE — a pure function of loop progress, shared by draw and audit
// ================================================================

const frameState = {
  c: 0,
  b: 1,
  mu: 0.6,
  spin: 0,
  tilt: 0,
  yaw: 0,
  hero: 1,
  traceU: 0,
  traceV: 0,
};

// Framing: fixed for a parameter set, solved over the whole loop by fitStage().
const fit = { scale: 160, radius: 1, offsetY: 0, key: "" };

let presetIndex = 0;

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function envelope(p, window) {
  return smoothstep(window[0], window[1], p) * (1 - smoothstep(window[2], window[3], p));
}

// Eccentricity schedule. cos(phase) puts the most asymmetric ring on frame 0 (the opening
// hero frame) and the near-torus at the midpoint; integer multiples of phase keep frame 600 ≡ 0.
function eccentricityAt(phase) {
  return PARAMS.cMid + PARAMS.swing * Math.cos(phase);
}

function computeFrameState(p) {
  const phase = p * TAU;
  const c = eccentricityAt(phase);
  frameState.c = c;
  frameState.b = Math.sqrt(PARAMS.a * PARAMS.a - c * c);
  frameState.mu = PARAMS.mu;
  frameState.hero = 0.5 + 0.5 * Math.cos(phase);
  frameState.spin = PARAMS.spinTurns * phase;
  frameState.tilt = PARAMS.tilt + STAGE.tiltSwing * Math.sin(phase);
  frameState.yaw = STAGE.yawSwing * Math.sin(phase + 0.7);
  // One meridian and one parallel travel around the surface (in turns, wrapped by the shader).
  frameState.traceU = -2 * p;
  frameState.traceV = p;
}

// Same pose renderFrame applies: spin about the cyclide's z axis, tilt, yaw.
function posePoint(point, out) {
  const spin = frameState.spin, tilt = HALF_PI - frameState.tilt, yaw = frameState.yaw;
  let x = point[0], y = point[1], z = point[2];
  let c = Math.cos(spin), s = Math.sin(spin);
  [x, y] = [c * x - s * y, s * x + c * y];
  c = Math.cos(tilt); s = Math.sin(tilt);
  [y, z] = [c * y - s * z, s * y + c * z];
  c = Math.cos(yaw); s = Math.sin(yaw);
  [x, z] = [c * x + s * z, -s * x + c * z];
  out[0] = x; out[1] = y; out[2] = z;
  return out;
}

// z is odd in v, so the surface is already centred in z; only x/y extents are solved.
function fitStage() {
  const key = [PARAMS.cMid, PARAMS.swing, PARAMS.mu, PARAMS.tilt, PARAMS.spinTurns].join();
  if (key === fit.key) return;
  const nu = 72, nv = 36, samples = STAGE.fitSamples;
  const point = [0, 0, 0];
  let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity;
  for (let k = 0; k < samples; k++) {
    computeFrameState(k / samples);
    for (let i = 0; i < nu; i++) {
      const u = TAU * i / nu;
      for (let j = 0; j < nv; j++) {
        const v = TAU * j / nv;
        posePoint(cyclidePoint(u, v, frameState.c, frameState.mu), point);
        xLo = Math.min(xLo, point[0]); xHi = Math.max(xHi, point[0]);
        yLo = Math.min(yLo, point[1]); yHi = Math.max(yHi, point[1]);
      }
    }
  }
  // 0.97 leaves room for perspective growth of the near side (audit measures the true bbox).
  fit.scale = 0.97 * Math.min(2 * STAGE.boundRadius / (yHi - yLo), (W - 2 * HUD.rightTextX) / (xHi - xLo));
  fit.offsetY = -fit.scale * (yLo + yHi) / 2;
  fit.radius = PARAMS.a + PARAMS.mu;
  fit.key = key;
}

// ================================================================
// SURFACE MESH + SHADERS
// ================================================================

// (u, v) lattice in turns; the seam rows duplicate so the wire grid stays continuous.
function buildCyclideMesh(rows) {
  const cols = 2 * rows;
  const geometry = new p5.Geometry();
  geometry.gid = `cyclide-${rows}`;
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) geometry.vertices.push(new p5.Vector(i / cols, j / rows, 0));
  }
  const row = cols + 1;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * row + i;
      geometry.faces.push([a, a + row, a + row + 1], [a, a + row + 1, a + 1]);
    }
  }
  return geometry;
}

const SURFACE_VERTEX = `#version 300 es
precision highp float;
in vec3 aPosition;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uA;
uniform float uC;
uniform float uMu;
uniform float uScale;
uniform float uDistance;
uniform float uDepthSpan;
out vec3 vNormal;
out vec3 vEye;
out vec2 vUV;
out float vDepth;

const float TAU = 6.283185307179586;
const float STEP = 2e-3;

// Line-by-line port of cyclideRaw(); the +c shift matches cyclidePoint().
vec3 cyclide(float u, float v) {
  float b2 = uA * uA - uC * uC;
  float b = sqrt(b2);
  float cu = cos(u);
  float cv = cos(v);
  float D = uA - uC * cu * cv;
  return vec3((uMu * (uC - uA * cu * cv) + b2 * cu) / D, b * sin(u) * (uA - uMu * cv) / D, b * sin(v) * (uC * cu - uMu) / D);
}

void main() {
  float u = aPosition.x * TAU;
  float v = aPosition.y * TAU;
  vec3 r = cyclide(u, v);
  r.x += uC;
  vec3 ru = cyclide(u + STEP, v) - cyclide(u - STEP, v);
  vec3 rv = cyclide(u, v + STEP) - cyclide(u, v - STEP);
  vec4 eye = uModelViewMatrix * vec4(r * uScale, 1.0);
  vNormal = mat3(uModelViewMatrix) * cross(ru, rv);
  vEye = eye.xyz;
  vUV = aPosition.xy;
  vDepth = clamp(0.5 + (eye.z + uDistance) / uDepthSpan, 0.0, 1.0);
  gl_Position = uProjectionMatrix * eye;
}
`;

const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vEye;
in vec2 vUV;
in float vDepth;
uniform vec3 uPositive;
uniform vec3 uNegative;
uniform vec3 uEdge;
uniform vec3 uInk;
uniform float uLight;
uniform float uWireU;
uniform float uWireV;
uniform float uWireOn;
uniform float uEdgeOn;
uniform vec2 uTrace;
out vec4 outColor;

const float TAU = 6.283185307179586;

// Antialiased iso-line of g; fades out where lines crowd closer than ~3 px.
float gridLine(float g) {
  float w = max(fwidth(g), 1e-5);
  float d = abs(fract(g + 0.5) - 0.5) / w;
  return (1.0 - smoothstep(0.45, 1.25, d)) * (1.0 - smoothstep(0.28, 0.55, w));
}

// A single wider circle at parameter value target (both in turns, wrapped).
float traceLine(float g, float target) {
  float d = abs(fract(g - target + 0.5) - 0.5) / max(fwidth(g), 1e-5);
  return 1.0 - smoothstep(0.9, 2.1, d);
}

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
  float shade = uLight * (0.06 + 0.62 * diffuse + 0.18 * soft);

  // Gaussian curvature sign: K > 0 (CYAN) exactly where cos v < 0, K < 0 (MAGENTA) elsewhere.
  float cosV = cos(vUV.y * TAU);
  float elliptic = smoothstep(-0.04, 0.04, -cosV);
  vec3 color = mix(uNegative, uPositive, elliptic) * shade * 0.75;

  // Lines of curvature: uWireU circles u = const, uWireV circles v = const.
  float wire = max(gridLine(vUV.x * uWireU), gridLine(vUV.y * uWireV)) * uWireOn;
  color = mix(color, uInk * (0.28 + 0.72 * shade), 0.8 * wire);

  // Parabolic circles v = π/2, 3π/2 (K = 0) in ACID.
  float g = vUV.y * 2.0 - 0.5;
  float dv = abs(fract(g + 0.5) - 0.5) / max(fwidth(g), 1e-6);
  float edge = (1.0 - smoothstep(0.9, 2.2, dv)) * uEdgeOn;
  color = mix(color, uEdge * (0.6 + 0.6 * shade), 0.95 * edge);

  // One travelling circle from each family.
  float trace = max(traceLine(vUV.x, uTrace.x), traceLine(vUV.y, uTrace.y)) * uWireOn;
  color = mix(color, uInk * (0.5 + 0.6 * shade), 0.85 * trace);

  color += uInk * (0.45 * spec * uLight + 0.1 * rim * uLight);
  color *= mix(0.5, 1.0, vDepth);
  outColor = vec4(min(color, vec3(1.0)), 1.0);
}
`;

let canvasEl;
let grainPg;
let hudPg;
let surfaceShader;
let cyclideMesh;
let meshKey = "";
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
  layers: { wire: true, edge: true, math: true },
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
  fitStage();
  bindUI();
  updateStaticUI();
  syncControls();
  if (auditParam !== null) window.cyclideAudit = runAudit();
  window.cyclide = { PARAMS, frameState, fit, computeFrameState, cyclidePoint, setLoop, runAudit };
}

function rebuildMesh() {
  const rows = clamp(Math.round(PARAMS.rows), LIMITS.minRows, LIMITS.maxRows);
  const key = `${rows}`;
  if (key === meshKey) return;
  if (cyclideMesh) freeGeometry(cyclideMesh);
  cyclideMesh = buildCyclideMesh(rows);
  meshKey = key;
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
  translate(0, STAGE.centerY - H / 2 + fit.offsetY, 0);
  rotateY(frameState.yaw + (free ? sim.dragYaw : 0));
  // Cyclide z axis points up the screen, tipped toward the viewer by tilt.
  rotateX(HALF_PI - frameState.tilt - (free ? sim.dragTilt : 0));
  rotateZ(frameState.spin);
  noStroke();
  shader(surfaceShader);
  surfaceShader.setUniform("uA", PARAMS.a);
  surfaceShader.setUniform("uC", frameState.c);
  surfaceShader.setUniform("uMu", frameState.mu);
  surfaceShader.setUniform("uScale", fit.scale);
  surfaceShader.setUniform("uDistance", distance);
  surfaceShader.setUniform("uDepthSpan", 2.2 * fit.scale * fit.radius);
  surfaceShader.setUniform("uPositive", colorVector(CYAN));
  surfaceShader.setUniform("uNegative", colorVector(MAGENTA));
  surfaceShader.setUniform("uEdge", colorVector(ACID));
  surfaceShader.setUniform("uInk", colorVector(INK));
  surfaceShader.setUniform("uLight", PARAMS.light);
  surfaceShader.setUniform("uWireU", PARAMS.wire);
  surfaceShader.setUniform("uWireV", Math.max(4, Math.round(PARAMS.wire / 2)));
  surfaceShader.setUniform("uWireOn", sim.layers.wire ? 1 : 0);
  surfaceShader.setUniform("uEdgeOn", sim.layers.edge ? 1 : 0);
  surfaceShader.setUniform("uTrace", [frameState.traceU, frameState.traceV]);
  model(cyclideMesh);
  resetShader();
  pop();
}

// ================================================================
// HUD
// ================================================================

// Hook captions; the null window shows at the hero frame on both ends of the loop.
const OVERLAY = {
  hook: true,
  captions: [
    { window: null, first: "EVERY LINE OF CURVATURE IS A CIRCLE", second: "TWO FAMILIES · u = const · v = const" },
    { window: [0.15, 0.17, 0.30, 0.32], first: "PARABOLIC CIRCLES  K = 0", second: "CYAN K > 0 · MAGENTA K < 0" },
    { window: [0.39, 0.41, 0.56, 0.58], first: "c → 0 RETURNS THE TORUS", second: "TUBE RADIUS μ − c … μ + c" },
    { window: [0.65, 0.67, 0.82, 0.84], first: "A TORUS SEEN THROUGH INVERSION", second: "ENVELOPE OF SPHERES TANGENT TO THREE" },
  ],
};

function citationText() {
  const cLo = PARAMS.cMid - PARAMS.swing, cHi = PARAMS.cMid + PARAMS.swing;
  return `a = ${PARAMS.a} · μ = ${PARAMS.mu.toFixed(2)} · c ∈ [${cLo.toFixed(2)}, ${cHi.toFixed(2)}] · u, v ∈ [0, 2π)`;
}

const HUD_TEXT = {
  title: "DUPIN CYCLIDE",
  subtitle: "ALL LINES OF CURVATURE ARE CIRCLES",
  formula: "(x² + y² + z² − μ² + b²)² = 4(ax − cμ)² + 4b²y²",
  condition: "c² = a² − b²  ·  ring:  c < μ < a",
  parabolic: "K = 0 · v = π/2, 3π/2",
};

function readoutText() {
  return `b ${frameState.b.toFixed(3)} · c ${frameState.c.toFixed(3)} · μ ${frameState.mu.toFixed(2)}`;
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
  graphics.text(readoutText(), HUD.stageTextX, HUD.stageY);
  graphics.fill(ACID.r, ACID.g, ACID.b, 240);
  graphics.textAlign(RIGHT, TOP);
  graphics.textSize(22);
  graphics.text(HUD_TEXT.parabolic, W - HUD.rightTextX, HUD.stageY + 3);
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
  if (OVERLAY.hook) {
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
  }
  graphics.textSize(22);
  graphics.fill(INK.r, INK.g, INK.b, HUD.citationAlpha);
  graphics.text(citationText(), W / 2, HUD.citationY);
  compositeHUD(graphics);
}

// ================================================================
// AUDIT — ?audit=1 checks the circle families, the implicit equation, the
// K-sign rule, mesh finiteness, framing, typography fit and the loop seam
// (report stored on window.cyclideAudit).
// ================================================================

// Mulberry32: the audit samples the same points on every run.
function seededRandom(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Max deviation of a closed curve from the circle through three of its points.
function circleError(points) {
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const third = Math.floor(points.length / 3);
  const A = points[0], B = points[third], C = points[2 * third];
  const ab = sub(B, A), ac = sub(C, A), n = cross(ab, ac);
  const nn = dot(n, n);
  const t1 = cross(n, ab), t2 = cross(ac, n);
  const center = [0, 1, 2].map((i) => A[i] + (t1[i] * dot(ac, ac) + t2[i] * dot(ab, ab)) / (2 * nn));
  const radius = Math.hypot(...sub(A, center));
  let error = 0;
  for (const p of points) {
    error = Math.max(error, Math.abs(Math.hypot(...sub(p, center)) - radius), Math.abs(dot(sub(p, A), n)) / Math.sqrt(nn));
  }
  return error;
}

// Normal curvatures along the parameter directions (principal, since F = M = 0).
function principalCurvatures(u, v, c, mu) {
  const h = 1e-4;
  const P = (du, dv) => cyclideRaw(u + du, v + dv, c, mu);
  const p0 = P(0, 0), pu1 = P(h, 0), pu0 = P(-h, 0), pv1 = P(0, h), pv0 = P(0, -h);
  const ru = [0, 1, 2].map((i) => (pu1[i] - pu0[i]) / (2 * h));
  const rv = [0, 1, 2].map((i) => (pv1[i] - pv0[i]) / (2 * h));
  const ruu = [0, 1, 2].map((i) => (pu1[i] - 2 * p0[i] + pu0[i]) / (h * h));
  const rvv = [0, 1, 2].map((i) => (pv1[i] - 2 * p0[i] + pv0[i]) / (h * h));
  const n = cross(ru, rv);
  const len = Math.hypot(...n);
  const N = n.map((x) => x / len);
  return { kU: dot(ruu, N) / dot(ru, ru), kV: dot(rvv, N) / dot(rv, rv), F: dot(ru, rv) / Math.sqrt(dot(ru, ru) * dot(rv, rv)) };
}

function auditGeometry() {
  const random = seededRandom(20261102);
  const report = { circleMaxError: 0, implicitMaxResidual: 0, orthogonalityMax: 0, kSignMismatches: 0, kSamples: 0 };
  // Sweep the slider's whole ring range (μ, c), not just the loop's.
  for (let m = 0; m <= 5; m++) {
    const mu = LIMITS.minMu + (LIMITS.maxMu - LIMITS.minMu) * m / 5;
    for (let k = 0; k <= 5; k++) {
      const c = (mu - LIMITS.ringGap) * k / 5;
      const b2 = PARAMS.a * PARAMS.a - c * c;
      for (let s = 0; s < 6; s++) {
        const t = TAU * s / 6 + 0.1;
        const uCircle = [], vCircle = [];
        for (let i = 0; i < 48; i++) {
          uCircle.push(cyclideRaw(t, TAU * i / 48, c, mu));
          vCircle.push(cyclideRaw(TAU * i / 48, t, c, mu));
        }
        report.circleMaxError = Math.max(report.circleMaxError, circleError(uCircle), circleError(vCircle));
      }
      for (let i = 0; i < 40; i++) {
        const u = random() * TAU, v = random() * TAU;
        const [x, y, z] = cyclideRaw(u, v, c, mu);
        const lhs = (x * x + y * y + z * z - mu * mu + b2) ** 2;
        const rhs = 4 * (PARAMS.a * x - c * mu) ** 2 + 4 * b2 * y * y;
        report.implicitMaxResidual = Math.max(report.implicitMaxResidual, Math.abs(lhs - rhs));
        if (Math.abs(Math.cos(v)) < 0.03) continue;
        const k = principalCurvatures(u, v, c, mu);
        report.orthogonalityMax = Math.max(report.orthogonalityMax, Math.abs(k.F));
        if (Math.sign(k.kU * k.kV) !== Math.sign(-Math.cos(v))) report.kSignMismatches++;
        report.kSamples++;
      }
    }
  }

  // Every mesh vertex at the loop's most eccentric c: finite position and a normal well away from zero.
  let nonFinite = 0, minNormal = Infinity;
  const cMax = PARAMS.cMid + PARAMS.swing;
  for (const vertex of cyclideMesh.vertices) {
    const u = TAU * vertex.x, v = TAU * vertex.y;
    const p = cyclidePoint(u, v, cMax, PARAMS.mu);
    const n = cyclideNormal(u, v, cMax, PARAMS.mu);
    if (!p.every(Number.isFinite) || !n.every(Number.isFinite)) nonFinite++;
    else minNormal = Math.min(minNormal, Math.hypot(...n));
  }
  report.mesh = { vertices: cyclideMesh.vertices.length, faces: cyclideMesh.faces.length, nonFinite, minNormal };
  return report;
}

function auditTypography() {
  const graphics = hudPg;
  const rows = [
    ["Georgia", BOLD, 72, HUD_TEXT.title],
    ["monospace", NORMAL, 34, HUD_TEXT.subtitle],
    ["monospace", NORMAL, 23, HUD_TEXT.formula],
    ["monospace", NORMAL, 26, HUD_TEXT.condition],
    ["monospace", NORMAL, 22, citationText()],
  ];
  for (const caption of OVERLAY.captions) rows.push(["monospace", NORMAL, 28, caption.first], ["monospace", NORMAL, 28, caption.second]);
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
  const left = HUD.stageTextX + graphics.textWidth("b 0.999 · c 0.999 · μ 0.99");
  graphics.textSize(22);
  const right = W - HUD.rightTextX - graphics.textWidth(HUD_TEXT.parabolic);
  return { widestLine: Math.round(widest), available: W - 2 * HUD.safeX, stageGap: Math.round(right - left) };
}

function runAudit() {
  const t0 = performance.now();
  const report = { geometry: auditGeometry(), typography: auditTypography(), framing: null, loop: null };
  const distance = (H / 2) / Math.tan(STAGE.fov / 2);
  const framing = { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity };
  const point = [0, 0, 0];
  let previous = null, first = null, maxInteriorStep = 0;
  const snapshot = () => [
    frameState.c, Math.cos(frameState.spin), Math.sin(frameState.spin), frameState.tilt, frameState.yaw,
    Math.cos(TAU * frameState.traceU), Math.sin(TAU * frameState.traceU),
    Math.cos(TAU * frameState.traceV), Math.sin(TAU * frameState.traceV),
  ];
  const step = (p, q) => Math.max(...p.map((value, i) => Math.abs(value - q[i])));
  let ringMargin = Infinity;
  for (let frame = 0; frame < LOOP_FRAMES; frame++) {
    computeFrameState(frame / LOOP_FRAMES);
    ringMargin = Math.min(ringMargin, frameState.mu - frameState.c, PARAMS.a - frameState.mu);
    const current = snapshot();
    if (previous) maxInteriorStep = Math.max(maxInteriorStep, step(current, previous));
    else first = current;
    previous = current;
    if (frame % 6 !== 0) continue;
    // Exact perspective projection of the posed, scaled surface (matches renderFrame).
    for (let i = 0; i < 96; i++) {
      const u = TAU * i / 96;
      for (let j = 0; j < 48; j++) {
        const v = TAU * j / 48;
        posePoint(cyclidePoint(u, v, frameState.c, frameState.mu), point);
        const p = point.map((value) => value * fit.scale);
        const cy = STAGE.centerY + fit.offsetY;
        const depth = distance - p[2];
        const sx = W / 2 + p[0] * distance / depth;
        const sy = cy + (p[1] * distance + (cy - H / 2) * p[2]) / depth;
        framing.top = Math.min(framing.top, Math.round(sy));
        framing.bottom = Math.max(framing.bottom, Math.round(sy));
        framing.left = Math.min(framing.left, Math.round(sx));
        framing.right = Math.max(framing.right, Math.round(sx));
      }
    }
  }
  framing.clearsTrack = framing.top > HUD.trackY + 12;
  framing.clearsCaptions = framing.bottom < HUD.bottomTextY - 24;
  report.framing = framing;
  // Wrap step 599 → 0 must look like any other consecutive step.
  report.loop = {
    frames: LOOP_FRAMES,
    seconds: LOOP_FRAMES / FPS,
    seamStep: step(first, previous),
    maxInteriorStep,
    ringMargin,
    auditMs: performance.now() - t0,
  };
  const g = report.geometry;
  report.ok = g.circleMaxError < 1e-9 && g.implicitMaxResidual < 1e-9 && g.orthogonalityMax < 1e-6 &&
    g.kSignMismatches === 0 && g.mesh.nonFinite === 0 && g.mesh.minNormal > 1e-3 &&
    framing.clearsTrack && framing.clearsCaptions &&
    report.typography.widestLine <= report.typography.available && report.typography.stageGap > 20 &&
    report.loop.seamStep <= report.loop.maxInteriorStep * 1.01 && ringMargin >= LIMITS.ringGap - 1e-9;
  console.log("[cyclide audit]", JSON.stringify(report, null, 2));
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

// Presets stay inside the ring range c < μ < a; the shape stays a ring cyclide.
const PRESETS = [
  { key: "loop", params: {} },
  { key: "torus", params: { cMid: 0.05, swing: 0.04 } },
  { key: "thin", params: { mu: 0.55, cMid: 0.36, swing: 0.12 } },
  { key: "fat", params: { mu: 0.8, cMid: 0.3, swing: 0.12 } },
];

// ?preset=thin&c=0.3&swing=0&mu=0.7 — handy for stills and shader checks.
function applyUrlParams() {
  const preset = PRESETS.findIndex((entry) => entry.key === urlParam("preset"));
  if (preset >= 0) {
    presetIndex = preset;
    Object.assign(PARAMS, PRESETS[preset].params);
  }
  const numeric = (name, key) => {
    const value = Number(urlParam(name));
    if (urlParam(name) !== null && Number.isFinite(value)) PARAMS[key] = value;
  };
  numeric("c", "cMid");
  numeric("swing", "swing");
  numeric("mu", "mu");
  numeric("rows", "rows");
  numeric("wire", "wire");
  numeric("tilt", "tilt");
  numeric("spin", "spinTurns");
  if (urlParam("hook") === "0") OVERLAY.hook = false;
  sanitizeParams();
}

// Ring cyclide: μ ≤ a − gap and 0 ≤ c(t) ≤ μ − gap for the whole loop (thin tube ≥ gap).
function sanitizeParams() {
  PARAMS.mu = clamp(PARAMS.mu, LIMITS.minMu, Math.min(LIMITS.maxMu, PARAMS.a - LIMITS.ringGap));
  const cMax = PARAMS.mu - LIMITS.ringGap;
  PARAMS.swing = clamp(PARAMS.swing, 0, Math.min(0.2, cMax / 2));
  PARAMS.cMid = clamp(PARAMS.cMid, PARAMS.swing, cMax - PARAMS.swing);
  PARAMS.rows = clamp(Math.round(PARAMS.rows), LIMITS.minRows, LIMITS.maxRows);
  PARAMS.wire = clamp(Math.round(PARAMS.wire), 6, 48);
  PARAMS.tilt = clamp(PARAMS.tilt, 0, 1.4);
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
  cSlider: ["cMid", (v) => v.toFixed(2)],
  swingSlider: ["swing", (v) => `± ${v.toFixed(2)}`],
  muSlider: ["mu", (v) => v.toFixed(2)],
  rowsSlider: ["rows", (v) => `${v.toFixed(0)} × ${(2 * v).toFixed(0)}`],
  wireSlider: ["wire", (v) => `${v.toFixed(0)} × ${Math.max(4, Math.round(v / 2))}`],
  tiltSlider: ["tilt", (v) => `${(v * 180 / Math.PI).toFixed(0)}°`],
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
      sanitizeParams();
      rebuildMesh();
      fitStage();
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
  const toggles = { showWire: "wire", showEdge: "edge", showMath: "math" };
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

const DEFAULT_PARAMS = { ...PARAMS };

function selectPreset(index) {
  if (isRecording) return;
  presetIndex = index;
  Object.assign(PARAMS, DEFAULT_PARAMS, PRESETS[index].params);
  sanitizeParams();
  rebuildMesh();
  fitStage();
  syncControls();
}

function togglePause() {
  if (isRecording) return;
  sim.paused = !sim.paused;
  syncControls();
}

function resetSimulator() {
  if (isRecording) return;
  Object.assign(PARAMS, DEFAULT_PARAMS);
  rebuildMesh();
  fitStage();
  presetIndex = 0;
  Object.assign(sim, { paused: false, playhead: 0, dragYaw: 0, dragTilt: 0 });
  for (const layer of Object.keys(sim.layers)) sim.layers[layer] = true;
  OVERLAY.hook = true;
  for (const id of ["showWire", "showEdge", "showHook", "showMath"]) {
    const element = getElement(id);
    if (element) element.checked = true;
  }
  syncControls();
}

const CONTROL_IDS = [
  ...Object.keys(SLIDERS),
  ...PRESETS.map((preset) => `preset-${preset.key}`),
  "pauseBtn", "resetBtn", "showWire", "showEdge", "showHook", "showMath",
];

function syncControls() {
  for (const [id, [key, format]] of Object.entries(SLIDERS)) {
    const element = getElement(id);
    if (element) element.value = PARAMS[key];
    setText(id.replace("Slider", "Value"), format(PARAMS[key]));
  }
  PRESETS.forEach((preset, index) => {
    const element = getElement(`preset-${preset.key}`);
    if (element) element.style.borderColor = index === presetIndex ? "rgba(255,255,255,0.6)" : "";
  });
  setText("pauseBtn", sim.paused ? "Play" : "Pause");
  const math = getElement("math");
  if (math) math.hidden = !sim.layers.math;
  for (const id of CONTROL_IDS) setDisabled(id, isRecording);
}

function updateLiveUI() {
  if (frameCount % 6 !== 0 || !sim.layers.math) return;
  setText("abValue", `b ${frameState.b.toFixed(4)} · c ${frameState.c.toFixed(4)} · μ ${frameState.mu.toFixed(2)}`);
  setText("tubeValue", `${(frameState.mu - frameState.c).toFixed(3)} … ${(frameState.mu + frameState.c).toFixed(3)}`);
  setText("meshValue", `${cyclideMesh.vertices.length} verts · 1 draw call`);
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
    saveCanvas(`dupin_cyclide_${getTimestamp()}`, "png");
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
    anchor.download = `dupin_cyclide_${getTimestamp()}.mp4`;
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
