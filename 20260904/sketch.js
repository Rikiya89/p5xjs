"use strict";

// ================================================================
// BERTRAND'S THEOREM — CLOSED ORBITS
// p5.js WEBGL
//
// 1080 × 1920
// 60 FPS
// 10-second seamless timeline
//
// Refactored version:
// - preserves existing visual behavior
// - preserves WebCodecs + mp4-muxer export
// - cleans corrupted operators / escaping
// - separates simulation, rendering, HUD, bloom, recording
// ================================================================


// ================================================================
// SERIES / EXPORT SETTINGS
// ================================================================

const W = 1080;
const H = 1920;
const FPS = 60;

const MAX_DURATION = 10;
const MAX_FRAMES = FPS * MAX_DURATION;
const LOOP_FRAMES = MAX_FRAMES;

const TAU = Math.PI * 2;


// ================================================================
// PALETTE
// ================================================================

const BG = {
  r: 3,
  g: 3,
  b: 5,
};

const INK = {
  r: 255,
  g: 255,
  b: 255,
};

const CYAN = {
  r: 0,
  g: 229,
  b: 255,
};

const MAGENTA = {
  r: 255,
  g: 61,
  b: 191,
};

const ACID = {
  r: 182,
  g: 255,
  b: 61,
};


// ================================================================
// SIMULATION / VISUAL CONFIG
// ================================================================

const CONFIG = {
  // Orbit
  gravityStrength: 1,
  eccentricity: 0.62,
  apoapsis: 1,

  // Numerical integration
  steps: 12,
  dt: 0.006,

  // Trail
  trailHistory: 600,
  preRoll: 118,

  // Scene
  orbitScale: 285,
  cameraDistance: 1120,

  // Bloom render resolution
  bloomScale: 0.5,

  // Gravity exponent animation
  baseExponent: 2.0,
  perturbExponent: 2.05,
  maxExponent: 2.11,
};


// ================================================================
// TIMELINE
// ================================================================

const BOUNDS = {
  closed: 0.18,
  perturb: 0.35,
  exponentRampEnd: 0.57,
  rosette: 0.72,
  structure: 0.88,
  returnEnd: 0.985,
  end: 1,
};

const PHASES = [
  {
    end: BOUNDS.closed,
    label: "01 · CLOSED ORBIT",
  },
  {
    end: BOUNDS.perturb,
    label: "02 · PERTURBATION",
  },
  {
    end: BOUNDS.rosette,
    label: "03 · PRECESSION",
  },
  {
    end: BOUNDS.structure,
    label: "04 · ORBITAL ROSETTE",
  },
  {
    end: BOUNDS.end,
    label: "05 · CLOSED ORBIT",
  },
];


// ================================================================
// HUD SETTINGS
// ================================================================

const HUD = {
  safeX: 56,
  stageY: 374,
  trackY: 418,

  titleY: 210,
  formulaY: 276,
  exponentY: 319,
  subtitleY: 348,

  bottomTextY: 1540,
  citationY: 1620,

  bottomMainAlpha: 174,
  citationAlpha: 112,
};


// ================================================================
// GLOBAL STATE
// ================================================================

let canvasEl;

let grainPg;
let hudPg;
let bloomPg;
let bloomStreakPg;

let perturbedFrames = [];
let closedFrames = [];
let backgroundStars = [];

let loopProgress = 0;
let phase = 0;

// Recording
let muxer = null;
let encoder = null;

let isRecording = false;
let isFinalizing = false;

let recFrameCount = 0;


// ================================================================
// PREVIEW PARAMETER
// Example:
// ?preview=0.5
// ================================================================

const previewParam =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("preview")
    : null;

const previewProgress =
  previewParam === null
    ? NaN
    : Number(previewParam);


// ================================================================
// SETUP
// ================================================================

function setup() {
  const cnv = createCanvas(W, H, WEBGL);

  canvasEl = cnv.elt;

  pixelDensity(1);
  frameRate(FPS);

  colorMode(RGB, 255, 255, 255, 255);
  strokeCap(ROUND);

  createRenderTargets();

  bakeGrain();
  buildBackgroundStars();
  buildOrbitFrames();

  bindUI();
  updateStaticUI();
}


// ================================================================
// RENDER TARGETS
// ================================================================

function createRenderTargets() {
  grainPg = createGraphics(W, H);
  grainPg.pixelDensity(1);

  hudPg = createGraphics(W, H);
  hudPg.pixelDensity(1);

  bloomPg = createGraphics(
    W * CONFIG.bloomScale,
    H * CONFIG.bloomScale,
    WEBGL
  );
  bloomPg.pixelDensity(1);

  bloomStreakPg = createGraphics(
    W * CONFIG.bloomScale,
    H * CONFIG.bloomScale
  );
  bloomStreakPg.pixelDensity(1);
}


