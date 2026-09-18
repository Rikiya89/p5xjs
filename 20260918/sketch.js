"use strict";

// PONCELET’S PORISM — HOMOTHETIC ELLIPSES
// Repeated tangent/intersection construction in unit-circle space, affinely
// mapped to the displayed ellipse pair. Affine maps preserve tangency.

const W = 1080;
const H = 1920;
const FPS = 60;

const MAX_DURATION = 10;
const MAX_FRAMES = FPS * MAX_DURATION;
const LOOP_FRAMES = MAX_FRAMES;
const TAU = Math.PI * 2;

const BG = { r: 3, g: 3, b: 5 };
const INK = { r: 255, g: 255, b: 255 };
const CYAN = { r: 0, g: 229, b: 255 };
const MAGENTA = { r: 255, g: 61, b: 191 };
const ACID = { r: 182, g: 255, b: 61 };

const HUD = {
  safeX: 56,
  stageTextX: 84,
  rightTextX: 140,
  stageY: 374,
  trackY: 418,
  titleY: 210,
  formulaY: 276,
  exponentY: 319,
  subtitleY: 348,
  bottomTextY: 1410,
  citationY: 1490,
  bottomMainAlpha: 174,
  citationAlpha: 112,
};

// For concentric circles, r/R = cos(pi/n) gives an exact closed n-orbit.
// Scaling and rotating both circles produces the homothetic ellipse pair.
const CONFIG = {
  sides: 5,
  outerA: 410,
  outerB: 312,
  ellipseRotation: -0.16,
  centerX: W / 2,
  centerY: 956,
  stageTop: 462,
  stageHeight: 1010,
  ellipseWeight: 2.2,
  orbitWeight: 4.2,
  constructionWeight: 1.15,
  trailWeight: 1.55,
  trailCount: 24,
  trailStep: 0.0085,
  envelopeCount: 12,
  conicTickCount: 48,
  constructionCycles: 2,
  closureTolerance: 1e-7,
  epsilon: 1e-10,
};

let canvasEl;
let grainPg;
let hudPg;
let geometryPg;
let loopProgress = 0;
let phase = 0;
let currentOrbit = null;
let currentOuterB = CONFIG.outerB;
let currentStartAngle = 0;
let constructionState = null;
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
  geometryPg = createGraphics(W, H);
  for (const graphics of [grainPg, hudPg, geometryPg]) graphics.pixelDensity(1);
  bakeGrain();
  bindUI();
  updateStaticUI();
}

// ================================================================
// PONCELET GEOMETRY
// ================================================================

