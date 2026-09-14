"use strict";

// DESCARTES’ CIRCLE THEOREM — APOLLONIAN GASKET
// Signed-curvature geometry; existing frame timing and recording pipeline.

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



// SETTINGS — world units are pixels at the initial camera scale.
const CONFIG = {
  enclosingRadius: 440,
  maxGeneration: 9,
  minRadius: 0.65,
  maxCircles: 3600,
  tangencyTolerance: 1e-7,
  generationInterval: 0.072,
  revealStart: 0.08,
  revealDuration: 0.035,
  zoomAmount: 2.25,
  zoomStart: 0.38,
  zoomEnd: 0.86,
  returnStart: 0.90,
  returnEnd: 0.985,
  lineWeight: 2.2,
};

let canvasEl;
let grainPg;
let hudPg;
let packingPg;
let circles = [];
let circleBuckets = new Map();
let focusPoint = { x: 0, y: 0 };
let visibleStats = { count: 4, generation: 0, minRadius: 0 };
let loopProgress = 0;
let phase = 0;
let muxer = null;
let encoder = null;
let isRecording = false;
let isFinalizing = false;
let recFrameCount = 0;

function setup() {
  const cnv = createCanvas(W, H, WEBGL);
  canvasEl = cnv.elt;
  pixelDensity(1);
  frameRate(FPS);
  colorMode(RGB, 255, 255, 255, 255);
  strokeCap(ROUND);
  grainPg = createGraphics(W, H);
  hudPg = createGraphics(W, H);
  packingPg = createGraphics(W, H);
  for (const graphics of [grainPg, hudPg, packingPg]) {
    graphics.pixelDensity(1);
  }
  bakeGrain();
  buildCirclePacking();
  bindUI();
  updateStaticUI();
}

// CIRCLE MODEL / SYMMETRICAL SEED
function createCircle(x, y, k, generation, parents = []) {
  return { x, y, k, r: Math.abs(1 / k), generation, parents, id: -1, birth: 0 };
}

function createSeedCircles() {
  const R = CONFIG.enclosingRadius;
  // Three equal disks: their centers form an equilateral triangle.
  // sqrt(3) * (R - r) = 2r, so each touches its peers and the enclosure.
  const r = R * Math.sqrt(3) / (2 + Math.sqrt(3));
  const seeds = [createCircle(0, 0, -1 / R, 0)];
  for (let i = 0; i < 3; i++) {
    const angle = -Math.PI / 2 + i * TAU / 3;
    seeds.push(createCircle(
      (R - r) * Math.cos(angle),
      (R - r) * Math.sin(angle),
      1 / r, 0
    ));
  }
  return seeds;
}

// DESCARTES MATH — complex bend-center reflection.
// For a known Descartes quadruple, replace d with the other solution:
// k' = 2(ka + kb + kc) - kd
// k'z' = 2(ka*za + kb*zb + kc*zc) - kd*zd.
// This is the paired-root form of k = sum(k) ± 2 sqrt(sum(ki*kj));
// using the known root avoids complex square-root branch ambiguity.
function solveDescartesCircle(parents, opposite, generation) {
  const k = 2 * parents.reduce((sum, c) => sum + c.k, 0) - opposite.k;
  if (!Number.isFinite(k) || k <= 0) return null;
  const x = (2 * parents.reduce((sum, c) => sum + c.k * c.x, 0)
    - opposite.k * opposite.x) / k;
  const y = (2 * parents.reduce((sum, c) => sum + c.k * c.y, 0)
    - opposite.k * opposite.y) / k;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return createCircle(x, y, k, generation, parents.map(c => c.id));
}

function isTangent(a, b) {
  const expected = a.k * b.k < 0 ? Math.abs(a.r - b.r) : a.r + b.r;
  const tolerance = CONFIG.tangencyTolerance * CONFIG.enclosingRadius;
  return Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - expected) <= tolerance;
}

// DUPLICATE CHECKING — nearby spatial buckets, then geometric comparison.
function bucketCoordinates(circle) {
  const cell = CONFIG.tangencyTolerance * CONFIG.enclosingRadius * 4;
  return [Math.floor(circle.x / cell), Math.floor(circle.y / cell)];
}

function isDuplicateCircle(circle) {
  const [bx, by] = bucketCoordinates(circle);
  const tolerance = CONFIG.tangencyTolerance * CONFIG.enclosingRadius;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const bucket = circleBuckets.get(`${bx + dx},${by + dy}`) || [];
      for (const existing of bucket) {
        if (Math.hypot(circle.x - existing.x, circle.y - existing.y) <= tolerance
          && Math.abs(circle.r - existing.r) <= tolerance
          && Math.abs(circle.k - existing.k) <= CONFIG.tangencyTolerance
            * Math.max(Math.abs(circle.k), Math.abs(existing.k))) return true;
      }
    }
  }
  return false;
}

