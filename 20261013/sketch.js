// Spherical harmonics × Platonic solids — each state is the band-limited harmonic transform of a solid's vertices.
const W = 1080;
const H = 1920;
const FPS = 60;
const MAX_DURATION = 10;
const MAX_FRAMES = FPS * MAX_DURATION;
const LOOP_FRAMES = MAX_FRAMES;
const TAU = Math.PI * 2;
const BG_R = 3, BG_G = 3, BG_B = 5;
const INK_R = 255, INK_G = 255, INK_B = 255;
// iPhone Reel safe area (1080x1920 source): Instagram crops ~97px per side to
// fill a 19.5:9 screen, its header covers the top ~250px, and caption / audio
// UI covers the bottom ~420px. All text and geometry stay inside these bounds.
const SAFE_X = 120, SAFE_TOP = 270, SAFE_BOTTOM = 1460;
let canvasEl = null, grainPg = null, hudPg = null;
let muxer = null, encoder = null, isRecording = false, recFrameCount = 0;
let loopProgress = 0, phase = 0, twistMix = 0;
let coreMesh, coreShader, ribbonMesh, ribbonShader;

// r(θ,φ,t) = R·[1 + A(t)·F(θ,φ,t)],  F = Σ c_lm(t)·Y_lm(θ,φ)  (real, orthonormal, l ≤ 8).
// State k: c_lm = mean over the solid's vertices v of Y_lm(v), kept only on its bands,
// normalized so max|F| = 1. Lobes therefore point exactly at the solid's vertices.
const SH_L = 8, SH_N = (SH_L + 1) * (SH_L + 1);
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
const CORE_RADIUS = 270, SHELL_RADIUS = CORE_RADIUS * GOLDEN_RATIO, LATTICE_LIFT = 1.014;
const LAT_SEGMENTS = 120, LON_SEGMENTS = 240, ARC_SAMPLES = 40, SHELL_SAMPLES = 128;
const LINE_WEIGHT = 2.10, STATE_SHARPNESS = 4.2, TILT = 0.58, CONTOURS = 7;
const OBJECT_SCALE = 1.0, CAM_DIST = 2300;
const AXIS3 = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
const STATES = [
  { name: "ICOSAHEDRON", source: "ico", bands: [6], amp: 0.30, center: 0, solids: ["ico", "dod"] },
  { name: "OCTAHEDRON", source: "oct", bands: [4, 6], amp: 0.30, center: TAU / 3, solids: ["oct", "cube"] },
  { name: "TETRAHEDRON", source: "tet", bands: [3, 4], amp: 0.34, center: TAU * 2 / 3, solids: ["tetA", "tetB"] },
];
const SOLID_KINDS = ["ico", "dod", "oct", "cube", "tetA", "tetB"], KIND_SHELL = 6;
const SH_SCALE = new Float64Array(SH_N);
const stateCoeffs = [], stateWeights = [0, 0, 0];
const blendCoeffs = new Float64Array(SH_N), coeffUniform = new Array(SH_N).fill(0);
let solids = null, ampNow = 0, debugFrame = false;

function factorial(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
function initShScale() {
  for (let l = 0; l <= SH_L; l++) {
    for (let m = 0; m <= l; m++) {
      const k = Math.sqrt((2 * l + 1) / (4 * Math.PI) * factorial(l - m) / factorial(l + m)) * (m > 0 ? Math.SQRT2 : 1);
      SH_SCALE[l * l + l + m] = k;
      SH_SCALE[l * l + l - m] = k;
    }
  }
}
// Associated Legendre recurrence with sin^m θ·{cos,sin}(mφ) taken as Re/Im (x+iy)^m —
// pole-safe, no atan. Mirrors shF() in GLSL term for term.
function shBasis(x, y, z, out) {
  let cr = 1, ci = 0, pmm = 1;
  for (let m = 0; m <= SH_L; m++) {
    if (m > 0) { pmm *= -(2 * m - 1); const nr = cr * x - ci * y; ci = cr * y + ci * x; cr = nr; }
    let pa = 0, pb = 0;
    for (let l = m; l <= SH_L; l++) {
      const p = l === m ? pmm : l === m + 1 ? z * (2 * m + 1) * pmm : ((2 * l - 1) * z * pb - (l + m - 1) * pa) / (l - m);
      pa = pb; pb = p;
      out[l * l + l + m] = SH_SCALE[l * l + l + m] * p * cr;
      if (m > 0) out[l * l + l - m] = SH_SCALE[l * l + l - m] * p * ci;
    }
  }
  return out;
}
function evalF(c, n, scratch) {
  shBasis(n[0], n[1], n[2], scratch);
  let s = 0;
  for (let i = 0; i < SH_N; i++) s += c[i] * scratch[i];
  return s;
}
function fibonacciSphere(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const z = 1 - 2 * (i + 0.5) / count, rho = Math.sqrt(1 - z * z), a = i * TAU / (GOLDEN_RATIO * GOLDEN_RATIO);
    out.push([rho * Math.cos(a), rho * Math.sin(a), z]);
  }
  return out;
}

