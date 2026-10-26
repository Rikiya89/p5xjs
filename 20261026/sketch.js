// Boy's Surface / Impossible Geometry — the Bryant–Kusner immersion of the real projective plane (see boy.js).
// The surface is never deformed: one static mesh, built once per resolution. Only spin, tilt, camera breath,
// light and the travelling bands move. The loop is 600 frames at 60 fps and the spin advances exactly 120°
// per loop, so the surface's own threefold symmetry closes the loop instead of a full turn.
const W = 1080;
const H = 1920;
const FPS = 60;
const MAX_DURATION = 10;
const LOOP = FPS * MAX_DURATION;
const TAU = Math.PI * 2;
const BG = [3 / 255, 3 / 255, 5 / 255];
const SILVER = [1, 1, 1];
// 20261019 palette: CYAN on the side the local normal faces, MAGENTA on the other, ACID on the seam |w| = 1.
const CYAN = [0 / 255, 229 / 255, 255 / 255];
const MAGENTA = [255 / 255, 61 / 255, 191 / 255];
const ACID = [182 / 255, 255 / 255, 61 / 255];
// Geometry band as in 20261019's stage: below the loop track (y 418), above the story captions (y 1322).
const GEO_TOP = 468, GEO_BOTTOM = 1282;
const FRAME_CY = (GEO_TOP + GEO_BOTTOM) / 2;
const FIT_W = 0.74 * W, FIT_H = GEO_BOTTOM - GEO_TOP;
const FOV = Math.PI / 7, CAM_D = 3200;
const MODE = { SCULPTURE: 0, WIREFRAME: 1, HYBRID: 2 };
const MODE_NAMES = ["SCULPTURE", "WIREFRAME", "HYBRID"];
const MODE_OPACITY = [1, 0.16, 1];
const PASS = { OPAQUE: 0, GHOST: 1, XRAY: 2 };
const DEFAULTS = {
  mode: MODE.HYBRID, color: 1, meshRes: 96, wireDensity: 36, lineOpacity: 0.75, surfOpacity: 1,
  highlight: 1, speed: 1, camDist: 1, camRot: 0, lightDir: 0, preview: 1,
};
const params = { ...DEFAULTS };
const orbit = { yaw: 0, pitch: 0, id: null, x: 0, y: 0 };
const fit = { scale: 1, offsetY: 0, fogNear: -1, fogFar: 1 };
let canvasEl = null, boyGeom = null, boyAudit = null, boyShader = null, hudPg = null;
let previewFrame = 0, exportFrame = 0, playing = true, exporting = false, showCaption = true;

// Camera / light choreography over one loop, phase ∈ [0, TAU).
// Every term must return to its start at phase = TAU: integer multiples of phase inside sin/cos, and the
// spin may only advance by a multiple of TAU/3 (the C₃ symmetry). Opening frame = cos peaks = hero view.
function choreography(phase) {
  return {
    spin: -phase / 3,
    tilt: 0.62 + 0.2 * Math.cos(phase),
    breath: 1 + 0.03 * Math.cos(phase),
    lightAz: -0.55 + 0.35 * Math.sin(phase),
    lightEl: 0.62 + 0.1 * Math.cos(2 * phase),
  };
}

function frameState(frameIndex, interactive = true) {
  const phase = TAU * (frameIndex % LOOP) / LOOP, c = choreography(phase);
  const userYaw = interactive ? orbit.yaw : 0, userPitch = interactive ? orbit.pitch : 0;
  return {
    phase,
    spin: c.spin + params.camRot * Math.PI / 180 + userYaw,
    tilt: Math.max(-1.5, Math.min(1.5, c.tilt + userPitch)),
    dist: CAM_D * c.breath * (interactive ? params.camDist : 1),
    lightAz: c.lightAz + params.lightDir * Math.PI / 180,
    lightEl: c.lightEl,
  };
}

