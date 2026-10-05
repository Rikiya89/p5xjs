// Villarceau instrument — exact oblique circles, sixfold symmetry, golden-ratio layers.
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
let ruleMesh, ruleShader;

// A ring torus: (sqrt(x*x+y*y)-R)^2 + z*z = r*r, R > r.
// Six rotations of each handed family give a spatial rosette; the three
// toroidal layers share the same ratio and shrink by the golden ratio.
const MAJOR_RADIUS = 320, MINOR_RADIUS = 122;
const SYMMETRY = 6, LAYER_COUNT = 3;
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
const CIRCLE_SAMPLES = 192, LINE_WEIGHT = 2.10;
const FAMILY_SWING = 0.30, LAYER_SWING = 0.24, BREATH = 0.025;
const OBJECT_SCALE = 1.13, CAM_DIST = 2700;
const KIND_CIRCLE_A = 0, KIND_CIRCLE_B = 1, KIND_CROWN = 2, KIND_BRIDGE = 3, KIND_EQUATOR = 4;
let debugFrame = false;

// Reuse the cached ribbon topology and two-pass luminous WEBGL renderer.
function addStrip(samples, p0, p1, index, shell, kind) {
  const start = ruleMesh.vertices.length;
  for (let s = 0; s <= samples; s++) {
    const t = p0 + (p1 - p0) * s / samples;
    ruleMesh.vertices.push(new p5.Vector(t, -1, index), new p5.Vector(t, 1, index));
    ruleMesh.uvs.push(shell, kind, shell, kind);
    if (s < samples) {
      const k = start + s * 2;
      ruleMesh.faces.push([k, k + 1, k + 2], [k + 1, k + 3, k + 2]);
    }
  }
}
function createRuleMesh() {
  ruleMesh = new p5.Geometry();
  ruleMesh.gid = "villarceau-instrument";
  for (let s = 0; s < LAYER_COUNT; s++) {
    for (let j = 0; j < SYMMETRY; j++) {
      addStrip(CIRCLE_SAMPLES, 0, TAU, j, s, KIND_CIRCLE_A);
      addStrip(CIRCLE_SAMPLES, 0, TAU, j, s, KIND_CIRCLE_B);
      // Hexagonal crowns use t=0 points of the actual Villarceau circles.
      addStrip(1, 0, 1, j, s, KIND_CROWN);
      addStrip(1, 0, 1, j + SYMMETRY, s, KIND_CROWN);
      if (s < LAYER_COUNT - 1) addStrip(1, 0, 1, j, s, KIND_BRIDGE);
    }
    addStrip(CIRCLE_SAMPLES, 0, TAU, 0, s, KIND_EQUATOR);
  }
}