function pointOnUnitCircle(angle) {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function ellipsePointFromUnit(point, semiA, semiB) {
  const x = point.x * semiA;
  const y = point.y * semiB;
  const c = Math.cos(CONFIG.ellipseRotation);
  const s = Math.sin(CONFIG.ellipseRotation);
  return {
    x: CONFIG.centerX + x * c - y * s,
    y: CONFIG.centerY + x * s + y * c,
  };
}

function tangentPointToInnerCircle(point, innerScale, direction = 1) {
  // q·p=r² and |q|=r define the two tangency points from |p|=1.
  const perpendicularScale = innerScale * Math.sqrt(
    Math.max(0, 1 - innerScale * innerScale)
  );
  return {
    x: innerScale * innerScale * point.x
      - direction * perpendicularScale * point.y,
    y: innerScale * innerScale * point.y
      + direction * perpendicularScale * point.x,
  };
}

function nextCircleIntersectionThroughPoint(point, linePoint) {
  // Intersect p + lambda*d with the unit circle. Since lambda=0 is one
  // root, Vieta gives the second without fragile quadratic subtraction.
  const dx = linePoint.x - point.x;
  const dy = linePoint.y - point.y;
  const denominator = dx * dx + dy * dy;
  if (denominator < CONFIG.epsilon) return null;
  const lambda = -2 * (point.x * dx + point.y * dy) / denominator;
  return {
    x: point.x + lambda * dx,
    y: point.y + lambda * dy,
  };
}

function constructPonceletOrbit(startAngle, semiB = CONFIG.outerB) {
  const sideCount = CONFIG.sides;
  const innerScale = Math.cos(Math.PI / sideCount);
  const unitVertices = [pointOnUnitCircle(startAngle)];
  const unitContacts = [];

  for (let i = 0; i < sideCount; i++) {
    const current = unitVertices[i];
    const contact = tangentPointToInnerCircle(current, innerScale, 1);
    const next = nextCircleIntersectionThroughPoint(current, contact);
    if (!next) return null;
    unitContacts.push(contact);
    unitVertices.push(next);
  }

  const vertices = unitVertices.map(point => ellipsePointFromUnit(
    point, CONFIG.outerA, semiB
  ));
  const contacts = unitContacts.map(point => ellipsePointFromUnit(
    point, CONFIG.outerA, semiB
  ));
  const closureError = Math.hypot(
    unitVertices[sideCount].x - unitVertices[0].x,
    unitVertices[sideCount].y - unitVertices[0].y
  );

  return {
    vertices,
    contacts,
    closureError,
    closed: closureError <= CONFIG.closureTolerance,
    innerScale,
  };
}

// ================================================================
// RENDERING
// ================================================================

function renderFrame() {
  background(BG.r, BG.g, BG.b);
  currentStartAngle = phase;
  currentOuterB = CONFIG.outerB;
  currentOrbit = constructPonceletOrbit(currentStartAngle, currentOuterB);
  constructionState = getConstructionState();

  const graphics = geometryPg;
  graphics.clear();
  graphics.push();
  graphics.drawingContext.save();
  graphics.drawingContext.beginPath();
  graphics.drawingContext.rect(
    HUD.safeX,
    CONFIG.stageTop,
    W - 2 * HUD.safeX,
    CONFIG.stageHeight
  );
  graphics.drawingContext.clip();
  drawPonceletTrails(graphics);
  drawConicPair(graphics);
  if (currentOrbit) {
    drawConstruction(graphics, currentOrbit);
    drawOrbit(graphics, currentOrbit, 0.62);
    drawActiveConstruction(graphics, currentOrbit, constructionState);
    drawActiveMarkers(graphics, currentOrbit, constructionState);
  }
  graphics.drawingContext.restore();
  graphics.pop();
  compositeHUD(graphics);
}

function drawRotatedEllipse(graphics, centerX, centerY, width, height) {
  graphics.push();
  graphics.translate(centerX, centerY);
  graphics.rotate(CONFIG.ellipseRotation);
  graphics.ellipse(0, 0, width, height);
  graphics.pop();
}

function drawConicPair(graphics) {
  if (!currentOrbit) return;
  graphics.noFill();
  graphics.strokeWeight(CONFIG.ellipseWeight * 5.5);
  graphics.stroke(INK.r, INK.g, INK.b, 10);
  drawRotatedEllipse(
    graphics, CONFIG.centerX, CONFIG.centerY,
    CONFIG.outerA * 2, currentOuterB * 2
  );
  graphics.stroke(CYAN.r, CYAN.g, CYAN.b, 18);
  drawRotatedEllipse(
    graphics, CONFIG.centerX, CONFIG.centerY,
    CONFIG.outerA * currentOrbit.innerScale * 2,
    currentOuterB * currentOrbit.innerScale * 2
  );
  graphics.strokeWeight(CONFIG.ellipseWeight);
  graphics.stroke(INK.r, INK.g, INK.b, 72);
  drawRotatedEllipse(
    graphics, CONFIG.centerX, CONFIG.centerY,
    CONFIG.outerA * 2, currentOuterB * 2
  );
  graphics.stroke(CYAN.r, CYAN.g, CYAN.b, 150);
  drawRotatedEllipse(
    graphics, CONFIG.centerX, CONFIG.centerY,
    CONFIG.outerA * currentOrbit.innerScale * 2,
    currentOuterB * currentOrbit.innerScale * 2
  );
  drawConicTicks(graphics);
  drawConicLabels(graphics);
}

function drawConicTicks(graphics) {
  graphics.strokeWeight(1);
  for (let i = 0; i < CONFIG.conicTickCount; i++) {
    const angle = i / CONFIG.conicTickCount * TAU;
    const outer = ellipsePointFromUnit(
      pointOnUnitCircle(angle),
      CONFIG.outerA,
      currentOuterB
    );
    const inner = ellipsePointFromUnit(
      pointOnUnitCircle(angle),
      CONFIG.outerA - (i % 4 === 0 ? 12 : 7),
      currentOuterB - (i % 4 === 0 ? 9 : 5)
    );
    const pulse = 0.5 + 0.5 * Math.cos(angle - phase);
    graphics.stroke(INK.r, INK.g, INK.b, 18 + 34 * pulse);
    graphics.line(outer.x, outer.y, inner.x, inner.y);
  }
}

function drawConicLabels(graphics) {
  const labelY = CONFIG.stageTop + 42;
  const outerLabelX = HUD.safeX + 18;
  const innerLabelX = W - HUD.rightTextX;
  graphics.noStroke();
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(22);
  graphics.textAlign(LEFT, CENTER);
  graphics.fill(INK.r, INK.g, INK.b, 112);
  graphics.text("OUTER CONIC", outerLabelX, labelY);
  graphics.textAlign(RIGHT, CENTER);
  graphics.fill(CYAN.r, CYAN.g, CYAN.b, 150);
  graphics.text("INNER CONIC", innerLabelX, labelY);
}

function drawOrbit(graphics, orbit, alpha) {
  graphics.noFill();
  graphics.stroke(MAGENTA.r, MAGENTA.g, MAGENTA.b, 20 * alpha);
  graphics.strokeWeight(CONFIG.orbitWeight * 4.6);
  graphics.beginShape();
  for (const vertex of orbit.vertices) graphics.vertex(vertex.x, vertex.y);
  graphics.endShape();
  graphics.stroke(MAGENTA.r, MAGENTA.g, MAGENTA.b, 56 * alpha);
  graphics.strokeWeight(CONFIG.orbitWeight * 2.1);
  graphics.beginShape();
  for (const vertex of orbit.vertices) graphics.vertex(vertex.x, vertex.y);
  graphics.endShape();
  graphics.stroke(MAGENTA.r, MAGENTA.g, MAGENTA.b, 235 * alpha);
  graphics.strokeWeight(CONFIG.orbitWeight);
  graphics.beginShape();
  for (const vertex of orbit.vertices) graphics.vertex(vertex.x, vertex.y);
  graphics.endShape();
}

function drawPonceletTrails(graphics) {
  // Rebuild a bounded orbit family each frame: deterministic, seamless, and
  // free from unlimited pixel accumulation. The wide family establishes the
  // porism; the local echoes preserve the direction of the moving start.
  const envelopeMix = 0.28 + 0.72 * (0.5 - 0.5 * Math.cos(phase));
  graphics.noFill();
  graphics.strokeWeight(CONFIG.trailWeight);

  for (let i = 0; i < CONFIG.envelopeCount; i++) {
    const familyAngle = currentStartAngle + i / CONFIG.envelopeCount * TAU;
    const orbit = constructPonceletOrbit(familyAngle, currentOuterB);
    if (!orbit) continue;
    const wave = 0.5 + 0.5 * Math.cos(familyAngle - phase * 2);
    graphics.stroke(MAGENTA.r, MAGENTA.g, MAGENTA.b, (9 + 20 * wave) * envelopeMix);
    graphics.beginShape();
    for (const vertex of orbit.vertices) graphics.vertex(vertex.x, vertex.y);
    graphics.endShape();
    graphics.noStroke();
    for (let j = 0; j < CONFIG.sides; j++) {
      const vertex = orbit.vertices[j];
      const contact = orbit.contacts[j];
      graphics.fill(MAGENTA.r, MAGENTA.g, MAGENTA.b, (12 + 16 * wave) * envelopeMix);
      graphics.circle(vertex.x, vertex.y, 2.4);
      graphics.fill(CYAN.r, CYAN.g, CYAN.b, (16 + 22 * wave) * envelopeMix);
      graphics.circle(contact.x, contact.y, 2.2);
    }
    graphics.noFill();
    graphics.strokeWeight(CONFIG.trailWeight);
  }

  const half = (CONFIG.trailCount - 1) / 2;
  for (let i = 0; i < CONFIG.trailCount; i++) {
    const offset = i - half;
    const trailAngle = currentStartAngle + offset * CONFIG.trailStep * TAU;
    const orbit = constructPonceletOrbit(trailAngle, currentOuterB);
    if (!orbit) continue;
    const proximity = 1 - Math.abs(offset) / (half + 1);
    const alpha = 7 + 62 * proximity * proximity * envelopeMix;
    const colorValue = offset <= 0 ? CYAN : MAGENTA;
    graphics.stroke(colorValue.r, colorValue.g, colorValue.b, alpha);
    graphics.beginShape();
    for (const vertex of orbit.vertices) graphics.vertex(vertex.x, vertex.y);
    graphics.endShape();
  }
}

function drawConstruction(graphics, orbit) {
  for (let i = 0; i < CONFIG.sides; i++) {
    const contact = orbit.contacts[i];
    graphics.noStroke();
    graphics.fill(CYAN.r, CYAN.g, CYAN.b, 68);
    graphics.circle(contact.x, contact.y, 5);
  }
}

function getConstructionState() {
  const totalSteps = CONFIG.sides * CONFIG.constructionCycles;
  const position = Math.min(loopProgress * totalSteps, totalSteps - CONFIG.epsilon);
  const wholeStep = Math.floor(position);
  const progress = position - wholeStep;
  return {
    index: wholeStep % CONFIG.sides,
    progress,
    alpha: clamp(Math.sin(Math.PI * loopProgress) * 6, 0, 1),
    mode: progress < 0.44 ? "TANGENT"
      : wholeStep % CONFIG.sides === CONFIG.sides - 1 && progress > 0.78
        ? "CLOSE"
        : "INTERSECTION",
  };
}

function mixPoint(a, b, amount) {
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
  };
}

