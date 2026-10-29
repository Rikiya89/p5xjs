// Hopf fibration × Flower of Life — S³ → S² fibers over sixfold golden-ratio rings, stereographically projected.
const W = 1080;
const H = 1920;
const FPS = 60;
const MAX_DURATION = 10;
const MAX_FRAMES = FPS * MAX_DURATION;
const LOOP_FRAMES = MAX_FRAMES;
const TAU = Math.PI * 2;
const BG_R = 3, BG_G = 3, BG_B = 5;
const INK_R = 255, INK_G = 255, INK_B = 255;
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

// ── Tunables ────────────────────────────────────────────────────────────────────────────────────────
// Flower-of-Life hex shells hold 6, 12, 18 points; listed inner → outer.
const RING_COUNTS = [6, 12, 18];
// Polar angle of each ring measured from the south pole (c = −1); successive rings shrink by PHI_SPACING.
const PSI_OUTER = 1.62, PHI_SPACING = GOLDEN_RATIO;
const FIBER_SAMPLES = 120;
const FLOW_TURNS = 1;                 // integer: (x0,x3) rotations per loop
const LINE_WEIGHT = 2.2;              // px, screen space (linePerspective off)
const GLOW_PASSES = [                 // stroke-alpha layering, widest first
  { w: 4.6, a: 20 },
  { w: 2.2, a: 54 },
  { w: 1.0, a: 240 },
];
const RING_TONE = [1.0, 0.84, 0.66];  // latitude → brightness level
const LON_TONE = 0.16;                // longitude → offset within the level
const RECEDE = [0.0, 0.6, 1.0];       // how far each ring fades at the envelope peak
const ENV_WARP = 0.35;                // pushes the envelope peak from 5 s to ~6 s
const BREATH = 0.025;
const UNIT = 210, CAM_DIST = 2600, CAM_PUSH = 0.4, FOV = Math.PI / 3.35;
const TILT_X = 0.20, TILT_OPEN = 0.85; // near face-on rosette → nested tori turned about the vertical at the peak
const SAFE_MARGIN_TOP = 250, SAFE_MARGIN_BOTTOM = 440, SAFE_MARGIN_RIGHT = 140;
const PROJ_EPS = 1e-3;
// "ribbon": one cached mesh, fibers evaluated in the vertex shader (60 fps).
// "polyline": literal beginShape/endShape(CLOSE) strokes — ~7.5 fps at 1080×1920 on an M2, kept for parity.
let RENDER_MODE = "ribbon";
let SAFE_ZONE_DEBUG = false;
let TEXT_OVERLAY = false;
let DEBUG = true;

let canvasEl = null, grainPg = null, finishImg = null, debugImg = null;
let muxer = null, encoder = null, isRecording = false, recFrameCount = 0;
let loopProgress = 0, phase = 0, env = 0, coverRequested = false;
let fibers = [], skippedSamples = 0;
let fiberMesh, fiberShader;

function buildBasePoints() {
  fibers = [];
  const n = RING_COUNTS.length;
  RING_COUNTS.forEach((count, ring) => {
    const psi = PSI_OUTER / Math.pow(PHI_SPACING, n - 1 - ring);
    const offset = (ring % 2) * Math.PI / count;
    for (let j = 0; j < count; j++) {
      const lon = offset + TAU * j / count;
      fibers.push({
        ring, lon,
        a: Math.sin(psi) * Math.cos(lon),
        b: Math.sin(psi) * Math.sin(lon),
        c: -Math.cos(psi),
        tone: RING_TONE[ring] * (1 - LON_TONE * (0.5 - 0.5 * Math.cos(6 * lon))),
        pts: new Float32Array(FIBER_SAMPLES * 3),
        depth: new Float32Array(FIBER_SAMPLES),
      });
    }
  });
}