// CPU twin of the vertex shader + draw() transform: math (x, y, z) → spin about z → p5 world (x, −z, −y)
// (the reflection keeps right-handed chirality on p5's y-down screen) → rotateX(−tilt) → translate y.
function toScreen(m, st, scale, offsetY, out) {
  const c = Math.cos(st.spin), s = Math.sin(st.spin);
  const x = (c * m[0] - s * m[1]) * scale, y = -m[2] * scale, z = -(s * m[0] + c * m[1]) * scale;
  const ct = Math.cos(st.tilt), sn = Math.sin(st.tilt);
  const wy = y * ct + z * sn + offsetY, wz = -y * sn + z * ct;
  const f = (H / 2) / Math.tan(FOV / 2), depth = st.dist - wz;
  out[0] = W / 2 + f * x / depth; out[1] = H / 2 + f * wy / depth; out[2] = depth;
  return out;
}
// Solved once over the whole loop (never per frame): the silhouette stays inside FIT_W × FIT_H, centred on
// the safe box, at every phase of the choreography.
function solveFit() {
  const ref = buildBoyMesh(32, 96), n = ref.pos.length / 3, m = [0, 0, 0], q = [0, 0, 0];
  let scale = 300, offsetY = 0;
  for (let iter = 0; iter < 6; iter++) {
    let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity, dLo = Infinity, dHi = -Infinity;
    for (let k = 0; k < 24; k++) {
      const st = frameState(k * LOOP / 24, false);
      for (let i = 0; i < n; i++) {
        m[0] = ref.pos[i * 3]; m[1] = ref.pos[i * 3 + 1]; m[2] = ref.pos[i * 3 + 2];
        toScreen(m, st, scale, offsetY, q);
        xLo = Math.min(xLo, q[0]); xHi = Math.max(xHi, q[0]);
        yLo = Math.min(yLo, q[1]); yHi = Math.max(yHi, q[1]);
        dLo = Math.min(dLo, q[2] - st.dist); dHi = Math.max(dHi, q[2] - st.dist);
      }
    }
    const f = (H / 2) / Math.tan(FOV / 2);
    offsetY += (FRAME_CY - (yLo + yHi) / 2) * CAM_D / f;
    scale *= Math.min(FIT_W / (xHi - xLo), FIT_H / (yHi - yLo));
    Object.assign(fit, { scale, offsetY, fogNear: dLo, fogFar: dHi, box: [xLo, xHi, yLo, yHi] });
  }
}