function drawActiveConstruction(graphics, orbit, state) {
  if (!state || state.alpha <= 0) return;
  const index = state.index;
  const source = orbit.vertices[index];
  const contact = orbit.contacts[index];
  const target = orbit.vertices[index + 1];
  const firstPart = clamp(state.progress / 0.44, 0, 1);
  const secondPart = clamp((state.progress - 0.44) / 0.56, 0, 1);
  const head = state.progress < 0.44
    ? mixPoint(source, contact, firstPart)
    : mixPoint(contact, target, secondPart);
  const sourceLabelDirection = Math.abs(source.x - CONFIG.centerX) > CONFIG.outerA * 0.72
    ? -1
    : 1;

  const sourceColor = index === 0 ? ACID : INK;

  graphics.noFill();
  graphics.strokeWeight(CONFIG.orbitWeight + 14);
  graphics.stroke(sourceColor.r, sourceColor.g, sourceColor.b, 24 * state.alpha);
  graphics.line(
    source.x,
    source.y,
    state.progress < 0.44 ? head.x : contact.x,
    state.progress < 0.44 ? head.y : contact.y
  );
  graphics.strokeWeight(CONFIG.orbitWeight + 2.2);
  graphics.stroke(sourceColor.r, sourceColor.g, sourceColor.b, 238 * state.alpha);
  graphics.line(
    source.x,
    source.y,
    state.progress < 0.44 ? head.x : contact.x,
    state.progress < 0.44 ? head.y : contact.y
  );
  if (state.progress >= 0.44) {
    graphics.strokeWeight(CONFIG.orbitWeight + 14);
    graphics.stroke(CYAN.r, CYAN.g, CYAN.b, 28 * state.alpha);
    graphics.line(contact.x, contact.y, head.x, head.y);
    graphics.strokeWeight(CONFIG.orbitWeight + 2.2);
    graphics.stroke(CYAN.r, CYAN.g, CYAN.b, 245 * state.alpha);
    graphics.line(contact.x, contact.y, head.x, head.y);
  }

  graphics.noStroke();
  graphics.fill(sourceColor.r, sourceColor.g, sourceColor.b, 245 * state.alpha);
  graphics.circle(source.x, source.y, 13);
  graphics.fill(CYAN.r, CYAN.g, CYAN.b, 250 * state.alpha);
  graphics.circle(contact.x, contact.y, state.progress >= 0.34 ? 15 : 8);
  graphics.fill(INK.r, INK.g, INK.b, 245 * state.alpha);
  graphics.circle(head.x, head.y, 7);

  drawGeometryLabel(
    graphics,
    index === 0 ? "P₀ · START" : `P${subscript(index)}`,
    source,
    index === 0 ? 40 : 28,
    state.alpha,
    sourceColor,
    sourceLabelDirection
  );
  if (state.progress >= 0.28) {
    drawGeometryLabel(graphics, `T${subscript(index)}`, contact, 31, state.alpha, CYAN, -1);
  }
  if (state.progress >= 0.5) {
    const nextIndex = (index + 1) % CONFIG.sides;
    drawGeometryLabel(
      graphics,
      state.mode === "CLOSE" ? "P₀ · CLOSE" : `P${subscript(nextIndex)}`,
      target,
      29,
      state.alpha,
      state.mode === "CLOSE" ? ACID : INK,
      state.mode === "CLOSE" ? -1 : 1
    );
  }
}

