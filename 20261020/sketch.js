// Dini's surface × Metatron's Cube — thirteen twisted pseudospheres (K = −1/(a² + b²)) on the Fruit of Life.
//   x = a cos u sin v,  y = a sin u sin v,  z = a (cos v + ln tan(v/2)) + b u
// Seen down its axis each spire's outline is its cuspidal helix, the circle r = a. Spaced 2 apart on the
// hexagonal lattice, the thirteen outlines form the Fruit of Life and the 78 lines between their centres form
// Metatron's Cube. b → −b is the exact mirror image, so the rings alternate chirality and counter-rotate.
const W = 1080;
const H = 1920;
const FPS = 60;
const MAX_DURATION = 10;
const MAX_FRAMES = FPS * MAX_DURATION;
const LOOP_FRAMES = MAX_FRAMES;
const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const BG_R = 3, BG_G = 3, BG_B = 5;
const INK_R = 255, INK_G = 255, INK_B = 255;
// iPhone Reel safe area (1080x1920 source): Instagram crops ~97px per side to
// fill a 19.5:9 screen, its header covers the top ~250px, and caption / audio
// UI covers the bottom ~420px. All text and geometry stay inside these bounds.
const SAFE_X = 120, SAFE_TOP = 270, SAFE_BOTTOM = 1460;
const GEO_TOP = SAFE_TOP + 240, GEO_BOTTOM = SAFE_BOTTOM - 96;
let canvasEl = null, grainPg = null, hudPg = null, backdropPg = null;
let muxer = null, encoder = null, isRecording = false, recFrameCount = 0, recStartFrame = 0;
let loopProgress = 0, phase = 0;
let diniMesh, surfaceShader, ribbonShader, centreRibbons, spireRibbons, mandalaMesh;
let debugFrame = false;

// a² + b² = C² for every spire on every frame, so the twist animates while K stays −1/C².
const DINI = {
  C: 1,
  twist: 0.18,
  swing: 0.06,
  turns: 2,      // u ∈ [−turns·π, turns·π]
  vMin: 0.08,    // spire tip: z → −∞ as v → 0
  vMax: 2.0,     // a short lip past the cuspidal edge v = π/2
};
const MESH_ROWS = 72, MESH_COLS = 288;
const WIRE = { centrePerTurn: 6, spirePerTurn: 3, meridianSamples: 56, lipSamples: 6, parallelSamples: 240 };
const LINE_WEIGHT = 1.9, LINE_LIFT = 3.0;
// Axis lean: near-axial (Metatron's Cube) around the loop wrap, oblique over the spire field mid-loop.
// Long lens: the floor sits below the spires' cusps, so a near camera throws each outline off its floor circle.
// FOV narrows with distance so pixels per unit at the origin match the original 2300 / π/3.35 rig.
const TILT = 0.8, TILT_AXIAL = 1.42, SPIN_TURNS = 1, CAM_DIST = 4000;
const FOV = 2 * Math.atan(Math.tan(Math.PI / 6.7) * 2300 / CAM_DIST);
const FIT_MARGIN = 0.94, FIT_MARGIN_AXIAL = 0.92, FIT_DROP = 0, FIT_TAIL = 0.5;
const KIND = { MERIDIAN: 0, CUSP: 1, BOUND: 2, CIRCLE: 3, SEG: 4, SHADOW: 5 };

// Fruit of Life: the centre, six at distance 2 and six at distance 4 along the hexagonal axes (units of C).
// Entries are [x, y, ring]. Metatron's Cube joins every pair of the thirteen centres.
const SPIRES = [[0, 0, 0]];
for (let k = 0; k < 6; k++) {
  const t = k * TAU / 6;
  SPIRES.push([2 * Math.cos(t), 2 * Math.sin(t), 1], [4 * Math.cos(t), 4 * Math.sin(t), 2]);
}
const METATRON = [];
for (let i = 0; i < SPIRES.length; i++) for (let j = i + 1; j < SPIRES.length; j++) METATRON.push([i, j]);
// Centre and outer ring right-handed, inner ring left-handed; ring k's twist breathes k·120° late (outward ripple).
const CHIRALITY = [1, -1, 1];
const MANDALA = { rings: [5.2, 5.32], ringSamples: 256, shadowSamples: 128 };

const frameState = {
  a: 1, b: 0, K: -1, tilt: TILT, axial: 0, mandala: 1, density: 0, yaw: 0, elev: 0, light: [0, 0, 1],
  spires: SPIRES.map(() => ({ a: 1, b: 0, spin: 0 })),
};
const fit = { zc: 0, floor: 0, side: null, axial: null };
const view = { scale: 100, offsetX: 0, offsetY: 0, fogNear: 2000, fogSpan: 600 };