// ================================================================
// DOM HELPERS
// ================================================================

function getElement(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = getElement(id);

  if (element) {
    element.textContent = value;
  }
}

function setDisabled(id, disabled) {
  const element = getElement(id);

  if (element) {
    element.disabled = disabled;
  }
}

function setProgress(percent) {
  const element = getElement("progressFill");

  if (element) {
    element.style.width = `${percent.toFixed(1)}%`;
  }
}

function bindUI() {
  const startButton = getElement("startBtn");
  const stopButton = getElement("stopBtn");

  if (startButton) {
    startButton.onclick = startRecording;
  }

  if (stopButton) {
    stopButton.onclick = stopRecording;
  }
}

function updateStaticUI() {
  setText("maxDuration", MAX_DURATION);
  setText("canvasSize", `${W} × ${H}`);
  setText("maxFrames", MAX_FRAMES);
}


// ================================================================
// MATH HELPERS
// ================================================================

function clamp(value, minValue, maxValue) {
  return Math.max(
    minValue,
    Math.min(maxValue, value)
  );
}

function smooth01(value) {
  const t = clamp(value, 0, 1);

  return t * t * (3 - 2 * t);
}

function segment(
  t,
  start,
  end,
  startValue,
  endValue
) {
  const normalized = (t - start) / (end - start);
  const eased = smooth01(normalized);

  return startValue +
    (endValue - startValue) * eased;
}


// ================================================================
// TIMELINE / FORCE EXPONENT
// ================================================================

function gravityExponentAt(t) {
  if (t < BOUNDS.closed) {
    return CONFIG.baseExponent;
  }

  if (t < BOUNDS.perturb) {
    return segment(
      t,
      BOUNDS.closed,
      BOUNDS.perturb,
      CONFIG.baseExponent,
      CONFIG.perturbExponent
    );
  }

  if (t < BOUNDS.exponentRampEnd) {
    return segment(
      t,
      BOUNDS.perturb,
      BOUNDS.exponentRampEnd,
      CONFIG.perturbExponent,
      CONFIG.maxExponent
    );
  }

  if (t < BOUNDS.structure) {
    return CONFIG.maxExponent;
  }

  return segment(
    t,
    BOUNDS.structure,
    BOUNDS.end,
    CONFIG.maxExponent,
    CONFIG.baseExponent
  );
}

function getCurrentPhase() {
  return (
    PHASES.find((item) => loopProgress < item.end) ||
    PHASES[PHASES.length - 1]
  );
}

function getReturnMix() {
  return smooth01(
    (loopProgress - BOUNDS.structure) /
    (BOUNDS.returnEnd - BOUNDS.structure)
  );
}


// ================================================================
// BACKGROUND GRAIN
// ================================================================

function bakeGrain() {
  grainPg.clear();
  grainPg.noStroke();

  randomSeed(20260904);

  const subtleCount = Math.floor(
    W * H * 0.0016
  );

  for (let i = 0; i < subtleCount; i++) {
    const value = random(110, 200);

    grainPg.fill(
      value,
      value,
      value,
      random(2, 7)
    );

    grainPg.circle(
      random(W),
      random(H),
      random(0.15, 0.85)
    );
  }

  const brightCount = Math.floor(
    W * H * 0.000035
  );

  for (let i = 0; i < brightCount; i++) {
    const value = random(210, 255);

    grainPg.fill(
      value,
      value,
      value,
      random(12, 34)
    );

    grainPg.circle(
      random(W),
      random(H),
      random(0.4, 1.2)
    );
  }
}


// ================================================================
// BACKGROUND STARS
// ================================================================

function buildBackgroundStars() {
  backgroundStars = [];

  randomSeed(20260904);

  const count = 86;

  for (let i = 0; i < count; i++) {
    backgroundStars.push({
      x: random(-W * 0.46, W * 0.46),
      y: random(-H * 0.34, H * 0.34),
      z: random(-240, 120),

      size: random(0.45, 1.45),
      alpha: random(12, 42),

      pulse: random(TAU),
    });
  }
}


// ================================================================
// ORBIT SIMULATION
// ================================================================

function createOrbitState() {
  return {
    x: CONFIG.apoapsis,
    y: 0,

    vx: 0,

    vy: Math.sqrt(
      CONFIG.gravityStrength *
      (1 - CONFIG.eccentricity) /
      CONFIG.apoapsis
    ),
  };
}

function calculateAcceleration(x, y, exponent) {
  const radiusSquared = Math.max(
    x * x + y * y,
    0.0025
  );

  const radius = Math.sqrt(radiusSquared);

  const force =
    -CONFIG.gravityStrength /
    Math.pow(radius, exponent + 1);

  return {
    x: x * force,
    y: y * force,
  };
}

