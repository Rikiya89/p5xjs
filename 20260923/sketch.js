// Poncelet reliquary — one closed polygon rule, stacked into a spatial envelope.
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
let loopProgress = 0, phase = 0, sweepMix = 0, theta0 = 0, echoWrite = 0;
let orbitMesh, orbitShader;

// Poncelet construction (controlled, exact rather than a general solver):
// for concentric circles R = 1 and r = cos(PI*m/n), every chord stepping by
// 2PI*m/n is tangent to the inner circle, so the {n/m} star closes after n
// steps from ANY start angle. A projective map (x, y) -> (x, y) / (1 + k d·q)
// sends lines to lines and conics to conics while preserving tangency, so the
// images are a genuine non-concentric ellipse pair with irregular, still
// exactly closing Poncelet polygons. k < 1 keeps the whole outer disk finite.
const N_SIDES = 7;
const M_MAIN = 2;              // heptagram {7/2}: primary family
const M_ECHO = 3;              // {7/3}: faint inner family on the same vertices
const R_MAIN = Math.cos(Math.PI * M_MAIN / N_SIDES);
const R_ECHO = Math.cos(Math.PI * M_ECHO / N_SIDES);
const PROJ_K = 0.34;           // projective strength, denominator stays >= 0.66
const WORLD_R = 330;
const LAYER_HALF = 20;         // layers -20..20, layer 0 is the active polygon
const LAYER_GAP = 17;
const LAYER_SHIFT = 0.052;     // start-angle offset between neighbouring layers
const LAYER_TWIST = 0.045;     // projective axis rotation through depth
const THETA_STEP = 1;          // loop advances the start by THETA_STEP * 2PI/n
const EDGE_SAMPLES = 10;
const CONIC_SAMPLES = 160;
const STRAND_SAMPLES = 120;
const KIND_MAIN = 0, KIND_ECHO = 1, KIND_STRAND = 2, KIND_OUTER = 3, KIND_INNER = 4;
const vertexCache = [];        // reused screen-accent positions for layer 0

// Mirror of shader worldPoint(); used for vertex / contact accents.
function mapPlane(x, y, psi) {
  const dx = Math.cos(psi), dy = Math.sin(psi);
  const w = 1 + PROJ_K * (x * dx + y * dy);
  const c = -PROJ_K / (1 - PROJ_K * PROJ_K); // recentres the outer conic on the axis
  return [x / w - c * dx, y / w - c * dy];
}
function worldPoint(x, y, layer, out) {
  const q = mapPlane(x, y, -phase + layer * LAYER_TWIST);
  const s = WORLD_R * (1 + 0.02 * Math.sin(2 * phase));
  const px = q[0] * s, pz = q[1] * s;
  out[0] = px;
  out[1] = layer * LAYER_GAP + 14 * Math.sin(px * 0.011 + phase + layer * 0.21) * Math.cos(pz * 0.009 - phase);
  out[2] = pz;
  return out;
}

// Cached topology: every strip stores (param, side, index) + (layer, kind);
// actual positions are evaluated from the loop clock on the GPU.
function addStrip(samples, p0, p1, index, layer, kind) {
  const start = orbitMesh.vertices.length;
  for (let s = 0; s <= samples; s++) {
    const t = p0 + (p1 - p0) * s / samples;
    orbitMesh.vertices.push(new p5.Vector(t, -1, index), new p5.Vector(t, 1, index));
    orbitMesh.uvs.push(layer, kind, layer, kind);
    if (s < samples) {
      const k = start + s * 2;
      orbitMesh.faces.push([k, k + 1, k + 2], [k + 1, k + 3, k + 2]);
    }
  }
}
function createOrbitDefinitions() {
  orbitMesh = new p5.Geometry();
  orbitMesh.gid = "poncelet-orbit-mesh"; // own buffer cache slot, never shared with sphere()
  for (let layer = -LAYER_HALF; layer <= LAYER_HALF; layer++) {
    for (let j = 0; j < N_SIDES; j++) {
      addStrip(EDGE_SAMPLES, 0, 1, j, layer, KIND_MAIN);
      if (layer % 2 === 0) addStrip(EDGE_SAMPLES, 0, 1, j, layer, KIND_ECHO);
    }
    if (layer % 4 === 0) addStrip(CONIC_SAMPLES, 0, TAU, 0, layer, KIND_INNER);
    if (layer === 0 || Math.abs(layer) === LAYER_HALF) addStrip(CONIC_SAMPLES, 0, TAU, 0, layer, KIND_OUTER);
  }
  // Vertex strands: each vertex followed continuously through the layer stack.
  for (let j = 0; j < N_SIDES; j++) addStrip(STRAND_SAMPLES, 0, 1, j, 0, KIND_STRAND);
  for (let j = 0; j < N_SIDES; j++) vertexCache.push([0, 0, 0], [0, 0, 0]);
}