function uRange() { return [-DINI.turns * Math.PI, DINI.turns * Math.PI]; }
function profileZ(v) { return Math.cos(v) + Math.log(Math.tan(v / 2)); }
function diniPoint(u, v, a, b, spin) {
  const s = Math.sin(v), w = u + spin;
  return [a * Math.cos(w) * s, a * Math.sin(w) * s, a * profileZ(v) + b * u];
}
// r_u × (r_v / a cos v): finite on the cusp v = π/2, where r_v itself vanishes.
function diniNormal(u, v, a, b, spin) {
  const s = Math.sin(v), w = u + spin;
  return cross([-a * Math.sin(w) * s, a * Math.cos(w) * s, b], [Math.cos(w), Math.sin(w), Math.cos(v) / s]);
}
// Signed meridian arc length in units of a: σ = ln sin v below the cusp, −ln sin v above.
function arcSigma(v) { return v <= HALF_PI ? Math.log(Math.sin(v)) : -Math.log(Math.sin(v)); }
function arcToV(sigma) { return sigma === 0 ? HALF_PI : sigma < 0 ? Math.asin(Math.exp(sigma)) : Math.PI - Math.asin(Math.exp(-sigma)); }
function cross(p, q) { return [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]]; }
function dot(p, q) { return p[0] * q[0] + p[1] * q[1] + p[2] * q[2]; }
function smoothstep(e0, e1, x) { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); }

// How strongly the spires' meridians read over one loop, p ∈ [0,1) → [0,1].
// 0 = cusp helices and outlines only (the mandala reads clean), 1 = full construction lines on every spire.
// Must equal 0 with zero slope at p = 0 and p = 1, or the Reel snaps at the wrap.
function densityEnvelope(p) {
  return smoothstep(0.05, 0.2, p) * (1 - smoothstep(0.8, 0.97, p));
}

function computeFrameState(p) {
  const ph = p * TAU;
  SPIRES.forEach(([, , ring], i) => {
    const s = frameState.spires[i], mag = DINI.twist + DINI.swing * Math.cos(ph - ring * TAU / 3);
    s.b = CHIRALITY[ring] * mag;
    s.a = Math.sqrt(DINI.C * DINI.C - mag * mag);
    s.spin = -CHIRALITY[ring] * SPIN_TURNS * ph;
  });
  frameState.a = frameState.spires[0].a;
  frameState.b = frameState.spires[0].b;
  frameState.K = -1 / (frameState.a * frameState.a + frameState.b * frameState.b);
  frameState.density = densityEnvelope(p);
  // Held near-axial for 1 s either side of the wrap, flat at the seam, oblique 3–7 s.
  const d = Math.min(p, 1 - p);
  frameState.axial = 1 - smoothstep(0.1, 0.3, d);
  frameState.tilt = TILT + (TILT_AXIAL - TILT) * frameState.axial;
  frameState.mandala = 0.55 + 0.45 * frameState.axial;
  frameState.yaw = 0.16 * Math.sin(ph);
  frameState.elev = 0.06 * Math.sin(2 * ph);
  const az = -1.05 + 0.4 * Math.sin(ph), el = 0.42 + 0.1 * Math.sin(2 * ph);
  frameState.light = [Math.cos(el) * Math.sin(az), -Math.sin(el), Math.cos(el) * Math.cos(az)];
}

// Same transform as place() in GLSL + rotateX(−tilt): (x, y, z) → (x, z − zc, y) puts the tips up and
// mirrors once (cancelling p5's left-handed y-down view, so b > 0 stays right-handed on screen).
function posePoint(r, cx, cy, out) {
  const x = r[0] + cx, y = r[2] - fit.zc, z = r[1] + cy;
  const c = Math.cos(-frameState.tilt), s = Math.sin(-frameState.tilt);
  out[0] = x; out[1] = c * y - s * z; out[2] = s * y + c * z;
  return out;
}