function verlet(state, exponent, dt) {
  const a0 = calculateAcceleration(
    state.x,
    state.y,
    exponent
  );

  const nextX =
    state.x +
    state.vx * dt +
    0.5 * a0.x * dt * dt;

  const nextY =
    state.y +
    state.vy * dt +
    0.5 * a0.y * dt * dt;

  const a1 = calculateAcceleration(
    nextX,
    nextY,
    exponent
  );

  state.vx +=
    0.5 * (a0.x + a1.x) * dt;

  state.vy +=
    0.5 * (a0.y + a1.y) * dt;

  state.x = nextX;
  state.y = nextY;
}

function advanceOrbit(state, exponent) {
  const samples = [];
  for (let i = 0; i < CONFIG.steps; i++) {
    verlet(
      state,
      exponent,
      CONFIG.dt
    );

    // Retain existing integration steps for smooth, physically sampled curves.
    samples.push({ x: state.x, y: state.y });
  }

  return {
    samples,
    x: state.x,
    y: state.y,

    radius: Math.hypot(
      state.x,
      state.y
    ),

    speed: Math.hypot(
      state.vx,
      state.vy
    ),

    exponent,
  };
}

function buildOrbitFrames() {
  perturbedFrames = [];
  closedFrames = [];

  const perturbedState = createOrbitState();
  const closedState = createOrbitState();

  for (
    let frame = -CONFIG.preRoll;
    frame < MAX_FRAMES;
    frame++
  ) {
    const normalizedFrame = clamp(
      frame / (MAX_FRAMES - 1),
      0,
      1
    );

    const exponent =
      frame < 0
        ? CONFIG.baseExponent
        : gravityExponentAt(normalizedFrame);

    perturbedFrames.push(
      advanceOrbit(
        perturbedState,
        exponent
      )
    );

    closedFrames.push(
      advanceOrbit(
        closedState,
        CONFIG.baseExponent
      )
    );
  }
}


// ================================================================
// FRAME LOOKUP
// ================================================================

function getFrameArrayIndex() {
  const timelineFrame = Math.floor(
    loopProgress * (MAX_FRAMES - 1)
  );

  return clamp(
    CONFIG.preRoll + timelineFrame,
    0,
    perturbedFrames.length - 1
  );
}


// ================================================================
// LOOP TIME
// ================================================================

function updateLoopTime() {
  if (Number.isFinite(previewProgress) && !isRecording) {
    loopProgress = clamp(
      previewProgress,
      0,
      0.999999
    );
  } else if (isRecording) {
    loopProgress = clamp(
      recFrameCount / (MAX_FRAMES - 1),
      0,
      0.999999
    );
  } else {
    loopProgress =
      ((frameCount - 1) % LOOP_FRAMES) /
      LOOP_FRAMES;
  }

  phase = loopProgress * TAU;
}


// ================================================================
// MAIN LOOP
// ================================================================

function draw() {
  updateLoopTime();

  renderFrame();
  drawScreenFinish();

  if (isRecording) {
    captureFrame();

    recFrameCount++;

    updateRecordingUI();

    if (recFrameCount >= MAX_FRAMES) {
      stopRecording();
    }
  }
}


// ================================================================
// MAIN RENDER
// ================================================================

function renderFrame() {
  background(
    BG.r,
    BG.g,
    BG.b
  );

  perspective(
    PI / 3.35,
    W / H,
    10,
    5000
  );

  setupCamera();

  drawEnvironment();

  push();

  applySculptureTransform();

  drawFieldStructure();
  drawClosedReference();
  drawOrbitTrail();
  drawCentralMass();
  drawOrbitingBody();

  pop();

  renderBloomSource();
  streakBloom();
  compositeBloom();
}


// ================================================================
// CAMERA
// ================================================================

function setupCamera(target = window) {
  const breathing =
    1 +
    0.012 *
    Math.sin(
      phase - PI * 0.35
    );

  target.camera(
    0,
    0,
    CONFIG.cameraDistance * breathing,

    0,
    35,
    0,

    0,
    1,
    0
  );
}


// ================================================================
// SCULPTURE TRANSFORM
// ================================================================

function applySculptureTransform(target = window) {
  const emergence = smooth01(
    (loopProgress - 0.24) / 0.52
  );

  target.translate(
    0,
    -30,
    0
  );

  target.rotateX(
    -0.08 +
    0.045 * Math.sin(phase)
  );

  target.rotateY(
    0.10 *
    Math.sin(phase)
  );

  target.rotateZ(
    -0.11 +
    0.035 *
    Math.sin(phase) *
    emergence
  );
}