function addCircle(circle) {
  circle.id = circles.length;
  circles.push(circle);
  const key = bucketCoordinates(circle).join(',');
  if (!circleBuckets.has(key)) circleBuckets.set(key, []);
  circleBuckets.get(key).push(circle);
}

// RECURSIVE GENERATION — bounded breadth-first Descartes reflections.
// Every child quadruple shares three tangent circles with its parent.
function buildCirclePacking() {
  circles = [];
  circleBuckets = new Map();
  const seeds = createSeedCircles();
  seeds.forEach(addCircle);
  const queue = [{ quad: seeds, depth: 0, replaced: -1 }];
  for (let cursor = 0; cursor < queue.length && circles.length < CONFIG.maxCircles; cursor++) {
    const node = queue[cursor];
    if (node.depth >= CONFIG.maxGeneration) continue;
    for (let slot = 0; slot < 4 && circles.length < CONFIG.maxCircles; slot++) {
      if (slot === node.replaced) continue; // Do not immediately reflect back.
      const parents = node.quad.filter((_, index) => index !== slot);
      const candidate = solveDescartesCircle(parents, node.quad[slot], node.depth + 1);
      if (!candidate || candidate.r < CONFIG.minRadius) continue;
      if (!parents.every(parent => isTangent(candidate, parent))) continue;
      if (Math.hypot(candidate.x, candidate.y) + candidate.r
        > CONFIG.enclosingRadius * (1 + CONFIG.tangencyTolerance)) continue;
      if (isDuplicateCircle(candidate)) continue;
      addCircle(candidate);
      const quad = node.quad.slice();
      quad[slot] = candidate;
      queue.push({ quad, depth: candidate.generation, replaced: slot });
    }
  }
  // Stable ordering: parents finish appearing before their children begin.
  for (let generation = 1; generation <= CONFIG.maxGeneration; generation++) {
    const layer = circles.filter(circle => circle.generation === generation);
    layer.forEach((circle, index) => {
      circle.birth = CONFIG.revealStart + (generation - 1) * CONFIG.generationInterval
        + index / Math.max(1, layer.length) * CONFIG.generationInterval * 0.45;
    });
  }
  // Push toward the first solved peripheral gap, itself a derived circle.
  const region = circles.find(circle => circle.generation === 1
    && Math.hypot(circle.x, circle.y) > CONFIG.enclosingRadius * 0.25);
  if (region) focusPoint = { x: region.x, y: region.y };
}

// ANIMATION / RENDERING — solve once; reveal fixed-radius circles in order.
function getReturnMix() {
  return smooth01((loopProgress - CONFIG.returnStart) / (CONFIG.returnEnd - CONFIG.returnStart));
}

function circleVisibility(circle) {
  if (circle.generation === 0) return 1;
  return smooth01((loopProgress - circle.birth) / CONFIG.revealDuration) * (1 - getReturnMix());
}

function renderFrame() {
  background(BG.r, BG.g, BG.b);
  const graphics = packingPg;
  graphics.clear();
  const zoomMix = smooth01((loopProgress - CONFIG.zoomStart)
    / (CONFIG.zoomEnd - CONFIG.zoomStart)) * (1 - getReturnMix());
  const zoom = 1 + (CONFIG.zoomAmount - 1) * zoomMix;
  const centerX = focusPoint.x * zoomMix;
  const centerY = focusPoint.y * zoomMix;
  visibleStats = { count: 0, generation: 0, minRadius: Infinity };
  graphics.push();
  // Keep geometry in its existing central stage, clear of the HUD.
  graphics.drawingContext.save();
  graphics.drawingContext.beginPath();
  graphics.drawingContext.rect(HUD.safeX, 462, W - 2 * HUD.safeX, 1010);
  graphics.drawingContext.clip();
  graphics.translate(W / 2, 964);
  graphics.scale(zoom);
  graphics.translate(-centerX, -centerY);
  for (const circle of circles) {
    const visibility = circleVisibility(circle);
    if (visibility <= 0) continue;
    visibleStats.count++;
    visibleStats.generation = Math.max(visibleStats.generation, circle.generation);
    if (circle.k > 0) visibleStats.minRadius = Math.min(visibleStats.minRadius, circle.r);
    renderCircle(graphics, circle, visibility, zoom);
    const age = loopProgress - circle.birth;
    if (circle.generation > 0 && age >= 0 && age < CONFIG.revealDuration * 2) {
      const markerAlpha = Math.sin(Math.PI * age / (CONFIG.revealDuration * 2))
        * (1 - getReturnMix());
      for (const id of circle.parents) renderTangencyPoint(graphics, circle, circles[id], markerAlpha, zoom);
    }
  }
  graphics.drawingContext.restore();
  graphics.pop();
  compositeHUD(graphics);
}

