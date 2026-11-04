"use strict";

// ENNEPER ROSETTE — HIGHER-ORDER ENNEPER MINIMAL SURFACE
// Weierstrass data g(z) = zⁿ, dh = dz, with X(z) = Re ∫ (1 − g², i(1 + g²), 2g) dh:
//   X = Re(z − z^(2n+1)/(2n+1))
//   Y = Re(i(z + z^(2n+1)/(2n+1)))
//   Z = Re(2z^(n+1)/(n+1))
// Conformal metric ds = (1 + |z|^(2n))|dz|, H = 0, K = −[2n|z|^(n−1) / (1 + |z|^(2n))²]² ≤ 0,
// unit normal N = (2 Re g, 2 Im g, |g|² − 1) / (|g|² + 1). z ↦ e^(2πi/(n+1)) z rotates the surface
// about the Z axis by −2π/(n+1): C_(n+1) symmetry (C3 for n = 2), flat point K = 0 at z = 0.
// Lines of curvature: Re w = const and Im w = const where w² = z^(n+1) (f g' dz² = n z^(n−1) dz² real).

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

// Vertical height ruler in the left column: Z ∈ [−Zmax, Zmax] mapped to [rulerBottom, rulerTop].
const RULER = {
  x: 112,
  top: 640,
  bottom: 1120,
  tick: 8,
};

// Adjustable parameters. R is the radius of the disk |z| ≤ R mapped by the Weierstrass data.
const ORDER_RADIUS = { 2: 1.25, 3: 1.16, 4: 1.12 };

const PARAMS = {
  n: 2,
  radius: ORDER_RADIUS[2],
  rows: 128,
  net: 6,
  contours: 6,
  tilt: 0.64,
  spinTurns: 1,
  light: 1,
};

const LIMITS = {
  minRadius: 0.7,
  maxRadius: 1.5,
  minRows: 48,
  maxRows: 160,
};

// Stage box the sculpture is fitted into once per parameter set (never per frame).
const STAGE = {
  left: 176,
  right: GRID.right,
  top: 548,
  bottom: 1212,
  fov: 0.5,
  tiltSwing: 0.1,
  yawSwing: 0.06,
  fitSamples: 60,
  levelOvershoot: 1.2,
  // Spin at t = 0 as a fraction of the 2π/(n+1) period: a gap between petals faces the camera.
  spinPhase: 0.2,
  axisLength: 1.45,
};

const HALF_PI = Math.PI / 2;

// ================================================================
// ENNEPER SURFACE — the same polar formulas run here and in GLSL
// ================================================================

function zMax() {
  return 2 * Math.pow(PARAMS.radius, PARAMS.n + 1) / (PARAMS.n + 1);
}

// z = r e^(iθ): zᵏ = rᵏ e^(ikθ), so every term is a real polar expression.
function enneperPoint(r, theta, n) {
  const m = 2 * n + 1, k = n + 1;
  const rm = Math.pow(r, m), rk = Math.pow(r, k);
  return [
    r * Math.cos(theta) - rm * Math.cos(m * theta) / m,
    -r * Math.sin(theta) - rm * Math.sin(m * theta) / m,
    2 * rk * Math.cos(k * theta) / k,
  ];
}

function enneperNormal(r, theta, n) {
  const gn = Math.pow(r, n), g2 = gn * gn;
  return [2 * gn * Math.cos(n * theta) / (g2 + 1), 2 * gn * Math.sin(n * theta) / (g2 + 1), (g2 - 1) / (g2 + 1)];
}

function gaussianCurvature(r, n) {
  const k = 2 * n * Math.pow(r, n - 1) / ((1 + Math.pow(r, 2 * n)) ** 2);
  return -k * k;
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
};

// Framing: fixed for a parameter set, solved over the whole loop by fitStage().
const fit = { scale: 200, tx: 0, ty: 0, depthSpan: 1, key: "" };

let presetIndex = 0;

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function fract(x) {
  return x - Math.floor(x);
}