// ================================================================
// ENVIRONMENT
// ================================================================

function drawEnvironment() {
  push();

  blendMode(ADD);
  noStroke();

  for (const star of backgroundStars) {
    const pulse =
      0.78 +
      0.22 *
      Math.sin(
        phase + star.pulse
      );

    fill(
      INK.r,
      INK.g,
      INK.b,
      star.alpha * pulse
    );

    push();

    translate(
      star.x,
      star.y,
      star.z
    );

    circle(
      0,
      0,
      star.size
    );

    pop();
  }

  blendMode(BLEND);

  pop();
}


// ================================================================
// CENTRAL FIELD STRUCTURE
// ================================================================

function drawFieldStructure(
  target = window,
  alphaScale = 1
) {
  target.push();

  target.noFill();
  target.blendMode(ADD);

  // Inner concentric rings
  for (let i = 0; i < 4; i++) {
    const radius =
      34 +
      i * 27;

    target.stroke(
      CYAN.r,
      CYAN.g,
      CYAN.b,
      (20 - i * 3) * alphaScale
    );

    target.strokeWeight(0.75);

    target.circle(
      0,
      0,
      radius * 2
    );
  }

  // Radial ticks
  target.rotateZ(
    Math.sin(phase) * 0.035
  );

  const tickCount = 24;
  const innerRadius = 112;

  for (let i = 0; i < tickCount; i++) {
    const angle =
      (i / tickCount) * TAU;

    const major =
      i % 6 === 0;

    const outerRadius =
      innerRadius +
      (major ? 13 : 6);

    target.stroke(
      INK.r,
      INK.g,
      INK.b,
      (major ? 26 : 12) *
      alphaScale
    );

    target.line(
      Math.cos(angle) * innerRadius,
      Math.sin(angle) * innerRadius,

      Math.cos(angle) * outerRadius,
      Math.sin(angle) * outerRadius
    );
  }

  target.blendMode(BLEND);

  target.pop();
}


// ================================================================
// CLOSED-ORBIT REFERENCE
// ================================================================

function drawClosedReference(
  target = window,
  alphaScale = 1
) {
  const end = CONFIG.preRoll;

  const start = Math.max(
    0,
    end - 184
  );

  const alpha =
    14;

  target.push();

  target.noFill();
  target.blendMode(ADD);

  target.beginShape();

  for (let i = start; i <= end; i++) {
    const orbit = closedFrames[i];

    const age =
      (i - start) /
      Math.max(1, end - start);

    const visibility =
      smooth01(age);

    target.stroke(
      CYAN.r,
      CYAN.g,
      CYAN.b,
      alpha *
      visibility *
      alphaScale
    );

    target.strokeWeight(
      (0.65 + 1.05 * age) *
      alphaScale
    );

    for (const sample of orbit.samples) {
      target.vertex(
        sample.x * CONFIG.orbitScale,
        sample.y * CONFIG.orbitScale,
        -5
      );
    }
  }

  target.endShape();

  target.blendMode(BLEND);

  target.pop();
}


// ================================================================
// PERTURBED ORBIT TRAIL
// ================================================================

function getTrailVisibility(
  index,
  end
) {
  const start = Math.max(
    0,
    end - CONFIG.trailHistory
  );

  const age = clamp(
    (index - start) /
    Math.max(1, end - start),
    0,
    1
  );

  return (
    Math.pow(age, 0.72)
  );
}

function getTrailColor(
  orbit,
  visibility,
  alphaScale = 1
) {
  const periapsis =
    1 -
    smooth01(
      (orbit.radius - 0.2) /
      0.8
    );

  const precession =
    smooth01(
      (orbit.exponent -
        CONFIG.baseExponent) /
      (
        CONFIG.maxExponent -
        CONFIG.baseExponent
      )
    );

  const exponentMix =
    precession * 0.82;

  const baseR = lerp(
    CYAN.r,
    MAGENTA.r,
    exponentMix
  );

  const baseG = lerp(
    CYAN.g,
    MAGENTA.g,
    exponentMix
  );

  const baseB = lerp(
    CYAN.b,
    MAGENTA.b,
    exponentMix
  );

  return {
    r: lerp(
      baseR,
      ACID.r,
      periapsis * 0.32
    ),

    g: lerp(
      baseG,
      ACID.g,
      periapsis * 0.32
    ),

    b: lerp(
      baseB,
      ACID.b,
      periapsis * 0.32
    ),

    alpha:
      (
        20 +
        172 * visibility +
        44 * periapsis
      ) *
      alphaScale,

    weight:
      (
        0.55 +
        1.65 * visibility +
        0.75 * periapsis
      ) *
      alphaScale,
  };
}