function buildSolids() {
  const unit = (v) => { const d = Math.hypot(v[0], v[1], v[2]); return [v[0] / d, v[1] / d, v[2] / d]; };
  const signs = (v) => { const o = []; for (const a of [1, -1]) for (const b of [1, -1]) for (const c of [1, -1]) o.push([v[0] * a, v[1] * b, v[2] * c]); return o; };
  const cyc = (v) => [[v[0], v[1], v[2]], [v[1], v[2], v[0]], [v[2], v[0], v[1]]];
  const uniq = (list) => list.filter((v, i) => list.findIndex((u) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]) < 1e-9) === i);
  const P = GOLDEN_RATIO;
  const verts = {
    ico: uniq(cyc([0, 1, P]).flatMap(signs)).map(unit),
    dod: uniq([...signs([1, 1, 1]), ...cyc([0, 1 / P, P]).flatMap(signs)]).map(unit),
    oct: uniq(cyc([1, 0, 0]).flatMap(signs)).map(unit),
    cube: uniq(signs([1, 1, 1])).map(unit),
    tetA: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(unit),
    tetB: [[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]].map(unit),
  };
  verts.tet = verts.tetA;
  const edges = {};
  for (const key of SOLID_KINDS) {
    const v = verts[key];
    let dMin = Infinity;
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) dMin = Math.min(dMin, Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]));
    edges[key] = [];
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
      if (Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]) < dMin * 1.001) edges[key].push([v[i], v[j]]);
    }
  }
  return { verts, edges };
}
function buildStateCoeffs() {
  const y = new Float64Array(SH_N), samples = fibonacciSphere(12000);
  for (const state of STATES) {
    const c = new Float64Array(SH_N), v = solids.verts[state.source];
    for (const p of v) {
      shBasis(p[0], p[1], p[2], y);
      for (const l of state.bands) for (let m = -l; m <= l; m++) c[l * l + l + m] += y[l * l + l + m] / v.length;
    }
    let maxAbs = 0;
    for (const n of samples) maxAbs = Math.max(maxAbs, Math.abs(evalF(c, n, y)));
    for (let i = 0; i < SH_N; i++) c[i] /= maxAbs;
    stateCoeffs.push(c);
  }
}

const SH_GLSL = `
uniform float uC[${SH_N}];
uniform float uAmp;
const float CORE_R = ${CORE_RADIUS.toFixed(4)};
float shF(vec3 n) {
  float total = 0.0, cr = 1.0, ci = 0.0, pmm = 1.0;
  for (int m = 0; m <= ${SH_L}; m++) {
    if (m > 0) { pmm *= -float(2*m-1); float nr = cr*n.x - ci*n.y; ci = cr*n.y + ci*n.x; cr = nr; }
    float pa = 0.0, pb = 0.0;
    for (int l = 0; l <= ${SH_L}; l++) {
      if (l < m) continue;
      float p = l == m ? pmm : (l == m+1 ? n.z*float(2*m+1)*pmm : (float(2*l-1)*n.z*pb - float(l+m-1)*pa)/float(l-m));
      pa = pb; pb = p;
      int base = l*l + l;
      total += uC[base+m]*p*cr;
      if (m > 0) total += uC[base-m]*p*ci;
    }
  }
  return total;
}
vec3 shSurface(vec3 n) { return n*CORE_R*(1.0 + uAmp*shF(n)); }
`;
const FOG_GLSL = `float fogDepth(vec4 eye) { return clamp(1.-(-eye.z-(${CAM_DIST.toFixed(1)}-460.))/1150.,.28,1.); }`;