function renderCircle(graphics, circle, visibility, zoom) {
  const accent = circle.generation === 0 ? INK : CYAN;
  const emphasis = Math.max(0.35, 1 / (1 + circle.generation * 0.16));
  graphics.noFill();
  graphics.stroke(accent.r, accent.g, accent.b, 228 * emphasis * visibility);
  graphics.strokeWeight(CONFIG.lineWeight * emphasis / zoom);
  graphics.circle(circle.x, circle.y, circle.r * 2);
}

function renderTangencyPoint(graphics, circle, parent, alpha, zoom) {
  // Inner disks touch toward their neighbor; enclosure contact is outward.
  const distance = Math.hypot(parent.x - circle.x, parent.y - circle.y);
  if (distance === 0) return;
  const sign = parent.k < 0 ? -1 : 1;
  const x = circle.x + sign * circle.r * (parent.x - circle.x) / distance;
  const y = circle.y + sign * circle.r * (parent.y - circle.y) / distance;
  graphics.noStroke();
  graphics.fill(ACID.r, ACID.g, ACID.b, 174 * alpha);
  graphics.circle(x, y, 4 / zoom);
}

// HUD — retain the existing fonts, sizes, hierarchy, and anchor positions.
function drawScreenFinish() {
  const graphics = hudPg;
  graphics.clear();
  graphics.image(grainPg, 0, 0);
  drawCornerGuides(graphics);
  graphics.noStroke();
  graphics.textAlign(CENTER, CENTER);
  graphics.textFont('Georgia');
  graphics.textStyle(BOLD);
  graphics.textSize(72);
  graphics.fill(INK.r, INK.g, INK.b, 246);
  graphics.text("DESCARTES’ THEOREM", W / 2, HUD.titleY);
  graphics.textFont('monospace');
  graphics.textStyle(NORMAL);
  graphics.textSize(34);
  graphics.fill(INK.r, INK.g, INK.b, 228);
  graphics.text('(k₁+k₂+k₃+k₄)² = 2(k₁²+k₂²+k₃²+k₄²)', W / 2, HUD.formulaY);
  graphics.textSize(23);
  graphics.fill(CYAN.r, CYAN.g, CYAN.b, 220);
  graphics.text('k = 1/r · ENCLOSING CIRCLE: k = −1/R', W / 2, HUD.exponentY);
  graphics.textSize(26);
  graphics.fill(INK.r, INK.g, INK.b, 166);
  graphics.text('THREE TANGENCIES. ONE NEW CIRCLE.', W / 2, HUD.subtitleY);
  graphics.fill(INK.r, INK.g, INK.b, 235);
  graphics.textAlign(LEFT, TOP);
  const label = loopProgress >= CONFIG.returnStart ? 'LOOP RETURN'
    : visibleStats.generation === 0 ? 'SEED · FOUR TANGENT CIRCLES'
      : `GEN ${String(visibleStats.generation).padStart(2, '0')} · GAP SOLVING`;
  graphics.text(label, HUD.safeX, HUD.stageY);
  graphics.textAlign(RIGHT, TOP);
  graphics.textSize(22);
  graphics.text(`CIRCLES · ${visibleStats.count}`, W - HUD.safeX, HUD.stageY + 3);
  const progress = clamp(Math.round(loopProgress * LOOP_FRAMES) / (LOOP_FRAMES - 1), 0, 1);
  const indicatorX = HUD.safeX + (W - 2 * HUD.safeX) * progress;
  graphics.stroke(INK.r, INK.g, INK.b, 34);
  graphics.strokeWeight(1);
  graphics.line(HUD.safeX, HUD.trackY, W - HUD.safeX, HUD.trackY);
  graphics.stroke(INK.r, INK.g, INK.b, 184);
  graphics.strokeWeight(2.2);
  graphics.line(HUD.safeX, HUD.trackY, indicatorX, HUD.trackY);
  graphics.noStroke();
  graphics.fill(INK.r, INK.g, INK.b, 235);
  graphics.circle(indicatorX, HUD.trackY, 8);
  graphics.textAlign(CENTER, CENTER);
  graphics.textSize(28);
  graphics.fill(INK.r, INK.g, INK.b, HUD.bottomMainAlpha);
  graphics.text('EACH GAP INHERITS THE SAME RULE', W / 2, HUD.bottomTextY);
  graphics.text('APOLLONIAN CIRCLE PACKING', W / 2, HUD.bottomTextY + 38);
  graphics.textSize(22);
  graphics.fill(INK.r, INK.g, INK.b, HUD.citationAlpha);
  graphics.text(`MIN r · ${visibleStats.minRadius.toFixed(2)}   |   MAX k · ${(1 / visibleStats.minRadius).toFixed(4)}`,
    W / 2, HUD.citationY);
  compositeHUD(graphics);
}

const previewParam =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("preview")
    : null;

const previewProgress =
  previewParam === null
    ? NaN
    : Number(previewParam);


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
      `descartes_apollonian_gasket_${getTimestamp()}`,
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
      `descartes_apollonian_gasket_${getTimestamp()}.mp4`;

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