function drawOrbitTrail(
  target = window,
  alphaScale = 1,
  end = getFrameArrayIndex(),
  opacity = 1 - getReturnMix()
) {
  // Crossfade to the exact opening trail; this is a visual loop transition.
  if (arguments.length < 3 && getReturnMix() > 0) {
    drawOrbitTrail(target, alphaScale, CONFIG.preRoll, getReturnMix());
  }
  if (opacity <= 0) return;

  const start = Math.max(
    0,
    end - CONFIG.trailHistory
  );

  target.push();

  target.noFill();
  target.blendMode(ADD);

  // Continuous trail
  target.beginShape();

  for (let i = start; i <= end; i++) {
    const orbit =
      perturbedFrames[i];

    const visibility =
      getTrailVisibility(
        i,
        end
      );

    const colorData =
      getTrailColor(
        orbit,
        visibility,
        alphaScale
      );

    target.stroke(
      colorData.r,
      colorData.g,
      colorData.b,
      colorData.alpha * opacity
    );

    target.strokeWeight(
      colorData.weight
    );

    for (const sample of orbit.samples) {
      target.vertex(
        sample.x * CONFIG.orbitScale,
        sample.y * CONFIG.orbitScale,
        0
      );
    }
  }

  target.endShape();

  // Temporal sample points
  const firstMarker =
    start +
    ((30 - (start % 30)) % 30);

  for (
    let i = firstMarker;
    i <= end;
    i += 30
  ) {
    const orbit =
      perturbedFrames[i];

    const visibility =
      getTrailVisibility(
        i,
        end
      );

    target.stroke(
      MAGENTA.r,
      MAGENTA.g,
      MAGENTA.b,
      72 *
      visibility *
      alphaScale * opacity
    );

    target.strokeWeight(
      2.2 * alphaScale
    );

    target.point(
      orbit.x * CONFIG.orbitScale,
      orbit.y * CONFIG.orbitScale,
      2
    );
  }

  target.blendMode(BLEND);

  target.pop();
}


// ================================================================
// CENTRAL MASS
// ================================================================

function drawCentralMass(
  target = window,
  alphaScale = 1
) {
  const pulse =
    0.5 +
    0.5 *
    Math.sin(phase * 2);

  target.push();

  target.blendMode(ADD);
  target.noStroke();

  // Outer cyan halo
  target.fill(
    CYAN.r,
    CYAN.g,
    CYAN.b,
    (24 + 12 * pulse) *
    alphaScale
  );

  target.circle(
    0,
    0,
    (45 + 4 * pulse) *
    alphaScale
  );

  // Magenta core halo
  target.fill(
    MAGENTA.r,
    MAGENTA.g,
    MAGENTA.b,
    52 * alphaScale
  );

  target.circle(
    0,
    0,
    (20 + 2 * pulse) *
    alphaScale
  );

  // White singularity
  target.fill(
    INK.r,
    INK.g,
    INK.b,
    242 * alphaScale
  );

  target.circle(
    0,
    0,
    (7 + pulse) *
    alphaScale
  );

  target.blendMode(BLEND);

  target.pop();
}


// ================================================================
// ORBITING BODY
// ================================================================

function drawOrbitingBody(
  target = window,
  alphaScale = 1
) {
  const index =
    getFrameArrayIndex();

  const perturbed =
    perturbedFrames[index];

  const closed =
    perturbedFrames[CONFIG.preRoll];

  const returnMix =
    getReturnMix();

  const x =
    lerp(
      perturbed.x,
      closed.x,
      returnMix
    ) *
    CONFIG.orbitScale;

  const y =
    lerp(
      perturbed.y,
      closed.y,
      returnMix
    ) *
    CONFIG.orbitScale;

  const radius =
    lerp(
      perturbed.radius,
      closed.radius,
      returnMix
    );

  const periapsis =
    1 -
    smooth01(
      (radius - 0.2) /
      0.8
    );

  target.push();

  target.translate(
    x,
    y,
    8
  );

  target.blendMode(ADD);
  target.noStroke();

  // Acid halo
  target.fill(
    ACID.r,
    ACID.g,
    ACID.b,
    (34 + 42 * periapsis) *
    alphaScale
  );

  target.circle(
    0,
    0,
    (24 + 13 * periapsis) *
    alphaScale
  );

  // White body
  target.fill(
    INK.r,
    INK.g,
    INK.b,
    245 * alphaScale
  );

  target.circle(
    0,
    0,
    (6.5 + 3.5 * periapsis) *
    alphaScale
  );

  target.blendMode(BLEND);

  target.pop();
}


// ================================================================
// BLOOM SOURCE
// ================================================================