// Two framings, each solved once at a fixed tilt over the phases where it is in use (never per frame, so the
// twist still reads as motion): the mandala (near-axial) and the spire field (oblique), each keeping the
// floor's outer ring inside the safe box. draw() dollies between them on the same envelope as the tilt.
function solveFraming(tilt, withRing, drop, margin, pFrom, pTo) {
  // The last FIT_TAIL of arc length is the faded spire tip; it may run into the box's slack.
  const [u0, u1] = uRange(), s0 = arcSigma(DINI.vMin) + FIT_TAIL, s1 = arcSigma(DINI.vMax);
  const nu = 40, nv = 14, samples = 24, q = [0, 0, 0];
  let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity, dLo = Infinity, dHi = -Infinity;
  const add = () => {
    xLo = Math.min(xLo, q[0]); xHi = Math.max(xHi, q[0]);
    yLo = Math.min(yLo, q[1]); yHi = Math.max(yHi, q[1]);
    dLo = Math.min(dLo, q[2]); dHi = Math.max(dHi, q[2]);
  };
  for (let k = 0; k <= samples; k++) {
    computeFrameState((((pFrom + (pTo - pFrom) * k / samples) % 1) + 1) % 1);
    frameState.tilt = tilt;
    SPIRES.forEach(([cx, cy], n) => {
      const sp = frameState.spires[n];
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
        posePoint(diniPoint(u0 + (u1 - u0) * i / nu, arcToV(s0 + (s1 - s0) * j / nv), sp.a, sp.b, sp.spin), cx, cy, q);
        add();
      }
    });
    if (!withRing) continue;
    const R = MANDALA.rings[1];
    for (let i = 0; i < 96; i++) {
      posePoint([R * Math.cos(TAU * i / 96), R * Math.sin(TAU * i / 96), fit.floor], 0, 0, q);
      add();
    }
  }
  const pxPerUnit = H / (2 * Math.tan(FOV / 2) * CAM_DIST);
  const scale = margin * Math.min((W - 2 * SAFE_X) / pxPerUnit / (xHi - xLo), (GEO_BOTTOM - GEO_TOP) / pxPerUnit / (yHi - yLo));
  return {
    scale,
    offsetX: -scale * (xLo + xHi) / 2,
    offsetY: ((GEO_TOP + GEO_BOTTOM) / 2 + drop - H / 2) / pxPerUnit - scale * (yLo + yHi) / 2,
    fogNear: CAM_DIST - scale * dHi,
    fogSpan: 1.15 * scale * (dHi - dLo),
  };
}
function fitStage() {
  // Floor = the lowest point of any spire (largest z), so every spire stands on it.
  const [u0, u1] = uRange(), s0 = arcSigma(DINI.vMin) + FIT_TAIL;
  let zLo = Infinity, zHi = -Infinity;
  for (let k = 0; k < 48; k++) {
    computeFrameState(k / 48);
    for (const sp of frameState.spires) for (let j = 0; j <= 48; j++) for (const u of [u0, u1]) {
      const z = diniPoint(u, arcToV(s0 + (arcSigma(DINI.vMax) - s0) * j / 48), sp.a, sp.b, 0)[2];
      zLo = Math.min(zLo, z); zHi = Math.max(zHi, z);
    }
  }
  fit.floor = zHi + 0.02;
  fit.zc = (zLo + fit.floor) / 2;
  fit.side = solveFraming(TILT, true, FIT_DROP, FIT_MARGIN, 0.2, 0.8);
  fit.axial = solveFraming(TILT_AXIAL, true, 0, FIT_MARGIN_AXIAL, -0.2, 0.2);
  computeFrameState(0);
}

// Line-by-line port of diniPoint() / diniNormal() / posePoint()'s axis map, per spire via uCenter.
const DINI_GLSL = `
uniform float uA;
uniform float uB;
uniform float uSpin;
uniform vec2 uCenter;
uniform float uScale;
uniform float uZc;
uniform float uFloor;
uniform float uFogNear;
uniform float uFogSpan;
vec3 place(vec3 r) { return vec3(r.x + uCenter.x, r.z - uZc, r.y + uCenter.y)*uScale; }
vec3 diniPoint(float u, float v) {
  float s = sin(v), w = u + uSpin;
  return place(vec3(uA*cos(w)*s, uA*sin(w)*s, uA*(cos(v) + log(tan(.5*v))) + uB*u));
}
vec3 diniNormal(float u, float v) {
  float s = sin(v), w = u + uSpin;
  vec3 n = cross(vec3(-uA*sin(w)*s, uA*cos(w)*s, uB), vec3(cos(w), sin(w), cos(v)/s));
  return vec3(n.x, n.z, n.y);
}
vec3 floorPoint(vec2 xy) { return place(vec3(xy, uFloor)); }
float sigmaToV(float sg) { return sg < 0. ? asin(exp(sg)) : 3.141592653589793 - asin(exp(-sg)); }
float fogDepth(vec4 eye) { return clamp(1. - (-eye.z - uFogNear)/uFogSpan, .30, 1.); }
`;