const CORE_VERTEX = `#version 300 es
precision highp float;
in vec3 aPosition;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
out vec3 vNormal;
out vec3 vEye;
out float vF;
out float vFog;
${SH_GLSL}
${FOG_GLSL}
void main() {
  vec3 n = normalize(aPosition);
  vec3 t1 = normalize(cross(n, abs(n.z) < .9 ? vec3(0,0,1) : vec3(1,0,0)));
  vec3 t2 = cross(n, t1);
  float f = shF(n);
  vec3 p = n*CORE_R*(1. + uAmp*f);
  vec3 p1 = shSurface(normalize(n + .004*t1)), p2 = shSurface(normalize(n + .004*t2));
  vec3 N = normalize(cross(p1 - p, p2 - p));
  if (dot(N, n) < 0.) N = -N;
  vec4 eye = uModelViewMatrix*vec4(p, 1.);
  vNormal = normalize(mat3(uModelViewMatrix)*N);
  vEye = eye.xyz; vF = f; vFog = fogDepth(eye);
  gl_Position = uProjectionMatrix*eye;
}
`;
const CORE_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vEye;
in float vF;
in float vFog;
uniform vec3 uInk;
uniform vec3 uBg;
out vec4 fragColor;
void main() {
  vec3 N = normalize(vNormal), V = normalize(-vEye);
  vec3 L = normalize(vec3(-.5, -.55, .67));
  float ndv = max(dot(N, V), 0.);
  float diff = max(dot(N, L), 0.);
  float spec = pow(max(dot(N, normalize(L + V)), 0.), 42.);
  float rim = pow(1. - ndv, 2.4);
  float lobe = vF > 0. ? 1. : .5;
  float body = (.035 + .17*diff)*lobe + .42*rim + .30*spec;
  float g = vF*${CONTOURS.toFixed(1)};
  float w = max(fwidth(g), 1e-4);
  float iso = (1. - smoothstep(.55, 1.5, abs(fract(g + .5) - .5)/w))*(1. - smoothstep(.22, .45, w));
  float nodal = 1. - smoothstep(1.0, 2.4, abs(vF)/max(fwidth(vF), 1e-5));
  float c = (body + .20*iso*(.45 + .55*ndv) + .50*nodal)*vFog;
  fragColor = vec4(mix(uBg, uInk, clamp(c, 0., 1.)), 1.);
}
`;

const RIBBON_VERTEX = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uHalo;
uniform float uPhase;
uniform float uW[3];
uniform float uShellMix;
uniform float uShellSpin;
out float vEdge;
out float vLight;
out float vGlow;
const float TAU = 6.283185307179586;
const vec3 AXIS3 = vec3(.5773502691896258);
${SH_GLSL}
${FOG_GLSL}
vec3 fromAngles(vec2 tp) { return vec3(sin(tp.x)*cos(tp.y), sin(tp.x)*sin(tp.y), cos(tp.x)); }
vec3 axisTurn(vec3 p, vec3 k, float a) { return p*cos(a) + cross(k, p)*sin(a) + k*dot(k, p)*(1. - cos(a)); }
vec3 ribbonPoint(float s, float kind) {
  if (kind < 5.5) {
    // Great-circle edge of the Platonic lattice, lifted onto r(θ,φ,t).
    vec3 a = aNormal, b = fromAngles(aTexCoord);
    float om = acos(clamp(dot(a, b), -1., 1.));
    vec3 d = normalize((sin((1. - s)*om)*a + sin(s*om)*b)/sin(om));
    return shSurface(d)*${LATTICE_LIFT.toFixed(4)};
  }
  // Seed-of-life shell: 12 mutually tangent circles centred on the icosahedron's vertices.
  vec3 c = aNormal;
  vec3 e1 = normalize(cross(c, abs(c.z) < .9 ? vec3(0,0,1) : vec3(1,0,0))), e2 = cross(c, e1);
  float al = aTexCoord.x;
  vec3 d = cos(al)*c + sin(al)*(cos(s*TAU)*e1 + sin(s*TAU)*e2);
  return axisTurn(d, AXIS3, uShellSpin)*${SHELL_RADIUS.toFixed(4)};
}
void main() {
  float s = aPosition.x, kind = aPosition.z;
  float weight = kind < 5.5 ? uW[int(kind*.5 + .01)] : uShellMix;
  vec3 p = ribbonPoint(s, kind);
  vec3 tangent = ribbonPoint(min(s + .004, 1.), kind) - ribbonPoint(max(s - .004, 0.), kind);
  bool dual = kind < 5.5 && mod(kind + .01, 2.) > 1.;
  float light = kind < 5.5 ? (dual ? .46 : .70) : .30;
  float glow = kind < 5.5 ? (dual ? .22 : .40) : .16;
  float width = ${LINE_WEIGHT.toFixed(4)}*(kind < 5.5 ? (dual ? .8 : 1.) : .75);
  if (kind < 5.5) {
    // Energy pulse leaving each vertex, three per loop.
    float bead = pow(max(0., cos(TAU*(s*.5 - uPhase*3./TAU))), 36.) + pow(max(0., cos(TAU*((1. - s)*.5 - uPhase*3./TAU))), 36.);
    light += .32*bead; glow += .35*bead; width += .7*bead;
  }
  weight = pow(weight, 1.35);
  vec4 eye = uModelViewMatrix*vec4(p, 1.);
  vec3 dirEye = normalize(mat3(uModelViewMatrix)*tangent);
  vec3 crossEye = cross(dirEye, normalize(eye.xyz));
  vec3 side = crossEye/max(length(crossEye), .0001);
  float depth = fogDepth(eye);
  vLight = light*depth*weight; vGlow = glow*depth*weight; vEdge = aPosition.y;
  gl_Position = uProjectionMatrix*vec4(eye.xyz + side*aPosition.y*width*(1. + uHalo*5.), 1.);
}
`;
const RIBBON_FRAGMENT = `#version 300 es
precision highp float;
uniform float uHalo;
in float vEdge;
in float vLight;
in float vGlow;
out vec4 fragColor;
void main() {
  float edge = 1. - smoothstep(.55, 1., abs(vEdge));
  float a = uHalo > .5 ? pow(1. - abs(vEdge), 3.)*.09*vGlow : edge*vLight;
  fragColor = vec4(vec3(a), a);
}
`;