const SUBSCRIPT_DIGITS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

function subscript(n) {
  return String(n).split("").map(d => SUBSCRIPT_DIGITS[Number(d)]).join("");
}

function drawGeometryLabel(graphics, label, point, distance, alpha, colorValue, direction) {
  const dx = point.x - CONFIG.centerX;
  const dy = point.y - CONFIG.centerY;
  const length = Math.max(CONFIG.epsilon, Math.hypot(dx, dy));
  graphics.noStroke();
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(26);
  graphics.textAlign(CENTER, CENTER);
  graphics.fill(colorValue.r, colorValue.g, colorValue.b, 225 * alpha);
  graphics.text(
    label,
    point.x + direction * dx / length * distance,
    point.y + direction * dy / length * distance
  );
}

function drawActiveMarkers(graphics, orbit, state) {
  const start = orbit.vertices[0];
  const close = orbit.vertices[orbit.vertices.length - 1];
  graphics.noStroke();
  graphics.fill(ACID.r, ACID.g, ACID.b, 245);
  graphics.circle(start.x, start.y, 17);
  graphics.noFill();
  graphics.stroke(ACID.r, ACID.g, ACID.b, 105);
  graphics.strokeWeight(2.2);
  graphics.circle(start.x, start.y, 31);
  graphics.stroke(MAGENTA.r, MAGENTA.g, MAGENTA.b, 145);
  graphics.line(close.x, close.y, start.x, start.y);
  const activeStartPoint = state && state.index === 0 && state.alpha > 0.2;
  const activeClose = state
    && state.index === CONFIG.sides - 1
    && state.progress >= 0.5
    && state.alpha > 0.2;
  if (!activeStartPoint && !activeClose) {
    const labelDirection = Math.abs(start.x - CONFIG.centerX) > CONFIG.outerA * 0.72
      ? -1
      : 1;
    drawGeometryLabel(graphics, "P₀ · START", start, 58, 0.88, ACID, labelDirection);
  }
}