const BOY_VERTEX = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uSpin;
uniform float uScale;
out vec3 vN;
out vec3 vEye;
out vec3 vM;
out vec2 vUV;
vec3 place(vec3 m) {
  float c = cos(uSpin), s = sin(uSpin);
  return vec3(c*m.x - s*m.y, -m.z, -(s*m.x + c*m.y));
}
void main() {
  vec4 eye = uModelViewMatrix*vec4(place(aPosition)*uScale, 1.);
  vN = mat3(uModelViewMatrix)*place(aNormal);
  vEye = eye.xyz; vM = aPosition; vUV = aTexCoord;
  gl_Position = uProjectionMatrix*eye;
}
`;

const BOY_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vN;
in vec3 vEye;
in vec3 vM;
in vec2 vUV;
uniform int uPass;
uniform vec3 uKey;
uniform vec3 uFill;
uniform vec3 uSilver;
uniform vec3 uBg;
uniform vec3 uFront;
uniform vec3 uBack;
uniform vec3 uEdge;
uniform float uAccent;
uniform float uLines;
uniform float uContours;
uniform float uLineAlpha;
uniform vec2 uGrid;
uniform float uOpacity;
uniform float uHighlight;
uniform float uPhase;
uniform vec2 uFog;
out vec4 fragColor;
const float TAU = 6.283185307179586;
const float BAND_PERIOD = 1.22;
const float CONTOUR_STEP = .0763;
// Anti-aliased iso-line of f at integers, ~px wide; fades out once lines get denser than ~4 px.
float aaLine(float f, float px) {
  float w = max(fwidth(f), 1e-6);
  float d = abs(fract(f - .5) - .5)/w;
  return (1. - smoothstep(.5*px - .5, .5*px + .5, d))*(1. - smoothstep(.2, .45, w));
}
void main() {
  vec3 N = normalize(vN), V = normalize(-vEye);
  float facing = dot(N, V);
  // Non-orientable: there is no outside. Light whichever side of the sheet faces the eye.
  if (facing < 0.) N = -N;
  float ndv = abs(facing);
  vec3 L = normalize(uKey), F = normalize(uFill);
  float wrap = max((dot(N, L) + .3)/1.3, 0.), diff = wrap*wrap;
  float fill = max(dot(N, F), 0.);
  float nh = max(dot(N, normalize(L + V)), 0.);
  float spec = .85*pow(nh, 160.) + .18*pow(nh, 16.);
  vec3 R = reflect(-V, N);
  float sky = -R.y;
  float env = .03 + .62*smoothstep(.2, .8, sky) + .34*exp(-pow((sky - .05)*9., 2.));
  float fres = pow(1. - ndv, 3.);
  float occl = mix(.45, 1., smoothstep(.05, .75, length(vM)));
  float fog = 1. - .55*smoothstep(uFog.x, uFog.y, -vEye.z);
  float band = pow(.5 + .5*cos(TAU*vM.z/BAND_PERIOD - uPhase), 22.);
  float contour = aaLine(vM.z/CONTOUR_STEP - 2.*uPhase/TAU, 1.1);
  float theta = aaLine(vUV.y*uGrid.x, 1.25)*smoothstep(.03, .22, vUV.x);
  float ring = aaLine(vUV.x*uGrid.y, 1.25);
  float grid = max(theta, ring)*uLines;
  float cont = contour*uContours*(.18 + .82*band);
  vec3 accent = mix(uSilver, facing >= 0. ? uFront : uBack, uAccent);
  vec3 ink = vec3(1.);
  float dr = vUV.x - 1.;
  float seam = (1. - smoothstep(1.2, 2.6, abs(dr)/max(fwidth(dr), 1e-6)))*uAccent;
  float lit = .3 + .7*diff;
  vec3 col;
  if (uPass == ${PASS.OPAQUE}) {
    vec3 metal = accent*((.02 + .3*diff + .06*fill)*occl + .62*env*mix(.35, 1., diff)*occl + .14*fres)
      + vec3(spec)*occl + accent*(.3*fres + .38*band*uHighlight*occl);
    col = metal*mix(.3, 1., uOpacity) + ink*(grid*lit*.9 + cont*1.2)*uLineAlpha;
    col = mix(uBg, vec3(1.), 1. - exp(-1.3*col*fog));
    col = mix(col, uEdge*(.6 + .5*lit)*fog, .95*seam);
  } else if (uPass == ${PASS.GHOST}) {
    col = (accent*fres*.32*(1. - uOpacity) + ink*grid*.1*uLineAlpha)*fog;
  } else {
    vec3 glass = accent*(.035 + .4*fres + .25*spec)*uOpacity + accent*band*.16*uHighlight*uOpacity;
    col = (glass + ink*(grid*(.3 + .4*lit) + cont*.6)*uLineAlpha + uEdge*seam*.7)*fog;
  }
  fragColor = vec4(col, 1.);
}
`;

function rebuildMesh(rings) {
  const mesh = buildBoyMesh(rings, rings * 3);
  boyAudit = auditBoyMesh(mesh);
  const g = new p5.Geometry();
  g.gid = "boy-" + mesh.rings + "x" + mesh.cols;
  const nv = mesh.pos.length / 3;
  for (let k = 0; k < nv; k++) {
    g.vertices.push(new p5.Vector(mesh.pos[k * 3], mesh.pos[k * 3 + 1], mesh.pos[k * 3 + 2]));
    g.vertexNormals.push(new p5.Vector(mesh.nor[k * 3], mesh.nor[k * 3 + 1], mesh.nor[k * 3 + 2]));
    g.uvs.push(mesh.uv[k * 2], mesh.uv[k * 2 + 1]);
  }
  g.faces = mesh.faces;
  if (boyGeom) freeGeometry(boyGeom);
  boyGeom = g;
  boyGeom.info = { rings: mesh.rings, cols: mesh.cols };
  const a = boyAudit;
  console[a.euler === 1 && a.open === 0 && a.nonFinite === 0 ? "log" : "error"]("BOY MESH", g.gid, a);
  setText("meshInfo", mesh.rings + "×" + mesh.cols + " · " + (a.F / 1000).toFixed(1) + "k tris");
  setText("auditInfo", "χ = V−E+F = " + a.euler + " (RP²) · open edges " + a.open + " · NaN " + a.nonFinite);
}