function createCoreMesh() {
  coreMesh = new p5.Geometry();
  coreMesh.gid = "sh-core";
  for (let i = 0; i <= LAT_SEGMENTS; i++) {
    const th = Math.PI * i / LAT_SEGMENTS;
    for (let j = 0; j <= LON_SEGMENTS; j++) {
      const ph = TAU * j / LON_SEGMENTS;
      coreMesh.vertices.push(new p5.Vector(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)));
      coreMesh.uvs.push(j / LON_SEGMENTS, i / LAT_SEGMENTS);
    }
  }
  const row = LON_SEGMENTS + 1;
  for (let i = 0; i < LAT_SEGMENTS; i++) {
    for (let j = 0; j < LON_SEGMENTS; j++) {
      const a = i * row + j, b = a + row;
      if (i > 0) coreMesh.faces.push([a, b, a + 1]);
      if (i < LAT_SEGMENTS - 1) coreMesh.faces.push([a + 1, b, b + 1]);
    }
  }
}
// Reuse the cached ribbon topology: aPosition = (s, side, kind), aNormal = start / centre, aTexCoord = end (θ,φ) / radius.
function addStrip(samples, a, tex, kind) {
  const start = ribbonMesh.vertices.length;
  for (let s = 0; s <= samples; s++) {
    const t = s / samples;
    ribbonMesh.vertices.push(new p5.Vector(t, -1, kind), new p5.Vector(t, 1, kind));
    ribbonMesh.vertexNormals.push(new p5.Vector(a[0], a[1], a[2]), new p5.Vector(a[0], a[1], a[2]));
    ribbonMesh.uvs.push(tex[0], tex[1], tex[0], tex[1]);
    if (s < samples) {
      const k = start + s * 2;
      ribbonMesh.faces.push([k, k + 1, k + 2], [k + 1, k + 3, k + 2]);
    }
  }
}
function createRibbonMesh() {
  ribbonMesh = new p5.Geometry();
  ribbonMesh.gid = "sh-lattice";
  SOLID_KINDS.forEach((key, kind) => {
    for (const [a, b] of solids.edges[key]) addStrip(ARC_SAMPLES, a, [Math.acos(b[2]), Math.atan2(b[1], b[0])], kind);
  });
  const tangentRadius = Math.atan(2) * 0.5;
  for (const c of solids.verts.ico) addStrip(SHELL_SAMPLES, c, [tangentRadius, 0], KIND_SHELL);
}