function renderBloomSource() {
  const target = bloomPg;

  target.push();

  target.background(0);

  target.perspective(
    PI / 3.35,
    W / H,
    10,
    5000
  );

  setupCamera(target);

  // Convert original 1080 × 1920 coordinates
  // into the half-resolution bloom buffer.
  target.scale(
    CONFIG.bloomScale
  );

  applySculptureTransform(target);

  drawClosedReference(
    target,
    1.6
  );

  drawOrbitTrail(
    target,
    1.75
  );

  drawCentralMass(
    target,
    1.8
  );

  drawOrbitingBody(
    target,
    1.8
  );

  target.pop();
}


// ================================================================
// HORIZONTAL STREAK BLOOM
// ================================================================

function streakBloom() {
  const target =
    bloomStreakPg;

  const taps = 8;

  const spread =
    3 +
    smooth01(
      (loopProgress - 0.35) /
      0.42
    ) *
    3;

  target.clear();

  target.push();

  target.blendMode(ADD);
  target.imageMode(CENTER);

  for (
    let offset = -taps;
    offset <= taps;
    offset++
  ) {
    const falloff =
      1 -
      Math.abs(offset) /
      taps;

    target.tint(
      255,
      255,
      255,
      7 *
      falloff *
      falloff
    );

    target.image(
      bloomPg,

      target.width / 2 +
      offset * spread,

      target.height / 2
    );
  }

  target.pop();
}


// ================================================================
// BLOOM COMPOSITE
// ================================================================

function compositeBloom() {
  push();

  drawingContext.disable(
    drawingContext.DEPTH_TEST
  );

  resetMatrix();

  camera(
    0,
    0,
    1,

    0,
    0,
    0,

    0,
    1,
    0
  );

  ortho(
    -W / 2,
    W / 2,

    -H / 2,
    H / 2,

    -10,
    10
  );

  noLights();

  blendMode(ADD);

  tint(
    255,
    255,
    255,
    190
  );

  image(
    bloomStreakPg,
    -W / 2,
    -H / 2,
    W,
    H
  );

  noTint();

  blendMode(BLEND);

  drawingContext.enable(
    drawingContext.DEPTH_TEST
  );

  pop();
}


// ================================================================
// FORMULA HUD
// ================================================================

function drawFormula(
  graphics,
  exponent
) {
  graphics.textStyle(NORMAL);
  graphics.textFont("monospace");
  graphics.textAlign(CENTER, CENTER);

  graphics.textSize(34);

  graphics.fill(
    INK.r,
    INK.g,
    INK.b,
    228
  );

  graphics.text(
    "F(r)  ∝  −1 / rⁿ",
    W * 0.5,
    HUD.formulaY
  );

  const exponentMix =
    smooth01(
      (
        exponent -
        CONFIG.baseExponent
      ) /
      (
        CONFIG.maxExponent -
        CONFIG.baseExponent
      )
    );

  graphics.textSize(23);

  graphics.fill(
    lerp(
      CYAN.r,
      MAGENTA.r,
      exponentMix
    ),
    lerp(
      CYAN.g,
      MAGENTA.g,
      exponentMix
    ),
    lerp(
      CYAN.b,
      MAGENTA.b,
      exponentMix
    ),
    220
  );

  graphics.text(
    `n = ${exponent.toFixed(3)}`,
    W * 0.5,
    HUD.exponentY
  );
}


// ================================================================
// SCREEN HUD / FINISH
// ================================================================

function drawScreenFinish() {
  const graphics = hudPg;

  const phaseInfo =
    getCurrentPhase();

  const progress =
    clamp(
      Math.round(
        loopProgress *
        LOOP_FRAMES
      ) /
      (LOOP_FRAMES - 1),
      0,
      1
    );

  const exponent =
    gravityExponentAt(
      loopProgress
    );

  graphics.clear();

  graphics.image(
    grainPg,
    0,
    0
  );

  drawCornerGuides(graphics);

  drawTitleHUD(
    graphics,
    exponent
  );

  drawTimelineHUD(
    graphics,
    phaseInfo,
    progress,
    exponent
  );

  drawBottomHUD(graphics);

  compositeHUD(graphics);
}


// ================================================================
// HUD — CORNER GUIDES
// ================================================================

function drawCornerGuides(graphics) {
  graphics.noFill();

  graphics.stroke(
    255,
    255,
    255,
    38
  );

  graphics.strokeWeight(0.7);

  const margin = 34;
  const length = 24;

  // Top left
  graphics.line(
    margin,
    margin,

    margin + length,
    margin
  );

  graphics.line(
    margin,
    margin,

    margin,
    margin + length
  );

  // Top right
  graphics.line(
    W - margin,
    margin,

    W - margin - length,
    margin
  );

  graphics.line(
    W - margin,
    margin,

    W - margin,
    margin + length
  );

  // Bottom left
  graphics.line(
    margin,
    H - margin,

    margin + length,
    H - margin
  );

  graphics.line(
    margin,
    H - margin,

    margin,
    H - margin - length
  );

  // Bottom right
  graphics.line(
    W - margin,
    H - margin,

    W - margin - length,
    H - margin
  );

  graphics.line(
    W - margin,
    H - margin,

    W - margin,
    H - margin - length
  );
}