const RULE_VERTEX = `
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uPhase;
uniform float uHalo;
varying float vEdge;
varying float vLight;
varying float vGlow;
const float TAU = 6.283185307179586;
const float R = ${MAJOR_RADIUS.toFixed(8)};
const float r = ${MINOR_RADIUS.toFixed(8)};
const float N = ${SYMMETRY.toFixed(1)};
const float PHI = ${GOLDEN_RATIO.toFixed(10)};
vec3 turnZ(vec3 p, float a) {
  return vec3(cos(a)*p.x-sin(a)*p.y, sin(a)*p.x+cos(a)*p.y, p.z);
}
// Exact circle of radius R in a bitangent plane z = +/- r*x/sqrt(R^2-r^2).
// Center (0,r,0), orthonormal basis (sqrt(R^2-r^2)/R,0,+/-r/R), (0,1,0).
// Rotating about the torus axis keeps every point on that same torus.
vec3 circlePoint(float t, float j, float hand, float shell) {
  vec3 p = vec3(sqrt(R*R-r*r)*cos(t), r+R*sin(t), hand*r*cos(t));
  float a = TAU*j/N + hand*${FAMILY_SWING.toFixed(8)}*sin(uPhase);
  return turnZ(p, a);
}
vec3 layerPose(vec3 p, float shell) {
  float breathing = 1. + ${BREATH.toFixed(8)}*sin(uPhase);
  p *= pow(PHI, -shell)*breathing;
  p = turnZ(p, (shell-1.)*${LAYER_SWING.toFixed(8)}*sin(uPhase));
  float tilt = (shell-1.)*.34*(1.-cos(uPhase));
  return vec3(p.x, cos(tilt)*p.y-sin(tilt)*p.z, sin(tilt)*p.y+cos(tilt)*p.z);
}
void main() {
  float t = aPosition.x, j = aPosition.z, shell = aTexCoord.x, kind = aTexCoord.y;
  vec3 p, tangent;
  float light = .90 - .08*shell;
  float width = ${LINE_WEIGHT.toFixed(8)};
  float glow = .25;
  if (kind < 1.5) {
    float hand = kind < .5 ? 1. : -1.;
    p = layerPose(circlePoint(t, j, hand, shell), shell);
    tangent = layerPose(circlePoint(t+.001, j, hand, shell), shell)-p;
    float bead = pow(max(0., cos(2.*t-uPhase+TAU*j/N)), 48.);
    light += .28*bead; width += .6*bead; glow += .5*bead;
    if (hand < 0.) light *= .74;
  } else if (kind < 3.5) {
    float hand = j < N ? 1. : -1.;
    float k = mod(j,N);
    vec3 A = layerPose(circlePoint(0.,k,hand,shell),shell);
    vec3 B;
    if (kind < 2.5) B = layerPose(circlePoint(0.,k+1.,hand,shell),shell);
    else B = layerPose(circlePoint(0.,k,hand,shell+1.),shell+1.);
    p = mix(A,B,t); tangent = B-A;
    light = kind < 2.5 ? .36 : .30; width *= .65; glow = .12;
  } else {
    // All t=-PI/2 throat points lie on this torus-derived inner equator.
    p = layerPose(vec3((R-r)*cos(t),(R-r)*sin(t),0.),shell);
    tangent = layerPose(vec3(-(R-r)*sin(t),(R-r)*cos(t),0.),shell);
    light = .75; width *= 1.1; glow = .4;
  }
  vec4 eye = uModelViewMatrix * vec4(p, 1.);
  vec3 dirEye = normalize(mat3(uModelViewMatrix)*tangent);
  vec3 crossEye = cross(dirEye,normalize(eye.xyz));
  vec3 side = crossEye/max(length(crossEye),.0001);
  float depth = clamp(1.-(-eye.z-(${CAM_DIST.toFixed(1)}-420.))/1100.,.3,1.);
  vLight = light*depth; vGlow = glow*depth; vEdge = aPosition.y;
  gl_Position = uProjectionMatrix*vec4(eye.xyz+side*aPosition.y*width*(1.+uHalo*5.),1.);
}
`;
const RULE_FRAGMENT = `
precision highp float;
uniform float uHalo;
varying float vEdge;
varying float vLight;
varying float vGlow;
void main() {
  float edge = 1. - smoothstep(.55, 1., abs(vEdge));
  float a = uHalo > .5 ? pow(1. - abs(vEdge), 3.)*.09*vGlow : edge*vLight;
  gl_FragColor = vec4(vec3(a), a);
}
`;

