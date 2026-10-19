"use strict";

// DINI'S SURFACE — CONSTANT NEGATIVE CURVATURE
//   x = a cos u sin v,   y = a sin u sin v,   z = a (cos v + ln tan(v/2)) + b u
// with 0 < v < π (ln tan(v/2) → ∓∞ at the ends) and Gaussian curvature
//   K = −1 / (a² + b²)   everywhere off the cuspidal edge.
// The twist b animates while a = √(C² − b²), so a² + b² = C² and K ≡ −1/C² on every frame.
// Every component of r_v carries the factor a cos v, so r_v = 0 on v = π/2: that line is the
// cuspidal edge, the helix (a cos u, a sin u, b u). Normals use r_u × (r_v / a cos v), which
// never vanishes. Each meridian u = const is a planar tractrix lifted by b u.

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

// Adjustable parameters. b(t) = twist + swing · cos(phase), a = √(C² − b²): any
// slider value keeps a² + b² = C², so the curvature never leaves −1/C².
const PARAMS = {
  curvatureRadius: 1,
  twist: 0.16,
  swing: 0.05,
  turns: 2,
  vMin: 0.1,
  vMax: 2.0,
  rows: 100,
  wire: 24,
  tilt: 0.3,
  spinTurns: 1,
  light: 1,
};

const LIMITS = {
  maxB: 0.55,
  minV: 0.03,
  maxV: Math.PI - 0.3,
  minRows: 40,
  maxRows: 120,
};

// Stage: the sculpture is fitted once per parameter set (never per frame) so its
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

// ================================================================
// DINI'S SURFACE — the same formulas run here and in GLSL
// ================================================================

function profileZ(v) {
  return Math.cos(v) + Math.log(Math.tan(v / 2));
}

function diniPoint(u, v, a, b) {
  const s = Math.sin(v);
  return [a * Math.cos(u) * s, a * Math.sin(u) * s, a * profileZ(v) + b * u];
}

// r_u × (r_v / a cos v): the oriented unit normal up to the sign of cos v, finite on the cusp.
function diniNormal(u, v, a, b) {
  const s = Math.sin(v);
  const ru = [-a * Math.sin(u) * s, a * Math.cos(u) * s, b];
  const rv = [Math.cos(u), Math.sin(u), Math.cos(v) / s];
  return cross(ru, rv);
}

// Signed meridian arc length in units of a: σ = ln sin v below the cusp, −ln sin v above.
function arcSigma(v) {
  return v <= HALF_PI ? Math.log(Math.sin(v)) : -Math.log(Math.sin(v));
}

function arcToV(sigma) {
  return sigma <= 0 ? Math.asin(Math.exp(sigma)) : Math.PI - Math.asin(Math.exp(-sigma));
}