function hopfFiber(a, b, c, theta) {
  const k = 1 / Math.sqrt(2 * (1 + c));
  const cs = Math.cos(theta), sn = Math.sin(theta);
  return [k * (1 + c) * cs, k * (a * sn - b * cs), k * (a * cs + b * sn), k * (1 + c) * sn];
}
// Hopf map matching hopfFiber's pairing z1 = x0 + i·x3, z2 = x2 + i·x1.
function hopfMap(x0, x1, x2, x3) {
  return [2 * (x0 * x2 + x1 * x3), 2 * (x2 * x3 - x0 * x1), x0 * x0 + x3 * x3 - x1 * x1 - x2 * x2];
}
// Map as written in the brief (pairs x0,x1 / x2,x3) — logged as a diagnostic only.
function hopfMapBrief(x0, x1, x2, x3) {
  return [2 * (x0 * x2 + x1 * x3), 2 * (x1 * x2 - x0 * x3), x0 * x0 + x1 * x1 - x2 * x2 - x3 * x3];
}

function envelope(phi) {
  const warped = phi - ENV_WARP * (1 - Math.cos(phi));
  return .5 - .5 * Math.cos(warped);
}
function viewState(phi) {
  const e = envelope(phi);
  return {
    flow: FLOW_TURNS * phi,
    breath: 1 + BREATH * Math.sin(phi),
    tiltY: TILT_OPEN * e + .10 * Math.sin(phi),
    tiltX: TILT_X + .06 * Math.sin(phi),
    // Push in late (e²) and fade early (e·(2−e)) so outer rings are gone before they grow past the margins.
    dist: CAM_DIST * (1 - CAM_PUSH * e * e),
    recede: e * (2 - e),
  };
}

// Writes world-space samples for one fiber; returns the number of skipped samples.
function computeFiber(f, view, out, depthOut) {
  const cf = Math.cos(view.flow), sf = Math.sin(view.flow);
  const cy = Math.cos(view.tiltY), sy = Math.sin(view.tiltY);
  const cx = Math.cos(view.tiltX), sx = Math.sin(view.tiltX);
  const s = UNIT * view.breath;
  let skipped = 0;
  for (let i = 0; i < FIBER_SAMPLES; i++) {
    const q = hopfFiber(f.a, f.b, f.c, TAU * i / FIBER_SAMPLES);
    const x0 = cf * q[0] - sf * q[3], x3 = sf * q[0] + cf * q[3];
    const d = 1 - x0;
    if (d < PROJ_EPS) { skipped++; continue; }
    let X = s * q[1] / d, Y = s * q[2] / d, Z = s * x3 / d;
    const X1 = cy * X + sy * Z, Z1 = -sy * X + cy * Z;
    const Y2 = cx * Y - sx * Z1, Z2 = sx * Y + cx * Z1;
    out[i * 3] = X1; out[i * 3 + 1] = Y2; out[i * 3 + 2] = Z2;
    depthOut[i] = Math.min(1, Math.max(.38, .69 + Z2 / (UNIT * 5.2)));
  }
  return skipped;
}

// One closed strip per fiber: aPosition = (sample, side, fiber), aTexCoord = (ring, longitude).
function createFiberMesh() {
  fiberMesh = new p5.Geometry();
  fiberMesh.gid = "hopf-flower-fibers";
  fibers.forEach((f, index) => {
    const start = fiberMesh.vertices.length;
    for (let s = 0; s <= FIBER_SAMPLES; s++) {
      fiberMesh.vertices.push(new p5.Vector(s, -1, index), new p5.Vector(s, 1, index));
      fiberMesh.uvs.push(f.ring, f.lon, f.ring, f.lon);
      if (s < FIBER_SAMPLES) {
        const k = start + s * 2;
        fiberMesh.faces.push([k, k + 1, k + 2], [k + 1, k + 3, k + 2]);
      }
    }
  });
}

// GLSL ES 1.00 has no const array initialisers: pick per ring with a step chain.
const glslRingPick = (values) => values.slice(1).reduce((expr, v, i) =>
  `mix(${expr}, ${v.toFixed(8)}, step(${(i + .5).toFixed(1)}, r))`, values[0].toFixed(8));