// ================================================================
// HUD — TITLE
// ================================================================

function drawTitleHUD(
  graphics,
  exponent
) {
  graphics.noStroke();

  graphics.textFont("Georgia");
  graphics.textAlign(CENTER, CENTER);
  graphics.textStyle(BOLD);

  graphics.fill(
    255,
    255,
    255,
    246
  );

  graphics.textSize(72);

  graphics.text(
    "BERTRAND'S THEOREM",
    W * 0.5,
    HUD.titleY
  );

  drawFormula(
    graphics,
    exponent
  );

  graphics.textStyle(NORMAL);
  graphics.textFont("monospace");

  graphics.fill(
    255,
    255,
    255,
    166
  );

  graphics.textSize(26);

  graphics.text(
    "A TINY CHANGE. THE ORBIT STOPS CLOSING.",
    W * 0.5,
    HUD.subtitleY
  );
}


// ================================================================
// HUD — TIMELINE
// ================================================================

function drawTimelineHUD(
  graphics,
  phaseInfo,
  progress,
  exponent
) {
  graphics.push();

  graphics.textFont("monospace");

  // Stage label
  graphics.textAlign(
    LEFT,
    TOP
  );

  graphics.fill(
    255,
    255,
    255,
    235
  );

  graphics.textSize(26);

  graphics.text(
    phaseInfo.label,
    HUD.safeX,
    HUD.stageY
  );

  // Force exponent
  graphics.textAlign(
    RIGHT,
    TOP
  );

  graphics.textSize(22);

  graphics.text(
    `FORCE EXPONENT · ${exponent.toFixed(3)}`,
    W - HUD.safeX,
    HUD.stageY + 3
  );

  // Track
  const indicatorX =
    lerp(
      HUD.safeX,
      W - HUD.safeX,
      progress
    );

  graphics.stroke(
    255,
    255,
    255,
    34
  );

  graphics.strokeWeight(1);

  graphics.line(
    HUD.safeX,
    HUD.trackY,

    W - HUD.safeX,
    HUD.trackY
  );

  // Progress
  graphics.stroke(
    255,
    255,
    255,
    184
  );

  graphics.strokeWeight(2.2);

  graphics.line(
    HUD.safeX,
    HUD.trackY,

    indicatorX,
    HUD.trackY
  );

  // Indicator
  graphics.noStroke();

  graphics.fill(
    255,
    255,
    255,
    235
  );

  graphics.circle(
    indicatorX,
    HUD.trackY,
    8
  );

  graphics.pop();
}


// ================================================================
// HUD — BOTTOM COPY
// ================================================================

function drawBottomHUD(graphics) {
  graphics.textAlign(
    CENTER,
    CENTER
  );

  graphics.textFont("monospace");

  graphics.fill(
    255,
    255,
    255,
    HUD.bottomMainAlpha
  );

  graphics.textSize(28);

  graphics.text(
    "ONLY TWO CENTRAL FORCES",
    W * 0.5,
    HUD.bottomTextY
  );

  graphics.text(
    "CLOSE EVERY BOUNDED ORBIT",
    W * 0.5,
    HUD.bottomTextY + 38
  );

  graphics.textSize(22);

  graphics.fill(
    255,
    255,
    255,
    HUD.citationAlpha
  );

  graphics.text(
    "INVERSE-SQUARE GRAVITY · CLOSED → PRECESSING",
    W * 0.5,
    HUD.citationY
  );
}


// ================================================================
// HUD COMPOSITE
// ================================================================

function compositeHUD(graphics) {
  push();

  drawingContext.disable(
    drawingContext.DEPTH_TEST
  );

  resetMatrix();

  camera(
    0,
    0,
    1,

    0,
    0,
    0,

    0,
    1,
    0
  );

  ortho(
    -W / 2,
    W / 2,

    -H / 2,
    H / 2,

    -10,
    10
  );

  noLights();

  blendMode(BLEND);

  image(
    graphics,
    -W / 2,
    -H / 2,
    W,
    H
  );

  drawingContext.enable(
    drawingContext.DEPTH_TEST
  );

  pop();
}


// ================================================================
// KEYBOARD
// ================================================================