function cross(p, q) {
  return [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
}

function dot(p, q) {
  return p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
}

function uRange() {
  const half = PARAMS.turns * Math.PI;
  return [-half, half];
}

// ================================================================
// FRAME STATE — a pure function of loop progress, shared by draw and audit
// ================================================================

const frameState = {
  a: 1,
  b: 0,
  curvature: -1,
  spin: 0,
  tilt: 0,
  yaw: 0,
  hero: 1,
};

// Framing: fixed for a parameter set, solved over the whole loop by fitStage().
const fit = { scale: 160, zCenter: 0, offsetY: 0, key: "" };

let presetIndex = 0;

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function envelope(p, window) {
  return smoothstep(window[0], window[1], p) * (1 - smoothstep(window[2], window[3], p));
}

// Twist schedule. cos(phase) puts the tightest helix on frame 0 (the opening hero frame)
// and the loosest at the midpoint; integer multiples of phase keep frame 600 ≡ frame 0.
function twistAt(phase) {
  return PARAMS.twist + PARAMS.swing * Math.cos(phase);
}

function computeFrameState(p) {
  const phase = p * TAU;
  const C = PARAMS.curvatureRadius;
  const b = twistAt(phase);
  frameState.b = b;
  frameState.a = Math.sqrt(C * C - b * b);
  frameState.curvature = -1 / (frameState.a * frameState.a + b * b);
  frameState.hero = 0.5 + 0.5 * Math.cos(phase);
  frameState.spin = PARAMS.spinTurns * phase;
  frameState.tilt = PARAMS.tilt + STAGE.tiltSwing * Math.sin(phase);
  frameState.yaw = STAGE.yawSwing * Math.sin(phase + 0.7);
}

// Same pose renderFrame applies: mirror y (p5's y-down view is left-handed, so this keeps the
// on-screen helix right-handed like the equations), spin about the axis, tilt, yaw.
function posePoint(point, out) {
  const spin = frameState.spin, tilt = HALF_PI - frameState.tilt, yaw = frameState.yaw;
  let x = point[0], y = -point[1], z = point[2] - fit.zCenter;
  let c = Math.cos(spin), s = Math.sin(spin);
  [x, y] = [c * x - s * y, s * x + c * y];
  c = Math.cos(tilt); s = Math.sin(tilt);
  [y, z] = [c * y - s * z, s * y + c * z];
  c = Math.cos(yaw); s = Math.sin(yaw);
  [x, z] = [c * x + s * z, -s * x + c * z];
  out[0] = x; out[1] = y; out[2] = z;
  return out;
}

function fitStage() {
  const key = [PARAMS.twist, PARAMS.swing, PARAMS.turns, PARAMS.vMin, PARAMS.vMax, PARAMS.tilt, PARAMS.spinTurns].join();
  if (key === fit.key) return;
  const [u0, u1] = uRange();
  const nu = 72, nv = 28, samples = STAGE.fitSamples;
  const point = [0, 0, 0];
  let zMin = Infinity, zMax = -Infinity;
  for (let k = 0; k < samples; k++) {
    computeFrameState(k / samples);
    for (const v of [PARAMS.vMin, PARAMS.vMax]) {
      for (const u of [u0, u1]) {
        const z = diniPoint(u, v, frameState.a, frameState.b)[2];
        zMin = Math.min(zMin, z);
        zMax = Math.max(zMax, z);
      }
    }
  }
  fit.zCenter = (zMin + zMax) / 2;
  let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity;
  for (let k = 0; k < samples; k++) {
    computeFrameState(k / samples);
    for (let i = 0; i <= nu; i++) {
      const u = u0 + (u1 - u0) * i / nu;
      for (let j = 0; j <= nv; j++) {
        const v = PARAMS.vMin + (PARAMS.vMax - PARAMS.vMin) * j / nv;
        posePoint(diniPoint(u, v, frameState.a, frameState.b), point);
        xLo = Math.min(xLo, point[0]); xHi = Math.max(xHi, point[0]);
        yLo = Math.min(yLo, point[1]); yHi = Math.max(yHi, point[1]);
      }
    }
  }
  // 0.97 leaves room for perspective growth of the near side (audit measures the true bbox).
  fit.scale = 0.97 * Math.min(2 * STAGE.boundRadius / (yHi - yLo), (W - 2 * HUD.rightTextX) / (xHi - xLo));
  fit.offsetY = -fit.scale * (yLo + yHi) / 2;
  fit.key = key;
}

// ================================================================
// SURFACE MESH + SHADERS
// ================================================================

// (u, v) lattice. Rows are spaced evenly in meridian arc length, and when the range crosses
// v = π/2 one row sits exactly on the cuspidal edge, so the fold stays sharp.
function buildDiniMesh(rows, vMin, vMax) {
  const cols = 4 * rows;
  const geometry = new p5.Geometry();
  geometry.gid = `dini-${rows}-${vMin.toFixed(3)}-${vMax.toFixed(3)}`;
  const s0 = arcSigma(vMin);
  const s1 = arcSigma(vMax);
  const sigmas = [];
  if (vMax > HALF_PI) {
    const upper = clamp(Math.round(rows * s1 / (s1 - s0)), 2, rows - 2);
    for (let j = 0; j < rows - upper; j++) sigmas.push(s0 * (1 - j / (rows - upper)));
    for (let j = 0; j <= upper; j++) sigmas.push(s1 * j / upper);
  } else {
    for (let j = 0; j <= rows; j++) sigmas.push(s0 + (s1 - s0) * j / rows);
  }
  for (const sigma of sigmas) {
    const v = sigma === 0 ? HALF_PI : arcToV(sigma);
    for (let i = 0; i <= cols; i++) geometry.vertices.push(new p5.Vector(i / cols, v, sigma));
  }
  const row = cols + 1;
  for (let j = 0; j < sigmas.length - 1; j++) {
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
uniform float uB;
uniform vec2 uURange;
uniform float uZCenter;
uniform float uScale;
uniform float uDistance;
uniform float uDepthSpan;
out vec3 vNormal;
out vec3 vEye;
out vec2 vGrid;
out float vV;
out float vDepth;

// Line-by-line port of diniPoint() / diniNormal(); y is mirrored like posePoint().
void main() {
  float u = mix(uURange.x, uURange.y, aPosition.x);
  float v = aPosition.y;
  float s = sin(v);
  float c = cos(v);
  vec3 r = vec3(uA * cos(u) * s, uA * sin(u) * s, uA * (c + log(tan(0.5 * v))) + uB * u - uZCenter);
  vec3 ru = vec3(-uA * sin(u) * s, uA * cos(u) * s, uB);
  vec3 rv = vec3(cos(u), sin(u), c / s);
  vec3 n = cross(ru, rv);
  r.y = -r.y;
  n.y = -n.y;
  vec4 eye = uModelViewMatrix * vec4(r * uScale, 1.0);
  vNormal = mat3(uModelViewMatrix) * n;
  vEye = eye.xyz;
  vGrid = vec2(u, aPosition.z);
  vV = v;
  vDepth = clamp(0.5 + (eye.z + uDistance) / uDepthSpan, 0.0, 1.0);
  gl_Position = uProjectionMatrix * eye;
}
`;

const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vEye;
in vec2 vGrid;
in float vV;
in float vDepth;
uniform vec3 uFront;
uniform vec3 uBack;
uniform vec3 uEdge;
uniform vec3 uInk;
uniform float uLight;
uniform float uWireU;
uniform float uWireS;
uniform float uWireOn;
uniform float uEdgeOn;
out vec4 outColor;

const float TAU = 6.283185307179586;

// Antialiased iso-line of g; fades out where lines crowd closer than ~3 px (the tail).
float gridLine(float g) {
  float w = max(fwidth(g), 1e-5);
  float d = abs(fract(g + 0.5) - 0.5) / w;
  return (1.0 - smoothstep(0.45, 1.25, d)) * (1.0 - smoothstep(0.28, 0.55, w));
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(-vEye);
  // The continuous normal field picks the side: CYAN on one face, MAGENTA on the other.
  bool front = dot(n, v) >= 0.0;
  if (!front) n = -n;
  vec3 key = normalize(vec3(-0.55, -0.7, 0.75));
  vec3 fill = normalize(vec3(0.8, 0.35, 0.45));
  float diffuse = max(dot(n, key), 0.0);
  float soft = max(dot(n, fill), 0.0);
  float spec = pow(max(dot(reflect(-key, n), v), 0.0), 42.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  float shade = uLight * (0.06 + 0.62 * diffuse + 0.18 * soft);
  vec3 color = (front ? uFront : uBack) * shade * 0.75;

  // Meridians (tractrices) every TAU / uWireU in u; parallels every uWireS in arc length.
  float wire = max(gridLine(vGrid.x * uWireU / TAU), gridLine(vGrid.y / uWireS)) * uWireOn;
  color = mix(color, uInk * (0.28 + 0.72 * shade), 0.8 * wire);

  // Cuspidal edge v = π/2 in ACID.
  float dv = vV - 1.5707963267948966;
  float edge = (1.0 - smoothstep(0.9, 2.2, abs(dv) / max(fwidth(dv), 1e-6))) * uEdgeOn;
  color = mix(color, uEdge * (0.6 + 0.6 * shade), 0.95 * edge);

  color += uInk * (0.45 * spec * uLight + 0.1 * rim * uLight);
  color *= mix(0.5, 1.0, vDepth);
  outColor = vec4(min(color, vec3(1.0)), 1.0);
}
`;

let canvasEl;
let grainPg;
let hudPg;
let surfaceShader;
let diniMesh;
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
  if (auditParam !== null) window.diniAudit = runAudit();
  window.dini = { PARAMS, frameState, fit, computeFrameState, diniPoint, setLoop, runAudit };
}

function rebuildMesh() {
  const rows = clamp(Math.round(PARAMS.rows), LIMITS.minRows, LIMITS.maxRows);
  const key = `${rows}|${PARAMS.vMin}|${PARAMS.vMax}`;
  if (key === meshKey) return;
  if (diniMesh) freeGeometry(diniMesh);
  diniMesh = buildDiniMesh(rows, PARAMS.vMin, PARAMS.vMax);
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
  // Surface z axis points up the screen, tipped toward the viewer by tilt.
  rotateX(HALF_PI - frameState.tilt - (free ? sim.dragTilt : 0));
  rotateZ(frameState.spin);
  noStroke();
  shader(surfaceShader);
  surfaceShader.setUniform("uA", frameState.a);
  surfaceShader.setUniform("uB", frameState.b);
  surfaceShader.setUniform("uURange", uRange());
  surfaceShader.setUniform("uZCenter", fit.zCenter);
  surfaceShader.setUniform("uScale", fit.scale);
  surfaceShader.setUniform("uDistance", distance);
  surfaceShader.setUniform("uDepthSpan", 2.2 * fit.scale * PARAMS.curvatureRadius);
  surfaceShader.setUniform("uFront", colorVector(CYAN));
  surfaceShader.setUniform("uBack", colorVector(MAGENTA));
  surfaceShader.setUniform("uEdge", colorVector(ACID));
  surfaceShader.setUniform("uInk", colorVector(INK));
  surfaceShader.setUniform("uLight", PARAMS.light);
  surfaceShader.setUniform("uWireU", PARAMS.wire);
  surfaceShader.setUniform("uWireS", Math.PI / PARAMS.wire);
  surfaceShader.setUniform("uWireOn", sim.layers.wire ? 1 : 0);
  surfaceShader.setUniform("uEdgeOn", sim.layers.edge ? 1 : 0);
  model(diniMesh);
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
    { window: null, first: "ONE CURVATURE. EVERY TWIST.", second: "a² + b² = 1  →  K ≡ −1" },
    { window: [0.15, 0.17, 0.30, 0.32], first: "CUSPIDAL EDGE  v = π/2", second: "A HELIX (a cos u, a sin u, b·u)" },
    { window: [0.39, 0.41, 0.56, 0.58], first: "EVERY MERIDIAN IS A TRACTRIX", second: "TANGENT TO THE AXIS ≡ a" },
    { window: [0.65, 0.67, 0.82, 0.84], first: "THE TWIST b CHANGES", second: "THE CURVATURE DOES NOT" },
  ],
};

function citationText() {
  const [u0, u1] = uRange();
  const piText = (value) => `${value < 0 ? "−" : ""}${(Math.abs(value) / Math.PI).toFixed(0)}π`;
  return `u ∈ [${piText(u0)}, ${piText(u1)}] · v ∈ [${PARAMS.vMin.toFixed(2)}, ${PARAMS.vMax.toFixed(2)}] · K = −1/(a² + b²)`;
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
  graphics.text("DINI'S SURFACE", W / 2, HUD.titleY);
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(34);
  graphics.fill(INK.r, INK.g, INK.b, 228);
  graphics.text("CONSTANT NEGATIVE CURVATURE", W / 2, HUD.formulaY);
  graphics.textSize(23);
  graphics.fill(CYAN.r, CYAN.g, CYAN.b, 220);
  graphics.text("x = a cos u sin v · y = a sin u sin v", W / 2, HUD.exponentY);
  graphics.textSize(26);
  graphics.fill(INK.r, INK.g, INK.b, 215);
  graphics.text("z = a (cos v + ln tan v/2) + b u", W / 2, HUD.subtitleY);

  graphics.textAlign(LEFT, TOP);
  graphics.fill(INK.r, INK.g, INK.b, 235);
  graphics.text(`a ${frameState.a.toFixed(3)} · b ${frameState.b.toFixed(3)}`, HUD.stageTextX, HUD.stageY);
  graphics.fill(ACID.r, ACID.g, ACID.b, 240);
  graphics.textAlign(RIGHT, TOP);
  graphics.textSize(22);
  graphics.text(`K = ${frameState.curvature.toFixed(3).replace("-", "−")}`, W - HUD.rightTextX, HUD.stageY + 3);
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
// AUDIT — ?audit=1 checks curvature, tractrix meridians, the cusp helix,
// mesh finiteness, framing, typography fit and the loop seam
// (report stored on window.diniAudit).
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

// K = (LN − M²) / (EG − F²) from central differences of diniPoint alone.
function finiteCurvature(u, v, a, b) {
  const h = 2e-4;
  const P = (du, dv) => diniPoint(u + du, v + dv, a, b);
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const p0 = P(0, 0);
  const pu1 = P(h, 0), pu0 = P(-h, 0), pv1 = P(0, h), pv0 = P(0, -h);
  const ru = sub(pu1, pu0).map((x) => x / (2 * h));
  const rv = sub(pv1, pv0).map((x) => x / (2 * h));
  const ruu = [0, 1, 2].map((i) => (pu1[i] - 2 * p0[i] + pu0[i]) / (h * h));
  const rvv = [0, 1, 2].map((i) => (pv1[i] - 2 * p0[i] + pv0[i]) / (h * h));
  const pp = P(h, h), pm = P(h, -h), mp = P(-h, h), mm = P(-h, -h);
  const ruv = [0, 1, 2].map((i) => (pp[i] - pm[i] - mp[i] + mm[i]) / (4 * h * h));
  const n = cross(ru, rv);
  const len = Math.hypot(...n);
  const N = n.map((x) => x / len);
  const E = dot(ru, ru), F = dot(ru, rv), G = dot(rv, rv);
  const L = dot(ruu, N), M = dot(ruv, N), Nn = dot(rvv, N);
  return (L * Nn - M * M) / (E * G - F * F);
}

function auditGeometry() {
  const random = seededRandom(20261019);
  const report = { curvatureMaxRelError: 0, curvatureSamples: 0, aSquaredPlusBSquaredError: 0 };
  const saved = { twist: PARAMS.twist, swing: PARAMS.swing };
  const C = PARAMS.curvatureRadius;
  // Sweep the slider's whole twist range, not just the loop's.
  for (let k = 0; k <= 10; k++) {
    const b = LIMITS.maxB * k / 10;
    const a = Math.sqrt(C * C - b * b);
    report.aSquaredPlusBSquaredError = Math.max(report.aSquaredPlusBSquaredError, Math.abs(a * a + b * b - C * C));
    const expected = -1 / (a * a + b * b);
    for (let i = 0; i < 60; i++) {
      const u = (random() * 2 - 1) * 2 * Math.PI;
      let v = 0.08 + random() * (Math.PI - 0.16);
      if (Math.abs(v - HALF_PI) < 0.12) v += 0.3;
      const K = finiteCurvature(u, v, a, b);
      report.curvatureMaxRelError = Math.max(report.curvatureMaxRelError, Math.abs(K - expected) / Math.abs(expected));
      report.curvatureSamples++;
    }
  }
  Object.assign(PARAMS, saved);

  // Tractrix: along a meridian, the tangent segment from the curve to the axis has length a.
  let tractrix = 0;
  for (let i = 1; i < 40; i++) {
    const v = PARAMS.vMin + (HALF_PI - 0.02 - PARAMS.vMin) * i / 40;
    const a = 0.97;
    const rho = a * Math.sin(v);
    const dRho = a * Math.cos(v);
    const dz = a * Math.cos(v) * Math.cos(v) / Math.sin(v);
    tractrix = Math.max(tractrix, Math.abs(rho * Math.hypot(dRho, dz) / Math.abs(dRho) - a));
  }
  report.tractrixTangentError = tractrix;

  // Cusp edge: r(u, π/2) = (a cos u, a sin u, b u), and r_v vanishes there.
  let helix = 0;
  for (let i = 0; i <= 40; i++) {
    const u = -2 * Math.PI + 4 * Math.PI * i / 40;
    const p = diniPoint(u, HALF_PI, 0.98, 0.2);
    helix = Math.max(helix, Math.abs(p[0] - 0.98 * Math.cos(u)), Math.abs(p[1] - 0.98 * Math.sin(u)), Math.abs(p[2] - 0.2 * u));
  }
  report.cuspHelixError = helix;

  // Every mesh vertex: finite position and a normal well away from zero (cusp row included).
  let nonFinite = 0, minNormal = Infinity;
  const [u0, u1] = uRange();
  for (const vertex of diniMesh.vertices) {
    const u = u0 + (u1 - u0) * vertex.x;
    const p = diniPoint(u, vertex.y, 0.98, 0.2);
    const n = diniNormal(u, vertex.y, 0.98, 0.2);
    if (!p.every(Number.isFinite) || !n.every(Number.isFinite)) nonFinite++;
    else minNormal = Math.min(minNormal, Math.hypot(...n));
  }
  report.mesh = { vertices: diniMesh.vertices.length, faces: diniMesh.faces.length, nonFinite, minNormal };
  return report;
}

function auditTypography() {
  const graphics = hudPg;
  const rows = [
    ["Georgia", BOLD, 72, "DINI'S SURFACE"],
    ["monospace", NORMAL, 34, "CONSTANT NEGATIVE CURVATURE"],
    ["monospace", NORMAL, 23, "x = a cos u sin v · y = a sin u sin v"],
    ["monospace", NORMAL, 26, "z = a (cos v + ln tan v/2) + b u"],
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
  graphics.textSize(26);
  const left = HUD.stageTextX + graphics.textWidth("a 0.999 · b 0.999");
  graphics.textSize(22);
  const right = W - HUD.rightTextX - graphics.textWidth("K = −1.000");
  return { widestLine: Math.round(widest), available: W - 2 * HUD.safeX, stageGap: Math.round(right - left) };
}

function runAudit() {
  const t0 = performance.now();
  const report = { geometry: auditGeometry(), typography: auditTypography(), framing: null, loop: null };
  const distance = (H / 2) / Math.tan(STAGE.fov / 2);
  const framing = { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity };
  const [u0, u1] = uRange();
  const point = [0, 0, 0];
  let previous = null, first = null, maxInteriorStep = 0;
  const snapshot = () => [frameState.a, frameState.b, Math.cos(frameState.spin), Math.sin(frameState.spin), frameState.tilt, frameState.yaw];
  const step = (p, q) => Math.max(...p.map((value, i) => Math.abs(value - q[i])));
  let curvatureDrift = 0;
  for (let frame = 0; frame < LOOP_FRAMES; frame++) {
    computeFrameState(frame / LOOP_FRAMES);
    curvatureDrift = Math.max(curvatureDrift, Math.abs(frameState.curvature + 1 / (PARAMS.curvatureRadius ** 2)));
    const current = snapshot();
    if (previous) maxInteriorStep = Math.max(maxInteriorStep, step(current, previous));
    else first = current;
    previous = current;
    if (frame % 6 !== 0) continue;
    // Exact perspective projection of the posed, scaled surface (matches renderFrame).
    for (let i = 0; i <= 96; i++) {
      const u = u0 + (u1 - u0) * i / 96;
      for (let j = 0; j <= 32; j++) {
        const v = PARAMS.vMin + (PARAMS.vMax - PARAMS.vMin) * j / 32;
        posePoint(diniPoint(u, v, frameState.a, frameState.b), point);
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
    curvatureDrift,
    auditMs: performance.now() - t0,
  };
  const g = report.geometry;
  report.ok = g.curvatureMaxRelError < 1e-4 && g.tractrixTangentError < 1e-9 && g.cuspHelixError < 1e-12 &&
    g.mesh.nonFinite === 0 && g.mesh.minNormal > 0.05 && framing.clearsTrack && framing.clearsCaptions &&
    report.typography.widestLine <= report.typography.available && report.typography.stageGap > 20 &&
    report.loop.seamStep <= report.loop.maxInteriorStep * 1.01 && curvatureDrift < 1e-12;
  console.log("[dini audit]", JSON.stringify(report, null, 2));
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

// Presets only move parameters that keep a² + b² = C²; the shape stays a Dini surface.
const PRESETS = [
  { key: "loop", params: {} },
  { key: "tight", params: { twist: 0.3, swing: 0.04 } },
  { key: "open", params: { twist: 0.05, swing: 0.04 } },
  { key: "cusp", params: { vMax: 2.6, twist: 0.14, swing: 0.04 } },
];

// ?preset=tight&b=0.2&swing=0&vmax=2.4 — handy for stills and shader checks.
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
  numeric("b", "twist");
  numeric("swing", "swing");
  numeric("turns", "turns");
  numeric("vmin", "vMin");
  numeric("vmax", "vMax");
  numeric("rows", "rows");
  numeric("wire", "wire");
  numeric("tilt", "tilt");
  numeric("spin", "spinTurns");
  if (urlParam("hook") === "0") OVERLAY.hook = false;
  sanitizeParams();
}

// Valid Dini ranges: 0 ≤ b ≤ maxB < C (so a > 0), 0 < vMin < vMax < π (ln tan finite).
function sanitizeParams() {
  PARAMS.swing = clamp(PARAMS.swing, 0, 0.15);
  PARAMS.twist = clamp(PARAMS.twist, PARAMS.swing, LIMITS.maxB - PARAMS.swing);
  PARAMS.turns = clamp(Math.round(PARAMS.turns * 2) / 2, 0.5, 3);
  PARAMS.vMin = clamp(PARAMS.vMin, LIMITS.minV, 1.2);
  PARAMS.vMax = clamp(PARAMS.vMax, PARAMS.vMin + 0.2, LIMITS.maxV);
  PARAMS.rows = clamp(Math.round(PARAMS.rows), LIMITS.minRows, LIMITS.maxRows);
  PARAMS.wire = clamp(Math.round(PARAMS.wire), 6, 48);
  PARAMS.tilt = clamp(PARAMS.tilt, 0, 0.9);
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
  twistSlider: ["twist", (v) => v.toFixed(2)],
  swingSlider: ["swing", (v) => `± ${v.toFixed(2)}`],
  turnsSlider: ["turns", (v) => `${v.toFixed(1)} turns`],
  vMinSlider: ["vMin", (v) => v.toFixed(2)],
  vMaxSlider: ["vMax", (v) => v.toFixed(2)],
  rowsSlider: ["rows", (v) => `${v.toFixed(0)} × ${(4 * v).toFixed(0)}`],
  wireSlider: ["wire", (v) => `${v.toFixed(0)} / turn`],
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
  setText("abValue", `a ${frameState.a.toFixed(4)} · b ${frameState.b.toFixed(4)}`);
  setText("curvatureValue", `${frameState.curvature.toFixed(6)}`);
  setText("meshValue", `${diniMesh.vertices.length} verts · 1 draw call`);
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
    saveCanvas(`dini_surface_${getTimestamp()}`, "png");
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
    anchor.download = `dini_surface_${getTimestamp()}.mp4`;
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
