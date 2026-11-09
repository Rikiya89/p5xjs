"use strict";

// GABRIEL'S HORN — TORRICELLI'S TRUMPET
// y = 1/x (x ≥ 1) rotated about the x-axis:
//   P(u, θ) = (u, cos θ / u, sin θ / u),  u ∈ [1, L],  θ ∈ [0, 2π);  outward normal ∝ (1/u², cos θ, sin θ).
// V(L) = π ∫₁ᴸ x⁻² dx = π(1 − 1/L) → π
// A(L) = 2π ∫₁ᴸ √(1 + x⁻⁴) / x dx = π[asinh L² − √(L⁴ + 1) / L² + √2 − asinh 1] > 2π ln L → ∞
// Only u ≤ L is drawn as the horn. The faint ghost on [L, 3L] and the dashed axis stand for the
// infinite limit that the finite render can never reach.

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

const PARAMS = {
  length: 30,
  spinTurns: 1,
  rows: 160,
  wire: 24,
  light: 1,
  mode: "auto",
};

const LIMITS = {
  minLength: 6,
  maxLength: 60,
  openingLength: 4,
  ghostFactor: 3,
  minRows: 60,
  maxRows: 240,
};

// Camera keyframes in horn units (mouth radius = 1). side = the y = 1/x graph view,
// depth = the horn receding toward its vanishing point. Target = (tx, ty, 0); the eye sits
// at distance d along (sin az cos el, −sin el, cos az cos el); roll turns the up vector.
const CAMERA = {
  fov: 0.66,
  near: 0.05,
  far: 600,
  side: { tx: 2.5, ty: 0.36, az: 0, el: 0, d: 11.47, roll: 0 },
  depth: { tx: 1.85, ty: 0.33, az: -1.5, el: 0.158, d: 7.88, roll: 0.173 },
  swayAz: 0.07,
  swayEl: 0.03,
};

// ================================================================
// GABRIEL'S HORN — the same formulas run here and in GLSL
// ================================================================

function hornPoint(u, theta) {
  return [u, Math.cos(theta) / u, Math.sin(theta) / u];
}

function hornNormal(u, theta) {
  const n = [1 / (u * u), Math.cos(theta), Math.sin(theta)];
  const length = Math.hypot(...n);
  return n.map((value) => value / length);
}

function volumeTo(L) {
  return Math.PI * (1 - 1 / L);
}

function areaTo(L) {
  const L2 = L * L;
  return Math.PI * (Math.asinh(L2) - Math.sqrt(L2 * L2 + 1) / L2 + Math.SQRT2 - Math.asinh(1));
}