function lightDir(az, el) {
  // p5 eye space is y-down: "up" is −y.
  return [Math.cos(el) * Math.sin(az), -Math.sin(el), Math.cos(el) * Math.cos(az)];
}

function renderScene(st) {
  const gl = drawingContext, mode = params.mode;
  background(BG[0] * 255, BG[1] * 255, BG[2] * 255);
  perspective(FOV, W / H, 50, 20000);
  camera(0, 0, st.dist, 0, 0, 0, 0, 1, 0);
  push();
  translate(0, fit.offsetY, 0);
  rotateX(-st.tilt);
  noStroke();
  shader(boyShader);
  const sh = boyShader;
  sh.setUniform("uSpin", st.spin);
  sh.setUniform("uScale", fit.scale);
  sh.setUniform("uKey", lightDir(st.lightAz, st.lightEl));
  sh.setUniform("uFill", lightDir(st.lightAz + 2.6, -0.35));
  sh.setUniform("uSilver", SILVER);
  sh.setUniform("uBg", BG);
  sh.setUniform("uFront", CYAN);
  sh.setUniform("uBack", MAGENTA);
  sh.setUniform("uEdge", ACID);
  sh.setUniform("uAccent", params.color);
  sh.setUniform("uLines", mode === MODE.SCULPTURE ? 0 : 1);
  sh.setUniform("uContours", mode === MODE.HYBRID ? 1 : mode === MODE.WIREFRAME ? 0.6 : 0);
  sh.setUniform("uLineAlpha", params.lineOpacity);
  sh.setUniform("uGrid", [params.wireDensity, params.wireDensity / 3]);
  sh.setUniform("uOpacity", params.surfOpacity);
  sh.setUniform("uHighlight", params.highlight * (mode === MODE.SCULPTURE ? 0.55 : 1));
  sh.setUniform("uPhase", st.phase);
  sh.setUniform("uFog", [st.dist + fit.fogNear, st.dist + fit.fogFar]);

  if (mode === MODE.WIREFRAME) {
    // X-ray: additive and order-independent, so every sheet, the self-intersections and the triple point show.
    gl.disable(gl.DEPTH_TEST);
    blendMode(ADD);
    sh.setUniform("uPass", PASS.XRAY);
    model(boyGeom);
    gl.enable(gl.DEPTH_TEST);
  } else {
    blendMode(BLEND);
    sh.setUniform("uPass", PASS.OPAQUE);
    model(boyGeom);
    // Hidden sheets whisper through the front one (lines in Hybrid, glass rims when opacity < 1).
    if (mode === MODE.HYBRID || params.surfOpacity < 1) {
      gl.depthMask(false);
      gl.depthFunc(gl.GREATER);
      blendMode(ADD);
      sh.setUniform("uPass", PASS.GHOST);
      model(boyGeom);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
    }
  }
  resetShader();
  blendMode(BLEND);
  pop();
  if (showCaption) { drawCaption(st); drawScreenImage(hudPg); }
}

function draw() {
  let f = exporting ? exportFrame : previewFrame;
  if (!exporting && typeof window.__frameOverride === "number") f = window.__frameOverride;
  renderScene(frameState(f));
  if (recording) captureFrame();
  if (exporting) return;
  if (playing) previewFrame = (previewFrame + params.speed) % LOOP;
  if (frameCount % 3 === 0) setText("frameInfo", Math.floor(f));
}

function setup() {
  const cnv = createCanvas(W, H, WEBGL);
  canvasEl = cnv.elt;
  pixelDensity(params.preview);
  frameRate(FPS);
  hudPg = createGraphics(W, H);
  hudPg.pixelDensity(1);
  boyShader = createShader(BOY_VERTEX, BOY_FRAGMENT);
  solveFit();
  rebuildMesh(params.meshRes);
  bindUI();
  bindOrbit();
  checkBoy();
}

