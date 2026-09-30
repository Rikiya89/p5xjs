// Doubly ruled surface — three hyperboloids built only from straight lines.
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

// Parameters: integer SPIN and BEAD_STREAMS preserve the loop permutation.
const RULINGS = 48;
const SHELL_R = [420, 300, 180], SHELL_H = [440, 400, 360];
const ALPHA_MID = 0.5 * Math.PI, ALPHA_AMP = 0.28 * Math.PI;
const SPIN = 4, BEAD_STREAMS = 3, RULE_LIGHT = 1.0;
// 2026-09-30 framing adjustment: clears the footer throughout all 600 phases.
const OBJECT_SCALE = 0.96, CAM_DIST = 2700;
const RULE_SAMPLES = 16, CIRCLE_SAMPLES = 160;
const KIND_RULE_A = 0, KIND_RULE_B = 1, KIND_RIM_TOP = 2, KIND_RIM_BOT = 3, KIND_THROAT = 4;
const alphaNow = [0, 0, 0];
let debugFrame = false;

// Cached topology: (parameter, side, ruling index), with (shell, kind) UVs.
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
  ruleMesh.gid = "doubly-ruled-mesh";
  for (let s = 0; s < 3; s++) {
    for (let j = 0; j < RULINGS; j++) {
      addStrip(RULE_SAMPLES, 0, 1, j, s, KIND_RULE_A);
      addStrip(RULE_SAMPLES, 0, 1, j, s, KIND_RULE_B);
    }
    addStrip(CIRCLE_SAMPLES, 0, TAU, 0, s, KIND_RIM_TOP);
    addStrip(CIRCLE_SAMPLES, 0, TAU, 0, s, KIND_RIM_BOT);
    addStrip(CIRCLE_SAMPLES, 0, TAU, 0, s, KIND_THROAT);
  }
}