// x such that A(x) = area (A is increasing, A(1) = 0).
function areaInverse(area) {
  if (area <= 0) return 1;
  let lo = 1, hi = 2;
  while (areaTo(hi) < area) hi *= 2;
  for (let i = 0; i < 64; i++) {
    const mid = 0.5 * (lo + hi);
    if (areaTo(mid) < area) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// The cut where the surface area equals π — the same number as the whole volume.
const AREA_PI_X = areaInverse(Math.PI);

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

// Horn → world: spin about the x-axis, then flip y so +y of the graph points up the screen
// (p5's world y points down). The vertex shader applies the identical matrix.
function toWorld(h, spin) {
  const c = Math.cos(spin), s = Math.sin(spin);
  return [h[0], -(h[1] * c - h[2] * s), h[1] * s + h[2] * c];
}

// ================================================================
// FRAME STATE — a pure function of loop progress, shared by draw and audit
// ================================================================

const frameState = {
  spin: 0,
  lead: 0,
  trail: 0,
  camK: 0,
  ext: 0,
  len: LIMITS.openingLength,
  pour: 0,
  pourMix: 0,
  fill: 1,
  paint: 1,
  surf: 0,
  wire: 1,
  cam: { ...CAMERA.side },
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
  hybrid: { surf: 0.5, wire: 1 },
  solid: { surf: 0.94, wire: 0.16 },
  wire: { surf: 0, wire: 1 },
};
const MODE_KEYS = ["auto", "hybrid", "solid", "wire"];

// Auto: wire while the curve sweeps → hybrid during the orbit → solid while L grows →
// hybrid for the pour (the fill must show through) → wire as the surface unsweeps.
function modeTarget(p) {
  if (PARAMS.mode !== "auto") return MODES[PARAMS.mode];
  const hybrid = smoothstep(0.16, 0.30, p) * (1 - smoothstep(0.84, 0.95, p));
  const solid = envelope(p, [0.38, 0.44, 0.51, 0.56]);
  return { surf: 0.5 * hybrid + 0.44 * solid, wire: 1 - 0.75 * solid };
}

// Timeline (p ∈ [0, 1)): curve → sweep → orbit → extend L → pour π → retract → unsweep.
// Every term is equal at p = 0 and p = 1, so frame 600 ≡ frame 0.
function computeFrameState(p) {
  const fs = frameState;
  // Integer turns with zero angular velocity at both ends: the opening curve holds still.
  fs.spin = PARAMS.spinTurns * TAU * (p - Math.sin(TAU * p) / TAU);
  fs.lead = smoothstep(0.03, 0.20, p);
  fs.trail = smoothstep(0.86, 0.985, p);
  fs.camK = smoothstep(0.16, 0.36, p) * (1 - smoothstep(0.82, 0.96, p));
  fs.ext = smoothstep(0.37, 0.55, p) * (1 - smoothstep(0.74, 0.83, p));
  fs.len = LIMITS.openingLength + (PARAMS.length - LIMITS.openingLength) * fs.ext;
  // Pour q·π of "paint": the volume front solves π(1 − 1/u) = qπ, the area front A(u) = qπ.
  fs.pour = smoothstep(0.57, 0.72, p);
  fs.pourMix = envelope(p, [0.55, 0.58, 0.75, 0.80]);
  const ghostEnd = fs.len * LIMITS.ghostFactor;
  fs.fill = fs.pour < 1 - 1 / ghostEnd ? 1 / (1 - fs.pour) : ghostEnd;
  fs.paint = areaInverse(Math.PI * fs.pour);
  const k = fs.camK;
  for (const key of Object.keys(CAMERA.side)) fs.cam[key] = lerp1(CAMERA.side[key], CAMERA.depth[key], k);
  fs.cam.az += CAMERA.swayAz * Math.sin(TAU * p) * k;
  fs.cam.el += CAMERA.swayEl * Math.sin(2 * TAU * p) * k;
  const mode = modeTarget(p);
  fs.surf = mode.surf;
  fs.wire = mode.wire;
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

function currentCamera() {
  const cam = { ...frameState.cam };
  if (freeCamera()) {
    cam.az += sim.dragYaw;
    cam.el = clamp(cam.el + sim.dragTilt, -1.3, 1.3);
  }
  return cam;
}

// ================================================================
// SURFACE MESH + SHADERS
// ================================================================

function colsForRows(rows) {
  return 4 * Math.round(rows * 0.15);
}

// (s, θ/2π) lattice; u = U0 (U1/U0)^s is applied in the shader, so L never rebuilds the mesh
// and rings are spaced geometrically (dense where the profile bends hardest, near the mouth).
// The θ seam column is duplicated. Faces are emitted in ascending or descending s so the
// translucent horn can be drawn far-to-near from either side.
function buildHornMesh(rows, cols, descending) {
  const geometry = new p5.Geometry();
  geometry.gid = `horn-${rows}x${cols}-${descending ? "desc" : "asc"}`;
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) geometry.vertices.push(new p5.Vector(j / rows, i / cols, 0));
  }
  const row = cols + 1;
  for (let k = 0; k < rows; k++) {
    const j = descending ? rows - 1 - k : k;
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
uniform float uU0;
uniform float uU1;
uniform float uSpin;
out vec3 vNormal;
out vec3 vEye;
out float vU;
out float vTheta;
out float vS;

const float TAU = 6.283185307179586;

void main() {
  float u = exp(mix(log(uU0), log(uU1), aPosition.x));
  float th = aPosition.y * TAU;
  float c = cos(th);
  float s = sin(th);
  // P(u, θ) and its outward normal; R = spin about x, then y flipped (toWorld()).
  vec3 h = vec3(u, c / u, s / u);
  vec3 n = vec3(1.0 / (u * u), c, s);
  float cs = cos(uSpin);
  float ss = sin(uSpin);
  mat3 R = mat3(1.0, 0.0, 0.0, 0.0, -cs, ss, 0.0, ss, cs);
  vec4 eye = uModelViewMatrix * vec4(R * h, 1.0);
  vNormal = mat3(uModelViewMatrix) * (R * n);
  vEye = eye.xyz;
  vU = u;
  vTheta = aPosition.y;
  vS = aPosition.x;
  gl_Position = uProjectionMatrix * eye;
}
`;

const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vEye;
in float vU;
in float vTheta;
in float vS;
uniform vec3 uBase;
uniform vec3 uPaintColor;
uniform vec3 uInk;
uniform float uLight;
uniform float uSurf;
uniform float uWire;
uniform float uMeridians;
uniform float uPass;
uniform float uGhost;
uniform float uFill;
uniform float uPaint;
uniform float uPour;
uniform float uFogNear;
uniform float uFogFar;
uniform vec2 uSweep;
out vec4 outColor;

// Antialiased iso-line of g; fades out where lines crowd closer than ~3 px.
float gridLine(float g) {
  float w = max(fwidth(g), 1e-5);
  float d = abs(fract(g + 0.5) - 0.5) / w;
  return (1.0 - smoothstep(0.45, 1.25, d)) * (1.0 - smoothstep(0.28, 0.55, w));
}

void main() {
  // Swept window θ/2π ∈ [trail, lead], unwrapped so a full sweep includes the seam column.
  if (uSweep.y - uSweep.x < 1e-4 || vTheta > uSweep.y || vTheta < uSweep.x) discard;
  vec3 n = normalize(vNormal);
  vec3 v = normalize(-vEye);
  bool front = dot(n, v) > 0.0;
  // Pass 0: interior (back-facing) fragments; pass 1: exterior.
  if ((uPass > 0.5) != front) discard;
  if (!front) n = -n;

  vec3 key = normalize(vec3(-0.55, -0.7, 0.75));
  vec3 fill = normalize(vec3(0.8, 0.35, 0.45));
  float diffuse = max(dot(n, key), 0.0);
  float soft = max(dot(n, fill), 0.0);
  float spec = pow(max(dot(reflect(-key, n), v), 0.0), 42.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  float shade = uLight * (0.08 + 0.62 * diffuse + 0.18 * soft);

  float side = front ? 1.0 : 0.0;
  float surfA = uSurf * mix(0.8, 1.0, side) * (1.0 - uGhost);
  vec3 surfC = uBase * shade * mix(0.62, 0.78, side);

  // Pour: the interior fills to x = uFill (volume); paint reaches only x = uPaint (area).
  float inside = 1.0 - smoothstep(uFill * 0.98, uFill, vU);
  float filled = uPour * (1.0 - side) * inside;
  surfC *= 1.0 - 0.5 * uPour * (1.0 - side) * (1.0 - inside);
  surfC = mix(surfC, uBase * (0.3 + 0.7 * shade), filled);
  surfA = max(surfA, 0.6 * filled);
  // Paint covers both walls (the inner wall is what the tunnel view shows).
  float painted = uPour * (1.0 - uGhost) * (1.0 - smoothstep(uPaint * 0.995, uPaint, vU));
  surfC = mix(surfC, uPaintColor * (0.3 + 0.8 * shade), painted);
  surfA = mix(surfA, 0.96, painted);
  surfC += uInk * (0.45 * spec + 0.1 * rim) * uLight * side;

  // Rings at integer x (unit slabs) with quarter subdivisions, plus uMeridians meridians.
  float rings = max(gridLine(vU), 0.45 * gridLine(vU * 4.0));
  float wire = max(rings, gridLine(vTheta * uMeridians)) * uWire;
  float ghostFade = mix(1.0, 0.5 * (1.0 - vS) * (1.0 - vS), uGhost);
  float wireA = wire * mix(0.65, 0.9, side) * ghostFade;
  vec3 wireC = uInk * (0.3 + 0.7 * shade) * mix(0.7, 1.0, side);

  // Premultiplied: wire layer over surface layer (p5 blends ONE, ONE_MINUS_SRC_ALPHA).
  float a = wireA + surfA * (1.0 - wireA);
  vec3 color = wireC * wireA + min(surfC, vec3(1.0)) * surfA * (1.0 - wireA);
  float fog = mix(0.3, 1.0, 1.0 - smoothstep(uFogNear, uFogFar, -vEye.z));
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
let hornMeshes = null;
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
  surf: 0,
  wire: 1,
  layers: { ghost: true, curve: true, math: true },
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
  bindUI();
  updateStaticUI();
  syncControls();
  if (auditParam !== null) window.hornAudit = runAudit();
  window.horn = { PARAMS, frameState, computeFrameState, cameraBasis, projectPoint, toWorld, hornPoint, volumeTo, areaTo, areaInverse, setLoop, runAudit };
}

function rebuildMesh() {
  const rows = clamp(Math.round(PARAMS.rows), LIMITS.minRows, LIMITS.maxRows);
  const cols = colsForRows(rows);
  const key = `${rows}x${cols}`;
  if (key === meshKey) return;
  if (hornMeshes) {
    freeGeometry(hornMeshes.asc);
    freeGeometry(hornMeshes.desc);
  }
  hornMeshes = { asc: buildHornMesh(rows, cols, false), desc: buildHornMesh(rows, cols, true) };
  meshKey = key;
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
    return;
  }
  const k = 1 - Math.exp(-Math.min(deltaTime, 100) / 1000 / 0.3);
  sim.surf += (frameState.surf - sim.surf) * k;
  sim.wire += (frameState.wire - sim.wire) * k;
}

function renderFrame() {
  background(BG.r, BG.g, BG.b);
  computeFrameState(loopProgress);
  updateModeMix();
  const fs = frameState;
  const basis = cameraBasis(currentCamera());
  perspective(CAMERA.fov, W / H, CAMERA.near, CAMERA.far);
  // Stroke widths in screen pixels: perspective() would scale them by the tiny horn units.
  linePerspective(false);
  camera(...basis.eye, ...basis.target, ...basis.up);

  const ghostEnd = fs.len * LIMITS.ghostFactor;
  const segments = [{ u0: 1, u1: fs.len, ghost: 0 }];
  if (sim.layers.ghost) segments.push({ u0: fs.len, u1: ghostEnd, ghost: 1 });
  // Far-to-near: looking toward +x the tail (high s) is farther away.
  const towardTail = basis.fwd[0] > 0;
  if (towardTail) segments.reverse();
  const mesh = towardTail ? hornMeshes.desc : hornMeshes.asc;
  const eyeDistance = Math.hypot(...basis.eye.map((value, i) => value - basis.target[i]));

  noStroke();
  fill(255);
  shader(surfaceShader);
  surfaceShader.setUniform("uSpin", fs.spin);
  surfaceShader.setUniform("uSweep", [fs.trail, fs.lead]);
  surfaceShader.setUniform("uBase", colorVector(CYAN));
  surfaceShader.setUniform("uPaintColor", colorVector(MAGENTA));
  surfaceShader.setUniform("uInk", colorVector(INK));
  surfaceShader.setUniform("uLight", PARAMS.light);
  surfaceShader.setUniform("uSurf", sim.surf);
  surfaceShader.setUniform("uWire", sim.wire);
  surfaceShader.setUniform("uMeridians", PARAMS.wire);
  surfaceShader.setUniform("uFill", fs.fill);
  surfaceShader.setUniform("uPaint", fs.paint);
  surfaceShader.setUniform("uPour", fs.pourMix);
  surfaceShader.setUniform("uFogNear", eyeDistance * 0.9);
  surfaceShader.setUniform("uFogFar", eyeDistance * 4);
  for (const segment of segments) {
    surfaceShader.setUniform("uU0", segment.u0);
    surfaceShader.setUniform("uU1", segment.u1);
    surfaceShader.setUniform("uGhost", segment.ghost);
    for (const pass of [0, 1]) {
      surfaceShader.setUniform("uPass", pass);
      model(mesh);
    }
  }
  resetShader();
  if (sim.layers.curve) {
    // push/pop: noFill() inside would otherwise switch off next frame's surface fill.
    push();
    drawGuides();
    pop();
  }
}

// Generatrix y = 1/x at the sweep edges, the x-axis (solid to L, dashed toward ∞),
// and the mouth / cutoff rings over the swept angle — drawn as strokes so the curve
// stays crisp even where it is the silhouette.
function drawGuides() {
  const fs = frameState;
  const lift = 1.004;
  const strokeCurve = (theta, alpha) => {
    stroke(ACID.r, ACID.g, ACID.b, alpha);
    strokeWeight(3);
    beginShape();
    for (let i = 0; i <= 96; i++) {
      const u = Math.pow(fs.len, i / 96);
      vertex(...toWorld(hornPoint(u, theta).map((value, k) => (k === 0 ? value : value * lift)), fs.spin));
    }
    endShape();
  };
  const strokeRing = (u, colorValue, alpha, weight) => {
    const a0 = fs.trail * TAU, a1 = fs.lead * TAU;
    if (a1 - a0 < 1e-3) return;
    stroke(colorValue.r, colorValue.g, colorValue.b, alpha);
    strokeWeight(weight);
    beginShape();
    const steps = Math.max(2, Math.ceil(96 * (a1 - a0) / TAU));
    for (let i = 0; i <= steps; i++) {
      const theta = lerp1(a0, a1, i / steps);
      vertex(...toWorld(hornPoint(u, theta).map((value, k) => (k === 0 ? value : value * lift)), fs.spin));
    }
    endShape();
  };

  noFill();
  // Axis: solid on [0, L], then geometric dashes on [L, 3L] fading out.
  stroke(INK.r, INK.g, INK.b, 120);
  strokeWeight(1.5);
  line(0, 0, 0, fs.len, 0, 0);
  const ghostEnd = fs.len * LIMITS.ghostFactor;
  for (let i = 0; i < 18; i++) {
    const x0 = fs.len * Math.pow(LIMITS.ghostFactor, i / 18);
    const x1 = fs.len * Math.pow(LIMITS.ghostFactor, (i + 0.5) / 18);
    stroke(INK.r, INK.g, INK.b, 120 * (1 - i / 18));
    line(x0, 0, 0, Math.min(x1, ghostEnd), 0, 0);
  }
  strokeRing(1, INK, 150, 1.5);
  strokeRing(fs.len, ACID, 220, 2.5);
  const curveAlpha = 255 * (1 - 0.45 * fs.camK);
  strokeCurve(fs.lead * TAU, curveAlpha);
  if (fs.trail > 0 && fs.trail < 1) strokeCurve(fs.trail * TAU, curveAlpha);
}

// ================================================================
// HUD
// ================================================================

// Hook captions; the null window shows at the opening frame on both ends of the loop.
const OVERLAY = {
  hook: true,
  captions: [
    { window: null, first: "ROTATE y = 1/x ABOUT THE x-AXIS", second: "FINITE VOLUME · INFINITE SURFACE AREA" },
    { window: [0.08, 0.11, 0.24, 0.27], first: "THE SWEEP: θ FROM 0 TO 2π", second: "RADIUS 1/x SHRINKS BUT NEVER REACHES 0" },
    { window: [0.36, 0.39, 0.53, 0.56], first: "V(L) = π(1 − 1/L) → π", second: "A(L) > 2π ln L → ∞" },
    { window: [0.56, 0.59, 0.75, 0.78], first: "POUR π: THE VOLUME FILLS THE WHOLE HORN", second: () => `THE SAME π OF AREA COATS ONLY x ≤ ${AREA_PI_X.toFixed(2)}` },
    { window: [0.79, 0.82, 0.90, 0.93], first: "THE RENDER STOPS AT x = L", second: "THE HORN DOES NOT — IT RUNS TO ∞" },
  ],
};

function captionText(value) {
  return typeof value === "function" ? value() : value;
}

const HUD_TEXT = {
  title: "GABRIEL'S HORN",
  subtitle: "TORRICELLI'S TRUMPET",
  formula: "P(u, θ) = (u, cos θ / u, sin θ / u) · u ∈ [1, L]",
  condition: "y = 1/x  ·  V = π  ·  A → ∞",
  limits: "V → π · A → ∞",
  citation: "V(L) = π(1 − 1/L) · A(L) = π[asinh L² − √(L⁴+1)/L² + √2 − asinh 1]",
};

function readoutText(len) {
  return `L ${len.toFixed(1)} · V ${volumeTo(len).toFixed(4)} · A ${areaTo(len).toFixed(2)}`;
}

// Labels pinned to the geometry: the cutoff ring (finite render) and the dashed axis end (∞).
function drawGeometryLabels(graphics) {
  const fs = frameState;
  const reveal = fs.lead * (1 - fs.trail) * (sim.layers.curve ? 1 : 0);
  if (reveal <= 0.01) return;
  const basis = cameraBasis(currentCamera());
  const inStage = (p) => p[2] > 0 && p[0] > HUD.safeX + 40 && p[0] < W - HUD.safeX - 40 && p[1] > HUD.trackY + 40 && p[1] < HUD.bottomTextY - 50;
  graphics.textSize(22);
  graphics.textAlign(CENTER, CENTER);
  const ring = projectPoint(basis, toWorld([fs.len, 0, 0], fs.spin));
  const next = projectPoint(basis, toWorld([fs.len * 1.05, 0, 0], fs.spin));
  const dx = next[0] - ring[0], dy = next[1] - ring[1];
  const dl = Math.hypot(dx, dy) || 1;
  const offset = 30 + (H / 2) * basis.f / ring[2] / fs.len;
  const label = [ring[0] - dy / dl * offset, ring[1] + dx / dl * offset, ring[2]];
  if (label[1] > ring[1] - 1) { label[0] = ring[0] + dy / dl * offset; label[1] = ring[1] - dx / dl * offset; }
  if (inStage(label)) {
    graphics.fill(ACID.r, ACID.g, ACID.b, 235 * reveal);
    graphics.text(`x = L = ${fs.len.toFixed(fs.len < 9.95 ? 1 : 0)}`, label[0], label[1]);
  }
  if (!sim.layers.ghost) return;
  const end = projectPoint(basis, toWorld([fs.len * LIMITS.ghostFactor, 0, 0], fs.spin));
  if (inStage(end)) {
    graphics.fill(INK.r, INK.g, INK.b, 200 * reveal);
    graphics.text("→ ∞", end[0] + dx / dl * 26, Math.max(end[1] + dy / dl * 26, HUD.trackY + 44));
  }
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
  graphics.text(readoutText(frameState.len), HUD.stageTextX, HUD.stageY);
  graphics.fill(ACID.r, ACID.g, ACID.b, 240);
  graphics.textAlign(RIGHT, TOP);
  graphics.textSize(22);
  graphics.text(HUD_TEXT.limits, W - HUD.rightTextX, HUD.stageY + 3);
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

  drawGeometryLabels(graphics);

  graphics.textAlign(CENTER, CENTER);
  graphics.textSize(28);
  if (OVERLAY.hook) {
    const p = loopProgress;
    for (const caption of OVERLAY.captions) {
      const weight = caption.window
        ? envelope(p, caption.window)
        : 1 - smoothstep(0.05, 0.09, p) + smoothstep(0.93, 0.985, p);
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
// AUDIT — ?audit=1 checks the closed forms against quadrature, the parameterisation and
// normals, mesh finiteness, framing at the current and maximum L, typography fit and the
// loop seam (report stored on window.hornAudit).
// ================================================================

// Composite Simpson in t = ln x (dx = x dt), smooth on [0, ln L].
function simpsonLog(f, L, n = 4000) {
  const T = Math.log(L), h = T / n;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const x = Math.exp(i * h);
    const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    sum += w * f(x) * x;
  }
  return sum * h / 3;
}

function auditMath() {
  const report = { volumeMaxError: 0, areaMaxError: 0, derivativeMaxError: 0, logBoundHolds: true, areaPiResidual: 0, fillResidual: 0 };
  for (const L of [1.5, 2, 4, 10, 30, 60, 1000]) {
    const V = simpsonLog((x) => Math.PI / (x * x), L);
    const A = simpsonLog((x) => TAU * Math.sqrt(1 + x ** -4) / x, L);
    report.volumeMaxError = Math.max(report.volumeMaxError, Math.abs(V - volumeTo(L)));
    report.areaMaxError = Math.max(report.areaMaxError, Math.abs(A - areaTo(L)));
    const h = 1e-5 * L;
    const dA = (areaTo(L + h) - areaTo(L - h)) / (2 * h);
    report.derivativeMaxError = Math.max(report.derivativeMaxError, Math.abs(dA - TAU * Math.sqrt(1 + L ** -4) / L));
    if (!(areaTo(L) > TAU * Math.log(L))) report.logBoundHolds = false;
  }
  report.areaAtOne = areaTo(1);
  report.areaPiX = AREA_PI_X;
  report.areaPiResidual = Math.abs(areaTo(AREA_PI_X) - Math.PI);
  for (const q of [0.1, 0.5, 0.9, 0.99]) report.fillResidual = Math.max(report.fillResidual, Math.abs(volumeTo(1 / (1 - q)) - Math.PI * q));
  return report;
}

function auditGeometry() {
  const report = { radiusMaxError: 0, normalMaxError: 0, outwardFailures: 0 };
  const h = 1e-5;
  for (let i = 0; i < 40; i++) {
    const u = Math.pow(LIMITS.maxLength, i / 39);
    for (let j = 0; j < 24; j++) {
      const theta = TAU * (j + 0.3) / 24;
      const p = hornPoint(u, theta);
      report.radiusMaxError = Math.max(report.radiusMaxError, Math.abs(Math.hypot(p[1], p[2]) - 1 / p[0]));
      const pu = hornPoint(u + h, theta).map((value, k) => (value - hornPoint(u - h, theta)[k]) / (2 * h));
      const pt = hornPoint(u, theta + h).map((value, k) => (value - hornPoint(u, theta - h)[k]) / (2 * h));
      const fd = normalize3(cross(pu, pt)).map((value) => -value);
      const n = hornNormal(u, theta);
      report.normalMaxError = Math.max(report.normalMaxError, Math.hypot(...n.map((value, k) => value - fd[k])));
      // Outward: the normal points away from the axis.
      if (n[1] * p[1] + n[2] * p[2] <= 0) report.outwardFailures++;
    }
  }
  let nonFinite = 0;
  for (const vertex of hornMeshes.asc.vertices) {
    for (const [u0, u1] of [[1, LIMITS.maxLength], [LIMITS.maxLength, LIMITS.maxLength * LIMITS.ghostFactor]]) {
      const u = Math.exp(lerp1(Math.log(u0), Math.log(u1), vertex.x));
      const p = toWorld(hornPoint(u, TAU * vertex.y), 0.7);
      if (!p.every(Number.isFinite) || !hornNormal(u, TAU * vertex.y).every(Number.isFinite)) nonFinite++;
    }
  }
  report.mesh = { vertices: hornMeshes.asc.vertices.length, faces: hornMeshes.asc.faces.length, nonFinite };
  return report;
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
  for (const caption of OVERLAY.captions) rows.push(["monospace", NORMAL, 28, captionText(caption.first)], ["monospace", NORMAL, 28, captionText(caption.second)]);
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
  const left = HUD.stageTextX + graphics.textWidth(readoutText(LIMITS.maxLength));
  graphics.textSize(22);
  const right = W - HUD.rightTextX - graphics.textWidth(HUD_TEXT.limits);
  return { widestLine: Math.round(widest), available: W - 2 * HUD.safeX, stageGap: Math.round(right - left) };
}

// Projected bbox of the horn (u ≤ L, swept part only) over the loop.
function auditFraming(length) {
  const saved = PARAMS.length;
  PARAMS.length = length;
  const framing = { length, top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity };
  for (let frame = 0; frame < LOOP_FRAMES; frame += 6) {
    computeFrameState(frame / LOOP_FRAMES);
    const fs = frameState;
    if (fs.lead - fs.trail < 1e-4) continue;
    const basis = cameraBasis(fs.cam);
    for (let i = 0; i <= 80; i++) {
      const u = Math.pow(fs.len, i / 80);
      for (let j = 0; j <= 32; j++) {
        const theta = TAU * lerp1(fs.trail, fs.lead, j / 32);
        const p = projectPoint(basis, toWorld(hornPoint(u, theta), fs.spin));
        framing.top = Math.min(framing.top, Math.round(p[1]));
        framing.bottom = Math.max(framing.bottom, Math.round(p[1]));
        framing.left = Math.min(framing.left, Math.round(p[0]));
        framing.right = Math.max(framing.right, Math.round(p[0]));
      }
    }
  }
  PARAMS.length = saved;
  framing.clearsTrack = framing.top > HUD.trackY + 12;
  framing.clearsCaptions = framing.bottom < HUD.bottomTextY - 24;
  framing.clearsSides = framing.left > HUD.safeX && framing.right < W - HUD.safeX;
  return framing;
}

function runAudit() {
  const t0 = performance.now();
  const report = {
    math: auditMath(),
    geometry: auditGeometry(),
    typography: auditTypography(),
    framing: [auditFraming(PARAMS.length), auditFraming(LIMITS.maxLength), auditFraming(LIMITS.minLength)],
    loop: null,
  };
  let previous = null, first = null, maxInteriorStep = 0;
  const snapshot = () => {
    const fs = frameState;
    return [
      // The swept window as width + edge angles: [1, 1] and [0, 0] are the same empty sweep at θ = 0.
      Math.cos(fs.spin), Math.sin(fs.spin), fs.lead - fs.trail, Math.cos(TAU * fs.lead), Math.sin(TAU * fs.lead),
      Math.cos(TAU * fs.trail), Math.sin(TAU * fs.trail), fs.camK, fs.len / PARAMS.length,
      fs.pourMix, fs.pour * fs.pourMix, fs.surf, fs.wire, ...Object.values(fs.cam),
    ];
  };
  const step = (p, q) => Math.max(...p.map((value, i) => Math.abs(value - q[i])));
  for (let frame = 0; frame < LOOP_FRAMES; frame++) {
    computeFrameState(frame / LOOP_FRAMES);
    const current = snapshot();
    if (previous) maxInteriorStep = Math.max(maxInteriorStep, step(current, previous));
    else first = current;
    previous = current;
  }
  // Wrap step 599 → 0 must look like any other consecutive step.
  report.loop = {
    frames: LOOP_FRAMES,
    seconds: LOOP_FRAMES / FPS,
    seamStep: step(first, previous),
    maxInteriorStep,
    auditMs: performance.now() - t0,
  };
  const m = report.math, g = report.geometry;
  report.ok = m.volumeMaxError < 1e-9 && m.areaMaxError < 1e-8 && m.derivativeMaxError < 1e-6 && m.logBoundHolds &&
    Math.abs(m.areaAtOne) < 1e-12 && m.areaPiResidual < 1e-9 && m.fillResidual < 1e-12 &&
    g.radiusMaxError < 1e-12 && g.normalMaxError < 1e-6 && g.outwardFailures === 0 && g.mesh.nonFinite === 0 &&
    report.framing.every((f) => f.clearsTrack && f.clearsCaptions && f.clearsSides) &&
    report.typography.widestLine <= report.typography.available && report.typography.stageGap > 20 &&
    report.loop.seamStep <= report.loop.maxInteriorStep * 1.01;
  computeFrameState(loopProgress);
  console.log("[horn audit]", JSON.stringify(report, null, 2));
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

// ?mode=wire&length=60&spin=0&rows=200 — handy for stills and shader checks.
function applyUrlParams() {
  const mode = MODE_KEYS.indexOf(urlParam("mode"));
  if (mode >= 0) {
    modeIndex = mode;
    PARAMS.mode = MODE_KEYS[mode];
  }
  const numeric = (name, key) => {
    const value = Number(urlParam(name));
    if (urlParam(name) !== null && Number.isFinite(value)) PARAMS[key] = value;
  };
  numeric("length", "length");
  numeric("spin", "spinTurns");
  numeric("rows", "rows");
  numeric("wire", "wire");
  numeric("light", "light");
  if (urlParam("hook") === "0") OVERLAY.hook = false;
  sanitizeParams();
  computeFrameState(0);
  sim.surf = frameState.surf;
  sim.wire = frameState.wire;
}

function sanitizeParams() {
  PARAMS.length = clamp(Math.round(PARAMS.length), LIMITS.minLength, LIMITS.maxLength);
  PARAMS.rows = clamp(4 * Math.round(PARAMS.rows / 4), LIMITS.minRows, LIMITS.maxRows);
  PARAMS.wire = clamp(2 * Math.round(PARAMS.wire / 2), 8, 48);
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
  lengthSlider: ["length", (v) => `${LIMITS.openingLength} → ${v.toFixed(0)}`],
  spinSlider: ["spinTurns", (v) => `${v.toFixed(0)} turn / loop`],
  rowsSlider: ["rows", (v) => `${v.toFixed(0)} × ${colsForRows(v)}`],
  wireSlider: ["wire", (v) => v.toFixed(0)],
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
      syncControls();
    };
  }
  const onClick = (id, handler) => {
    const element = getElement(id);
    if (element) element.onclick = handler;
  };
  MODE_KEYS.forEach((mode, index) => onClick(`mode-${mode}`, () => selectMode(index)));
  onClick("pauseBtn", togglePause);
  onClick("cameraBtn", resetCamera);
  onClick("resetBtn", resetSimulator);
  const toggles = { showGhost: "ghost", showCurve: "curve", showMath: "math" };
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

function selectMode(index) {
  if (isRecording) return;
  modeIndex = index;
  PARAMS.mode = MODE_KEYS[index];
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
  rebuildMesh();
  modeIndex = 0;
  Object.assign(sim, { paused: false, playhead: 0, dragYaw: 0, dragTilt: 0 });
  for (const layer of Object.keys(sim.layers)) sim.layers[layer] = true;
  OVERLAY.hook = true;
  for (const id of ["showGhost", "showCurve", "showHook", "showMath"]) {
    const element = getElement(id);
    if (element) element.checked = true;
  }
  syncControls();
}

const CONTROL_IDS = [
  ...Object.keys(SLIDERS),
  ...MODE_KEYS.map((mode) => `mode-${mode}`),
  "pauseBtn", "cameraBtn", "resetBtn", "showGhost", "showCurve", "showHook", "showMath",
];

function syncControls() {
  for (const [id, [key, format]] of Object.entries(SLIDERS)) {
    const element = getElement(id);
    if (element) element.value = PARAMS[key];
    setText(id.replace("Slider", "Value"), format(PARAMS[key]));
  }
  MODE_KEYS.forEach((mode, index) => {
    const element = getElement(`mode-${mode}`);
    if (element) element.style.borderColor = index === modeIndex ? "rgba(255,255,255,0.6)" : "";
  });
  setText("pauseBtn", sim.paused ? "Play" : "Pause");
  const math = getElement("math");
  if (math) math.hidden = !sim.layers.math;
  for (const id of CONTROL_IDS) setDisabled(id, isRecording);
}

function updateLiveUI() {
  if (frameCount % 6 !== 0 || !sim.layers.math) return;
  const len = frameState.len;
  setText("volumeValue", `V(${len.toFixed(2)}) = ${volumeTo(len).toFixed(5)}  (π = ${Math.PI.toFixed(5)})`);
  setText("areaValue", `A(${len.toFixed(2)}) = ${areaTo(len).toFixed(4)}  (> 2π ln L = ${(TAU * Math.log(len)).toFixed(4)})`);
  setText("paintValue", AREA_PI_X.toFixed(4));
  setText("meshValue", `${hornMeshes.asc.vertices.length} verts · ${2 * (sim.layers.ghost ? 2 : 1)} draw calls`);
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
    saveCanvas(`gabriels_horn_${getTimestamp()}`, "png");
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
    anchor.download = `gabriels_horn_${getTimestamp()}.mp4`;
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
