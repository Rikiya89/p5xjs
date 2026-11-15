"use strict";

// HELICOID — INFINITE SPIRAL GEOMETRY
// X(u, v) = (u cos v, u sin v, c v),  |u| ≤ U,  |v| ≤ πT  (T turns, pitch c, rise 2πc per turn).
// X_u = (cos v, sin v, 0), X_v = (−u sin v, u cos v, c): E = 1, F = 0, G = u² + c².
// N = X_u × X_v / |…| = (c sin v, −c cos v, u) / √(c² + u²); e = g = 0, f = c / √(c² + u²),
// so H = (eG − 2fF + gE) / 2(EG − F²) = 0 and K = −c² / (c² + u²)² < 0.
// Every level set z = const is a straight line through the axis (a ruling), and every u = const
// curve is a helix of radius |u| — its shadow on the base plate is a concentric circle.
// Screw symmetry: X(u, v + φ) = R_φ X(u, v) + (0, 0, cφ). Half-turn: R_π X(u, v) = X(−u, v), so a
// spin of π per loop returns the image onto itself.

const W = 1080;
const H = 1920;
const FPS = 60;

const MAX_DURATION = 10;
const MAX_FRAMES = FPS * MAX_DURATION;
const LOOP_FRAMES = MAX_FRAMES;
const TAU = Math.PI * 2;

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

// Vertical height ruler in the left column: Z ∈ [−πcT, πcT] mapped to [rulerBottom, rulerTop].
const RULER = {
  x: 112,
  top: 640,
  bottom: 1120,
  tick: 8,
};

// Adjustable parameters.
//   pitch c       — z = c v, rise per turn 2πc (relative to the radial extent U)
//   turns T       — v ∈ [−πT, πT]; multiples of 0.5 so the ruler ticks land on half-turns
//   extent U      — radial half-width |u| ≤ U
//   rows          — mesh resolution across u; v gets 6 × rows segments
//   helices       — u = const curves per side (= concentric circles on the plate)
//   rulings       — z = const lines per turn
//   divisions     — angular divisions of the sacred-geometry plate
const PARAMS = {
  pitch: 0.12,
  turns: 1.5,
  extent: 1,
  rows: 96,
  helices: 6,
  rulings: 24,
  divisions: 12,
  tilt: 0.22,
  spinTurns: 1,
  light: 1,
};

const LIMITS = {
  minRows: 48,
  maxRows: 160,
  colsPerRow: 6,
};

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
  levelOvershoot: 1.2,
  // Spin at t = 0 as a fraction of π (the half-turn symmetry period).
  spinPhase: 0.15,
};

// Sacred-geometry base plate, in units of U, sitting below the lowest ruling.
const PLATE = {
  gap: 0.16,
  radius: 1.16,
  tick: 0.05,
  segments: 128,
  axisAbove: 0.24,
  axisBelow: 0.1,
};

const HALF_PI = Math.PI / 2;

// ================================================================
// HELICOID — the same formulas run here and in GLSL
// ================================================================

function halfHeight() {
  return Math.PI * PARAMS.pitch * PARAMS.turns;
}

function plateZ() {
  return -halfHeight() - PLATE.gap * PARAMS.extent;
}

function axisTopZ() {
  return halfHeight() + PLATE.axisAbove * PARAMS.extent;
}

function axisBottomZ() {
  return plateZ() - PLATE.axisBelow * PARAMS.extent;
}

function helicoidPoint(u, v, c, out = [0, 0, 0]) {
  out[0] = u * Math.cos(v);
  out[1] = u * Math.sin(v);
  out[2] = c * v;
  return out;
}

function helicoidNormal(u, v, c) {
  const length = Math.sqrt(c * c + u * u);
  return [c * Math.sin(v) / length, -c * Math.cos(v) / length, u / length];
}

function gaussianCurvature(u, c) {
  const q = c * c + u * u;
  return -c * c / (q * q);
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
  spin: 0,
  tilt: 0,
  yaw: 0,
  level: 0,
  levelVisible: 1,
  rulingAngle: 0,
};

// Framing: fixed for a parameter set, solved over the whole loop by fitStage().
const fit = { scale: 200, tx: 0, ty: 0, depthSpan: 1, key: "" };

let presetIndex = 1;

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function fract(x) {
  return x - Math.floor(x);
}

function computeFrameState(p) {
  const phase = p * TAU;
  // π per loop: frame 600 is frame 0 carried onto itself by the half-turn symmetry.
  frameState.spin = Math.PI * (STAGE.spinPhase + PARAMS.spinTurns * p);
  frameState.tilt = PARAMS.tilt + STAGE.tiltSwing * Math.sin(phase);
  frameState.yaw = STAGE.yawSwing * Math.sin(phase + 0.7);
  // Screw phase: the cobalt ruling climbs −1.2 zₕ → 1.2 zₕ; it sits on z = 0 at frame 0 and wraps at
  // p = 0.5 while it is off the surface on both ends.
  const zh = halfHeight();
  frameState.level = 2 * STAGE.levelOvershoot * zh * (fract(p + 0.5) - 0.5);
  frameState.levelVisible = 1 - smoothstep(0.97 * zh, 1.03 * zh, Math.abs(frameState.level));
  // World direction of that ruling: v = z / c, carried by the spin.
  frameState.rulingAngle = frameState.level / PARAMS.pitch + frameState.spin;
}