function computeFrameState(p) {
  const phase = p * TAU;
  // 2π/(n+1) per loop: frame 600 is frame 0 rotated onto itself by the C_(n+1) symmetry.
  frameState.spin = (TAU * STAGE.spinPhase + PARAMS.spinTurns * phase) / (PARAMS.n + 1);
  frameState.tilt = PARAMS.tilt + STAGE.tiltSwing * Math.sin(phase);
  frameState.yaw = STAGE.yawSwing * Math.sin(phase + 0.7);
  // Emphasised contour sweeps −1.2 Zmax → 1.2 Zmax; it sits on Z = 0 (the saddle star) at frame 0
  // and wraps at p = 0.5 while it is off the surface on both ends.
  const zm = zMax();
  frameState.level = 2 * STAGE.levelOvershoot * zm * (fract(p + 0.5) - 0.5);
  frameState.levelVisible = 1 - smoothstep(0.97 * zm, 1.06 * zm, Math.abs(frameState.level));
}

// Same pose renderFrame applies: spin about Z, tilt (elevation), yaw.
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

function fitStage() {
  const key = [PARAMS.n, PARAMS.radius, PARAMS.tilt, PARAMS.spinTurns].join();
  if (key === fit.key) return;
  const nr = 24, nt = 180, samples = STAGE.fitSamples;
  const point = [0, 0, 0];
  let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity, extent = 0;
  for (let k = 0; k < samples; k++) {
    computeFrameState(k / samples);
    for (let i = 1; i <= nr; i++) {
      const r = PARAMS.radius * i / nr;
      for (let j = 0; j < nt; j++) {
        posePoint(enneperPoint(r, TAU * j / nt, PARAMS.n), point);
        xLo = Math.min(xLo, point[0]); xHi = Math.max(xHi, point[0]);
        yLo = Math.min(yLo, point[1]); yHi = Math.max(yHi, point[1]);
        extent = Math.max(extent, Math.abs(point[2]));
      }
    }
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

// Polar lattice (s = r/R, θ in turns). The mesh does not depend on n or R — both are uniforms —
// so it is built once per resolution. The θ seam column duplicates so overlays stay continuous.
function buildEnneperMesh(rows) {
  const cols = 4 * rows;
  const geometry = new p5.Geometry();
  geometry.gid = `enneper-${rows}`;
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
uniform float uN;
uniform float uR;
uniform float uScale;
uniform float uDistance;
uniform float uDepthSpan;
out vec3 vNormal;
out vec3 vEye;
out vec2 vPolar;
out float vDepth;

const float TAU = 6.283185307179586;

// Line-by-line port of enneperPoint() / enneperNormal().
void main() {
  float r = uR * aPosition.x;
  float th = TAU * aPosition.y;
  float m = 2.0 * uN + 1.0;
  float k = uN + 1.0;
  float rm = pow(r, m);
  vec3 p = vec3(r * cos(th) - rm * cos(m * th) / m,
               -r * sin(th) - rm * sin(m * th) / m,
               2.0 * pow(r, k) * cos(k * th) / k);
  float gn = pow(r, uN);
  float g2 = gn * gn;
  vec3 n = vec3(2.0 * gn * cos(uN * th), 2.0 * gn * sin(uN * th), g2 - 1.0) / (g2 + 1.0);
  vec4 eye = uModelViewMatrix * vec4(p * uScale, 1.0);
  vNormal = mat3(uModelViewMatrix) * n;
  vEye = eye.xyz;
  vPolar = vec2(r, th);
  vDepth = clamp(0.5 + (eye.z + uDistance) / uDepthSpan, 0.0, 1.0);
  gl_Position = uProjectionMatrix * eye;
}
`;

const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vEye;
in vec2 vPolar;
in float vDepth;
uniform float uN;
uniform float uR;
uniform vec3 uBg;
uniform vec3 uInk;
uniform vec3 uCharcoal;
uniform vec3 uMuted;
uniform vec3 uCobalt;
uniform float uLight;
uniform float uNetStep;
uniform float uContourStep;
uniform float uLevel;
uniform float uNetOn;
uniform float uContourOn;
out vec4 outColor;

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
  vec3 n = normalize(vNormal);
  vec3 v = normalize(-vEye);
  bool front = dot(n, v) >= 0.0;
  if (!front) n = -n;
  vec3 key = normalize(vec3(-0.5, -0.75, 0.62));
  vec3 fill = normalize(vec3(0.75, 0.2, 0.6));
  float diffuse = max(dot(n, key), 0.0);
  float soft = max(dot(n, fill), 0.0);
  float spec = pow(max(dot(reflect(-key, n), v), 0.0), 36.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.5);

  // Charcoal top side, near-black underside; restrained key + fill.
  vec3 base = front ? uCharcoal : uInk;
  vec3 color = mix(base, uMuted, uLight * (0.34 * diffuse + 0.1 * soft) * (front ? 1.0 : 0.6));

  float r = vPolar.x;
  float th = vPolar.y;

  // Lines of curvature: w = z^((n+1)/2); Re w, Im w = const (sign flip across the θ seam is
  // harmless because the line set {k · step} is symmetric under w → −w).
  float k = uN + 1.0;
  vec2 w = pow(r, 0.5 * k) * vec2(cos(0.5 * k * th), sin(0.5 * k * th));
  float net = max(gridLine(w.x / uNetStep, 1.0), gridLine(w.y / uNetStep, 1.0)) * uNetOn;
  color = mix(color, uMuted, 0.72 * net);

  // Height contours Z = const (exact Z from r, θ), with emphasis travelling with uLevel.
  float z = 2.0 * pow(r, k) * cos(k * th) / k;
  float near = exp(-pow((z - uLevel) / (1.1 * uContourStep), 2.0));
  float contour = gridLine(z / uContourStep, 1.0 + 0.9 * near) * (0.38 + 0.62 * near);
  float sweep = levelLine(z, uLevel, 2.4);
  color = mix(color, uCobalt, uContourOn * max(0.9 * contour, sweep));

  // Open boundary |z| = R as a fine off-white edge.
  float edge = levelLine(r, uR, 1.3);
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
let enneperMesh;
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
  layers: { net: true, contours: true, notes: true, math: true },
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
  if (auditParam !== null) window.enneperAudit = runAudit();
  window.enneper = { PARAMS, frameState, fit, computeFrameState, enneperPoint, setLoop, runAudit };
}

function rebuildMesh() {
  const rows = clamp(Math.round(PARAMS.rows), LIMITS.minRows, LIMITS.maxRows);
  const key = `${rows}`;
  if (key === meshKey) return;
  if (enneperMesh) freeGeometry(enneperMesh);
  enneperMesh = buildEnneperMesh(rows);
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
  // Z (the C_(n+1) axis) points up the screen, tipped toward the viewer by the elevation.
  rotateX(HALF_PI - frameState.tilt);
  rotateZ(frameState.spin);
  noStroke();
  shader(surfaceShader);
  surfaceShader.setUniform("uN", PARAMS.n);
  surfaceShader.setUniform("uR", PARAMS.radius);
  surfaceShader.setUniform("uScale", fit.scale);
  surfaceShader.setUniform("uDistance", distance);
  surfaceShader.setUniform("uDepthSpan", fit.depthSpan);
  surfaceShader.setUniform("uBg", colorVector(BG));
  surfaceShader.setUniform("uInk", colorVector(INK));
  surfaceShader.setUniform("uCharcoal", colorVector(CHARCOAL));
  surfaceShader.setUniform("uMuted", colorVector(MUTED));
  surfaceShader.setUniform("uCobalt", colorVector(COBALT));
  surfaceShader.setUniform("uLight", PARAMS.light);
  surfaceShader.setUniform("uNetStep", Math.pow(PARAMS.radius, (PARAMS.n + 1) / 2) / PARAMS.net);
  surfaceShader.setUniform("uContourStep", zMax() / PARAMS.contours);
  surfaceShader.setUniform("uLevel", frameState.level);
  surfaceShader.setUniform("uNetOn", sim.layers.net ? 1 : 0);
  surfaceShader.setUniform("uContourOn", sim.layers.contours ? 1 : 0);
  model(enneperMesh);
  resetShader();

  // Symmetry axis, depth-tested so the sculpture occludes it; pierces the flat point z = 0.
  const axis = STAGE.axisLength * zMax() * fit.scale;
  stroke(INK.r, INK.g, INK.b, 150);
  strokeWeight(1.2);
  line(0, 0, -axis, 0, 0, axis);
  pop();
}

// ================================================================
// HUD — Neo-Swiss editorial layer (existing fonts and size scale: 72 / 34 / 28 / 26 / 23 / 22)
// ================================================================

const SUPERSCRIPT = { 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

function pad2(value) {
  return String(value).padStart(2, "0");
}

function hudText() {
  const n = PARAMS.n;
  return {
    header: "MATHEMATICAL STUDIES / 001",
    headerRight: `ENNEPER / 00${n}`,
    title: ["ENNEPER", "ROSETTE"],
    column: [
      ["MINIMAL SURFACE", 26, INK],
      [`ORDER ${pad2(n)} / C${n + 1} SYMMETRY`, 22, INK],
      ["MEAN CURVATURE / H = 0", 22, CHARCOAL],
      ["GAUSSIAN CURVATURE / K ≤ 0", 22, CHARCOAL],
    ],
    weierstrass: "WEIERSTRASS REPRESENTATION",
    integral: "X(z) = Re ∫ (1 − g², i(1 + g²), 2g) dh",
    data: `g(z) = z${SUPERSCRIPT[n]}   dh = dz`,
    legend: [
      [MUTED, "LINES OF CURVATURE", `Re w, Im w = const · w² = z${SUPERSCRIPT[n + 1]}`],
      [COBALT, "HEIGHT CONTOURS", "Z = const"],
    ],
    citation: `|z| ≤ ${PARAMS.radius.toFixed(2)} · FLAT POINT K(0) = 0 · ${meshLabel()}`,
    citationRight: `${MAX_DURATION} S / ${LOOP_FRAMES} F`,
    axis: `C${n + 1}`,
  };
}

function meshLabel() {
  const rows = Math.round(PARAMS.rows);
  return `${rows} × ${4 * rows} MESH`;
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
  graphics.text(`θ(t) = 2πt / ${PARAMS.n + 1}`, GRID.right, HUD.readoutY);

  drawHeightRuler(graphics);
  drawAxisLabel(graphics, text.axis);
  drawRegistrationMark(graphics, GRID.right - 14, STAGE.top);
  drawRegistrationMark(graphics, gridX(0) + 14, HUD.ruleBottomY - 40);

  // Lower band: representation (columns 0–6) + legend (columns 7–11).
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

// Z ruler: one tick per contour level, cobalt marker at the emphasised level.
function drawHeightRuler(graphics) {
  const zm = zMax();
  const toY = (z) => RULER.bottom - (RULER.bottom - RULER.top) * (z / zm + 1) / 2;
  hairline(graphics, RULER.x, RULER.top, RULER.x, RULER.bottom, INK, 200, 1);
  for (let i = -PARAMS.contours; i <= PARAMS.contours; i++) {
    const y = toY(i * zm / PARAMS.contours);
    const length = i === 0 ? 2 * RULER.tick : (i % PARAMS.contours === 0 ? 1.5 : 1) * RULER.tick;
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
  const y = toY(clamp(frameState.level, -zm, zm));
  hairline(graphics, RULER.x - 18, y, RULER.x + 18, y, COBALT, alpha, 2.4);
  graphics.noStroke();
  fillColor(graphics, COBALT, alpha);
  graphics.textAlign(LEFT, CENTER);
  const sign = frameState.level < 0 ? "−" : "+";
  graphics.text(`${sign}${Math.abs(frameState.level).toFixed(2)}`, RULER.x + 24, y - 1);
}

// Label at the top of the symmetry axis, projected with the live pose.
const axisScratch = [[0, 0, 0], [0, 0, 0]];
function drawAxisLabel(graphics, label) {
  if (!sim.layers.notes) return;
  const top = posePoint([0, 0, STAGE.axisLength * zMax()], axisScratch[0]);
  const screen = projectToScreen(top, axisScratch[1]);
  graphics.noStroke();
  setType(graphics, "monospace", NORMAL, 22);
  fillColor(graphics, INK, 230);
  graphics.textAlign(LEFT, BOTTOM);
  graphics.text(label, screen[0] + 8, screen[1] - 2);
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
// AUDIT — ?audit=1 checks the Weierstrass formulas against complex arithmetic, H = 0,
// conformality, the normal, K, the curvature-line net, C_(n+1) symmetry, mesh finiteness,
// framing, typography fit and the loop seam (report stored on window.enneperAudit).
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

// Independent reference: the brief's complex formulas evaluated with complex multiplication.
const complex = {
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  pow(z, k) {
    let out = [1, 0];
    for (let i = 0; i < k; i++) out = complex.mul(out, z);
    return out;
  },
};

function enneperComplex(x, y, n) {
  const z = [x, y], m = 2 * n + 1, k = n + 1;
  const zm = complex.pow(z, m), zk = complex.pow(z, k);
  const X = x - zm[0] / m;
  const Y = -(y + zm[1] / m);              // Re(i·w) = −Im w
  const Z = 2 * zk[0] / k;
  return [X, Y, Z];
}

function auditOrder(n, radius, random) {
  const report = { n, formulaMax: 0, harmonicMax: 0, conformalMax: 0, normalMax: 0, kRelMax: 0, kPositive: 0, netMax: 0, symmetryMax: 0 };
  const cart = (x, y) => enneperPoint(Math.hypot(x, y), Math.atan2(y, x), n);
  const h = 1e-3;
  for (let s = 0; s < 120; s++) {
    const r = 0.08 + (radius - 0.08) * random(), t = TAU * random();
    const x = r * Math.cos(t), y = r * Math.sin(t);
    const p0 = cart(x, y);
    report.formulaMax = Math.max(report.formulaMax, ...enneperComplex(x, y, n).map((value, i) => Math.abs(value - p0[i])));
    const f = (a, b) => cart(x + a * h, y + b * h);
    const px1 = f(1, 0), px0 = f(-1, 0), py1 = f(0, 1), py0 = f(0, -1);
    const rx = [0, 1, 2].map((i) => (px1[i] - px0[i]) / (2 * h));
    const ry = [0, 1, 2].map((i) => (py1[i] - py0[i]) / (2 * h));
    const rxx = [0, 1, 2].map((i) => (px1[i] - 2 * p0[i] + px0[i]) / (h * h));
    const ryy = [0, 1, 2].map((i) => (py1[i] - 2 * p0[i] + py0[i]) / (h * h));
    const a = f(1, 1), b = f(1, -1), c = f(-1, 1), d = f(-1, -1);
    const rxy = [0, 1, 2].map((i) => (a[i] - b[i] - c[i] + d[i]) / (4 * h * h));
    const nRaw = cross(rx, ry), len = Math.hypot(...nRaw), N = nRaw.map((value) => value / len);
    const E = dot(rx, rx), F = dot(rx, ry), G = dot(ry, ry);
    const e = dot(rxx, N), fm = dot(rxy, N), g = dot(ryy, N);
    report.conformalMax = Math.max(report.conformalMax, Math.abs(E - G) / E, Math.abs(F) / E);
    // Mean curvature (eG − 2fF + gE) / 2(EG − F²), relative to the principal scale.
    const Hm = (e * G - 2 * fm * F + g * E) / (2 * (E * G - F * F));
    const K = (e * g - fm * fm) / (E * G - F * F);
    report.harmonicMax = Math.max(report.harmonicMax, Math.abs(Hm) / Math.sqrt(Math.abs(K) + 1e-12));
    const Kf = gaussianCurvature(r, n);
    report.kRelMax = Math.max(report.kRelMax, Math.abs(K - Kf) / Math.abs(Kf));
    if (Kf > 0) report.kPositive++;
    report.normalMax = Math.max(report.normalMax, ...enneperNormal(r, t, n).map((value, i) => Math.abs(value - N[i])));
    // Re w = const has tangent dz ∝ i / w', Im w = const has dz ∝ 1 / w' with w' ∝ z^((n−1)/2).
    const angle = -(n - 1) / 2 * t;
    const scale = E * (Math.abs(e) + Math.abs(fm) + Math.abs(g));
    for (const [dx, dy] of [[-Math.sin(angle), Math.cos(angle)], [Math.cos(angle), Math.sin(angle)]]) {
      const residual = (E * fm - F * e) * dx * dx + (E * g - G * e) * dx * dy + (F * g - G * fm) * dy * dy;
      report.netMax = Math.max(report.netMax, Math.abs(residual) / scale);
    }
    const q = enneperPoint(r, t + TAU / (n + 1), n), rot = -TAU / (n + 1);
    report.symmetryMax = Math.max(report.symmetryMax,
      Math.abs(q[0] - (Math.cos(rot) * p0[0] - Math.sin(rot) * p0[1])),
      Math.abs(q[1] - (Math.sin(rot) * p0[0] + Math.cos(rot) * p0[1])),
      Math.abs(q[2] - p0[2]));
  }
  report.flatPointK = gaussianCurvature(0, n);
  report.ok = report.formulaMax < 1e-12 && report.harmonicMax < 1e-4 && report.conformalMax < 1e-4 &&
    report.normalMax < 1e-4 && report.kRelMax < 1e-3 && report.kPositive === 0 && report.netMax < 1e-4 &&
    report.symmetryMax < 1e-12 && report.flatPointK === 0;
  return report;
}

function auditGeometry() {
  const random = seededRandom(20261104);
  const orders = [2, 3, 4].map((n) => auditOrder(n, ORDER_RADIUS[n], random));
  let nonFinite = 0;
  for (const vertex of enneperMesh.vertices) {
    const r = PARAMS.radius * vertex.x, t = TAU * vertex.y;
    if (![...enneperPoint(r, t, PARAMS.n), ...enneperNormal(r, t, PARAMS.n)].every(Number.isFinite)) nonFinite++;
  }
  return { orders, mesh: { vertices: enneperMesh.vertices.length, faces: enneperMesh.faces.length, nonFinite } };
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
  const citation = measure("monospace", NORMAL, 22, text.citation) + 24 + measure("monospace", NORMAL, 22, text.citationRight);
  const header = measure("monospace", NORMAL, 22, text.header) + 24 + measure("monospace", NORMAL, 22, text.headerRight);
  return {
    titleRight: Math.round(GRID.left + title),
    columnLeft: gridX(7),
    columnRight: Math.round(gridX(7) + column),
    legendRight: Math.round(gridX(7) + legend),
    lowerLeftRight: Math.round(GRID.left + Math.max(integral, data)),
    citationWidth: Math.round(citation),
    headerWidth: Math.round(header),
    available: GRID.right - GRID.left,
  };
}

function runAudit() {
  const t0 = performance.now();
  const report = { geometry: auditGeometry(), typography: auditTypography(), framing: null, loop: null };
  const framing = { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity };
  const posed = [0, 0, 0], screen = [0, 0];
  let previous = null, first = null, maxInteriorStep = 0;
  // Symmetry-reduced pose: the rendered image depends on spin only modulo 2π/(n+1).
  const k = PARAMS.n + 1;
  const snapshot = () => [
    Math.cos(k * frameState.spin), Math.sin(k * frameState.spin), frameState.tilt, frameState.yaw,
    frameState.levelVisible * frameState.level,
  ];
  const step = (p, q) => Math.max(...p.map((value, i) => Math.abs(value - q[i])));
  for (let frame = 0; frame < LOOP_FRAMES; frame++) {
    computeFrameState(frame / LOOP_FRAMES);
    const current = snapshot();
    if (previous) maxInteriorStep = Math.max(maxInteriorStep, step(current, previous));
    else first = current;
    previous = current;
    if (frame % 6 !== 0) continue;
    for (let i = 1; i <= 32; i++) {
      const r = PARAMS.radius * i / 32;
      for (let j = 0; j < 256; j++) {
        projectToScreen(posePoint(enneperPoint(r, TAU * j / 256, PARAMS.n), posed), screen);
        framing.top = Math.min(framing.top, Math.round(screen[1]));
        framing.bottom = Math.max(framing.bottom, Math.round(screen[1]));
        framing.left = Math.min(framing.left, Math.round(screen[0]));
        framing.right = Math.max(framing.right, Math.round(screen[0]));
      }
    }
  }
  framing.clearsTop = framing.top > HUD.readoutY + 40;
  framing.clearsBottom = framing.bottom < HUD.ruleBottomY - 12;
  framing.clearsRuler = framing.left > RULER.x + 24;
  framing.clearsRight = framing.right <= GRID.right + 4;
  report.framing = framing;
  report.loop = {
    frames: LOOP_FRAMES,
    seconds: LOOP_FRAMES / FPS,
    seamStep: step(first, previous),
    maxInteriorStep,
    auditMs: performance.now() - t0,
  };
  const ty = report.typography;
  report.ok = report.geometry.orders.every((order) => order.ok) && report.geometry.mesh.nonFinite === 0 &&
    framing.clearsTop && framing.clearsBottom && framing.clearsRuler && framing.clearsRight &&
    ty.titleRight < ty.columnLeft - 24 && ty.columnRight <= GRID.right && ty.legendRight <= GRID.right &&
    ty.lowerLeftRight < ty.columnLeft - 16 && ty.citationWidth <= ty.available && ty.headerWidth <= ty.available &&
    report.loop.seamStep <= report.loop.maxInteriorStep * 1.01;
  console.log("[enneper audit]", JSON.stringify(report, null, 2));
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

// One preset per supported order; each sets its tuned disk radius.
const PRESETS = [2, 3, 4].map((n) => ({ key: `order${n}`, params: { n, radius: ORDER_RADIUS[n] } }));

// ?n=3&R=1.2&rows=96 — handy for stills and shader checks.
function applyUrlParams() {
  const preset = PRESETS.findIndex((entry) => entry.params.n === Number(urlParam("n")));
  if (preset >= 0) {
    presetIndex = preset;
    Object.assign(PARAMS, PRESETS[preset].params);
  }
  const numeric = (name, key) => {
    const value = Number(urlParam(name));
    if (urlParam(name) !== null && Number.isFinite(value)) PARAMS[key] = value;
  };
  numeric("R", "radius");
  numeric("rows", "rows");
  numeric("net", "net");
  numeric("contours", "contours");
  numeric("tilt", "tilt");
  numeric("spin", "spinTurns");
  if (urlParam("notes") === "0") sim.layers.notes = false;
  sanitizeParams();
}

function sanitizeParams() {
  PARAMS.n = clamp(Math.round(PARAMS.n), 2, 4);
  PARAMS.radius = clamp(PARAMS.radius, LIMITS.minRadius, LIMITS.maxRadius);
  PARAMS.rows = clamp(Math.round(PARAMS.rows), LIMITS.minRows, LIMITS.maxRows);
  PARAMS.net = clamp(Math.round(PARAMS.net), 3, 12);
  PARAMS.contours = clamp(Math.round(PARAMS.contours), 3, 12);
  PARAMS.tilt = clamp(PARAMS.tilt, 0.2, 1.2);
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
  radiusSlider: ["radius", (v) => `|z| ≤ ${v.toFixed(2)}`],
  rowsSlider: ["rows", (v) => `${v.toFixed(0)} × ${(4 * v).toFixed(0)}`],
  netSlider: ["net", (v) => `${v.toFixed(0)} per family`],
  contourSlider: ["contours", (v) => `${(2 * v + 1).toFixed(0)} levels`],
  tiltSlider: ["tilt", (v) => `${(v * 180 / Math.PI).toFixed(0)}°`],
  spinSlider: ["spinTurns", (v) => `${v.toFixed(0)} × 2π/(n+1)`],
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
  const toggles = { showNet: "net", showContours: "contours", showNotes: "notes", showMath: "math" };
  for (const [id, layer] of Object.entries(toggles)) {
    const element = getElement(id);
    if (element) element.onchange = () => {
      sim.layers[layer] = element.checked;
      syncControls();
    };
  }
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
  for (const id of ["showNet", "showContours", "showNotes", "showMath"]) {
    const element = getElement(id);
    if (element) element.checked = true;
  }
  syncControls();
}

const CONTROL_IDS = [
  ...Object.keys(SLIDERS),
  ...PRESETS.map((preset) => `preset-${preset.key}`),
  "pauseBtn", "resetBtn", "showNet", "showContours", "showNotes", "showMath",
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
  const n = PARAMS.n, R = PARAMS.radius;
  setText("orderValue", `n = ${n} · g(z) = z^${n} · C${n + 1}`);
  setText("kValue", `${gaussianCurvature(R, n).toExponential(2)} … 0`);
  setText("levelValue", frameState.level.toFixed(3));
  setText("meshValue", `${enneperMesh.vertices.length} verts · 1 draw call`);
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
    saveCanvas(`enneper_rosette_${getTimestamp()}`, "png");
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
    anchor.download = `enneper_rosette_${getTimestamp()}.mp4`;
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