const SURFACE_VERTEX = `#version 300 es
precision highp float;
in vec3 aPosition;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec2 uURange;
out vec3 vNormal;
out vec3 vEye;
out float vFog;
out float vSigma;
${DINI_GLSL}
void main() {
  float u = mix(uURange.x, uURange.y, aPosition.x), v = aPosition.y;
  vec4 eye = uModelViewMatrix*vec4(diniPoint(u, v), 1.);
  vNormal = mat3(uModelViewMatrix)*diniNormal(u, v);
  vEye = eye.xyz; vFog = fogDepth(eye); vSigma = aPosition.z;
  gl_Position = uProjectionMatrix*eye;
}
`;
const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vEye;
in float vFog;
in float vSigma;
uniform vec3 uInk;
uniform vec3 uBg;
uniform vec3 uLight;
uniform float uFocus;
out vec4 fragColor;
void main() {
  vec3 N = normalize(vNormal), V = normalize(-vEye), L = normalize(uLight);
  // Two-sided: the face the continuous normal points away from is the dimmer "inside".
  float side = 1.;
  if (dot(N, V) < 0.) { N = -N; side = .42; }
  float ndv = max(dot(N, V), 0.);
  // Wrapped key: the flare rolls from light into shadow instead of cutting off at the terminator.
  float wrap = max((dot(N, L) + .4)/1.4, 0.);
  float diff = wrap*wrap;
  float nh = max(dot(N, normalize(L + V)), 0.);
  float sheen = .16*pow(nh, 18.) + .55*pow(nh, 180.);
  float fres = pow(1. - ndv, 3.2);
  float sky = .5 - .5*N.y;
  // Tip occlusion: the spire darkens toward its tip, the cusp lip stays lit.
  float throat = mix(.22, 1., smoothstep(-2.4, -.25, vSigma));
  float c = ((.018 + .74*diff + .05*sky)*throat + .42*fres*mix(.5, 1., throat) + sheen*throat)*side*vFog*uFocus;
  c = 1. - exp(-1.35*c);
  fragColor = vec4(mix(uBg, uInk, c), 1.);
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
uniform float uDensity;
uniform float uGhost;
uniform float uMandala;
uniform float uFocus;
uniform vec3 uLight;
out float vEdge;
out float vLight;
out float vGlow;
const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;
${DINI_GLSL}
// Spire strips: a straight segment in (u, σ) from aNormal.xy to aTexCoord, lifted onto the surface.
// Floor strips: circles (centre aNormal.xy, radius aNormal.z, angles aTexCoord), segments, or the spire's
// own cusp outline r = a (SHADOW), all in the plane z = uFloor.
vec3 ribbonPoint(float s, int kind) {
  if (kind == ${KIND.CIRCLE}) { float t = mix(aTexCoord.x, aTexCoord.y, s); return floorPoint(aNormal.xy + aNormal.z*vec2(cos(t), sin(t))); }
  if (kind == ${KIND.SHADOW}) { float t = mix(aTexCoord.x, aTexCoord.y, s); return floorPoint(uA*vec2(cos(t), sin(t))); }
  if (kind == ${KIND.SEG}) return floorPoint(mix(aNormal.xy, aTexCoord, s));
  return diniPoint(mix(aNormal.x, aTexCoord.x, s), sigmaToV(mix(aNormal.y, aTexCoord.y, s)));
}
void main() {
  float s = aPosition.x;
  int kind = int(aPosition.z + .5);
  bool planar = kind >= ${KIND.CIRCLE};
  vec3 p = ribbonPoint(s, kind);
  vec3 tangent = ribbonPoint(min(s + .004, 1.), kind) - ribbonPoint(max(s - .004, 0.), kind);
  float light = .26, glow = .10, width = .7, weight = 1., floorLit = .12;
  if (kind == ${KIND.MERIDIAN}) { light = .58; glow = .2; width = .9; weight = .5 + .5*uDensity; }
  else if (kind == ${KIND.CUSP}) { light = .78; glow = .7; width = 1.4; floorLit = .65; }
  else if (kind == ${KIND.BOUND}) { light = .62; glow = .26; width = 1.; floorLit = .3; }
  else if (kind == ${KIND.CIRCLE}) { light = .34; glow = .10; width = .62; weight = uMandala; }
  else if (kind == ${KIND.SHADOW}) { light = .36; glow = .10; width = .6; weight = uMandala; }
  else if (kind == ${KIND.SEG}) { light = .2; glow = 0.; width = .48; weight = uMandala; }
  if (!planar) { light *= uFocus; glow *= uFocus; }
  float bead = 0.;
  if (kind == ${KIND.MERIDIAN}) {
    // Pulse climbing each tractrix from lip to tip; aNormal.z staggers it into a rising spiral.
    bead = pow(max(0., cos(PI*(s - aNormal.z - 2.*uPhase/TAU))), 60.);
    glow += .45*bead; width += .9*bead;
  }
  // Every spire line converges on the tip; fade them before ADD piles them into a white bar.
  // Planar kinds never reach sigmaToV/diniNormal (asin > 1 would NaN the vertex).
  float v = 0.;
  if (!planar) {
    v = sigmaToV(mix(aNormal.y, aTexCoord.y, s));
    if (kind != ${KIND.CUSP}) weight *= smoothstep(.07, .45, sin(v));
  }
  weight = pow(weight, 1.35);
  vec4 eye = uModelViewMatrix*vec4(p, 1.);
  // The floor is the farthest layer at the axial hook; keep it out of the fog floor.
  float depth = planar ? max(fogDepth(eye), .85) : fogDepth(eye);
  if (!planar) {
    // Lines are engraved into the lit surface: they catch the key light and sink into shadow.
    vec3 nEye = normalize(mat3(uModelViewMatrix)*diniNormal(mix(aNormal.x, aTexCoord.x, s), v));
    if (dot(nEye, -eye.xyz) < 0.) nEye = -nEye;
    float wrap = max((dot(nEye, normalize(uLight)) + .4)/1.4, 0.);
    light *= floorLit + (1. - floorLit)*wrap*wrap;
  }
  light += .5*bead;
  if (uGhost > .5) {
    // Hidden-line pass: only the floor figure and the cusp helices, a whisper through the spires.
    weight *= planar ? .3 : kind == ${KIND.CUSP} ? .06 : 0.;
    light = planar ? .3 : 1.;
  }
  // Slide toward the eye along the view ray: no screen shift, clears the faceted surface depth.
  // Hidden spire lines lift far more, so GREATER only passes lines truly behind another sheet, not grazing facets.
  float lift = uGhost > .5 && !planar ? 25. : ${LINE_LIFT.toFixed(2)};
  eye.xyz += normalize(-eye.xyz)*lift;
  vec3 dirEye = mat3(uModelViewMatrix)*tangent;
  dirEye /= max(length(dirEye), 1e-6);
  vec3 crossEye = cross(dirEye, normalize(eye.xyz));
  vec3 side = crossEye/max(length(crossEye), .0001);
  vLight = light*depth*weight; vGlow = glow*depth*weight; vEdge = aPosition.y;
  gl_Position = uProjectionMatrix*vec4(eye.xyz + side*aPosition.y*width*${LINE_WEIGHT.toFixed(2)}*(1. + uHalo*5.), 1.);
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

// (u, v) lattice: aPosition = (u01, v, σ). Rows are evenly spaced in meridian arc length σ
// and one row sits exactly on σ = 0, so the cuspidal fold stays a sharp crease.
function createDiniMesh() {
  diniMesh = new p5.Geometry();
  diniMesh.gid = "dini-surface";
  const s0 = arcSigma(DINI.vMin), s1 = arcSigma(DINI.vMax);
  const upper = Math.max(2, Math.round(MESH_ROWS * s1 / (s1 - s0)));
  const sigmas = [];
  for (let j = 0; j < MESH_ROWS - upper; j++) sigmas.push(s0 * (1 - j / (MESH_ROWS - upper)));
  for (let j = 0; j <= upper; j++) sigmas.push(s1 * j / upper);
  for (const sigma of sigmas) {
    const v = arcToV(sigma);
    for (let i = 0; i <= MESH_COLS; i++) diniMesh.vertices.push(new p5.Vector(i / MESH_COLS, v, sigma));
  }
  const row = MESH_COLS + 1;
  for (let j = 0; j < sigmas.length - 1; j++) {
    for (let i = 0; i < MESH_COLS; i++) {
      const k = j * row + i;
      diniMesh.faces.push([k, k + row, k + row + 1], [k, k + row + 1, k + 1]);
    }
  }
  diniMesh.cuspRow = sigmas.indexOf(0) >= 0;
}
// aPosition = (s, side, kind), aNormal = (start.xy, bead/radius), aTexCoord = end.
function addStrip(g, samples, a, b, kind, extra = 0) {
  const start = g.vertices.length;
  for (let s = 0; s <= samples; s++) {
    const t = s / samples;
    g.vertices.push(new p5.Vector(t, -1, kind), new p5.Vector(t, 1, kind));
    g.vertexNormals.push(new p5.Vector(a[0], a[1], extra), new p5.Vector(a[0], a[1], extra));
    g.uvs.push(b[0], b[1], b[0], b[1]);
    if (s < samples) {
      const k = start + s * 2;
      g.faces.push([k, k + 1, k + 2], [k + 1, k + 3, k + 2]);
    }
  }
}
// One spire's lines in its own (u, σ) coordinates; the same mesh is drawn at every centre via uniforms.
function createSpireRibbons(perTurn, gid) {
  const g = new p5.Geometry();
  g.gid = gid;
  const [u0, u1] = uRange(), s0 = arcSigma(DINI.vMin), s1 = arcSigma(DINI.vMax);
  const count = Math.round(perTurn * DINI.turns);
  for (let j = 0; j <= count; j++) {
    const u = u0 + (u1 - u0) * j / count;
    const kind = j === 0 || j === count ? KIND.BOUND : KIND.MERIDIAN;
    // Split at σ = 0 so a sample lands exactly on the cusp of every tractrix.
    addStrip(g, WIRE.meridianSamples, [u, s0], [u, 0], kind, (j / count) * DINI.turns);
    addStrip(g, WIRE.lipSamples, [u, 0], [u, s1], KIND.BOUND);
  }
  addStrip(g, WIRE.parallelSamples, [u0, 0], [u1, 0], KIND.CUSP);
  addStrip(g, WIRE.parallelSamples, [u0, s1], [u1, s1], KIND.BOUND);
  addStrip(g, MANDALA.shadowSamples, [0, 0], [0, TAU], KIND.SHADOW);
  return g;
}
function createMandalaMesh() {
  mandalaMesh = new p5.Geometry();
  mandalaMesh.gid = "metatron";
  for (const [i, j] of METATRON) addStrip(mandalaMesh, 2, SPIRES[i], SPIRES[j], KIND.SEG);
  for (const r of MANDALA.rings) addStrip(mandalaMesh, MANDALA.ringSamples, [0, 0], [0, TAU], KIND.CIRCLE, r);
}

function primeState() {
  // Retained recording hook: geometry, camera and light are absolute functions of phase.
}
function updateLoopTime() {
  // Frames 0..599 sample [0,TAU); TAU matches frame 0 without duplicating it.
  const frame = isRecording ? recStartFrame + recFrameCount : frameCount - 1;
  loopProgress = (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;
  if (!isRecording && typeof window !== "undefined" && typeof window.__phaseOverride === "number") {
    loopProgress = ((window.__phaseOverride / TAU) % 1 + 1) % 1;
  }
  phase = loopProgress * TAU;
  computeFrameState(loopProgress);
}
function updateCamera() {
  perspective(FOV, W / H, 10, 12000);
  const yaw = frameState.yaw, elev = frameState.elev;
  camera(CAM_DIST * Math.cos(elev) * Math.sin(yaw), -CAM_DIST * Math.sin(elev),
    CAM_DIST * Math.cos(elev) * Math.cos(yaw), 0, 0, 0, 0, 1, 0);
}
// Dolly between the two framings; scale blends in log space so the zoom speed reads even.
function updateView() {
  const m = frameState.axial, A = fit.axial, S = fit.side;
  view.scale = Math.exp(Math.log(S.scale) + (Math.log(A.scale) - Math.log(S.scale)) * m);
  for (const key of ["offsetX", "offsetY", "fogNear", "fogSpan"]) view[key] = S[key] + (A[key] - S[key]) * m;
}
// Fresh arrays per call: every spire must upload its own centre.
function setSpireUniforms(sh, n) {
  const sp = frameState.spires[n];
  sh.setUniform("uA", sp.a);
  sh.setUniform("uB", sp.b);
  sh.setUniform("uSpin", sp.spin);
  sh.setUniform("uCenter", [SPIRES[n][0], SPIRES[n][1]]);
  sh.setUniform("uFocus", n === 0 ? 1 : 0.8);
  sh.setUniform("uScale", view.scale);
  sh.setUniform("uZc", fit.zc);
  sh.setUniform("uFloor", fit.floor);
  sh.setUniform("uFogNear", view.fogNear);
  sh.setUniform("uFogSpan", view.fogSpan);
}
function setFloorUniforms(sh) {
  setSpireUniforms(sh, 0);
  sh.setUniform("uCenter", [0, 0]);
}

function draw() {
  updateLoopTime();
  background(BG_R, BG_G, BG_B);
  drawScreenImage(backdropPg);
  drawingContext.clear(drawingContext.DEPTH_BUFFER_BIT);
  updateCamera();
  push();
  updateView();
  translate(view.offsetX, view.offsetY, 0);
  rotateX(-frameState.tilt);
  noStroke();
  drawingContext.depthMask(true);
  blendMode(BLEND);
  // Every surface writes depth before any line pass, so lines of one spire hide behind the next.
  shader(surfaceShader);
  surfaceShader.setUniform("uURange", uRange());
  surfaceShader.setUniform("uInk", [INK_R / 255, INK_G / 255, INK_B / 255]);
  surfaceShader.setUniform("uBg", [BG_R / 255, BG_G / 255, BG_B / 255]);
  surfaceShader.setUniform("uLight", frameState.light);
  for (let n = 0; n < SPIRES.length; n++) {
    setSpireUniforms(surfaceShader, n);
    model(diniMesh);
  }

  drawingContext.depthMask(false);
  blendMode(ADD);
  shader(ribbonShader);
  ribbonShader.setUniform("uPhase", phase);
  ribbonShader.setUniform("uDensity", frameState.density);
  ribbonShader.setUniform("uLight", frameState.light);
  ribbonShader.setUniform("uMandala", frameState.mandala);
  // Passes: hidden lines (GREATER), visible lines, halo.
  for (const [ghost, halo] of [[1, 0], [0, 0], [0, 1]]) {
    drawingContext.depthFunc(ghost ? drawingContext.GREATER : drawingContext.LEQUAL);
    ribbonShader.setUniform("uGhost", ghost);
    ribbonShader.setUniform("uHalo", halo);
    setFloorUniforms(ribbonShader);
    model(mandalaMesh);
    for (let n = 0; n < SPIRES.length; n++) {
      setSpireUniforms(ribbonShader, n);
      model(n === 0 ? centreRibbons : spireRibbons);
    }
  }
  drawingContext.depthFunc(drawingContext.LEQUAL);
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
  backdropPg = createGraphics(W, H);
  backdropPg.pixelDensity(1);
  fitStage();
  bakeBackdrop();
  createDiniMesh();
  centreRibbons = createSpireRibbons(WIRE.centrePerTurn, "dini-centre-lines");
  spireRibbons = createSpireRibbons(WIRE.spirePerTurn, "dini-spire-lines");
  createMandalaMesh();
  surfaceShader = createShader(SURFACE_VERTEX, SURFACE_FRAGMENT);
  ribbonShader = createShader(RIBBON_VERTEX, RIBBON_FRAGMENT);

  const el = (id) => document.getElementById(id);
  if (el("startBtn")) el("startBtn").onclick = startRecording;
  if (el("stopBtn")) el("stopBtn").onclick = stopRecording;
  if (el("maxDuration")) el("maxDuration").textContent = MAX_DURATION;
  if (el("canvasSize")) el("canvasSize").textContent = W + " × " + H;
  if (el("maxFrames")) el("maxFrames").textContent = MAX_FRAMES;
  checkDini();
}

// CPU checks: K constant under the twist sweep, equal-area element, finite cusp normals, cusp row,
// mirror claim for b → −b, Fruit of Life spacing / no interpenetration, Metatron line count, loop closure.
function checkDini() {
  const h = 1e-4, us = [-5.1, -1.3, 0.4, 2.2, 5.6], vs = [0.25, 0.7, 1.2, 1.45, 1.75, 1.95];
  let maxKErr = 0, minCuspNormal = Infinity, maxAreaErr = 0, maxMirror = 0, minClearance = Infinity;
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  for (let k = 0; k < 16; k++) {
    computeFrameState(k / 16);
    const { a, b } = frameState, P = (u, v) => diniPoint(u, v, a, b, 0);
    for (const u of us) for (const v of vs) {
      const c = P(u, v), pu = P(u + h, v), mu = P(u - h, v), pv = P(u, v + h), mv = P(u, v - h);
      const ru = sub(pu, mu).map((x) => x / (2 * h)), rv = sub(pv, mv).map((x) => x / (2 * h));
      const ruu = [0, 1, 2].map((i) => (pu[i] - 2 * c[i] + mu[i]) / (h * h));
      const rvv = [0, 1, 2].map((i) => (pv[i] - 2 * c[i] + mv[i]) / (h * h));
      const ruv = sub(sub(P(u + h, v + h), P(u + h, v - h)), sub(P(u - h, v + h), P(u - h, v - h))).map((x) => x / (4 * h * h));
      const n = cross(ru, rv), nl = Math.hypot(...n), N = n.map((x) => x / nl);
      const E = dot(ru, ru), F = dot(ru, rv), G = dot(rv, rv), L = dot(ruu, N), M = dot(ruv, N), Nn = dot(rvv, N);
      maxKErr = Math.max(maxKErr, Math.abs((L * Nn - M * M) / (E * G - F * F) - frameState.K) / Math.abs(frameState.K));
      maxAreaErr = Math.max(maxAreaErr, Math.abs(nl - a * DINI.C * Math.abs(Math.cos(v))) / (a * DINI.C * Math.abs(Math.cos(v))));
      const m = diniPoint(-u, v, a, -b, 0);
      maxMirror = Math.max(maxMirror, Math.abs(m[0] - c[0]), Math.abs(m[1] + c[1]), Math.abs(m[2] - c[2]));
    }
    for (const u of us) minCuspNormal = Math.min(minCuspNormal, Math.hypot(...diniNormal(u, HALF_PI, a, b, 0)));
    for (const [i, j] of METATRON) {
      const d = Math.hypot(SPIRES[i][0] - SPIRES[j][0], SPIRES[i][1] - SPIRES[j][1]);
      minClearance = Math.min(minClearance, d - frameState.spires[i].a - frameState.spires[j].a);
    }
  }
  let minSpacing = Infinity;
  for (const [i, j] of METATRON) minSpacing = Math.min(minSpacing, Math.hypot(SPIRES[i][0] - SPIRES[j][0], SPIRES[i][1] - SPIRES[j][1]));
  computeFrameState(1);
  const end = JSON.parse(JSON.stringify(frameState));
  computeFrameState(0);
  const loopError = Math.max(Math.abs(end.density - frameState.density), Math.abs(end.yaw - frameState.yaw),
    Math.abs(end.elev - frameState.elev), Math.abs(end.tilt - frameState.tilt),
    ...end.light.map((x, i) => Math.abs(x - frameState.light[i])),
    ...end.spires.map((s, i) => Math.max(Math.abs(s.b - frameState.spires[i].b), Math.abs(Math.sin((s.spin - frameState.spires[i].spin) / 2)))));
  const ok = maxKErr < 1e-3 && maxAreaErr < 1e-4 && maxMirror < 1e-12 && minCuspNormal > 1e-3 && diniMesh.cuspRow &&
    SPIRES.length === 13 && METATRON.length === 78 && Math.abs(minSpacing - 2) < 1e-9 && minClearance > 0 && loopError < 1e-9;
  console[ok ? "log" : "error"]("DINI CHECK", { ok, spires: SPIRES.length, lines: METATRON.length, minSpacing, minClearance,
    maxMirror, maxKErr, maxAreaErr, minCuspNormal, cuspRow: diniMesh.cuspRow, loopError, side: fit.side, axial: fit.axial });
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
  const g = hudPg, { a, b, K, density } = frameState;
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
  g.text("DINI'S SURFACE", W * 0.5, SAFE_TOP + 30);
  g.textStyle(NORMAL);
  g.fill(INK_R, INK_G, INK_B, 122);
  g.textSize(24);
  g.text("METATRON'S CUBE · FRUIT OF LIFE", W * 0.5, SAFE_TOP + 86);
  g.fill(INK_R, INK_G, INK_B, 64);
  g.textSize(17);
  g.text("r(u,v) = (a cos u sin v, a sin u sin v, a(cos v + ln tan ½v) + b u)", W * 0.5, SAFE_TOP + 124);

  g.textAlign(LEFT, TOP);
  g.fill(INK_R, INK_G, INK_B, 78);
  g.textSize(19);
  g.text("a = " + a.toFixed(3) + "  ·  b = " + b.toFixed(3), SAFE_X, SAFE_TOP + 176);
  g.textAlign(RIGHT, TOP);
  g.text("K = −1/(a²+b²) = " + K.toFixed(3).replace("-", "−"), W - SAFE_X, SAFE_TOP + 176);

  // Twist track: b between its tightest and most open value.
  const trackX = SAFE_X, trackY = SAFE_TOP + 220, trackW = W - SAFE_X * 2;
  const tb = (b - (DINI.twist - DINI.swing)) / (2 * DINI.swing);
  g.stroke(INK_R, INK_G, INK_B, 24);
  g.strokeWeight(1);
  g.line(trackX, trackY, trackX + trackW, trackY);
  g.stroke(INK_R, INK_G, INK_B, 20 + 150 * tb);
  g.strokeWeight(2.2);
  g.line(trackX, trackY, trackX + trackW * tb, trackY);
  g.noStroke();
  g.fill(INK_R, INK_G, INK_B, 58);
  g.circle(trackX, trackY, 4);
  g.circle(trackX + trackW, trackY, 4);
  g.fill(INK_R, INK_G, INK_B, 132);
  g.circle(trackX + trackW * tb, trackY, 6);

  g.textAlign(CENTER, CENTER);
  g.fill(INK_R, INK_G, INK_B, 58 + 132 * (1 - density));
  g.textSize(22);
  g.text("13 CUSP OUTLINES, SEEN DOWN THE AXES = FRUIT OF LIFE", W * 0.5, SAFE_BOTTOM - 64);
  g.textSize(17);
  g.fill(INK_R, INK_G, INK_B, 96);
  g.text("78 LINES · CHIRALITY ±b BY RING · K = −1/(a²+b²) · 10 SECOND LOOP", W * 0.5, SAFE_BOTTOM - 32);

  if (debugFrame && !isRecording) {
    g.noFill();
    g.stroke(INK_R, INK_G, INK_B, 90);
    g.strokeWeight(1);
    g.rect(SAFE_X, SAFE_TOP, W - SAFE_X * 2, SAFE_BOTTOM - SAFE_TOP);
    g.line(SAFE_X, GEO_TOP, W - SAFE_X, GEO_TOP);
    g.line(SAFE_X, GEO_BOTTOM, W - SAFE_X, GEO_BOTTOM);
  }

  drawScreenImage(g);
}

// Static backdrop: a faint ink bloom behind the sculpture, corners left at exact BG.
function bakeBackdrop() {
  const ctx = backdropPg.drawingContext, cy = (GEO_TOP + GEO_BOTTOM) / 2 + FIT_DROP;
  const grad = ctx.createRadialGradient(W / 2, cy - 60, 0, W / 2, cy, 760);
  grad.addColorStop(0, "rgba(255,255,255,0.055)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.022)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  backdropPg.clear();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawScreenImage(g) {
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
    saveCanvas("dini_metatron_" + getTimestamp(), "png");
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
  // Continue from the frame on screen; any LOOP_FRAMES-long window is still a seamless loop.
  recStartFrame = frameCount;
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
  a.download = "dini_metatron_" + getTimestamp() + ".mp4";
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