function keyReleased() {
  if (key === "h" || key === "H") {
    const controls = getElement("controls");
    if (controls) controls.hidden = !controls.hidden;
    return false;
  }

  if (
    key === "r" ||
    key === "R"
  ) {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }

    return false;
  }

  if (
    key === "s" ||
    key === "S"
  ) {
    saveCanvas(
      `bertrands_theorem_closed_orbits_${getTimestamp()}`,
      "png"
    );

    return false;
  }

  return true;
}


// ================================================================
// RECORDING UI
// ================================================================

function updateRecordingUI() {
  setText(
    "duration",
    (recFrameCount / FPS).toFixed(1)
  );

  setText(
    "frameCount",
    recFrameCount
  );

  setProgress(
    (
      recFrameCount /
      MAX_FRAMES
    ) *
    100
  );
}


// ================================================================
// START RECORDING
// ================================================================

function startRecording() {
  if (
    isRecording ||
    isFinalizing
  ) {
    return;
  }

  if (
    typeof VideoEncoder ===
    "undefined"
  ) {
    alert(
      "WebCodecs not supported."
    );

    return;
  }

  if (
    typeof Mp4Muxer ===
    "undefined"
  ) {
    alert(
      "mp4-muxer not loaded."
    );

    return;
  }

  muxer =
    new Mp4Muxer.Muxer({
      target:
        new Mp4Muxer.ArrayBufferTarget(),

      video: {
        codec: "avc",
        width: W,
        height: H,
      },

      fastStart: "in-memory",

      firstTimestampBehavior:
        "offset",
    });

  encoder =
    new VideoEncoder({
      output: (
        chunk,
        metadata
      ) => {
        muxer.addVideoChunk(
          chunk,
          metadata
        );
      },

      error: (error) => {
        console.error(error);

        isRecording = false;
        isFinalizing = false;

        setStatus(
          "Error",
          "#f44"
        );
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

  loopProgress = 0;
  phase = 0;

  isRecording = true;

  setText(
    "duration",
    "0.0"
  );

  setText(
    "frameCount",
    "0"
  );

  setDisabled(
    "startBtn",
    true
  );

  setDisabled(
    "stopBtn",
    false
  );

  setProgress(0);

  setStatus(
    "Recording…",
    "#fff"
  );
}


// ================================================================
// STOP RECORDING
// ================================================================

async function stopRecording() {
  if (
    !encoder ||
    !muxer ||
    isFinalizing
  ) {
    return;
  }

  isRecording = false;
  isFinalizing = true;

  setDisabled(
    "stopBtn",
    true
  );

  setStatus(
    "Finalizing…",
    "#ccc"
  );

  try {
    await encoder.flush();

    muxer.finalize();

    const buffer =
      muxer.target.buffer;

    const blob =
      new Blob(
        [buffer],
        {
          type: "video/mp4",
        }
      );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;

    anchor.download =
      `bertrands_theorem_closed_orbits_${getTimestamp()}.mp4`;

    anchor.click();

    setTimeout(
      () => {
        URL.revokeObjectURL(url);
      },
      1000
    );

    setStatus(
      "Saved",
      "#8f8"
    );
  } catch (error) {
    console.error(error);

    setStatus(
      "Error",
      "#f44"
    );
  } finally {
    if (
      encoder &&
      encoder.state !== "closed"
    ) {
      encoder.close();
    }

    encoder = null;
    muxer = null;

    isFinalizing = false;

    setDisabled(
      "startBtn",
      false
    );

    setDisabled(
      "stopBtn",
      true
    );
  }
}


// ================================================================
// FRAME CAPTURE
// ================================================================

function captureFrame() {
  if (
    !encoder ||
    encoder.state !== "configured"
  ) {
    return;
  }

  const timestamp =
    Math.round(
      recFrameCount *
      1_000_000 /
      FPS
    );

  const frame =
    new VideoFrame(
      canvasEl,
      {
        timestamp,
      }
    );

  encoder.encode(
    frame,
    {
      keyFrame:
        recFrameCount %
        FPS ===
        0,
    }
  );

  frame.close();
}


// ================================================================
// STATUS
// ================================================================

function setStatus(
  textValue,
  colorValue
) {
  const status =
    getElement("status");

  if (!status) {
    return;
  }

  status.textContent =
    textValue;

  status.style.color =
    colorValue;
}


// ================================================================
// TIMESTAMP
// ================================================================

function getTimestamp() {
  const date = new Date();

  const year =
    date
      .getFullYear()
      .toString();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  const hour =
    String(
      date.getHours()
    ).padStart(2, "0");

  const minute =
    String(
      date.getMinutes()
    ).padStart(2, "0");

  const second =
    String(
      date.getSeconds()
    ).padStart(2, "0");

  return (
    `${year}${month}${day}_` +
    `${hour}${minute}${second}`
  );
}