// Same pose renderFrame applies: spin about Z (sculpture only), tilt (elevation), yaw.
function posePoint(point, out, spun = true) {
  const spin = spun ? frameState.spin : 0, tilt = HALF_PI - frameState.tilt, yaw = frameState.yaw;
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

function cameraDistance() {
  return (H / 2) / Math.tan(STAGE.fov / 2);
}

// Exact perspective projection of a posed model point (matches renderFrame).
function projectToScreen(posed, out) {
  const distance = cameraDistance();
  const x = fit.tx + posed[0] * fit.scale, y = fit.ty + posed[1] * fit.scale, z = posed[2] * fit.scale;
  const k = distance / (distance - z);
  out[0] = W / 2 + x * k;
  out[1] = H / 2 + y * k;
  return out;
}

// Calls visit(point, spun) for every drawn feature that can reach the silhouette:
// surface lattice, plate rim (with ticks) and the two axis extensions.
function forEachExtremePoint(nu, nvPerTurn, visit) {
  const U = PARAMS.extent, c = PARAMS.pitch, T = PARAMS.turns;
  const point = [0, 0, 0];
  const nv = Math.ceil(nvPerTurn * T);
  for (let i = -nu; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) visit(helicoidPoint(U * i / nu, Math.PI * T * (2 * j / nv - 1), c, point), true);
  }
  const rim = (PLATE.radius + PLATE.tick) * U, z = plateZ();
  for (let j = 0; j < PLATE.segments; j++) {
    const a = TAU * j / PLATE.segments;
    point[0] = rim * Math.cos(a); point[1] = rim * Math.sin(a); point[2] = z;
    visit(point, false);
  }
  for (const zAxis of [axisTopZ(), axisBottomZ()]) {
    point[0] = 0; point[1] = 0; point[2] = zAxis;
    visit(point, false);
  }
}

function fitStage() {
  const key = [PARAMS.pitch, PARAMS.turns, PARAMS.extent, PARAMS.tilt, PARAMS.spinTurns].join();
  if (key === fit.key) return;
  const posed = [0, 0, 0];
  let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity, extent = 0;
  for (let k = 0; k < STAGE.fitSamples; k++) {
    computeFrameState(k / STAGE.fitSamples);
    forEachExtremePoint(12, 72, (point, spun) => {
      posePoint(point, posed, spun);
      xLo = Math.min(xLo, posed[0]); xHi = Math.max(xHi, posed[0]);
      yLo = Math.min(yLo, posed[1]); yHi = Math.max(yHi, posed[1]);
      extent = Math.max(extent, Math.abs(posed[2]));
    });
  }
  // 0.94 leaves room for perspective growth of the near side (the audit measures the true bbox).
  const boxW = STAGE.right - STAGE.left, boxH = STAGE.bottom - STAGE.top;
  fit.scale = 0.94 * Math.min(boxW / (xHi - xLo), boxH / (yHi - yLo));
  fit.tx = (STAGE.left + STAGE.right) / 2 - W / 2 - fit.scale * (xLo + xHi) / 2;
  fit.ty = (STAGE.top + STAGE.bottom) / 2 - H / 2 - fit.scale * (yLo + yHi) / 2;
  fit.depthSpan = 2.2 * fit.scale * extent;
  fit.key = key;
}

// ================================================================
// SURFACE MESH + SHADERS
// ================================================================

// (s, t) lattice on [0, 1]²: u = U(2s − 1), v = πT(2t − 1). Pitch, turns and extent are uniforms,
// so the mesh is built once per resolution. The u lattice is symmetric, so the half-turn maps
// vertices onto vertices.
function buildHelicoidMesh(rows) {
  const cols = LIMITS.colsPerRow * rows;
  const geometry = new p5.Geometry();
  geometry.gid = `helicoid-${rows}`;
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) geometry.vertices.push(new p5.Vector(j / rows, i / cols, 0));
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
uniform float uPitch;
uniform float uTurns;
uniform float uExtent;
uniform float uScale;
uniform float uDistance;
uniform float uDepthSpan;
out vec3 vNormal;
out vec3 vEye;
out vec3 vUp;
out vec2 vParam;
out float vDepth;

const float PI = 3.141592653589793;