const ORBIT_VERTEX = `
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uPhase;
uniform float uTheta0;
uniform float uScan;
uniform float uHalo;
varying float vEdge;
varying float vLight;
varying float vGlow;
const float TAU = 6.283185307179586;
const float N = ${N_SIDES}.;
const float HALF = ${LAYER_HALF}.;

vec2 mapPlane(vec2 q, float psi) {
  vec2 d = vec2(cos(psi), sin(psi));
  float k = ${PROJ_K};
  return q / (1. + k*dot(q, d)) + k/(1. - k*k) * d;
}
vec3 worldPoint(vec2 q, float layer) {
  vec2 p = mapPlane(q, -uPhase + layer*${LAYER_TWIST}) * ${WORLD_R}. * (1. + .02*sin(2.*uPhase));
  float y = layer*${LAYER_GAP}. + 14.*sin(p.x*.011 + uPhase + layer*.21)*cos(p.y*.009 - uPhase);
  return vec3(p.x, y, p.y);
}
// Layer L carries the Poncelet state with start angle theta0 + L*shift:
// earlier states sink below, later states rise above the active polygon.
float layerTheta(float layer) { return uTheta0 + layer*${LAYER_SHIFT}; }
vec3 evalPoint(float t, float j, float layer, float kind) {
  if (kind < 1.5) {
    float m = kind < .5 ? ${M_MAIN}. : ${M_ECHO}.;
    float a0 = layerTheta(layer) + j*TAU*m/N;
    float a1 = a0 + TAU*m/N;
    // Chords map to chords under the projective map, so lerp in the preimage.
    return worldPoint(mix(vec2(cos(a0), sin(a0)), vec2(cos(a1), sin(a1)), t), layer);
  }
  if (kind < 2.5) {
    float l = mix(-HALF, HALF, t);
    float a = layerTheta(l) + j*TAU*${M_MAIN}./N;
    return worldPoint(vec2(cos(a), sin(a)), l);
  }
  float r = kind < 3.5 ? 1. : ${R_MAIN};
  return worldPoint(r*vec2(cos(t), sin(t)), layer);
}
void main() {
  float t = aPosition.x;
  float j = aPosition.z;
  float layer = aTexCoord.x;
  float kind = aTexCoord.y;
  vec3 p = evalPoint(t, j, layer, kind);
  vec3 tangent = evalPoint(t + .002, j, layer, kind) - evalPoint(t - .002, j, layer, kind);
  vec4 eye = uModelViewMatrix * vec4(p, 1.);
  // Camera-facing ribbon: width offset built in eye space, never degenerate.
  vec3 dirEye = normalize(mat3(uModelViewMatrix) * tangent);
  vec3 side = normalize(cross(dirEye, normalize(eye.xyz)));

  float fade = 1. - abs(layer)/HALF;
  float scan = exp(-pow((layer - uScan)/1.7, 2.));
  float active = kind < .5 ? 1. - step(.5, abs(layer)) : 0.;
  float light, width, glow;
  if (kind < .5) {
    light = mix(.07 + .20*pow(fade, 1.6) + .34*scan, 1., active);
    width = mix(.55 + .55*fade + .5*scan, 2.3, active);
    glow = active + .25*scan;
  } else if (kind < 1.5) {
    light = .035 + .05*fade + .09*scan;
    width = .45;
    glow = 0.;
  } else if (kind < 2.5) {
    float lf = 1. - abs(mix(-1., 1., t));
    // Traveling beads: param-keyed, identical for every strand, loop-periodic.
    float bead = pow(max(0., cos(t*TAU*2. - uPhase*2.)), 40.);
    light = .12 + .20*lf + .45*bead;
    width = .8 + .5*bead;
    glow = .35*bead;
  } else if (kind < 3.5) {
    float center = 1. - step(.5, abs(layer));
    light = mix(.16, .40, center);
    width = mix(.7, 1.15, center);
    glow = .2*center;
  } else {
    float center = 1. - step(.5, abs(layer));
    light = mix(.06 + .10*fade + .18*scan, .55, center);
    width = mix(.6, 1.3, center);
    glow = .3*center;
  }
  float depth = clamp(1.30 + eye.z/2600., .25, 1.);
  vLight = light*depth;
  vGlow = glow*depth;
  vEdge = aPosition.y;
  gl_Position = uProjectionMatrix * vec4(eye.xyz + side*aPosition.y*width*(1. + uHalo*5.), 1.);
}
`;
const ORBIT_FRAGMENT = `
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
  // Retained recording reset hook: all geometry is an absolute function of phase.
  sweepMix = 0;
}
function updateLoopTime() {
  const frame = isRecording ? recFrameCount : frameCount - 1;
  loopProgress = (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;
  phase = loopProgress * TAU;
  sweepMix = .5 - .5 * Math.cos(phase);
  // Start point glides THETA_STEP vertex spacings per loop; the closed polygon
  // set at phase 2PI is identical to phase 0, so the wrap is seamless.
  theta0 = phase * THETA_STEP / N_SIDES + 0.16 * Math.sin(phase);
}
function updateCamera() {
  perspective(Math.PI / 3.35, W / H, 10, 6000);
  const yaw = .62 + .55 * Math.sin(phase);
  const lift = -640 + 90 * Math.sin(2 * phase);
  camera(1400 * Math.sin(yaw), lift, 1400 * Math.cos(yaw), 0, 10, 0, 0, 1, 0);
}
function drawVertices() {
  // Accents on the active polygon: outer vertices and inner tangent contacts.
  for (let j = 0; j < N_SIDES; j++) {
    const a = theta0 + j * TAU * M_MAIN / N_SIDES;
    const c = a + Math.PI * M_MAIN / N_SIDES;
    worldPoint(Math.cos(a), Math.sin(a), 0, vertexCache[j * 2]);
    worldPoint(R_MAIN * Math.cos(c), R_MAIN * Math.sin(c), 0, vertexCache[j * 2 + 1]);
  }
  // Flat-filled spheres read as luminous discs from every camera angle.
  // Additive light is order independent, so accents skip the depth test.
  drawingContext.disable(drawingContext.DEPTH_TEST);
  noStroke();
  for (const [radius, alpha] of [[11, 18], [5, 70], [2.4, 255]]) {
    fill(INK_R, INK_G, INK_B, alpha);
    for (let j = 0; j < N_SIDES * 2; j++) {
      const v = vertexCache[j];
      push();
      translate(v[0], v[1], v[2]);
      sphere(j % 2 ? radius * 0.6 : radius, 10, 8);
      pop();
    }
  }
  drawingContext.enable(drawingContext.DEPTH_TEST);
}
function draw() {
  updateLoopTime();
  background(BG_R, BG_G, BG_B);
  updateCamera();
  push();
  // Keep the whole envelope between the header track and footer across the
  // loop, and clear of the cropped sides / right-hand action buttons on iPhone.
  translate(0, -40, 0);
  scale(0.72);
  noStroke();
  // Luminous additive layering: order independent, so no depth writes.
  drawingContext.depthMask(false);
  blendMode(ADD);
  shader(orbitShader);
  orbitShader.setUniform('uPhase', phase);
  orbitShader.setUniform('uTheta0', theta0);
  orbitShader.setUniform('uScan', LAYER_HALF * Math.sin(phase));
  orbitShader.setUniform('uHalo', 0);
  model(orbitMesh);
  orbitShader.setUniform('uHalo', 1);
  model(orbitMesh);
  resetShader();
  drawVertices();
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
  const info = { label: "HEPTAGRAM ORBIT FAMILY", note: "EVERY START CLOSES" };
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
  g.text("PONCELET’S PORISM", W * 0.5, SAFE_TOP + 30);
  g.textStyle(NORMAL);
  g.fill(INK_R, INK_G, INK_B, 122);
  g.textSize(24);
  g.text("CLOSED GEOMETRY", W * 0.5, SAFE_TOP + 86);
  g.fill(INK_R, INK_G, INK_B, 64);
  g.textSize(17);
  g.text("OUTER CONIC  ·  INNER CONIC  ·  ONE CLOSURE", W * 0.5, SAFE_TOP + 124);

  g.textAlign(LEFT, TOP);
  g.fill(INK_R, INK_G, INK_B, 78);
  g.textSize(19);
  g.text(info.label, SAFE_X, SAFE_TOP + 176);
  g.textAlign(RIGHT, TOP);
  g.text("SWEEP / " + Math.round(sweepMix * 100) + "%", W - SAFE_X, SAFE_TOP + 176);

  const trackX = SAFE_X, trackY = SAFE_TOP + 220, trackW = W - SAFE_X * 2;
  g.stroke(INK_R, INK_G, INK_B, 24);
  g.strokeWeight(1);
  g.line(trackX, trackY, trackX + trackW, trackY);
  g.stroke(INK_R, INK_G, INK_B, 150);
  g.strokeWeight(2.2);
  g.line(trackX, trackY, trackX + trackW * sweepMix, trackY);
  g.noStroke();
  for (const marker of [0, 0.25, 0.5, 0.75, 1]) {
    g.fill(INK_R, INK_G, INK_B, marker === 0.5 ? 132 : 58);
    g.circle(trackX + trackW * marker, trackY, marker === 0.5 ? 6 : 4);
  }

  g.textAlign(CENTER, CENTER);
  g.fill(INK_R, INK_G, INK_B, 58 + 132 * sweepMix);
  g.textSize(22);
  g.text(info.note, W * 0.5, SAFE_BOTTOM - 64);
  g.textSize(17);
  g.fill(INK_R, INK_G, INK_B, 96);
  g.text("VERTEX  ->  TANGENT  ->  VERTEX  ->  RETURN", W * 0.5, SAFE_BOTTOM - 32);

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
    saveCanvas("poncelet_porism_" + getTimestamp(), "png");
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
  a.download = "poncelet_porism_" + getTimestamp() + ".mp4";
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