function primeState() {
  // Retained recording hook: geometry, camera and light are absolute functions of phase.
}
function updateLoopTime() {
  // Frames 0..599 sample [0,TAU); TAU matches frame 0 without duplicating it.
  const frame = isRecording ? recFrameCount : frameCount - 1;
  loopProgress = (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;
  phase = loopProgress * TAU;
  twistMix = .5 - .5 * Math.cos(phase);
}
function updateCamera() {
  perspective(Math.PI / 3.35, W / H, 10, 8000);
  const yaw = .13 * Math.sin(phase);
  const elev = .10 * Math.sin(phase);
  camera(CAM_DIST * Math.cos(elev) * Math.sin(yaw), -CAM_DIST * Math.sin(elev),
    CAM_DIST * Math.cos(elev) * Math.cos(yaw), 0, 0, 0, 0, 1, 0);
}
// CPU counterpart for torus, plane, circle and loop-invariant verification.
function villarceauPoint(t, j, hand, shell, phi) {
  const R = MAJOR_RADIUS, r = MINOR_RADIUS;
  const a = TAU * j / SYMMETRY + hand * FAMILY_SWING * Math.sin(phi);
  const x = Math.sqrt(R*R-r*r)*Math.cos(t), y = r+R*Math.sin(t), z = hand*r*Math.cos(t);
  const c = Math.cos(a), sn = Math.sin(a);
  const p = [c*x-sn*y, sn*x+c*y, z];
  const factor = Math.pow(GOLDEN_RATIO,-shell)*(1+BREATH*Math.sin(phi));
  const spin = (shell-1)*LAYER_SWING*Math.sin(phi), tilt = (shell-1)*.34*(1-Math.cos(phi));
  const xx = factor*(Math.cos(spin)*p[0]-Math.sin(spin)*p[1]);
  const yy = factor*(Math.sin(spin)*p[0]+Math.cos(spin)*p[1]);
  return [xx, Math.cos(tilt)*yy-Math.sin(tilt)*factor*z, Math.sin(tilt)*yy+Math.cos(tilt)*factor*z];
}
function checkLoopClosure() {
  let maxTorusError = 0, maxLoopError = 0;
  for (let shell = 0; shell < LAYER_COUNT; shell++) {
    for (let j = 0; j < SYMMETRY; j++) {
      for (const hand of [1,-1]) {
        for (let k = 0; k <= CIRCLE_SAMPLES; k++) {
          const t = TAU*k/CIRCLE_SAMPLES;
          const start = villarceauPoint(t,j,hand,shell,0);
          const end = villarceauPoint(t,j,hand,shell,TAU);
          maxLoopError = Math.max(maxLoopError,...start.map((v,i)=>Math.abs(v-end[i])));
          const scale = Math.pow(GOLDEN_RATIO,-shell);
          const [x,y,z] = start.map(v=>v/scale);
          maxTorusError = Math.max(maxTorusError,Math.abs((Math.hypot(x,y)-MAJOR_RADIUS)**2+z*z-MINOR_RADIUS**2));
        }
      }
    }
  }
  const ok = maxTorusError < 1e-7 && maxLoopError < 1e-7;
  console[ok ? "log" : "error"]("VILLARCEAU / LOOP CHECK", {ok,maxTorusError,maxLoopError});
  return ok;
}
function draw() {
  updateLoopTime();
  background(BG_R, BG_G, BG_B);
  updateCamera();
  push();
  translate(0, -12, 0);
  scale(OBJECT_SCALE);
  // Front-facing sixfold alignment opens immediately into a tilted instrument.
  rotateX(.12+.60*Math.sin(phase)+.22*(1-Math.cos(phase)));
  rotateY(.26*Math.sin(phase));
  rotateZ(.10*Math.sin(phase));
  noStroke();
  drawingContext.depthMask(false);
  blendMode(ADD);
  shader(ruleShader);
  ruleShader.setUniform('uPhase', phase);
  ruleShader.setUniform('uHalo', 0);
  model(ruleMesh);
  ruleShader.setUniform('uHalo', 1);
  model(ruleMesh);
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
  createRuleMesh();
  ruleShader = createShader(RULE_VERTEX, RULE_FRAGMENT);

  const el = (id) => document.getElementById(id);
  if (el("startBtn")) el("startBtn").onclick = startRecording;
  if (el("stopBtn")) el("stopBtn").onclick = stopRecording;
  if (el("maxDuration")) el("maxDuration").textContent = MAX_DURATION;
  if (el("canvasSize")) el("canvasSize").textContent = W + " × " + H;
  if (el("maxFrames")) el("maxFrames").textContent = MAX_FRAMES;
  checkLoopClosure();
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
  const info = { label: "SIXFOLD / THREE LAYERS", note: "OBLIQUE CIRCLES · SHARED TORUS" };
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
  g.text("VILLARCEAU CIRCLES", W * 0.5, SAFE_TOP + 30);
  g.textStyle(NORMAL);
  g.fill(INK_R, INK_G, INK_B, 122);
  g.textSize(24);
  g.text("A SACRED GEOMETRIC INSTRUMENT", W * 0.5, SAFE_TOP + 86);
  g.fill(INK_R, INK_G, INK_B, 64);
  g.textSize(17);
  g.text("TWO HANDED FAMILIES  ·  GOLDEN-RATIO NESTING", W * 0.5, SAFE_TOP + 124);

  g.textAlign(LEFT, TOP);
  g.fill(INK_R, INK_G, INK_B, 78);
  g.textSize(19);
  g.text(info.label, SAFE_X, SAFE_TOP + 176);
  g.textAlign(RIGHT, TOP);
  g.text("ORBIT / " + Math.round(twistMix * 100) + "%", W - SAFE_X, SAFE_TOP + 176);

  const trackX = SAFE_X, trackY = SAFE_TOP + 220, trackW = W - SAFE_X * 2;
  g.stroke(INK_R, INK_G, INK_B, 24);
  g.strokeWeight(1);
  g.line(trackX, trackY, trackX + trackW, trackY);
  g.stroke(INK_R, INK_G, INK_B, 150);
  g.strokeWeight(2.2);
  g.line(trackX, trackY, trackX + trackW * twistMix, trackY);
  g.noStroke();
  for (const marker of [0, 0.25, 0.5, 0.75, 1]) {
    g.fill(INK_R, INK_G, INK_B, marker === 0.5 ? 132 : 58);
    g.circle(trackX + trackW * marker, trackY, marker === 0.5 ? 6 : 4);
  }

  g.textAlign(CENTER, CENTER);
  g.fill(INK_R, INK_G, INK_B, 58 + 132 * twistMix);
  g.textSize(22);
  g.text(info.note, W * 0.5, SAFE_BOTTOM - 64);
  g.textSize(17);
  g.fill(INK_R, INK_G, INK_B, 96);
  g.text("6-FOLD SYMMETRY  ·  10 SECOND ORBIT", W * 0.5, SAFE_BOTTOM - 32);

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
    saveCanvas("villarceau_" + getTimestamp(), "png");
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