// HUD — existing fonts, sizes, hierarchy, and anchors are retained.
function drawScreenFinish() {
  const graphics = hudPg;
  graphics.clear();
  graphics.image(grainPg, 0, 0);
  drawCornerGuides(graphics);
  graphics.noStroke();
  graphics.textAlign(CENTER, CENTER);
  graphics.textFont("Georgia");
  graphics.textStyle(BOLD);
  graphics.textSize(72);
  graphics.fill(INK.r, INK.g, INK.b, 218);
  graphics.text("PONCELET’S PORISM", W / 2, HUD.titleY);
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(34);
  graphics.fill(INK.r, INK.g, INK.b, 228);
  graphics.text("P₀ → T₀ → P₁ → ··· → P₀", W / 2, HUD.formulaY);
  graphics.textSize(23);
  graphics.fill(CYAN.r, CYAN.g, CYAN.b, 220);
  graphics.text("r / R = cos(π/n) · AFFINE TANGENCY", W / 2, HUD.exponentY);
  graphics.textSize(26);
  graphics.fill(INK.r, INK.g, INK.b, 166);
  graphics.text("ONE CLOSED ORBIT. EVERY START CLOSES.", W / 2, HUD.subtitleY);
  graphics.fill(INK.r, INK.g, INK.b, 235);
  graphics.textAlign(LEFT, TOP);
  const status = currentOrbit && currentOrbit.closed
    && constructionState && constructionState.alpha > 0.2
    ? `STEP ${String(constructionState.index + 1).padStart(2, "0")}/${String(CONFIG.sides).padStart(2, "0")} · ${constructionState.mode}`
    : currentOrbit && currentOrbit.closed
      ? "PONCELET ORBIT · CLOSED"
      : "PONCELET ORBIT · CHECK";
  graphics.text(status, HUD.stageTextX, HUD.stageY);
  graphics.textAlign(RIGHT, TOP);
  graphics.textSize(22);
  graphics.text(`n = ${CONFIG.sides}`, W - HUD.rightTextX, HUD.stageY + 3);
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
  graphics.text("EACH EDGE TOUCHES THE INNER CONIC ONCE", W / 2, HUD.bottomTextY);
  graphics.text("MOVE THE START → THE ORBIT STILL CLOSES", W / 2, HUD.bottomTextY + 38);
  graphics.textSize(22);
  graphics.fill(INK.r, INK.g, INK.b, HUD.citationAlpha);
  const closure = currentOrbit && currentOrbit.closed
    ? "< 1e−12"
    : currentOrbit
      ? currentOrbit.closureError.toExponential(2)
      : "—";
  const eccentricity = Math.sqrt(Math.max(
    0,
    1 - currentOuterB * currentOuterB / (CONFIG.outerA * CONFIG.outerA)
  ));
  graphics.text(
    `CLOSURE ERROR · ${closure}   |   e · ${eccentricity.toFixed(3)}`,
    W / 2,
    HUD.citationY
  );
  compositeHUD(graphics);
}

