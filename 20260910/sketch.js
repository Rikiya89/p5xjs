// Bertrand reliquary — closed paths as sculptural material, not simulated bodies.
const W = 1080;
const H = 1920;
const FPS = 60;
const MAX_DURATION = 10;
const MAX_FRAMES = FPS * MAX_DURATION;
const LOOP_FRAMES = MAX_FRAMES;
const TAU = Math.PI * 2;
const BG_R = 3, BG_G = 3, BG_B = 5;
const INK_R = 255, INK_G = 255, INK_B = 255;
let canvasEl = null, grainPg = null, hudPg = null;
let muxer = null, encoder = null, isRecording = false, recFrameCount = 0;
let loopProgress = 0, phase = 0, bertrandMix = 0, echoWrite = 0;
let orbitMesh, orbitShader;
const ORBIT_COUNT = 122; // 10 structural ribbons, 28 woven ribs, 84 fine filaments.
const PATH_SAMPLES = 192;

// Cached topology. Parameter-space vertices are evaluated on the GPU; no
// per-frame curve arrays or numerical integration are needed.
function createOrbitDefinitions() {
  orbitMesh = new p5.Geometry();
  for (let orbit = 0; orbit < ORBIT_COUNT; orbit++) {
    const start = orbitMesh.vertices.length;
    for (let j = 0; j <= PATH_SAMPLES; j++) {
      const t = j / PATH_SAMPLES * TAU;
      orbitMesh.vertices.push(new p5.Vector(t, -1, orbit), new p5.Vector(t, 1, orbit));
      if (j < PATH_SAMPLES) {
        const k = start + j * 2;
        orbitMesh.faces.push([k, k + 1, k + 2], [k + 1, k + 3, k + 2]);
      }
    }
  }
}

const ORBIT_VERTEX = `
precision highp float;
attribute vec3 aPosition;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uPhase;
uniform float uMix;
uniform float uHalo;
varying float vEdge;
varying float vLight;
varying float vPrimary;
const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;
mat3 turnX(float a) { float c=cos(a), s=sin(a); return mat3(1.,0.,0.,0.,c,s,0.,-s,c); }
mat3 turnY(float a) { float c=cos(a), s=sin(a); return mat3(c,0.,-s,0.,1.,0.,s,0.,c); }
mat3 turnZ(float a) { float c=cos(a), s=sin(a); return mat3(c,s,0.,-s,c,0.,0.,0.,1.); }

vec3 sampleBertrandPath(float t, float id) {
  float primary = 1. - step(10., id);
  float secondary = step(10., id) * (1. - step(38., id));
  float groupIndex = primary > .5 ? id : (secondary > .5 ? id-10. : id-38.);
  float count = primary > .5 ? 10. : (secondary > .5 ? 28. : 84.);
  float f = groupIndex / count;
  float goldenAngle = groupIndex * TAU / 1.61803398875;
  float radius = primary > .5 ? 335. + 105.*f : (secondary > .5 ? 238. + 64.*f : 164. + 85.*f);
  float a = radius * (primary > .5 ? 1.02 : .85);
  float b = radius * (primary > .5 ? 1.03 : 1.18);
  float drift = .13*sin(uPhase + goldenAngle);
  // Focus-offset ellipses and 1:1:2 harmonic cages both close at 2pi.
  // Interpolation of periodic curves retains positional and tangent closure.
  vec3 kepler = vec3(a*cos(t) - a*.13, b*sin(t), 0.);
  vec3 harmonic = vec3(a*cos(t+drift), b*sin(t), radius*.50*sin(2.*t+goldenAngle+uPhase));
  float mixAmount = primary > .5 ? .18 + .42*uMix : .38 + .62*uMix;
  vec3 p = mix(kepler, harmonic, mixAmount);
  // Bundles share a meridional skeleton, with fine ribs between major bands.
  float inclination = primary > .5 ? f*PI : goldenAngle;
  float roll = primary > .5 ? .25*sin(goldenAngle) : .34*sin(goldenAngle);
  p = turnY(inclination + .20*sin(uPhase+f*TAU)) * turnZ(roll) * p;
  p = turnX(.16*sin(uPhase + f*TAU)) * p;
  return p * (1. + .025*sin(uPhase));
}
void main() {
  float t = aPosition.x;
  float id = aPosition.z;
  float primary = 1.-step(10.,id);
  float secondary = step(10.,id)*(1.-step(38.,id));
  vec3 p = sampleBertrandPath(t,id);
  vec3 tangent = normalize(sampleBertrandPath(t+.002,id)-sampleBertrandPath(t-.002,id));
  vec3 side = normalize(cross(tangent, normalize(p)));
  float width = primary > .5 ? 1.65 : (secondary > .5 ? .65 : .24);
  width *= .78 + .22*cos(2.*t + id);
  vec3 normal = normalize(cross(tangent,side));
  vec4 eye = uModelViewMatrix * vec4(p,1.);
  vec3 n = normalize(mat3(uModelViewMatrix)*normal);
  float facing = abs(dot(n,normalize(-eye.xyz)));
  float light = .24 + .76*pow(facing,.7);
  float depth = clamp(1.25 + eye.z/2400.,.20,.95);
  // Traveling highlights use the same integer-frequency loop clock.
  float bead = pow(max(0.,cos(t-uPhase*2.+id*2.399963)),110.);
  vLight = (light*(primary>.5 ? .91 : (secondary>.5 ? .51 : .23)) + bead*.65)*depth;
  vPrimary = primary;
  vEdge = aPosition.y;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(p+side*aPosition.y*width*(1.+uHalo*4.),1.);
}
`;
const ORBIT_FRAGMENT = `
precision highp float;
uniform float uHalo;
varying float vEdge;
varying float vLight;
varying float vPrimary;
void main() {
  float edge = 1.-smoothstep(.60,1.,abs(vEdge));
  float alpha = uHalo>.5 ? pow(1.-abs(vEdge),3.)*.075*vPrimary : edge;
  gl_FragColor = vec4(vec3(vLight),alpha);
}
`;