const RULE_VERTEX = `
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uPhase;
uniform vec3 uAlpha;
uniform float uHalo;
varying float vEdge;
varying float vLight;
varying float vGlow;
const float TAU = 6.283185307179586;
const float N = ${RULINGS.toFixed(1)};
const float SPIN = ${SPIN.toFixed(1)};
const float BEAD_STREAMS = ${BEAD_STREAMS.toFixed(1)};
const float RULE_LIGHT = ${RULE_LIGHT.toFixed(8)};
const float CAM_DIST = ${CAM_DIST.toFixed(1)};
void main() {
  float t = aPosition.x;
  float j = aPosition.z;
  float shell = aTexCoord.x;
  float kind = aTexCoord.y;
  float r, h, sigma, alpha, width, light;
  if (shell < .5) {
    r = ${SHELL_R[0].toFixed(1)}; h = ${SHELL_H[0].toFixed(1)};
    sigma = 1.; alpha = uAlpha.x; width = 1.10; light = .30;
  } else if (shell < 1.5) {
    r = ${SHELL_R[1].toFixed(1)}; h = ${SHELL_H[1].toFixed(1)};
    sigma = -1.; alpha = uAlpha.y; width = 1.00; light = .20;
  } else {
    r = ${SHELL_R[2].toFixed(1)}; h = ${SHELL_H[2].toFixed(1)};
    sigma = 1.; alpha = uAlpha.z; width = .90; light = .38;
  }
  h *= 1. + .03*sin(2.*uPhase - shell);
  vec3 p, tangent;
  float glow = 0.;
  if (kind < 1.5) {
    float eps = kind < .5 ? 1. : -1.;
    float theta = TAU*j/N + sigma*SPIN*uPhase/N;
    vec3 A = vec3(r*cos(theta), -h, r*sin(theta));
    vec3 B = vec3(r*cos(theta + eps*alpha), h, r*sin(theta + eps*alpha));
    p = A + t*(B - A);
    tangent = B - A;
    if (eps < 0.) light *= .6;
    light *= RULE_LIGHT;
    float u = eps > 0. ? t : 1. - t;
    float arg = u - uPhase/TAU - BEAD_STREAMS*theta/TAU;
    float bead = pow(max(0., cos(TAU*arg)), 60.);
    light += .55*bead*RULE_LIGHT;
    width += .6*bead;
    glow = .4*bead;
  } else {
    float y = kind < 2.5 ? -h : h;
    light = .35; width = 1.2;
    if (kind > 3.5) {
      r *= cos(alpha/2.); y = 0.;
      light = .55; width = 1.6; glow = .3;
    }
    p = vec3(r*cos(t), y, r*sin(t));
    tangent = vec3(-r*sin(t), 0., r*cos(t));
  }
  vec4 eye = uModelViewMatrix * vec4(p, 1.);
  vec3 dirEye = normalize(mat3(uModelViewMatrix) * tangent);
  vec3 side = normalize(cross(dirEye, normalize(eye.xyz)));
  float depth = clamp(1. - (-eye.z - (CAM_DIST - 420.))/1100., .3, 1.);
  vLight = light*depth;
  vGlow = glow*depth;
  vEdge = aPosition.y;
  gl_Position = uProjectionMatrix * vec4(eye.xyz + side*aPosition.y*width*(1. + uHalo*5.), 1.);
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
  // Retained recording hook: all geometry is an absolute function of phase.
}
function updateLoopTime() {
  const frame = isRecording ? recFrameCount : frameCount - 1;
  loopProgress = (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;
  phase = loopProgress * TAU;
  twistMix = .5 - .5 * Math.cos(phase);
  for (let s = 0; s < 3; s++) alphaNow[s] = ALPHA_MID - ALPHA_AMP * Math.cos(phase - s * Math.PI / 2);
}
function updateCamera() {
  perspective(Math.PI / 3.35, W / H, 10, 8000);
  const yaw = .35 * Math.sin(phase);
  const elev = .24 + .05 * Math.sin(2 * phase);
  camera(CAM_DIST * Math.cos(elev) * Math.sin(yaw), -CAM_DIST * Math.sin(elev),
    CAM_DIST * Math.cos(elev) * Math.cos(yaw), 0, 0, 0, 0, 1, 0);
}
function rulingEndpoints(s, j, eps, phi) {
  const sigma = s === 1 ? -1 : 1;
  const theta = TAU * j / RULINGS + sigma * SPIN * phi / RULINGS;
  const alpha = ALPHA_MID - ALPHA_AMP * Math.cos(phi - s * Math.PI / 2);
  const r = SHELL_R[s], h = SHELL_H[s] * (1 + .03 * Math.sin(2 * phi - s));
  return {
    A: [r * Math.cos(theta), -h, r * Math.sin(theta)],
    B: [r * Math.cos(theta + eps * alpha), h, r * Math.sin(theta + eps * alpha)],
    arg: -phi / TAU - BEAD_STREAMS * theta / TAU,
  };
}
function checkLoopClosure() {
  for (let s = 0; s < 3; s++) {
    const sigma = s === 1 ? -1 : 1;
    for (let j = 0; j < RULINGS; j++) {
      for (const eps of [1, -1]) {
        const next = ((j + sigma * SPIN) % RULINGS + RULINGS) % RULINGS;
        const end = rulingEndpoints(s, j, eps, TAU), start = rulingEndpoints(s, next, eps, 0);
        const argDiff = ((end.arg - start.arg) % 1 + 1) % 1;
        if (end.A.some((v, i) => Math.abs(v - start.A[i]) > 1e-6) ||
            end.B.some((v, i) => Math.abs(v - start.B[i]) > 1e-6) ||
            Math.min(argDiff, 1 - argDiff) > 1e-6) {
          console.error("LOOP CHECK FAIL s=" + s + " j=" + j);
          return false;
        }
      }
    }
  }
  console.log("LOOP CHECK PASS");
  return true;
}
function draw() {
  updateLoopTime();
  background(BG_R, BG_G, BG_B);
  updateCamera();
  push();
  translate(0, -12, 0);
  scale(OBJECT_SCALE);
  noStroke();
  drawingContext.depthMask(false);
  blendMode(ADD);
  shader(ruleShader);
  ruleShader.setUniform('uPhase', phase);
  ruleShader.setUniform('uAlpha', alphaNow);
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
  const info = { label: "THREE NESTED HYPERBOLOIDS", note: "EVERY POINT LIES ON TWO LINES" };
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

  // Exact existing typography settings, positions, alignment, spacing, and hierarchy.
  g.noStroke();
  g.textFont("ui-monospace, Menlo, Consolas, monospace");
  g.textAlign(CENTER, CENTER);
  g.textStyle(BOLD);
  g.fill(INK_R, INK_G, INK_B, 246);
  g.textSize(54);
  g.text("DOUBLY RULED SURFACE", W * 0.5, SAFE_TOP + 30);
  g.textStyle(NORMAL);
  g.fill(INK_R, INK_G, INK_B, 122);
  g.textSize(24);
  g.text("STRAIGHT LINES, CURVED FORM", W * 0.5, SAFE_TOP + 86);
  g.fill(INK_R, INK_G, INK_B, 64);
  g.textSize(17);
  g.text("LINE FAMILY A  ·  LINE FAMILY B  ·  ONE SURFACE", W * 0.5, SAFE_TOP + 124);

  g.textAlign(LEFT, TOP);
  g.fill(INK_R, INK_G, INK_B, 78);
  g.textSize(19);
  g.text(info.label, SAFE_X, SAFE_TOP + 176);
  g.textAlign(RIGHT, TOP);
  g.text("TWIST / " + Math.round(twistMix * 100) + "%", W - SAFE_X, SAFE_TOP + 176);

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
  g.text("CIRCLE  +  CIRCLE  +  TWIST  =  HYPERBOLOID", W * 0.5, SAFE_BOTTOM - 32);

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
    saveCanvas("doubly_ruled_" + getTimestamp(), "png");
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
  a.download = "doubly_ruled_" + getTimestamp() + ".mp4";
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
  const frame = new VideoFrame(canvasEl, { timestamp: recFrameCount * (1_000_000 / FPS) });
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