const previewParam = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search).get("preview")
  : null;
const previewProgress = previewParam === null ? NaN : Number(previewParam);

function getElement(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = getElement(id);
  if (element) element.textContent = value;
}

function setDisabled(id, disabled) {
  const element = getElement(id);
  if (element) element.disabled = disabled;
}

function setProgress(percent) {
  const element = getElement("progressFill");
  if (element) element.style.width = `${percent.toFixed(1)}%`;
}

function bindUI() {
  const startButton = getElement("startBtn");
  const stopButton = getElement("stopBtn");
  if (startButton) startButton.onclick = startRecording;
  if (stopButton) stopButton.onclick = stopRecording;
}

function updateStaticUI() {
  setText("maxDuration", MAX_DURATION);
  setText("canvasSize", `${W} × ${H}`);
  setText("maxFrames", MAX_FRAMES);
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function updateLoopTime() {
  if (Number.isFinite(previewProgress) && !isRecording) {
    loopProgress = clamp(previewProgress, 0, 0.999999);
  } else if (isRecording) {
    loopProgress = clamp(recFrameCount / (MAX_FRAMES - 1), 0, 0.999999);
  } else {
    loopProgress = ((frameCount - 1) % LOOP_FRAMES) / LOOP_FRAMES;
  }
  phase = loopProgress * TAU;
}

function draw() {
  updateLoopTime();
  renderFrame();
  drawScreenFinish();
  if (isRecording) {
    captureFrame();
    recFrameCount++;
    updateRecordingUI();
    if (recFrameCount >= MAX_FRAMES) stopRecording();
  }
}

function bakeGrain() {
  grainPg.clear();
  grainPg.noStroke();
  randomSeed(20260904);
  const subtleCount = Math.floor(W * H * 0.0016);
  for (let i = 0; i < subtleCount; i++) {
    const value = random(110, 200);
    grainPg.fill(value, value, value, random(2, 7));
    grainPg.circle(random(W), random(H), random(0.15, 0.85));
  }
  const brightCount = Math.floor(W * H * 0.000035);
  for (let i = 0; i < brightCount; i++) {
    const value = random(210, 255);
    grainPg.fill(value, value, value, random(12, 34));
    grainPg.circle(random(W), random(H), random(0.4, 1.2));
  }
}

function drawCornerGuides(graphics) {
  graphics.noFill();
  graphics.stroke(255, 255, 255, 38);
  graphics.strokeWeight(0.7);
  const margin = 34;
  const length = 24;
  graphics.line(margin, margin, margin + length, margin);
  graphics.line(margin, margin, margin, margin + length);
  graphics.line(W - margin, margin, W - margin - length, margin);
  graphics.line(W - margin, margin, W - margin, margin + length);
  graphics.line(margin, H - margin, margin + length, H - margin);
  graphics.line(margin, H - margin, margin, H - margin - length);
  graphics.line(W - margin, H - margin, W - margin - length, H - margin);
  graphics.line(W - margin, H - margin, W - margin, H - margin - length);
}

function compositeHUD(graphics) {
  push();
  drawingContext.disable(drawingContext.DEPTH_TEST);
  resetMatrix();
  camera(0, 0, 1, 0, 0, 0, 0, 1, 0);
  ortho(-W / 2, W / 2, -H / 2, H / 2, -10, 10);
  noLights();
  blendMode(BLEND);
  image(graphics, -W / 2, -H / 2, W, H);
  drawingContext.enable(drawingContext.DEPTH_TEST);
  pop();
}

function keyReleased() {
  if (key === "h" || key === "H") {
    const controls = getElement("controls");
    if (controls) controls.hidden = !controls.hidden;
    return false;
  }
  if (key === "r" || key === "R") {
    if (isRecording) stopRecording();
    else startRecording();
    return false;
  }
  if (key === "s" || key === "S") {
    saveCanvas(`poncelet_porism_${getTimestamp()}`, "png");
    return false;
  }
  return true;
}

function updateRecordingUI() {
  setText("duration", (recFrameCount / FPS).toFixed(1));
  setText("frameCount", recFrameCount);
  setProgress(recFrameCount / MAX_FRAMES * 100);
}

function startRecording() {
  if (isRecording || isFinalizing) return;
  if (typeof VideoEncoder === "undefined") {
    alert("WebCodecs not supported.");
    return;
  }
  if (typeof Mp4Muxer === "undefined") {
    alert("mp4-muxer not loaded.");
    return;
  }
  muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: "avc", width: W, height: H },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  encoder = new VideoEncoder({
    output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    error: (error) => {
      console.error(error);
      isRecording = false;
      isFinalizing = false;
      setStatus("Error", "#f44");
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
  setText("duration", "0.0");
  setText("frameCount", "0");
  setDisabled("startBtn", true);
  setDisabled("stopBtn", false);
  setProgress(0);
  setStatus("Recording…", "#fff");
}

async function stopRecording() {
  if (!encoder || !muxer || isFinalizing) return;
  isRecording = false;
  isFinalizing = true;
  setDisabled("stopBtn", true);
  setStatus("Finalizing…", "#ccc");
  try {
    await encoder.flush();
    muxer.finalize();
    const buffer = muxer.target.buffer;
    const blob = new Blob([buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `poncelet_porism_${getTimestamp()}.mp4`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Saved", "#8f8");
  } catch (error) {
    console.error(error);
    setStatus("Error", "#f44");
  } finally {
    if (encoder && encoder.state !== "closed") encoder.close();
    encoder = null;
    muxer = null;
    isFinalizing = false;
    setDisabled("startBtn", false);
    setDisabled("stopBtn", true);
  }
}

function captureFrame() {
  if (!encoder || encoder.state !== "configured") return;
  const timestamp = Math.round(recFrameCount * 1_000_000 / FPS);
  const frame = new VideoFrame(canvasEl, { timestamp });
  encoder.encode(frame, { keyFrame: recFrameCount % FPS === 0 });
  frame.close();
}

function setStatus(textValue, colorValue) {
  const status = getElement("status");
  if (!status) return;
  status.textContent = textValue;
  status.style.color = colorValue;
}

function getTimestamp() {
  const date = new Date();
  const year = date.getFullYear().toString();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hour}${minute}${second}`;
}