function primeState() {
  // Retained recording reset hook: all geometry is an absolute function of phase.
  bertrandMix = 0;
}
function updateLoopTime() {
  const frame = isRecording ? recFrameCount : frameCount - 1;
  loopProgress = (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;
  phase = loopProgress * TAU;
  bertrandMix = .5 - .5 * Math.cos(phase);
}
function updateCamera() {
  perspective(Math.PI / 3.35, W / H, 10, 6000);
  const angle = phase + .36;
  camera(1490*Math.sin(angle), -75 + 40*Math.sin(phase), 1490*Math.cos(angle), 0, 0, 0, 0, 1, 0);
}
function draw() {
  updateLoopTime();
  background(BG_R, BG_G, BG_B);
  updateCamera();
  push();
  // Keep every orbit clear of the fixed header and footer across the full loop.
  scale(0.74);
  rotateZ(-.22 + .06*Math.sin(phase));
  noStroke();
  shader(orbitShader);
  orbitShader.setUniform('uPhase', phase);
  orbitShader.setUniform('uMix', bertrandMix);
  orbitShader.setUniform('uHalo', 0);
  model(orbitMesh);
  // Restrained ribbon halo, using existing monochrome ink only.
  drawingContext.depthMask(false);
  blendMode(ADD);
  orbitShader.setUniform('uHalo', 1);
  model(orbitMesh);
  blendMode(BLEND);
  drawingContext.depthMask(true);
  resetShader();
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
  createOrbitDefinitions();
  orbitShader = createShader(ORBIT_VERTEX, ORBIT_FRAGMENT);

  const el = (id) => document.getElementById(id);
  if (el("startBtn")) el("startBtn").onclick = startRecording;
  if (el("stopBtn")) el("stopBtn").onclick = stopRecording;
  if (el("maxDuration")) el("maxDuration").textContent = MAX_DURATION;
  if (el("canvasSize")) el("canvasSize").textContent = W + " × " + H;
  if (el("maxFrames")) el("maxFrames").textContent = MAX_FRAMES;
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
  const info = { label: "CELESTIAL ORBIT RELIQUARY", note: "TWO FAMILIES / ONE RECURRENCE" };
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
  g.text("BERTRAND’S THEOREM", W * 0.5, 222);
  g.textStyle(NORMAL);
  g.fill(INK_R, INK_G, INK_B, 122);
  g.textSize(24);
  g.text("CLOSED TRAJECTORIES / OPEN SPACE", W * 0.5, 278);
  g.fill(INK_R, INK_G, INK_B, 64);
  g.textSize(17);
  g.text("INVERSE SQUARE  ·  HARMONIC  ·  BOUNDED INFINITUDE", W * 0.5, 316);

  g.textAlign(LEFT, TOP);
  g.fill(INK_R, INK_G, INK_B, 78);
  g.textSize(19);
  g.text(info.label, 70, 372);
  g.textAlign(RIGHT, TOP);
  g.text("DUALITY / " + Math.round(bertrandMix * 100) + "%", W - 70, 372);

  const trackX = 70, trackY = 416, trackW = W - 140;
  g.stroke(INK_R, INK_G, INK_B, 24);
  g.strokeWeight(1);
  g.line(trackX, trackY, trackX + trackW, trackY);
  g.stroke(INK_R, INK_G, INK_B, 150);
  g.strokeWeight(2.2);
  g.line(trackX, trackY, trackX + trackW * bertrandMix, trackY);
  g.noStroke();
  for (const marker of [0, 0.25, 0.5, 0.75, 1]) {
    g.fill(INK_R, INK_G, INK_B, marker === 0.5 ? 132 : 58);
    g.circle(trackX + trackW * marker, trackY, marker === 0.5 ? 6 : 4);
  }

  g.textAlign(CENTER, CENTER);
  g.fill(INK_R, INK_G, INK_B, 58 + 132 * bertrandMix);
  g.textSize(22);
  g.text(info.note, W * 0.5, 1482);
  g.textSize(17);
  g.fill(INK_R, INK_G, INK_B, 96);
  g.text("ELLIPSE  ->  WEAVE  ->  HARMONIC  ->  RETURN", W * 0.5, 1514);

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
    saveCanvas("bertrand_reliquary_" + getTimestamp(), "png");
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
  // Recording may start from a warm preview at an arbitrary loop position. The
  // flow state is persistent, so without re-priming, frame 0 would be captured
  // mid-relaxation from the wrong form and the first ~6 frames would visibly
  // settle -- and the loop would not close.
  echoWrite = 0;
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
  a.download = "bertrand_reliquary_" + getTimestamp() + ".mp4";
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