// CPU checks of the claims the artwork rests on: C₃ symmetry (w → e^{2πi/3}w is a −120° turn about z),
// antipodal identification on |w| = 1, the three ends of D landing on the triple point, and loop closure.
function checkBoy() {
  const c = Math.cos(TAU / 3), s = Math.sin(TAU / 3), S5 = Math.sqrt(5);
  let sym = 0, anti = 0;
  for (let k = 0; k < 400; k++) {
    const r = Math.sqrt((k + 0.5) / 400), t = k * 2.399963;
    const u = r * Math.cos(t), v = r * Math.sin(t), p = boyPoint(u, v), q = boyPoint(u * c - v * s, u * s + v * c);
    sym = Math.max(sym, Math.abs(c * p[0] + s * p[1] - q[0]), Math.abs(-s * p[0] + c * p[1] - q[1]), Math.abs(p[2] - q[2]));
    const a = boyPoint(Math.cos(t), Math.sin(t)), b = boyPoint(-Math.cos(t), -Math.sin(t));
    anti = Math.max(anti, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  const r0 = Math.cbrt((3 - S5) / 2);
  const triple = Math.max(...[0, 1, 2].map((k) => Math.hypot(...boyPoint(r0 * Math.cos(k * TAU / 3), r0 * Math.sin(k * TAU / 3)))));
  const a = choreography(0), b = choreography(TAU);
  const loopErr = Math.max(Math.abs(a.tilt - b.tilt), Math.abs(a.breath - b.breath), Math.abs(a.lightAz - b.lightAz),
    Math.abs(a.lightEl - b.lightEl), Math.abs(Math.sin(1.5 * (a.spin - b.spin))));
  const ok = sym < 1e-9 && anti < 1e-9 && triple < 1e-9 && loopErr < 1e-9;
  console[ok ? "log" : "error"]("BOY CHECK", { ok, sym, anti, triple, loopErr, fit: { ...fit } });
  return ok;
}

// Per-frame HUD in 20261019's layout: serif title, the Bryant–Kusner formula in CYAN / INK, live readouts
// with the ACID seam relation, a loop track, story captions on loop windows and a citation line.
const HUD = {
  safeX: 56, stageTextX: 84, rightTextX: 140,
  titleY: 210, formulaY: 276, exponentY: 319, subtitleY: 348, stageY: 374, trackY: 418,
  bottomTextY: 1322, citationY: 1404, bottomMainAlpha: 235, citationAlpha: 190,
};
// The null window holds at the hero frame on both ends of the loop; the others fade in and out mid-loop.
const OVERLAY = [
  { window: null, first: "ONE SIDE. NO INSIDE.", second: "RP²  IMMERSED IN  R³" },
  { window: [0.15, 0.17, 0.30, 0.32], first: "THREE SHEETS, ONE POINT", second: "D = 0  →  THE TRIPLE POINT  x = 0" },
  { window: [0.39, 0.41, 0.56, 0.58], first: "THE DISK'S EDGE IS GLUED", second: "w ~ −w  ON  |w| = 1" },
  { window: [0.65, 0.67, 0.82, 0.84], first: "TURN IT 120°", second: "NOTHING CHANGES  ·  C₃" },
];
function smooth01(e0, e1, x) { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); }
function envelope(p, w) { return smooth01(w[0], w[1], p) * (1 - smooth01(w[2], w[3], p)); }

function drawCaption(st) {
  const g = hudPg, deg = 180 / Math.PI, p = st.phase / TAU;
  const theta = ((-st.spin * deg) % 120 + 120) % 120;
  const ink = (a) => g.fill(255, 255, 255, a), cyan = (a) => g.fill(0, 229, 255, a), acid = (a) => g.fill(182, 255, 61, a);
  g.clear();
  g.noFill();
  g.stroke(255, 80);
  g.strokeWeight(0.7);
  const m = 34, l = 24;
  g.line(m, m, m + l, m); g.line(m, m, m, m + l);
  g.line(W - m, m, W - m - l, m); g.line(W - m, m, W - m, m + l);
  g.line(m, H - m, m + l, H - m); g.line(m, H - m, m, H - m - l);
  g.line(W - m, H - m, W - m - l, H - m); g.line(W - m, H - m, W - m, H - m - l);

  g.noStroke();
  g.textAlign(CENTER, CENTER);
  g.textFont("Georgia");
  g.textStyle(BOLD);
  g.textSize(72);
  ink(245);
  g.text("BOY'S SURFACE", W / 2, HUD.titleY);
  g.textFont("monospace");
  g.textStyle(NORMAL);
  g.textSize(34);
  ink(228);
  g.text("IMPOSSIBLE GEOMETRY", W / 2, HUD.formulaY);
  g.textSize(23);
  cyan(220);
  g.text("g₁ = −³⁄₂ Im[w(1−w⁴)/D] · g₂ = −³⁄₂ Re[w(1+w⁴)/D]", W / 2, HUD.exponentY);
  g.textSize(26);
  ink(215);
  g.text("g₃ = Im[(1+w⁶)/D] − ½ · x = g / |g|²", W / 2, HUD.subtitleY);

  g.textAlign(LEFT, TOP);
  ink(235);
  g.text("θ " + theta.toFixed(1) + "° · tilt " + (st.tilt * deg).toFixed(1) + "°", HUD.stageTextX, HUD.stageY);
  g.textAlign(RIGHT, TOP);
  g.textSize(22);
  acid(240);
  g.text("w ~ −w on |w| = 1", W - HUD.rightTextX, HUD.stageY + 3);

  const x = HUD.safeX + (W - 2 * HUD.safeX) * p;
  g.stroke(255, 80);
  g.strokeWeight(1);
  g.line(HUD.safeX, HUD.trackY, W - HUD.safeX, HUD.trackY);
  g.stroke(255, 184);
  g.strokeWeight(2.2);
  g.line(HUD.safeX, HUD.trackY, x, HUD.trackY);
  g.noStroke();
  ink(235);
  g.circle(x, HUD.trackY, 8);

  g.textAlign(CENTER, CENTER);
  g.textSize(28);
  for (const c of OVERLAY) {
    const weight = c.window ? envelope(p, c.window) : 1 - smooth01(0.05, 0.09, p) + smooth01(0.90, 0.985, p);
    if (weight <= 0.01) continue;
    ink(HUD.bottomMainAlpha * weight);
    g.text(c.first, W / 2, HUD.bottomTextY);
    g.text(c.second, W / 2, HUD.bottomTextY + 38);
  }
  g.textSize(22);
  ink(HUD.citationAlpha);
  g.text("|w| ≤ 1 · D = w⁶ + √5 w³ − 1 · χ = 1 · " + MAX_DURATION + " s loop", W / 2, HUD.citationY);
}

function drawScreenImage(g) {
  push();
  drawingContext.disable(drawingContext.DEPTH_TEST);
  resetMatrix();
  camera(0, 0, 1, 0, 0, 0, 0, 1, 0);
  ortho(-W * 0.5, W * 0.5, -H * 0.5, H * 0.5, -10, 10);
  blendMode(BLEND);
  image(g, -W * 0.5, -H * 0.5, W, H);
  drawingContext.enable(drawingContext.DEPTH_TEST);
  pop();
}

// ── UI ──────────────────────────────────────────────────────────────────────
const el = (id) => document.getElementById(id);
function setText(id, value) { const e = el(id); if (e) e.textContent = value; }
function setStatus(text, color = "#ccc") { const e = el("status"); if (e) { e.textContent = text; e.style.color = color; } }

const SLIDERS = {
  meshRes: (v) => v + "",
  wireDensity: (v) => v + "",
  lineOpacity: (v) => v.toFixed(2),
  surfOpacity: (v) => v.toFixed(2),
  highlight: (v) => v.toFixed(2),
  speed: (v) => v.toFixed(2) + "×",
  camDist: (v) => v.toFixed(2),
  camRot: (v) => v + "°",
  lightDir: (v) => v + "°",
  preview: (v) => (v * 100) + "%",
};
function syncUI() {
  for (const [key, fmt] of Object.entries(SLIDERS)) {
    const input = el(key);
    if (!input) continue;
    input.value = params[key];
    setText(key + "Out", fmt(params[key]));
  }
  document.querySelectorAll("#modeSeg button").forEach((b) => b.classList.toggle("is-on", +b.dataset.mode === params.mode));
  document.querySelectorAll("#colorSeg button").forEach((b) => b.classList.toggle("is-on", +b.dataset.color === params.color));
  setText("playBtn", playing ? "Pause" : "Play");
  setText("captionBtn", "Caption: " + (showCaption ? "on" : "off"));
  setText("recBtn", recording ? "■ Stop rec" : "● Rec live");
  el("recBtn").classList.toggle("is-rec", recording);
  // Live capture needs the canvas at 1080×1920 the whole time: no density change, no export mid-recording.
  el("preview").disabled = recording;
  el("exportBtn").disabled = recording;
}
function bindUI() {
  for (const [key, fmt] of Object.entries(SLIDERS)) {
    const input = el(key);
    if (!input) continue;
    input.addEventListener("input", () => {
      if (exporting) return;
      const v = parseFloat(input.value);
      setText(key + "Out", fmt(v));
      // Mesh topology and canvas density change only on release, never per drag tick.
      if (key !== "meshRes" && key !== "preview") params[key] = v;
    });
    input.addEventListener("change", () => {
      if (exporting) return;
      const v = parseFloat(input.value);
      params[key] = v;
      if (key === "meshRes") rebuildMesh(v);
      if (key === "preview") pixelDensity(v);
    });
  }
  document.querySelectorAll("#modeSeg button").forEach((b) => b.addEventListener("click", () => setMode(+b.dataset.mode)));
  document.querySelectorAll("#colorSeg button").forEach((b) => b.addEventListener("click", () => {
    if (exporting) return;
    params.color = +b.dataset.color;
    syncUI();
  }));
  el("playBtn").onclick = togglePlay;
  el("resetBtn").onclick = resetCamera;
  el("captionBtn").onclick = () => { if (exporting) return; showCaption = !showCaption; syncUI(); };
  el("hideBtn").onclick = () => toggleUI(false);
  el("showUi").onclick = () => toggleUI(true);
  el("exportBtn").onclick = exportAnimation;
  el("recBtn").onclick = toggleRecording;
  syncUI();
}
function setMode(mode) {
  if (exporting) return;
  params.mode = mode;
  params.surfOpacity = MODE_OPACITY[mode];
  syncUI();
}
function togglePlay() { if (exporting) return; playing = !playing; syncUI(); }
function resetCamera() {
  if (exporting) return;
  orbit.yaw = 0; orbit.pitch = 0;
  params.camDist = DEFAULTS.camDist; params.camRot = DEFAULTS.camRot;
  syncUI();
}
function toggleUI(show) {
  el("controls").classList.toggle("is-hidden", !show);
  el("showUi").classList.toggle("is-on", !show);
}
function lockUI(locked) {
  el("controls").classList.toggle("is-locked", locked);
  document.querySelectorAll("#controls button, #controls input").forEach((n) => { n.disabled = locked; });
}

// Orbit is a static offset added to the choreography: dragging is ignored while exporting, so capture is
// deterministic (the export renders whatever offset is set when it starts, identically on every frame).
function bindOrbit() {
  canvasEl.addEventListener("pointerdown", (e) => {
    if (exporting) return;
    orbit.id = e.pointerId; orbit.x = e.clientX; orbit.y = e.clientY;
    canvasEl.setPointerCapture(e.pointerId);
  });
  canvasEl.addEventListener("pointermove", (e) => {
    if (exporting || orbit.id !== e.pointerId) return;
    orbit.yaw += (e.clientX - orbit.x) * 0.006;
    orbit.pitch = Math.max(-1.2, Math.min(1.2, orbit.pitch + (e.clientY - orbit.y) * 0.005));
    orbit.x = e.clientX; orbit.y = e.clientY;
  });
  const end = (e) => { if (orbit.id === e.pointerId) orbit.id = null; };
  canvasEl.addEventListener("pointerup", end);
  canvasEl.addEventListener("pointercancel", end);
  canvasEl.addEventListener("dblclick", resetCamera);
  canvasEl.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (exporting) return;
    params.camDist = Math.max(0.6, Math.min(1.8, params.camDist * Math.exp(e.deltaY * 0.001)));
    syncUI();
  }, { passive: false });
}

function keyReleased() {
  if (document.activeElement && document.activeElement.tagName === "INPUT" && key === " ") return true;
  if (key === "h" || key === "H") { toggleUI(el("controls").classList.contains("is-hidden")); return false; }
  if (key === " ") { togglePlay(); return false; }
  if (key === "e" || key === "E") { exportAnimation(); return false; }
  if ((key === "r" || key === "R") && !exporting) { toggleRecording(); return false; }
  if ((key === "s" || key === "S") && !exporting) { saveCanvas("boys_surface_" + getTimestamp(), "png"); return false; }
  return true;
}