const FIBER_VERTEX = `
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uFlow, uBreath, uTiltX, uTiltY, uRecede, uHalfWidth, uAlpha;
varying float vDist;
varying float vAlpha;
const float TAU = 6.283185307179586;
const vec2 VIEWPORT = vec2(${W.toFixed(1)}, ${H.toFixed(1)});
float ringTone(float r) { return ${glslRingPick(RING_TONE)}; }
float ringRecede(float r) { return ${glslRingPick(RECEDE)}; }
// Mirrors computeFiber(): Hopf fiber → (x0,x3) flow → stereographic → tiltY → tiltX.
vec3 fiberPoint(float theta, vec3 base) {
  float a = base.x, b = base.y, c = base.z;
  float k = 1. / sqrt(2. * (1. + c));
  vec4 q = k * vec4((1. + c) * cos(theta), a * sin(theta) - b * cos(theta),
                    a * cos(theta) + b * sin(theta), (1. + c) * sin(theta));
  float x0 = cos(uFlow) * q.x - sin(uFlow) * q.w;
  float x3 = sin(uFlow) * q.x + cos(uFlow) * q.w;
  // CPU checkHopf() asserts 1 − x0 ≥ eps for every sample of the loop; the clamp is only a guard.
  float d = max(1. - x0, ${PROJ_EPS.toExponential()});
  vec3 P = ${UNIT.toFixed(1)} * uBreath * vec3(q.y, q.z, x3) / d;
  vec3 P1 = vec3(cos(uTiltY) * P.x + sin(uTiltY) * P.z, P.y, -sin(uTiltY) * P.x + cos(uTiltY) * P.z);
  return vec3(P1.x, cos(uTiltX) * P1.y - sin(uTiltX) * P1.z, sin(uTiltX) * P1.y + cos(uTiltX) * P1.z);
}
void main() {
  float ring = aTexCoord.x;
  float lon = aTexCoord.y;
  float psi = ${PSI_OUTER.toFixed(8)} / pow(${PHI_SPACING.toFixed(10)}, ${(RING_COUNTS.length - 1).toFixed(1)} - ring);
  vec3 base = vec3(sin(psi) * cos(lon), sin(psi) * sin(lon), -cos(psi));
  float theta = TAU * aPosition.x / ${FIBER_SAMPLES.toFixed(1)};
  vec3 p = fiberPoint(theta, base);
  vec3 pNext = fiberPoint(theta + .002, base);
  vec4 c0 = uProjectionMatrix * uModelViewMatrix * vec4(p, 1.);
  vec4 c1 = uProjectionMatrix * uModelViewMatrix * vec4(pNext, 1.);
  vec2 dir = (c1.xy / c1.w - c0.xy / c0.w) * VIEWPORT;
  float len = length(dir);
  vec2 normal = len > 1e-6 ? vec2(-dir.y, dir.x) / len : vec2(0., 1.);
  float extent = uHalfWidth + 1.;
  c0.xy += normal * aPosition.y * extent * 2. / VIEWPORT * c0.w;
  float tone = ringTone(ring) * (1. - ${LON_TONE.toFixed(8)} * (.5 - .5 * cos(6. * lon)));
  float depth = clamp(.69 + p.z / ${(UNIT * 5.2).toFixed(1)}, .38, 1.);
  vAlpha = uAlpha * tone * (1. - ringRecede(ring) * uRecede) * depth;
  vDist = aPosition.y * extent;
  gl_Position = c0;
}
`;
const FIBER_FRAGMENT = `
precision highp float;
uniform float uHalfWidth;
varying float vDist;
varying float vAlpha;
void main() {
  float a = vAlpha * clamp(uHalfWidth + .5 - abs(vDist), 0., 1.);
  gl_FragColor = vec4(vec3(a), a);
}
`;