// Line-by-line port of helicoidPoint() / helicoidNormal().
void main() {
  float u = uExtent * (2.0 * aPosition.x - 1.0);
  float v = PI * uTurns * (2.0 * aPosition.y - 1.0);
  float c = uPitch;
  vec3 p = vec3(u * cos(v), u * sin(v), c * v);
  vec3 n = vec3(c * sin(v), -c * cos(v), u) / sqrt(c * c + u * u);
  vec4 eye = uModelViewMatrix * vec4(p * uScale, 1.0);
  vNormal = mat3(uModelViewMatrix) * n;
  vUp = mat3(uModelViewMatrix) * vec3(0.0, 0.0, 1.0);
  vEye = eye.xyz;
  vParam = vec2(u, v);
  vDepth = clamp(0.5 + (eye.z + uDistance) / uDepthSpan, 0.0, 1.0);
  gl_Position = uProjectionMatrix * eye;
}
`;

const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vEye;
in vec3 vUp;
in vec2 vParam;
in float vDepth;
uniform float uPitch;
uniform float uTurns;
uniform float uExtent;
uniform vec3 uBg;
uniform vec3 uInk;
uniform vec3 uCharcoal;
uniform vec3 uMuted;
uniform vec3 uCobalt;
uniform float uLight;
uniform float uHelixStep;
uniform float uRulingStep;
uniform float uLevel;
uniform float uLevelVisible;
uniform float uNetOn;
uniform float uContourOn;
out vec4 outColor;

const float PI = 3.141592653589793;

// Antialiased iso-line of g, about 1 px wide; fades where lines crowd closer than ~3 px.
float gridLine(float g, float width) {
  float w = max(fwidth(g), 1e-6);
  float d = abs(fract(g + 0.5) - 0.5) / w;
  return (1.0 - smoothstep(0.5 * width, 0.5 * width + 0.8, d)) * (1.0 - smoothstep(0.25, 0.5, w));
}

// A single line where g = target.
float levelLine(float g, float target, float width) {
  float d = abs(g - target) / max(fwidth(g), 1e-6);
  return 1.0 - smoothstep(0.5 * width, 0.5 * width + 0.9, d);
}

void main() {
  // Orientation-free shading: the half-turn symmetry flips N, so only the viewer-facing normal
  // and the world axis may decide the colour (otherwise the loop seam would swap the sides).
  vec3 n = normalize(vNormal);
  vec3 v = normalize(-vEye);
  if (dot(n, v) < 0.0) n = -n;
  float upward = smoothstep(-0.35, 0.35, dot(n, normalize(vUp)));
  vec3 key = normalize(vec3(-0.5, -0.75, 0.62));
  vec3 fill = normalize(vec3(0.75, 0.2, 0.6));
  float diffuse = max(dot(n, key), 0.0);
  float soft = max(dot(n, fill), 0.0);
  float spec = pow(max(dot(reflect(-key, n), v), 0.0), 36.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.5);

  // Charcoal where the sheet faces up the axis, near-black where it faces down; restrained light.
  vec3 base = mix(uInk, uCharcoal, upward);
  vec3 color = mix(base, uMuted, uLight * (0.34 * diffuse + 0.1 * soft) * (0.6 + 0.4 * upward));

  float u = vParam.x;
  float z = uPitch * vParam.y;

  // Helices u = const (concentric with the plate circles); u = 0 is the axis itself.
  float helix = gridLine(u / uHelixStep, 1.0) * uNetOn;
  color = mix(color, uMuted, 0.72 * helix);

  // Rulings z = const — the straight lines of the ruled surface — with the screw-phase emphasis.
  float near = uLevelVisible * exp(-pow((z - uLevel) / (1.1 * uRulingStep), 2.0));
  float ruling = gridLine(z / uRulingStep, 1.0 + 0.9 * near) * (0.38 + 0.62 * near);
  float sweep = uLevelVisible * levelLine(z, uLevel, 2.4);
  color = mix(color, uCobalt, uContourOn * max(0.9 * ruling, sweep));

  // Open boundary: the two outer helices |u| = U and the two end rulings |v| = πT.
  float edge = max(levelLine(abs(u), uExtent, 1.3), levelLine(abs(vParam.y), PI * uTurns, 1.3));
  color = mix(color, uBg, 0.85 * edge);

  color += vec3(0.16 * spec * uLight + 0.05 * rim);
  // Faint aerial perspective toward the paper.
  color = mix(color, uBg, 0.14 * (1.0 - vDepth));
  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

let canvasEl;
let grainPg;
let hudPg;
let surfaceShader;
let helicoidMesh;
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
  layers: { net: true, contours: true, plate: true, notes: true, math: true },
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
  rebuildPlate();
  bindUI();
  updateStaticUI();
  syncControls();
  if (auditParam !== null) window.helicoidAudit = runAudit();
  window.helicoid = { PARAMS, frameState, fit, computeFrameState, helicoidPoint, setLoop, runAudit };
}

function rebuildMesh() {
  const rows = clamp(Math.round(PARAMS.rows), LIMITS.minRows, LIMITS.maxRows);
  const key = `${rows}`;
  if (key === meshKey) return;
  if (helicoidMesh) freeGeometry(helicoidMesh);
  helicoidMesh = buildHelicoidMesh(rows);
  meshKey = key;
}

// ================================================================
// SACRED-GEOMETRY PLATE — stroke geometry built once per parameter set
// ================================================================
// Concentric circles r = kU / helices (the shadows of the helices), the 1.16 U rim with
// 4 × divisions ticks, `divisions` evenly spaced radii and a hexagram {6/2} inscribed in r = U.

const plate = { key: "", rings: null, rim: null, spokes: null, star: null };

function circleSegments(list, radius, z) {
  for (let j = 0; j < PLATE.segments; j++) {
    const a0 = TAU * j / PLATE.segments, a1 = TAU * (j + 1) / PLATE.segments;
    list.push(radius * Math.cos(a0), radius * Math.sin(a0), z, radius * Math.cos(a1), radius * Math.sin(a1), z);
  }
}

// Each layer is tessellated once into a p5.Geometry (strokes only) and replayed with model(), so the
// per-frame cost is one draw per layer instead of re-tessellating ~2,200 stroke vertices.
const PLATE_LAYERS = {
  rings: [INK, 70, 0.9],
  spokes: [INK, 55, 0.8],
  star: [MUTED, 200, 1],
  rim: [INK, 170, 1],
};

function plateLineLists() {
  const U = PARAMS.extent, z = plateZ(), rim = PLATE.radius * U;
  const lists = { rings: [], spokes: [], star: [], rim: [] };
  for (let k = 1; k <= PARAMS.helices; k++) circleSegments(lists.rings, U * k / PARAMS.helices, z);
  circleSegments(lists.rings, U, halfHeight()); // top rim of the cylinder carrying the outer helices
  circleSegments(lists.rim, rim, z);
  const ticks = 4 * PARAMS.divisions;
  for (let k = 0; k < ticks; k++) {
    const a = TAU * k / ticks, length = (k % 4 === 0 ? 1 : 0.45) * PLATE.tick * U;
    lists.rim.push(rim * Math.cos(a), rim * Math.sin(a), z, (rim + length) * Math.cos(a), (rim + length) * Math.sin(a), z);
  }
  const inner = U / PARAMS.helices;
  for (let k = 0; k < PARAMS.divisions; k++) {
    const a = TAU * k / PARAMS.divisions;
    lists.spokes.push(inner * Math.cos(a), inner * Math.sin(a), z, rim * Math.cos(a), rim * Math.sin(a), z);
  }
  for (let k = 0; k < 6; k++) {
    const a0 = HALF_PI + TAU * k / 6, a1 = HALF_PI + TAU * (k + 2) / 6;
    lists.star.push(U * Math.cos(a0), U * Math.sin(a0), z, U * Math.cos(a1), U * Math.sin(a1), z);
  }
  return lists;
}

// Must run after fitStage(): the geometry is baked at the fitted pixel scale.
function rebuildPlate() {
  const key = [PARAMS.pitch, PARAMS.turns, PARAMS.extent, PARAMS.helices, PARAMS.divisions, fit.scale].join();
  if (key === plate.key) return;
  const lists = plateLineLists(), s = fit.scale;
  for (const [name, [colorValue, alpha]] of Object.entries(PLATE_LAYERS)) {
    if (plate[name]) freeGeometry(plate[name]);
    const list = lists[name];
    plate[name] = buildGeometry(() => {
      noFill();
      stroke(colorValue.r, colorValue.g, colorValue.b, alpha);
      beginShape(LINES);
      for (let i = 0; i < list.length; i += 3) vertex(list[i] * s, list[i + 1] * s, list[i + 2] * s);
      endShape();
    });
  }
  plate.key = key;
}

function drawPlate() {
  const s = fit.scale, U = PARAMS.extent, z = plateZ() * s;
  // push/pop: noFill() must not leak into the surface's model() fill pass.
  push();
  noFill();
  if (sim.layers.plate) {
    for (const [name, [colorValue, alpha, weight]] of Object.entries(PLATE_LAYERS)) {
      stroke(colorValue.r, colorValue.g, colorValue.b, alpha);
      strokeWeight(weight);
      model(plate[name]);
    }
  }
  // Shadow of the cobalt ruling: the diameter at angle v + spin, v = z / c.
  const alpha = 255 * frameState.levelVisible;
  if (alpha >= 2) {
    const r = U * s, a = frameState.rulingAngle;
    stroke(COBALT.r, COBALT.g, COBALT.b, alpha);
    strokeWeight(2);
    line(-r * Math.cos(a), -r * Math.sin(a), z, r * Math.cos(a), r * Math.sin(a), z);
  }
  pop();
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
  if (free) {
    frameState.yaw += sim.dragYaw;
    frameState.tilt += sim.dragTilt;
  }
  const distance = cameraDistance();
  perspective(STAGE.fov, W / H, distance * 0.5, distance * 2);
  camera(0, 0, distance, 0, 0, 0, 0, 1, 0);

  push();
  translate(fit.tx, fit.ty, 0);
  rotateY(frameState.yaw);
  // Z (the screw axis) points up the screen, tipped toward the viewer by the elevation.
  rotateX(HALF_PI - frameState.tilt);

  // Static plate and axis extensions (the surface itself carries the axis between its ends).
  drawPlate();
  stroke(INK.r, INK.g, INK.b, 150);
  strokeWeight(1.2);
  const s = fit.scale;
  line(0, 0, halfHeight() * s, 0, 0, axisTopZ() * s);
  line(0, 0, axisBottomZ() * s, 0, 0, -halfHeight() * s);

  rotateZ(frameState.spin);
  noStroke();
  shader(surfaceShader);
  surfaceShader.setUniform("uPitch", PARAMS.pitch);
  surfaceShader.setUniform("uTurns", PARAMS.turns);
  surfaceShader.setUniform("uExtent", PARAMS.extent);
  surfaceShader.setUniform("uScale", fit.scale);
  surfaceShader.setUniform("uDistance", distance);
  surfaceShader.setUniform("uDepthSpan", fit.depthSpan);
  surfaceShader.setUniform("uBg", colorVector(BG));
  surfaceShader.setUniform("uInk", colorVector(INK));
  surfaceShader.setUniform("uCharcoal", colorVector(CHARCOAL));
  surfaceShader.setUniform("uMuted", colorVector(MUTED));
  surfaceShader.setUniform("uCobalt", colorVector(COBALT));
  surfaceShader.setUniform("uLight", PARAMS.light);
  surfaceShader.setUniform("uHelixStep", PARAMS.extent / PARAMS.helices);
  surfaceShader.setUniform("uRulingStep", TAU * PARAMS.pitch / PARAMS.rulings);
  surfaceShader.setUniform("uLevel", frameState.level);
  surfaceShader.setUniform("uLevelVisible", frameState.levelVisible);
  surfaceShader.setUniform("uNetOn", sim.layers.net ? 1 : 0);
  surfaceShader.setUniform("uContourOn", sim.layers.contours ? 1 : 0);
  model(helicoidMesh);
  resetShader();
  pop();
}

// ================================================================
// HUD — Neo-Swiss editorial layer (existing fonts and size scale: 72 / 34 / 28 / 26 / 23 / 22)
// ================================================================

function pad2(value) {
  return String(value).padStart(2, "0");
}

function turnsLabel(turns) {
  return Number.isInteger(turns) ? `${turns}` : turns.toFixed(1);
}

function piMultiple(value) {
  if (value === 0) return "0";
  if (value === 1) return "π";
  if (value === -1) return "−π";
  return `${value < 0 ? "−" : ""}${turnsLabel(Math.abs(value))}π`;
}

function hudText() {
  const c = PARAMS.pitch, T = PARAMS.turns;
  return {
    header: "MATHEMATICAL STUDIES / 002",
    headerRight: `HELICOID / 0${pad2(presetIndex + 1)}`,
    title: ["HELICOID", "INFINITE"],
    column: [
      ["SPIRAL GEOMETRY", 26, INK],
      [`PITCH c = ${c.toFixed(3)} / ${turnsLabel(T)} TURNS`, 22, INK],
      ["MEAN CURVATURE / H = 0", 22, CHARCOAL],
      ["GAUSSIAN CURVATURE / K < 0", 22, CHARCOAL],
    ],
    weierstrass: "PARAMETRIC SURFACE X(u, v)",
    integral: "x = u cos v · y = u sin v · z = c v",
    data: `|v| ≤ ${piMultiple(T)}   |u| ≤ ${PARAMS.extent.toFixed(2)}`,
    legend: [
      [MUTED, "HELICES / u = const", `r = kU / ${PARAMS.helices} · ${PARAMS.divisions} DIVISIONS`],
      [COBALT, "RULINGS / z = const", `${PARAMS.rulings} PER TURN · 2πc RISE`],
    ],
    citation: `K = −c² / (c² + u²)² · ${meshLabel()}`,
    citationRight: `${MAX_DURATION} S / ${LOOP_FRAMES} F`,
    axis: "SCREW AXIS",
  };
}

function meshLabel() {
  const rows = Math.round(PARAMS.rows);
  return `${rows} × ${LIMITS.colsPerRow * rows} MESH`;
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
  graphics.text(`θ(t) = ${PARAMS.spinTurns === 0 ? "0" : `${piMultiple(PARAMS.spinTurns)}t`}`, GRID.right, HUD.readoutY);

  drawHeightRuler(graphics);
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

// Z ruler: one tick per quarter turn (Δz = πc/2), longer at half turns, cobalt marker at the
// climbing ruling.
function drawHeightRuler(graphics) {
  const zh = halfHeight();
  const toY = (z) => RULER.bottom - (RULER.bottom - RULER.top) * (z / zh + 1) / 2;
  hairline(graphics, RULER.x, RULER.top, RULER.x, RULER.bottom, INK, 200, 1);
  const quarters = Math.round(2 * PARAMS.turns);
  for (let i = -quarters; i <= quarters; i++) {
    const y = toY(i * zh / quarters);
    const length = i === 0 ? 2 * RULER.tick : (i % 2 === 0 ? 1.5 : 1) * RULER.tick;
    hairline(graphics, RULER.x - length, y, RULER.x, y, INK, 200, 1);
  }
  graphics.noStroke();
  setType(graphics, "monospace", NORMAL, 22);
  fillColor(graphics, CHARCOAL, 220);
  graphics.textAlign(LEFT, BOTTOM);
  graphics.text("+Z", GRID.left, RULER.top - 12);
  graphics.textAlign(LEFT, TOP);
  graphics.text("−Z", GRID.left, RULER.bottom + 12);
  const alpha = 255 * frameState.levelVisible;
  if (alpha < 2) return;
  const y = toY(clamp(frameState.level, -zh, zh));
  hairline(graphics, RULER.x - 18, y, RULER.x + 18, y, COBALT, alpha, 2.4);
  graphics.noStroke();
  fillColor(graphics, COBALT, alpha);
  graphics.textAlign(LEFT, CENTER);
  const sign = frameState.level < 0 ? "−" : "+";
  graphics.text(`${sign}${Math.abs(frameState.level).toFixed(2)}`, RULER.x + 24, y - 1);
}

// Label at the top of the screw axis, projected with the live pose.
const axisScratch = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
const AXIS_LABEL = { dx: 8, dy: -2, height: 24 };

function axisLabelAnchor() {
  axisScratch[0][0] = 0; axisScratch[0][1] = 0; axisScratch[0][2] = axisTopZ();
  return projectToScreen(posePoint(axisScratch[0], axisScratch[1], false), axisScratch[2]);
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
// AUDIT — ?audit=1 checks the parametrisation against an independent screw construction, H = 0,
// the metric, the normal, K, straight rulings, screw and half-turn symmetry, mesh finiteness,
// framing, typography fit and the loop seam (report stored on window.helicoidAudit).
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

// Independent reference: rotate (u, 0, 0) by v using the half-angle (rational) rotation and lift by cv.
function helicoidScrew(u, v, c) {
  const t = Math.tan(v / 2), d = 1 + t * t;
  return [u * (1 - t * t) / d, u * 2 * t / d, c * v];
}

function rotateZ3(p, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
}

function auditPreset(params, random) {
  const { pitch: c, turns: T, extent: U } = params;
  const report = { pitch: c, turns: T, formulaMax: 0, harmonicMax: 0, metricMax: 0, normalMax: 0, kRelMax: 0, kNonNegative: 0, rulingMax: 0, screwMax: 0, halfTurnMax: 0 };
  const X = (u, v) => helicoidPoint(u, v, c, [0, 0, 0]);
  const h = 1e-3;
  for (let s = 0; s < 120; s++) {
    const u = U * (2 * random() - 1), v = Math.PI * T * (2 * random() - 1);
    const p0 = X(u, v);
    report.formulaMax = Math.max(report.formulaMax, ...helicoidScrew(u, v, c).map((value, i) => Math.abs(value - p0[i])));
    const f = (a, b) => X(u + a * h, v + b * h);
    const pu1 = f(1, 0), pu0 = f(-1, 0), pv1 = f(0, 1), pv0 = f(0, -1);
    const ru = [0, 1, 2].map((i) => (pu1[i] - pu0[i]) / (2 * h));
    const rv = [0, 1, 2].map((i) => (pv1[i] - pv0[i]) / (2 * h));
    const ruu = [0, 1, 2].map((i) => (pu1[i] - 2 * p0[i] + pu0[i]) / (h * h));
    const rvv = [0, 1, 2].map((i) => (pv1[i] - 2 * p0[i] + pv0[i]) / (h * h));
    const a = f(1, 1), b = f(1, -1), cc = f(-1, 1), d = f(-1, -1);
    const ruv = [0, 1, 2].map((i) => (a[i] - b[i] - cc[i] + d[i]) / (4 * h * h));
    const nRaw = cross(ru, rv), len = Math.hypot(...nRaw), N = nRaw.map((value) => value / len);
    const E = dot(ru, ru), F = dot(ru, rv), G = dot(rv, rv);
    const e = dot(ruu, N), fm = dot(ruv, N), g = dot(rvv, N);
    report.metricMax = Math.max(report.metricMax, Math.abs(E - 1), Math.abs(F), Math.abs(G - (u * u + c * c)) / G);
    // Mean curvature (eG − 2fF + gE) / 2(EG − F²), relative to the principal scale √|K|.
    const Hm = (e * G - 2 * fm * F + g * E) / (2 * (E * G - F * F));
    const K = (e * g - fm * fm) / (E * G - F * F);
    const Kf = gaussianCurvature(u, c);
    report.harmonicMax = Math.max(report.harmonicMax, Math.abs(Hm) / Math.sqrt(Math.abs(Kf)));
    report.kRelMax = Math.max(report.kRelMax, Math.abs(K - Kf) / Math.abs(Kf));
    if (Kf >= 0) report.kNonNegative++;
    report.normalMax = Math.max(report.normalMax, ...helicoidNormal(u, v, c).map((value, i) => Math.abs(value - N[i])));
    // Ruling z = cv: three points at the same v are collinear and share z.
    const q0 = X(-U, v), q1 = X(U, v), dq = [0, 1, 2].map((i) => q1[i] - q0[i]);
    const dp = [0, 1, 2].map((i) => p0[i] - q0[i]);
    report.rulingMax = Math.max(report.rulingMax, Math.hypot(...cross(dq, dp)) / Math.hypot(...dq), Math.abs(q0[2] - p0[2]), Math.abs(q1[2] - p0[2]));
    // Screw: X(u, v + φ) = R_φ X(u, v) + (0, 0, cφ). Half-turn: R_π X(u, v) = X(−u, v).
    const phi = TAU * random() - Math.PI, screw = rotateZ3(p0, phi), shifted = X(u, v + phi);
    report.screwMax = Math.max(report.screwMax, Math.abs(screw[0] - shifted[0]), Math.abs(screw[1] - shifted[1]), Math.abs(screw[2] + c * phi - shifted[2]));
    const half = rotateZ3(p0, Math.PI), mirrored = X(-u, v);
    report.halfTurnMax = Math.max(report.halfTurnMax, ...half.map((value, i) => Math.abs(value - mirrored[i])));
  }
  report.ok = report.formulaMax < 1e-9 && report.harmonicMax < 1e-4 && report.metricMax < 1e-5 &&
    report.normalMax < 1e-5 && report.kRelMax < 1e-3 && report.kNonNegative === 0 && report.rulingMax < 1e-12 &&
    report.screwMax < 1e-12 && report.halfTurnMax < 1e-12;
  return report;
}

function auditGeometry() {
  const random = seededRandom(20261111);
  const presets = PRESETS.map((preset) => auditPreset({ ...PARAMS, ...preset.params }, random));
  let nonFinite = 0, asymmetric = 0;
  const vertices = helicoidMesh.vertices;
  for (const vertex of vertices) {
    const u = PARAMS.extent * (2 * vertex.x - 1), v = Math.PI * PARAMS.turns * (2 * vertex.y - 1);
    if (![...helicoidPoint(u, v, PARAMS.pitch), ...helicoidNormal(u, v, PARAMS.pitch)].every(Number.isFinite)) nonFinite++;
  }
  // Half-turn maps lattice row j onto row rows − j: the s lattice must be symmetric about 1/2.
  const rows = Math.round(PARAMS.rows);
  for (let j = 0; j <= rows; j++) if (Math.abs(j / rows + (rows - j) / rows - 1) > 1e-12) asymmetric++;
  return { presets, mesh: { vertices: vertices.length, faces: helicoidMesh.faces.length, nonFinite, asymmetric } };
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
  const report = { geometry: auditGeometry(), typography: auditTypography(), framing: null, loop: null };
  const framing = { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity, labelTop: Infinity, labelRight: -Infinity };
  const posed = [0, 0, 0], screen = [0, 0];
  let previous = null, first = null, maxInteriorStep = 0;
  // Symmetry-reduced pose: the rendered image depends on spin (and the plate diameter) only modulo π.
  const snapshot = () => [
    Math.cos(2 * frameState.spin), Math.sin(2 * frameState.spin), frameState.tilt, frameState.yaw,
    frameState.levelVisible * frameState.level,
    frameState.levelVisible * Math.cos(2 * frameState.rulingAngle),
    frameState.levelVisible * Math.sin(2 * frameState.rulingAngle),
  ];
  const step = (p, q) => Math.max(...p.map((value, i) => Math.abs(value - q[i])));
  for (let frame = 0; frame < LOOP_FRAMES; frame++) {
    computeFrameState(frame / LOOP_FRAMES);
    const current = snapshot();
    if (previous) maxInteriorStep = Math.max(maxInteriorStep, step(current, previous));
    else first = current;
    previous = current;
    if (frame % 6 !== 0) continue;
    forEachExtremePoint(16, 128, (point, spun) => {
      projectToScreen(posePoint(point, posed, spun), screen);
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
  report.ok = report.geometry.presets.every((preset) => preset.ok) && report.geometry.mesh.nonFinite === 0 &&
    report.geometry.mesh.asymmetric === 0 &&
    framing.clearsTop && framing.clearsBottom && framing.clearsRuler && framing.clearsRight &&
    ty.titleRight < ty.columnLeft - 24 && ty.columnRight <= GRID.right && ty.legendRight <= GRID.right &&
    ty.lowerLeftRight < ty.columnLeft - 16 && ty.citationWidth <= ty.available && ty.headerWidth <= ty.available &&
    report.loop.seamStep <= report.loop.maxInteriorStep * 1.01;
  console.log("[helicoid audit]", JSON.stringify(report, null, 2));
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

// Turn-count presets; each retunes the pitch so the rise stays sculptural in the 9:16 stage.
const PRESETS = [
  { key: "turns1", params: { turns: 1, pitch: 0.16 } },
  { key: "turns15", params: { turns: 1.5, pitch: 0.12 } },
  { key: "turns25", params: { turns: 2.5, pitch: 0.075 } },
];

// ?preset=1&c=0.1&T=2&rows=96 — handy for stills and shader checks.
function applyUrlParams() {
  const preset = Number(urlParam("preset")) - 1;
  if (urlParam("preset") !== null && PRESETS[preset]) {
    presetIndex = preset;
    Object.assign(PARAMS, PRESETS[preset].params);
  }
  const numeric = (name, key) => {
    const value = Number(urlParam(name));
    if (urlParam(name) !== null && Number.isFinite(value)) PARAMS[key] = value;
  };
  numeric("c", "pitch");
  numeric("T", "turns");
  numeric("U", "extent");
  numeric("rows", "rows");
  numeric("helices", "helices");
  numeric("rulings", "rulings");
  numeric("divisions", "divisions");
  numeric("tilt", "tilt");
  numeric("spin", "spinTurns");
  if (urlParam("notes") === "0") sim.layers.notes = false;
  sanitizeParams();
}

function sanitizeParams() {
  PARAMS.pitch = clamp(PARAMS.pitch, 0.05, 0.2);
  PARAMS.turns = clamp(Math.round(2 * PARAMS.turns) / 2, 1, 3);
  PARAMS.extent = clamp(PARAMS.extent, 0.6, 1.4);
  PARAMS.rows = clamp(Math.round(PARAMS.rows), LIMITS.minRows, LIMITS.maxRows);
  PARAMS.helices = clamp(Math.round(PARAMS.helices), 3, 12);
  PARAMS.rulings = clamp(Math.round(PARAMS.rulings / 6) * 6, 12, 48);
  PARAMS.divisions = clamp(Math.round(PARAMS.divisions / 6) * 6, 6, 24);
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
  pitchSlider: ["pitch", (v) => `c = ${v.toFixed(3)}`],
  turnsSlider: ["turns", (v) => `${turnsLabel(v)} turns`],
  extentSlider: ["extent", (v) => `|u| ≤ ${v.toFixed(2)}`],
  rowsSlider: ["rows", (v) => `${v.toFixed(0)} × ${(LIMITS.colsPerRow * v).toFixed(0)}`],
  helixSlider: ["helices", (v) => `${(2 * v + 1).toFixed(0)} helices`],
  rulingSlider: ["rulings", (v) => `${v.toFixed(0)} per turn`],
  divisionSlider: ["divisions", (v) => `${v.toFixed(0)} × ${(360 / v).toFixed(0)}°`],
  tiltSlider: ["tilt", (v) => `${(v * 180 / Math.PI).toFixed(0)}°`],
  spinSlider: ["spinTurns", (v) => `${v.toFixed(0)} × π`],
  lightSlider: ["light", (v) => v.toFixed(2)],
};

function applyParams() {
  sanitizeParams();
  rebuildMesh();
  fitStage();
  rebuildPlate();
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
  PRESETS.forEach((preset, index) => onClick(`preset-${preset.key}`, () => selectPreset(index)));
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

const TOGGLES = { showNet: "net", showContours: "contours", showPlate: "plate", showNotes: "notes", showMath: "math" };
const DEFAULT_PARAMS = { ...PARAMS };
const DEFAULT_PRESET = presetIndex;

function selectPreset(index) {
  if (isRecording) return;
  presetIndex = index;
  Object.assign(PARAMS, DEFAULT_PARAMS, PRESETS[index].params);
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
  ...PRESETS.map((preset) => `preset-${preset.key}`),
  "pauseBtn", "resetBtn", ...Object.keys(TOGGLES),
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
  const c = PARAMS.pitch, U = PARAMS.extent;
  setText("pitchInfo", `c = ${c.toFixed(3)} · rise 2πc = ${(TAU * c).toFixed(3)} · ${turnsLabel(PARAMS.turns)} turns`);
  setText("kValue", `${gaussianCurvature(0, c).toFixed(1)} … ${gaussianCurvature(U, c).toFixed(3)}`);
  setText("levelValue", `${frameState.level.toFixed(3)} · v = ${(frameState.level / c).toFixed(2)}`);
  setText("meshValue", `${helicoidMesh.vertices.length} verts · 1 surface draw call`);
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
    saveCanvas(`helicoid_${getTimestamp()}`, "png");
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
    anchor.download = `helicoid_${getTimestamp()}.mp4`;
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