function primeState() {
  // Retained recording hook: geometry, camera and light are absolute functions of phase.
}
function updateLoopTime() {
  // Frames 0..599 sample [0,TAU); TAU matches frame 0 without duplicating it.
  const frame = isRecording ? recFrameCount : frameCount - 1;
  loopProgress = (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;
  if (!isRecording && typeof window !== "undefined" && typeof window.__phaseOverride === "number") {
    loopProgress = ((window.__phaseOverride / TAU) % 1 + 1) % 1;
  }
  phase = loopProgress * TAU;
  twistMix = .5 - .5 * Math.cos(3 * phase);
}
// Choreography: von Mises bumps around each state's centre, normalized to a partition of unity.
// Higher STATE_SHARPNESS = longer dwell on each solid, quicker morphs between them.
function computeStateWeights(phi, out) {
  let sum = 0;
  for (let k = 0; k < STATES.length; k++) {
    out[k] = Math.exp(STATE_SHARPNESS * (Math.cos(phi - STATES[k].center) - 1));
    sum += out[k];
  }
  for (let k = 0; k < STATES.length; k++) out[k] /= sum;
  return out;
}
function updateHarmonics() {
  computeStateWeights(phase, stateWeights);
  blendCoeffs.fill(0);
  ampNow = 0;
  for (let k = 0; k < STATES.length; k++) {
    const w = stateWeights[k], c = stateCoeffs[k];
    for (let i = 0; i < SH_N; i++) blendCoeffs[i] += w * c[i];
    ampNow += w * STATES[k].amp;
  }
  for (let i = 0; i < SH_N; i++) coeffUniform[i] = blendCoeffs[i] * SH_SCALE[i];
}
function updateCamera() {
  perspective(Math.PI / 3.35, W / H, 10, 8000);
  const yaw = .10 * Math.sin(phase);
  const elev = .07 * Math.sin(2 * phase);
  camera(CAM_DIST * Math.cos(elev) * Math.sin(yaw), -CAM_DIST * Math.sin(elev),
    CAM_DIST * Math.cos(elev) * Math.cos(yaw), 0, 0, 0, 0, 1, 0);
}
// Object pose: the shared 3-fold axis (1,1,1) faces the camera at every state peak
// (tilt ∝ 1−cos 3φ vanishes there), so each lattice reads as its hexagram / Metatron projection.
function applyObjectPose() {
  rotateX(TILT * twistMix);
  rotateY(.22 * Math.sin(3 * phase));
  rotateZ(phase);
  rotate(Math.acos(1 / Math.sqrt(3)), [1, -1, 0]);
}
function setHarmonicUniforms(sh) {
  sh.setUniform("uC", coeffUniform);
  sh.setUniform("uAmp", ampNow);
}

function draw() {
  updateLoopTime();
  updateHarmonics();
  background(BG_R, BG_G, BG_B);
  drawingContext.clear(drawingContext.DEPTH_BUFFER_BIT);
  updateCamera();
  push();
  translate(0, -55, 0);
  scale(OBJECT_SCALE);
  applyObjectPose();
  noStroke();
  drawingContext.depthMask(true);
  blendMode(BLEND);
  shader(coreShader);
  setHarmonicUniforms(coreShader);
  coreShader.setUniform("uInk", [INK_R / 255, INK_G / 255, INK_B / 255]);
  coreShader.setUniform("uBg", [BG_R / 255, BG_G / 255, BG_B / 255]);
  model(coreMesh);

  drawingContext.depthMask(false);
  blendMode(ADD);
  shader(ribbonShader);
  setHarmonicUniforms(ribbonShader);
  ribbonShader.setUniform("uPhase", phase);
  ribbonShader.setUniform("uW", stateWeights);
  ribbonShader.setUniform("uShellMix", .55 + .45 * twistMix);
  ribbonShader.setUniform("uShellSpin", -phase);
  ribbonShader.setUniform("uHalo", 0);
  model(ribbonMesh);
  ribbonShader.setUniform("uHalo", 1);
  model(ribbonMesh);
  resetShader();
  blendMode(BLEND);
  drawingContext.depthMask(true);
  pop();
  drawScreenFinish();
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
  grainPg = createGraphics(W, H);
  grainPg.pixelDensity(1);
  hudPg = createGraphics(W, H);
  hudPg.pixelDensity(1);
  bakeGrain();
  initShScale();
  solids = buildSolids();
  buildStateCoeffs();
  createCoreMesh();
  createRibbonMesh();
  coreShader = createShader(CORE_VERTEX, CORE_FRAGMENT);
  ribbonShader = createShader(RIBBON_VERTEX, RIBBON_FRAGMENT);

  const el = (id) => document.getElementById(id);
  if (el("startBtn")) el("startBtn").onclick = startRecording;
  if (el("stopBtn")) el("stopBtn").onclick = stopRecording;
  if (el("maxDuration")) el("maxDuration").textContent = MAX_DURATION;
  if (el("canvasSize")) el("canvasSize").textContent = W + " × " + H;
  if (el("maxFrames")) el("maxFrames").textContent = MAX_FRAMES;
  checkHarmonics();
}

// CPU checks: orthonormality, Platonic invariance, lobes on vertices, loop closure.
function checkHarmonics() {
  const y = new Float64Array(SH_N), samples = fibonacciSphere(20000);
  let maxOrtho = 0;
  const gram = new Float64Array(SH_N * SH_N);
  for (const n of samples) {
    shBasis(n[0], n[1], n[2], y);
    for (let i = 0; i < SH_N; i++) for (let j = i; j < SH_N; j++) gram[i * SH_N + j] += y[i] * y[j] * 4 * Math.PI / samples.length;
  }
  for (let i = 0; i < SH_N; i++) for (let j = i; j < SH_N; j++) maxOrtho = Math.max(maxOrtho, Math.abs(gram[i * SH_N + j] - (i === j ? 1 : 0)));
  const turn = (v, k, a) => {
    const c = Math.cos(a), s = Math.sin(a), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
    return [0, 1, 2].map((i) => v[i] * c + (k[(i + 1) % 3] * v[(i + 2) % 3] - k[(i + 2) % 3] * v[(i + 1) % 3]) * s + k[i] * d * (1 - c));
  };
  let maxSym = 0, minLobe = Infinity;
  STATES.forEach((state, k) => {
    const v = solids.verts[state.source], axis = v[0];
    const order = state.source === "ico" ? 5 : state.source === "oct" ? 4 : 3;
    for (let i = 0; i < 400; i++) {
      const n = samples[i * 37];
      maxSym = Math.max(maxSym, Math.abs(evalF(stateCoeffs[k], n, y) - evalF(stateCoeffs[k], turn(n, axis, TAU / order), y)));
    }
    for (const p of v) minLobe = Math.min(minLobe, evalF(stateCoeffs[k], p, y));
  });
  const w0 = computeStateWeights(0, [0, 0, 0]), w1 = computeStateWeights(TAU, [0, 0, 0]);
  const loopError = Math.max(...w0.map((w, i) => Math.abs(w - w1[i])), Math.abs(Math.sin(3 * TAU)), Math.abs(Math.sin(2 * TAU)), Math.abs(1 - Math.cos(3 * TAU)));
  const ok = maxOrtho < 2e-3 && maxSym < 1e-9 && minLobe > .9 && loopError < 1e-9;
  console[ok ? "log" : "error"]("HARMONIC CHECK", { ok, maxOrtho, maxSym, minLobe, loopError });
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

function drawScreenFinish() {
  const g = hudPg;
  let lead = 0;
  for (let k = 1; k < STATES.length; k++) if (stateWeights[k] > stateWeights[lead]) lead = k;
  const info = {
    label: STATES[lead].name + "  ·  l = " + STATES[lead].bands.join(","),
    note: "c(l,m) = MEAN OF Y(l,m) OVER THE SOLID'S VERTICES",
  };
  g.clear();
  g.image(grainPg, 0, 0);
  g.noFill();
  g.stroke(INK_R, INK_G, INK_B, 26);
  g.strokeWeight(0.7);
  const m = 34, l = 24;
  g.line(m, m, m + l, m); g.line(m, m, m, m + l);
  g.line(W - m, m, W - m - l, m); g.line(W - m, m, W - m, m + l);
  g.line(m, H - m, m + l, H - m); g.line(m, H - m, m, H - m - l);
  g.line(W - m, H - m, W - m - l, H - m); g.line(W - m, H - m, W - m, H - m - l);

  // Retained typography, safe-area anchors, and screen-finishing helpers.
  g.noStroke();
  g.textFont("ui-monospace, Menlo, Consolas, monospace");
  g.textAlign(CENTER, CENTER);
  g.textStyle(BOLD);
  g.fill(INK_R, INK_G, INK_B, 246);
  g.textSize(54);
  g.text("SPHERICAL HARMONICS", W * 0.5, SAFE_TOP + 30);
  g.textStyle(NORMAL);
  g.fill(INK_R, INK_G, INK_B, 122);
  g.textSize(24);
  g.text("THE HARMONIC SHADOW OF A PLATONIC SOLID", W * 0.5, SAFE_TOP + 86);
  g.fill(INK_R, INK_G, INK_B, 64);
  g.textSize(17);
  g.text("r(θ,φ,t) = R · [1 + A · Σ c(l,m) Y(l,m)]", W * 0.5, SAFE_TOP + 124);

  g.textAlign(LEFT, TOP);
  g.fill(INK_R, INK_G, INK_B, 78);
  g.textSize(19);
  g.text(info.label, SAFE_X, SAFE_TOP + 176);
  g.textAlign(RIGHT, TOP);
  g.text("WEIGHT / " + Math.round(stateWeights[lead] * 100) + "%", W - SAFE_X, SAFE_TOP + 176);

  // Three-segment track: each solid's share of the harmonic blend.
  const trackX = SAFE_X, trackY = SAFE_TOP + 220, trackW = W - SAFE_X * 2, seg = trackW / STATES.length, gap = 10;
  g.stroke(INK_R, INK_G, INK_B, 24);
  g.strokeWeight(1);
  g.line(trackX, trackY, trackX + trackW, trackY);
  for (let k = 0; k < STATES.length; k++) {
    const x0 = trackX + seg * k + gap, x1 = trackX + seg * (k + 1) - gap;
    g.stroke(INK_R, INK_G, INK_B, 20 + 150 * stateWeights[k]);
    g.strokeWeight(2.2);
    g.line(x0, trackY, x0 + (x1 - x0) * stateWeights[k], trackY);
  }
  g.noStroke();
  for (let k = 0; k <= STATES.length; k++) {
    g.fill(INK_R, INK_G, INK_B, k === lead ? 132 : 58);
    g.circle(trackX + seg * k, trackY, k === lead ? 6 : 4);
  }

  g.textAlign(CENTER, CENTER);
  g.fill(INK_R, INK_G, INK_B, 58 + 132 * (1 - twistMix));
  g.textSize(22);
  g.text(info.note, W * 0.5, SAFE_BOTTOM - 64);
  g.textSize(17);
  g.fill(INK_R, INK_G, INK_B, 96);
  g.text("ICOSA · OCTA · TETRA  ·  10 SECOND LOOP", W * 0.5, SAFE_BOTTOM - 32);

  if (debugFrame && !isRecording) {
    g.noFill();
    g.stroke(INK_R, INK_G, INK_B, 90);
    g.strokeWeight(1);
    g.rect(SAFE_X, SAFE_TOP, W - SAFE_X * 2, SAFE_BOTTOM - SAFE_TOP);
    g.line(SAFE_X, SAFE_TOP + 236, W - SAFE_X, SAFE_TOP + 236);
    g.line(SAFE_X, SAFE_BOTTOM - 80, W - SAFE_X, SAFE_BOTTOM - 80);
  }

  push();
  drawingContext.disable(drawingContext.DEPTH_TEST);
  resetMatrix();
  camera(0, 0, 1, 0, 0, 0, 0, 1, 0);
  ortho(-W * 0.5, W * 0.5, -H * 0.5, H * 0.5, -10, 10);
  noLights();
  blendMode(BLEND);
  image(g, -W * 0.5, -H * 0.5, W, H);
  drawingContext.enable(drawingContext.DEPTH_TEST);
  pop();
}

function keyReleased() {
  if (key === "r" || key === "R") {
    isRecording ? stopRecording() : startRecording();
    return false;
  }
  if (key === "s" || key === "S") {
    saveCanvas("spherical_harmonics_" + getTimestamp(), "png");
    return false;
  }
  if (key === "d" || key === "D") {
    debugFrame = !debugFrame;
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
  a.download = "spherical_harmonics_" + getTimestamp() + ".mp4";
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