function primeState() {
  // Retained recording hook: geometry, camera and light are absolute functions of phase.
}
function updateLoopTime() {
  // Frames 0..599 sample [0,TAU); TAU matches frame 0 without duplicating it.
  const frame = coverRequested ? 0 : isRecording ? recFrameCount : frameCount - 1;
  loopProgress = (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;
  phase = loopProgress * TAU;
  env = envelope(phase);
}
function updateCamera(view) {
  // Off-axis frustum keeps the origin on the safe-zone centre at every dolly distance.
  const near = 10, top = near * Math.tan(FOV / 2), right = top * W / H;
  const sx = ((W - SAFE_MARGIN_RIGHT) / 2 - W / 2) / (W / 2);
  const sy = ((SAFE_MARGIN_TOP + H - SAFE_MARGIN_BOTTOM) / 2 - H / 2) / (H / 2);
  frustum(-right * (1 + sx), right * (1 - sx), -top * (1 - sy), top * (1 + sy), near, 9000);
  linePerspective(false);
  camera(0, 0, view.dist, 0, 0, 0, 0, 1, 0);
}

function drawFibers(view) {
  RENDER_MODE === "polyline" ? drawFiberPolylines(view) : drawFiberRibbons(view);
}
function drawFiberRibbons(view) {
  noStroke();
  shader(fiberShader);
  fiberShader.setUniform("uFlow", view.flow);
  fiberShader.setUniform("uBreath", view.breath);
  fiberShader.setUniform("uTiltX", view.tiltX);
  fiberShader.setUniform("uTiltY", view.tiltY);
  fiberShader.setUniform("uRecede", view.recede);
  for (const pass of GLOW_PASSES) {
    fiberShader.setUniform("uHalfWidth", LINE_WEIGHT * pass.w / 2);
    fiberShader.setUniform("uAlpha", pass.a / 255);
    model(fiberMesh);
  }
  resetShader();
}
function drawFiberPolylines(view) {
  skippedSamples = 0;
  for (const f of fibers) skippedSamples += computeFiber(f, view, f.pts, f.depth);
  noFill();
  for (const pass of GLOW_PASSES) {
    strokeWeight(LINE_WEIGHT * pass.w);
    for (const f of fibers) {
      const alpha = pass.a * f.tone * (1 - RECEDE[f.ring] * view.recede);
      if (alpha < .5) continue;
      beginShape();
      for (let i = 0; i < FIBER_SAMPLES; i++) {
        stroke(INK_R, INK_G, INK_B, alpha * f.depth[i]);
        vertex(f.pts[i * 3], f.pts[i * 3 + 1], f.pts[i * 3 + 2]);
      }
      endShape(CLOSE);
    }
  }
}

function draw() {
  updateLoopTime();
  background(BG_R, BG_G, BG_B);
  const view = viewState(phase);
  updateCamera(view);
  push();
  drawingContext.depthMask(false);
  blendMode(ADD);
  drawFibers(view);
  blendMode(BLEND);
  drawingContext.depthMask(true);
  pop();
  drawScreenFinish();
  if (coverRequested) {
    coverRequested = false;
    saveCanvas("cover", "png");
  }
  if (isRecording) {
    captureFrame();
    recFrameCount++;
    updateRecordingUI();
    if (recFrameCount >= MAX_FRAMES) stopRecording();
  }
}

function setup() {
  const cnv = createCanvas(W, H, WEBGL);
  canvasEl = cnv.elt;
  pixelDensity(1);
  frameRate(FPS);
  colorMode(RGB, 255, 255, 255, 255);
  strokeCap(ROUND);
  strokeJoin(ROUND);
  randomSeed(20261029);
  noiseSeed(20261029);
  grainPg = createGraphics(W, H);
  grainPg.pixelDensity(1);
  bakeGrain();
  bakeFinish();
  buildBasePoints();
  createFiberMesh();
  fiberShader = createShader(FIBER_VERTEX, FIBER_FRAGMENT);

  const el = (id) => document.getElementById(id);
  if (el("startBtn")) el("startBtn").onclick = startRecording;
  if (el("stopBtn")) el("stopBtn").onclick = stopRecording;
  if (el("maxDuration")) el("maxDuration").textContent = MAX_DURATION;
  if (el("canvasSize")) el("canvasSize").textContent = W + " × " + H;
  if (el("maxFrames")) el("maxFrames").textContent = MAX_FRAMES;
  console.log("CANVAS", width, height, pixelDensity());
  if (DEBUG) { checkHopf(); checkLoopClosure(); }
}

function checkHopf() {
  let maxNorm = 0, maxHopf = 0, maxBrief = 0, skipped = 0;
  for (const f of fibers) {
    for (let i = 0; i < FIBER_SAMPLES; i++) {
      const q = hopfFiber(f.a, f.b, f.c, TAU * i / FIBER_SAMPLES);
      maxNorm = Math.max(maxNorm, Math.abs(Math.hypot(...q) - 1));
      const hq = hopfMap(...q), hb = hopfMapBrief(...q), base = [f.a, f.b, f.c];
      maxHopf = Math.max(maxHopf, ...hq.map((v, k) => Math.abs(v - base[k])));
      maxBrief = Math.max(maxBrief, ...hb.map((v, k) => Math.abs(v - base[k])));
    }
  }
  for (let frame = 0; frame < LOOP_FRAMES; frame++) {
    const view = viewState(TAU * frame / LOOP_FRAMES);
    for (const f of fibers) skipped += computeFiber(f, view, f.pts, f.depth);
  }
  const ok = maxNorm < 1e-6 && maxHopf < 1e-6 && skipped === 0;
  console[ok ? "log" : "error"]("HOPF CHECK " + (ok ? "PASS" : "FAIL"),
    { fibers: fibers.length, samples: FIBER_SAMPLES, maxNorm, maxHopf, skipped, briefMapMaxError: maxBrief });
  return ok;
}
function checkLoopClosure() {
  const v0 = viewState(0), v1 = viewState(TAU);
  // flow is an angle: 0 and TAU are the same rotation, so compare its cos/sin.
  let maxLoopError = Math.max(...Object.keys(v0).filter((k) => k !== "flow").map((k) => Math.abs(v0[k] - v1[k])),
    Math.abs(Math.cos(v0.flow) - Math.cos(v1.flow)), Math.abs(Math.sin(v0.flow) - Math.sin(v1.flow)),
    Math.abs(envelope(0) - envelope(TAU)));
  const a = new Float32Array(FIBER_SAMPLES * 3), b = new Float32Array(FIBER_SAMPLES * 3), d = new Float32Array(FIBER_SAMPLES);
  for (const f of fibers) {
    computeFiber(f, v0, a, d);
    computeFiber(f, v1, b, d);
    for (let i = 0; i < a.length; i++) maxLoopError = Math.max(maxLoopError, Math.abs(a[i] - b[i]) / UNIT);
  }
  const ok = maxLoopError < 1e-6;
  console[ok ? "log" : "error"]("LOOP CHECK " + (ok ? "PASS" : "FAIL"), { maxLoopError, envelope0: envelope(0) });
  return ok;
}

function bakeGrain() {
  grainPg.clear();
  grainPg.noStroke();
  randomSeed(20260901);
  for (let i = 0; i < Math.floor(W * H * 0.0016); i++) {
    const value = random(110, 200);
    grainPg.fill(value, value, value, random(2, 7));
    grainPg.circle(random(W), random(H), random(0.15, 0.85));
  }
  for (let i = 0; i < Math.floor(W * H * 0.000035); i++) {
    const value = random(210, 255);
    grainPg.fill(value, value, value, random(12, 34));
    grainPg.circle(random(W), random(H), random(0.4, 1.2));
  }
}

// Grain and the static title are baked once into a p5.Image so the texture uploads once, not per frame.
function bakeFinish() {
  const g = createGraphics(W, H);
  g.pixelDensity(1);
  g.image(grainPg, 0, 0);
  if (TEXT_OVERLAY) {
    g.noStroke();
    g.textFont("ui-monospace, Menlo, Consolas, monospace");
    g.textAlign(CENTER, CENTER);
    g.textStyle(BOLD);
    g.fill(INK_R, INK_G, INK_B, 236);
    g.textSize(54);
    g.text("HOPF FIBRATION", (W - SAFE_MARGIN_RIGHT) / 2, SAFE_MARGIN_TOP + 50);
    g.textStyle(NORMAL);
    g.fill(INK_R, INK_G, INK_B, 128);
    g.textSize(30);
    g.text("S³ → S²", (W - SAFE_MARGIN_RIGHT) / 2, SAFE_MARGIN_TOP + 106);
  }
  finishImg = g.get();
  g.clear();
  g.noStroke();
  g.fill(255, 40, 40, 46);
  g.rect(0, 0, W, SAFE_MARGIN_TOP);
  g.rect(0, H - SAFE_MARGIN_BOTTOM, W, SAFE_MARGIN_BOTTOM);
  g.rect(W - SAFE_MARGIN_RIGHT, SAFE_MARGIN_TOP, SAFE_MARGIN_RIGHT, H - SAFE_MARGIN_TOP - SAFE_MARGIN_BOTTOM);
  g.noFill();
  g.stroke(255, 70, 70, 200);
  g.strokeWeight(2);
  g.rect(1, SAFE_MARGIN_TOP, W - SAFE_MARGIN_RIGHT - 1, H - SAFE_MARGIN_TOP - SAFE_MARGIN_BOTTOM);
  debugImg = g.get();
  g.remove();
}

function drawScreenFinish() {
  push();
  drawingContext.disable(drawingContext.DEPTH_TEST);
  resetMatrix();
  camera(0, 0, 1, 0, 0, 0, 0, 1, 0);
  ortho(-W * 0.5, W * 0.5, -H * 0.5, H * 0.5, -10, 10);
  noLights();
  blendMode(BLEND);
  image(finishImg, -W * 0.5, -H * 0.5, W, H);
  if (SAFE_ZONE_DEBUG && !isRecording && !coverRequested) image(debugImg, -W * 0.5, -H * 0.5, W, H);
  drawingContext.enable(drawingContext.DEPTH_TEST);
  pop();
}

function keyReleased() {
  if (key === "r" || key === "R") {
    isRecording ? stopRecording() : startRecording();
    return false;
  }
  if (key === "s" || key === "S") {
    saveCanvas("hopf_flower_" + getTimestamp(), "png");
    return false;
  }
  if (key === "d" || key === "D") {
    SAFE_ZONE_DEBUG = !SAFE_ZONE_DEBUG;
    return false;
  }
  if (key === "t" || key === "T") {
    TEXT_OVERLAY = !TEXT_OVERLAY;
    bakeFinish();
    return false;
  }
  if ((key === "c" || key === "C") && !isRecording) {
    coverRequested = true;
    return false;
  }
  return true;
}

function updateRecordingUI() {
  const el = (id) => document.getElementById(id);
  if (el("duration")) el("duration").textContent = (recFrameCount / FPS).toFixed(1);
  if (el("frameCount")) el("frameCount").textContent = recFrameCount;
  if (el("progressFill")) el("progressFill").style.width = ((recFrameCount / MAX_FRAMES) * 100).toFixed(1) + "%";
}

function startRecording() {
  if (typeof VideoEncoder === "undefined") { alert("WebCodecs not supported."); return; }
  if (typeof Mp4Muxer === "undefined") { alert("mp4-muxer not loaded."); return; }
  muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: "avc", width: W, height: H },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => { console.error(error); isRecording = false; setStatus("Error", "#f44"); },
  });
  encoder.configure({ codec: "avc1.640028", width: W, height: H, bitrate: 18_000_000, framerate: FPS });
  recFrameCount = 0;
  loopProgress = 0;
  phase = 0;
  primeState();
  isRecording = true;
  const el = (id) => document.getElementById(id);
  if (el("duration")) el("duration").textContent = "0.0";
  if (el("frameCount")) el("frameCount").textContent = "0";
  if (el("startBtn")) el("startBtn").disabled = true;
  if (el("stopBtn")) el("stopBtn").disabled = false;
  if (el("progressFill")) el("progressFill").style.width = "0%";
  setStatus("Recording…", "#fff");
}

async function stopRecording() {
  if (!encoder || !muxer) return;
  isRecording = false;
  setStatus("Finalizing…", "#ccc");
  await encoder.flush();
  muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "villarceau_" + getTimestamp() + ".mp4";
  a.click();
  encoder.close();
  encoder = null;
  muxer = null;
  setTimeout(() => URL.revokeObjectURL(url), 6000);
  const el = (id) => document.getElementById(id);
  if (el("startBtn")) el("startBtn").disabled = false;
  if (el("stopBtn")) el("stopBtn").disabled = true;
  if (el("progressFill")) el("progressFill").style.width = "0%";
  setStatus("Complete", "#fff");
  setTimeout(() => setStatus("Ready", "#ccc"), 3000);
}

function captureFrame() {
  if (!encoder || !canvasEl) return;
  // Explicit duration retains the final sample in the full 10-second MP4.
  const frame = new VideoFrame(canvasEl, {
    timestamp: recFrameCount * (1_000_000 / FPS),
    duration: Math.round(1_000_000 / FPS),
  });
  encoder.encode(frame, { keyFrame: recFrameCount % FPS === 0 });
  frame.close();
}

function setStatus(textValue, colorValue) {
  const el = document.getElementById("status");
  if (el) { el.textContent = textValue; el.style.color = colorValue; }
}

function getTimestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + "_" +
    pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds());
}

if (typeof window !== "undefined") {
  window.startRecording = startRecording;
  window.stopRecording = stopRecording;
}
