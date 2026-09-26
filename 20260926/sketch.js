"use strict";

// DANDELIN SPHERES — CONIC SECTIONS
// A plane n·p = d cuts a right double cone (apex at the origin, axis y,
// half-angle α). Along a generator t·g(φ) the section sits at t = d / (n·g),
// so ellipse, parabola and hyperbola come from one formula. Spheres centred
// on the axis at height c touch the cone when r = |c|·sinα and the plane when
// |c·cosβ − d| = r, giving c = d / (cosβ ± sinα). Each sphere touches the
// plane at a focus; tangent lengths PF = PT along the generator make
// PF₁ ± PF₂ the fixed distance between the two contact circles.

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

// Mathematical parameters — world units, plane distance from the apex = 1.
const MATH = {
  coneAngle: Math.PI / 6,
  planeDistance: 1,
  upperExtent: 2.35,
  lowerExtent: 2.35,
  ellipseTilt: 18 * Math.PI / 180,
  hyperbolaTilt: Math.PI / 2,
  epsilon: 1e-9,
};

const SIN_A = Math.sin(MATH.coneAngle);
const COS_A = Math.cos(MATH.coneAngle);
const TAN_A = Math.tan(MATH.coneAngle);
const PARABOLA_TILT = Math.PI / 2 - MATH.coneAngle;
const DEG = 180 / Math.PI;

// Visual parameters.
const VIEW = {
  focal: 2950,
  centerX: W / 2,
  centerY: 918,
  near: 0.5,
  maskTop: 446,
  maskBottom: 1388,
  maskLeft: 120,
  maskRight: 960,
  feather: 64,
  generatorCount: 48,
  circleSegments: 120,
  conicSamples: 720,
  ringHeights: [-1.2, 1.2],
  planeHalfU: 2.35,
  planeHalfW: 1.55,
  planeLayers: 7,
  planeRulings: 8,
  sphereFade: [2.45, 3.1],
  curveWeight: 3.2,
};

// Animation parameters — normalized loop progress 0..1.
const TIMELINE = {
  tiltKeys: [
    [0.00, MATH.ellipseTilt],
    [0.10, MATH.ellipseTilt],
    [0.22, PARABOLA_TILT],
    [0.27, PARABOLA_TILT],
    [0.38, MATH.hyperbolaTilt],
    [0.52, MATH.hyperbolaTilt],
    [0.61, PARABOLA_TILT],
    [0.66, PARABOLA_TILT],
    [0.76, MATH.ellipseTilt],
    [1.00, MATH.ellipseTilt],
  ],
  heroDrift: [0.76, 1.0],
  heroDriftAmount: 3 * Math.PI / 180,
  curveBase: 0.38,
  curve: [0.12, 0.34, 0.93, 1.0],
  spheres: [0.42, 0.52, 0.92, 0.99],
  foci: [0.76, 0.84, 0.92, 0.98],
  construction: [0.82, 0.86, 0.92, 0.96],
  constructionSweep: [0.82, 0.96],
};

const CAMERA = {
  yaw: -0.74,
  yawSwing: 0.30,
  yawDetail: 0.07,
  elevation: 0.30,
  elevationSwing: 0.06,
  distanceKeys: [
    [0.00, 17.5],
    [0.30, 17.0],
    [0.44, 19.5],
    [0.72, 12.6],
    [0.88, 12.6],
    [1.00, 17.5],
  ],
  targetKeys: [
    [0.00, 0.25],
    [0.44, 0.0],
    [0.72, 1.35],
    [0.88, 1.35],
    [1.00, 0.25],
  ],
};

let canvasEl;
let grainPg;
let hudPg;
let geometryPg;
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
  geometryPg = createGraphics(W, H);
  for (const graphics of [grainPg, hudPg, geometryPg]) graphics.pixelDensity(1);
  bakeGrain();
  bindUI();
  updateStaticUI();
  if (auditParam !== null) window.dandelinAudit = runAudit();
}

// ================================================================
// DANDELIN GEOMETRY
// ================================================================

const GEN_COS = new Float64Array(VIEW.generatorCount);
const GEN_SIN = new Float64Array(VIEW.generatorCount);
for (let i = 0; i < VIEW.generatorCount; i++) {
  GEN_COS[i] = Math.cos(i / VIEW.generatorCount * TAU);
  GEN_SIN[i] = Math.sin(i / VIEW.generatorCount * TAU);
}

function createSphereState(index) {
  return {
    index,
    active: false,
    c: 0,
    r: 0,
    contactY: 0,
    contactR: 0,
    focusX: 0,
    focusY: 0,
    planeGap: 0,
    visibility: 0,
  };
}

const scene = {
  tilt: MATH.ellipseTilt,
  cosTilt: 1,
  sinTilt: 0,
  nx: 0,
  ny: 1,
  cameraSide: 1,
  eccentricity: 0,
  type: "ELLIPSE",
  spheres: [createSphereState(0), createSphereState(1)],
  curveAlpha: 0,
  sphereReveal: 0,
  focusReveal: 0,
  focusLocal: 0,
  constructionReveal: 0,
  pointPhi: Math.PI,
  pointT: 0,
};

function setPlaneTilt(tilt) {
  scene.tilt = tilt;
  scene.cosTilt = Math.cos(tilt);
  scene.sinTilt = Math.sin(tilt);
  scene.nx = -scene.sinTilt;
  scene.ny = scene.cosTilt;
  scene.eccentricity = scene.sinTilt / COS_A;
  scene.type = Math.abs(scene.eccentricity - 1) < 1e-6
    ? "PARABOLA"
    : scene.eccentricity < 1 ? "ELLIPSE" : "HYPERBOLA";
  // Sphere 0 always sits between apex and plane; sphere 1 passes through
  // infinity at the parabola and returns in the opposite nappe.
  updateSphere(scene.spheres[0], scene.cosTilt + SIN_A);
  updateSphere(scene.spheres[1], scene.cosTilt - SIN_A);
}

function updateSphere(sphere, denominator) {
  sphere.active = Math.abs(denominator) > MATH.epsilon;
  if (!sphere.active) {
    sphere.visibility = 0;
    return;
  }
  const c = MATH.planeDistance / denominator;
  sphere.c = c;
  sphere.r = Math.abs(c) * SIN_A;
  sphere.contactY = c * COS_A * COS_A;
  sphere.contactR = Math.abs(c) * SIN_A * COS_A;
  // Foot of the perpendicular from the centre (0, c, 0) to the plane.
  sphere.planeGap = scene.ny * c - MATH.planeDistance;
  sphere.focusX = -sphere.planeGap * scene.nx;
  sphere.focusY = c - sphere.planeGap * scene.ny;
  sphere.visibility = 1 - smoothstep(VIEW.sphereFade[0], VIEW.sphereFade[1], Math.abs(c));
}

function conicParameter(phi) {
  const denominator = scene.cosTilt * COS_A - scene.sinTilt * SIN_A * Math.cos(phi);
  if (Math.abs(denominator) < MATH.epsilon) return NaN;
  return MATH.planeDistance / denominator;
}

function isInsideCone(t) {
  if (!Number.isFinite(t)) return false;
  const y = t * COS_A;
  return y <= MATH.upperExtent && y >= -MATH.lowerExtent;
}

function boundaryPhi(phiInside, phiOutside) {
  for (let i = 0; i < 18; i++) {
    const mid = (phiInside + phiOutside) / 2;
    if (isInsideCone(conicParameter(mid))) phiInside = mid;
    else phiOutside = mid;
  }
  return phiInside;
}

// ================================================================
// ANIMATION + CAMERA
// ================================================================

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function envelope(p, window) {
  return smoothstep(window[0], window[1], p) * (1 - smoothstep(window[2], window[3], p));
}

function keyframeValue(keys, p) {
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [p0, v0] = keys[i - 1];
      const [p1, v1] = keys[i];
      return v0 + (v1 - v0) * smootherstep(clamp((p - p0) / (p1 - p0), 0, 1));
    }
  }
  return keys[keys.length - 1][1];
}

function updateAnimation() {
  const p = loopProgress;
  const drift = clamp(
    (p - TIMELINE.heroDrift[0]) / (TIMELINE.heroDrift[1] - TIMELINE.heroDrift[0]),
    0,
    1
  );
  setPlaneTilt(
    keyframeValue(TIMELINE.tiltKeys, p)
      + TIMELINE.heroDriftAmount * Math.sin(Math.PI * drift) ** 2
  );
  scene.curveAlpha = TIMELINE.curveBase
    + (1 - TIMELINE.curveBase) * envelope(p, TIMELINE.curve);
  scene.sphereReveal = envelope(p, TIMELINE.spheres);
  scene.focusReveal = envelope(p, TIMELINE.foci);
  scene.focusLocal = smoothstep(TIMELINE.foci[0], TIMELINE.foci[1], p);
  scene.constructionReveal = envelope(p, TIMELINE.construction);
  const sweep = smoothstep(TIMELINE.constructionSweep[0], TIMELINE.constructionSweep[1], p);
  // φ = π stays on the section for every tilt in [0, π/2]: cos(β − α) > 0.
  scene.pointPhi = Math.PI + (sweep - 0.5) * 2.6;
  scene.pointT = conicParameter(scene.pointPhi);
}

const cam = {
  ex: 0, ey: 0, ez: 0,
  rx: 1, ry: 0, rz: 0,
  ux: 0, uy: 1, uz: 0,
  fx: 0, fy: 0, fz: -1,
};

function updateCamera() {
  const yaw = CAMERA.yaw
    + CAMERA.yawSwing * Math.sin(phase)
    + CAMERA.yawDetail * Math.sin(2 * phase);
  const elevation = CAMERA.elevation
    + CAMERA.elevationSwing * (0.5 - 0.5 * Math.cos(phase));
  const distance = keyframeValue(CAMERA.distanceKeys, loopProgress);
  const targetY = keyframeValue(CAMERA.targetKeys, loopProgress);
  cam.ex = distance * Math.cos(elevation) * Math.sin(yaw);
  cam.ey = targetY + distance * Math.sin(elevation);
  cam.ez = distance * Math.cos(elevation) * Math.cos(yaw);
  const fx = -cam.ex;
  const fy = targetY - cam.ey;
  const fz = -cam.ez;
  const fLength = Math.hypot(fx, fy, fz);
  cam.fx = fx / fLength;
  cam.fy = fy / fLength;
  cam.fz = fz / fLength;
  // right = forward × worldUp, up = right × forward
  const rLength = Math.hypot(cam.fz, cam.fx);
  cam.rx = -cam.fz / rLength;
  cam.ry = 0;
  cam.rz = cam.fx / rLength;
  cam.ux = cam.ry * cam.fz - cam.rz * cam.fy;
  cam.uy = cam.rz * cam.fx - cam.rx * cam.fz;
  cam.uz = cam.rx * cam.fy - cam.ry * cam.fx;
  scene.cameraSide = Math.sign(
    scene.nx * cam.ex + scene.ny * cam.ey - MATH.planeDistance
  ) || 1;
}

// ================================================================
// PROJECTION + PATH HELPERS
// ================================================================

let projX = 0;
let projY = 0;

function projectPoint(x, y, z) {
  const dx = x - cam.ex;
  const dy = y - cam.ey;
  const dz = z - cam.ez;
  const depth = dx * cam.fx + dy * cam.fy + dz * cam.fz;
  if (!(depth > VIEW.near)) return false;
  const scale = VIEW.focal / depth;
  projX = VIEW.centerX + (dx * cam.rx + dy * cam.ry + dz * cam.rz) * scale;
  projY = VIEW.centerY - (dx * cam.ux + dy * cam.uy + dz * cam.uz) * scale;
  return true;
}

// > 0 on the camera side of the cutting plane.
function planeSide(x, y) {
  return (scene.nx * x + scene.ny * y - MATH.planeDistance) * scene.cameraSide;
}

function emitPoint(ctx, x, y, z, penDown) {
  if (!projectPoint(x, y, z)) return false;
  if (penDown) ctx.lineTo(projX, projY);
  else ctx.moveTo(projX, projY);
  return true;
}

// sideFilter: 0 keeps everything, 1 keeps the camera side, -1 the far side.
// Crossings are cut exactly, since planeSide is linear along a segment.
function tracePolyline3D(ctx, points, count, sideFilter) {
  let penDown = false;
  let previousSide = 0;
  for (let i = 0; i < count; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const z = points[i * 3 + 2];
    const side = sideFilter === 0 ? 1 : planeSide(x, y) * sideFilter;
    if (i > 0 && (side >= 0) !== (previousSide >= 0)) {
      const amount = previousSide / (previousSide - side);
      const px = points[i * 3 - 3];
      const py = points[i * 3 - 2];
      const pz = points[i * 3 - 1];
      penDown = emitPoint(
        ctx,
        px + (x - px) * amount,
        py + (y - py) * amount,
        pz + (z - pz) * amount,
        penDown
      );
      if (side < 0) penDown = false;
    }
    if (side >= 0) penDown = emitPoint(ctx, x, y, z, penDown);
    else penDown = false;
    previousSide = side;
  }
}

const POINTS = new Float64Array(3 * 2048);

function writeSegment(buffer, ax, ay, az, bx, by, bz) {
  buffer[0] = ax; buffer[1] = ay; buffer[2] = az;
  buffer[3] = bx; buffer[4] = by; buffer[5] = bz;
  return 2;
}

// Circle centre + radius·(cos θ·a + sin θ·b) for θ in [from, to].
function writeCircle(buffer, cx, cy, cz, ax, ay, az, bx, by, bz, radius, segments, from = 0, to = TAU) {
  for (let i = 0; i <= segments; i++) {
    const angle = from + (to - from) * i / segments;
    const c = Math.cos(angle) * radius;
    const s = Math.sin(angle) * radius;
    buffer[i * 3] = cx + c * ax + s * bx;
    buffer[i * 3 + 1] = cy + c * ay + s * by;
    buffer[i * 3 + 2] = cz + c * az + s * bz;
  }
  return segments + 1;
}

function writeHorizontalCircle(buffer, y, radius, segments, from, to) {
  return writeCircle(buffer, 0, y, 0, 1, 0, 0, 0, 0, 1, radius, segments, from, to);
}

// Exact outline of a sphere seen from the eye: a circle on the tangent cone.
function writeSphereSilhouette(buffer, sphere) {
  const vx = cam.ex;
  const vy = cam.ey - sphere.c;
  const vz = cam.ez;
  const distanceSq = vx * vx + vy * vy + vz * vz;
  const radiusSq = sphere.r * sphere.r;
  if (distanceSq <= radiusSq * 1.0001) return 0;
  const distance = Math.sqrt(distanceSq);
  const k = radiusSq / distanceSq;
  const radius = sphere.r * Math.sqrt(distanceSq - radiusSq) / distance;
  const nx = vx / distance;
  const ny = vy / distance;
  const nz = vz / distance;
  const aLength = Math.hypot(nz, nx);
  const ax = -nz / aLength;
  const az = nx / aLength;
  const bx = ny * az;
  const by = nz * ax - nx * az;
  const bz = -ny * ax;
  return writeCircle(
    buffer,
    k * vx, sphere.c + k * vy, k * vz,
    ax, 0, az, bx, by, bz,
    radius, VIEW.circleSegments
  );
}

function rgba(colorValue, alpha) {
  return `rgba(${colorValue.r},${colorValue.g},${colorValue.b},${clamp(alpha, 0, 255) / 255})`;
}

// Same three-pass glow ratios as the house orbit stroke.
function glowStroke(ctx, colorValue, alpha, weight, glow = 1) {
  if (alpha <= 0.5) return;
  if (glow > 0) {
    ctx.lineWidth = weight * 4.6;
    ctx.strokeStyle = rgba(colorValue, alpha * 0.085 * glow);
    ctx.stroke();
    ctx.lineWidth = weight * 2.1;
    ctx.strokeStyle = rgba(colorValue, alpha * 0.24 * glow);
    ctx.stroke();
  }
  ctx.lineWidth = weight;
  ctx.strokeStyle = rgba(colorValue, alpha);
  ctx.stroke();
}

function glowDot(ctx, x, y, colorValue, alpha, radius) {
  for (const [scale, amount] of [[4.8, 0.07], [2.3, 0.28], [1, 1]]) {
    ctx.beginPath();
    ctx.arc(x, y, radius * scale, 0, TAU);
    ctx.fillStyle = rgba(colorValue, alpha * amount);
    ctx.fill();
  }
}

// ================================================================
// RENDERING
// ================================================================

function renderFrame() {
  background(BG.r, BG.g, BG.b);
  updateAnimation();
  updateCamera();

  const graphics = geometryPg;
  const ctx = graphics.drawingContext;
  graphics.clear();
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Painter's order around the cutting plane: everything on the far side,
  // then the translucent plane, then the camera side. Each sphere lies
  // entirely on one side, so the split is exact.
  drawCone(ctx, -1, false);
  drawDandelinSpheres(ctx, -1);
  drawCone(ctx, -1, true);
  drawCuttingPlane(ctx);
  drawCone(ctx, 1, false);
  drawDandelinSpheres(ctx, 1);
  drawCone(ctx, 1, true);
  drawConicIntersection(ctx);
  drawConstructionLines(ctx);
  drawTangencyPoints(ctx);
  ctx.restore();
  drawGeometryLabels(graphics);
  applyStageMask(ctx);
  compositeHUD(graphics);
}

function drawCone(ctx, sideFilter, frontPass) {
  const upperT = MATH.upperExtent / COS_A;
  const lowerT = -MATH.lowerExtent / COS_A;
  for (let i = 0; i < VIEW.generatorCount; i++) {
    const cosPhi = GEN_COS[i];
    const sinPhi = GEN_SIN[i];
    const gx = SIN_A * cosPhi;
    const gz = SIN_A * sinPhi;
    // Outward normal of the upper nappe is (cosφ, −tanα, sinφ); it is
    // orthogonal to the generator, so facing depends only on the eye.
    const facing = cam.ex * cosPhi + cam.ez * sinPhi - TAN_A * cam.ey;
    for (const nappe of [1, -1]) {
      if ((nappe * facing > 0) !== frontPass) continue;
      const endT = nappe > 0 ? upperT : lowerT;
      const mx = gx * endT * 0.5;
      const my = COS_A * endT * 0.5;
      const mz = gz * endT * 0.5;
      const viewLength = Math.hypot(cam.ex - mx, cam.ey - my, cam.ez - mz);
      const cosine = nappe * facing * COS_A / viewLength;
      const fresnel = Math.pow(1 - Math.abs(cosine), 4);
      const alpha = (frontPass ? 20 : 9) + 64 * fresnel;
      ctx.beginPath();
      tracePolyline3D(
        ctx,
        POINTS,
        writeSegment(POINTS, 0, 0, 0, gx * endT, COS_A * endT, gz * endT),
        sideFilter
      );
      glowStroke(ctx, INK, alpha, 1, 0);
    }
  }

  if (frontPass) {
    drawConeSilhouette(ctx, sideFilter);
    for (const y of [MATH.upperExtent, -MATH.lowerExtent]) {
      ctx.beginPath();
      tracePolyline3D(
        ctx,
        POINTS,
        writeHorizontalCircle(POINTS, y, Math.abs(y) * TAN_A, VIEW.circleSegments),
        sideFilter
      );
      glowStroke(ctx, INK, 74, 1.3, 0.6);
    }
    return;
  }

  for (const y of VIEW.ringHeights) {
    ctx.beginPath();
    tracePolyline3D(
      ctx,
      POINTS,
      writeHorizontalCircle(POINTS, y, Math.abs(y) * TAN_A, VIEW.circleSegments),
      sideFilter
    );
    glowStroke(ctx, INK, 18, 1, 0);
  }

  ctx.setLineDash([5, 11]);
  ctx.beginPath();
  tracePolyline3D(
    ctx,
    POINTS,
    writeSegment(POINTS, 0, -MATH.lowerExtent, 0, 0, MATH.upperExtent, 0),
    sideFilter
  );
  glowStroke(ctx, INK, 52, 1, 0);
  ctx.setLineDash([]);

  if (planeSide(0, 0) * sideFilter >= 0 && projectPoint(0, 0, 0)) {
    glowDot(ctx, projX, projY, INK, 150, 2.6);
  }
}

function drawConeSilhouette(ctx, sideFilter) {
  // The tangent planes through the eye touch the cone along the generators
  // where ρ·cos(φ − ψ) = tanα·eye.y.
  const rho = Math.hypot(cam.ex, cam.ez);
  const ratio = TAN_A * cam.ey / rho;
  if (Math.abs(ratio) >= 1) return;
  const psi = Math.atan2(cam.ez, cam.ex);
  const spread = Math.acos(ratio);
  const upperT = MATH.upperExtent / COS_A;
  const lowerT = -MATH.lowerExtent / COS_A;
  for (const phi of [psi - spread, psi + spread]) {
    const gx = SIN_A * Math.cos(phi);
    const gz = SIN_A * Math.sin(phi);
    ctx.beginPath();
    tracePolyline3D(
      ctx,
      POINTS,
      writeSegment(
        POINTS,
        gx * lowerT, COS_A * lowerT, gz * lowerT,
        gx * upperT, COS_A * upperT, gz * upperT
      ),
      sideFilter
    );
    glowStroke(ctx, INK, 108, 1.35, 0.7);
  }
}

function writePlaneQuad(buffer, scale) {
  const ux = scene.cosTilt;
  const uy = scene.sinTilt;
  // Centre near the section: foot of the apex perpendicular, nudged along
  // the tilt direction while the section is an ellipse.
  const offset = 0.45 * scene.cosTilt * scene.cosTilt;
  const cx = MATH.planeDistance * scene.nx + ux * offset;
  const cy = MATH.planeDistance * scene.ny + uy * offset;
  const hu = VIEW.planeHalfU * scale;
  const hw = VIEW.planeHalfW * scale;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  for (let i = 0; i < corners.length; i++) {
    const [su, sw] = corners[i];
    buffer[i * 3] = cx + ux * hu * su;
    buffer[i * 3 + 1] = cy + uy * hu * su;
    buffer[i * 3 + 2] = hw * sw;
  }
  return corners.length;
}

function drawCuttingPlane(ctx) {
  // Stacked translucent layers feather the plane edge instead of cutting it.
  for (let i = 0; i < VIEW.planeLayers; i++) {
    const scale = 1 - i / VIEW.planeLayers * 0.62;
    ctx.beginPath();
    tracePolyline3D(ctx, POINTS, writePlaneQuad(POINTS, scale), 0);
    ctx.fillStyle = rgba(INK, 3.4);
    ctx.fill();
  }

  const offset = 0.45 * scene.cosTilt * scene.cosTilt;
  const ux = scene.cosTilt;
  const uy = scene.sinTilt;
  const cx = MATH.planeDistance * scene.nx + ux * offset;
  const cy = MATH.planeDistance * scene.ny + uy * offset;
  const extentU = VIEW.planeHalfU * 0.94;
  const extentW = VIEW.planeHalfW * 0.94;
  for (let i = -VIEW.planeRulings; i <= VIEW.planeRulings; i++) {
    const amount = i / VIEW.planeRulings;
    const falloff = Math.pow(1 - Math.abs(amount), 1.6);
    const u = amount * extentU;
    ctx.beginPath();
    tracePolyline3D(
      ctx,
      POINTS,
      writeSegment(
        POINTS,
        cx + ux * u, cy + uy * u, -extentW * 0.8,
        cx + ux * u, cy + uy * u, extentW * 0.8
      ),
      0
    );
    glowStroke(ctx, INK, (i === 0 ? 40 : 20) * falloff, 1, 0);
  }
  for (const w of [-0.5, 0, 0.5]) {
    const z = w * extentW;
    ctx.beginPath();
    tracePolyline3D(
      ctx,
      POINTS,
      writeSegment(
        POINTS,
        cx - ux * extentU * 0.8, cy - uy * extentU * 0.8, z,
        cx + ux * extentU * 0.8, cy + uy * extentU * 0.8, z
      ),
      0
    );
    glowStroke(ctx, INK, w === 0 ? 30 : 16, 1, 0);
  }

  // Instrument ticks at the inner feather corners.
  const hu = VIEW.planeHalfU * 0.72;
  const hw = VIEW.planeHalfW * 0.72;
  const tick = 0.16;
  ctx.beginPath();
  for (const [su, sw] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const px = cx + ux * hu * su;
    const py = cy + uy * hu * su;
    const pz = hw * sw;
    tracePolyline3D(ctx, POINTS, writeSegment(
      POINTS, px - ux * tick * su, py - uy * tick * su, pz, px, py, pz
    ), 0);
    tracePolyline3D(ctx, POINTS, writeSegment(
      POINTS, px, py, pz - tick * sw, px, py, pz
    ), 0);
  }
  glowStroke(ctx, CYAN, 120, 1.4, 0.5);
}

function drawDandelinSpheres(ctx, sideFilter) {
  if (scene.sphereReveal <= 0.001) return;
  for (const sphere of scene.spheres) {
    const alpha = scene.sphereReveal * sphere.visibility;
    if (!sphere.active || alpha <= 0.004) continue;
    if ((Math.sign(sphere.planeGap) * scene.cameraSide > 0 ? 1 : -1) !== sideFilter) continue;
    drawSphere(ctx, sphere, alpha);
  }
}

function drawSphere(ctx, sphere, alpha) {
  const count = writeSphereSilhouette(POINTS, sphere);
  if (count === 0 || !projectPoint(0, sphere.c, 0)) return;
  const centerX = projX;
  const centerY = projY;
  if (!projectPoint(POINTS[0], POINTS[1], POINTS[2])) return;
  const radius = Math.hypot(projX - centerX, projY - centerY);

  // Glass body: nearly clear centre, denser toward the rim.
  ctx.beginPath();
  tracePolyline3D(ctx, POINTS, count, 0);
  const body = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  body.addColorStop(0, rgba(CYAN, 5 * alpha));
  body.addColorStop(0.72, rgba(CYAN, 12 * alpha));
  body.addColorStop(1, rgba(CYAN, 34 * alpha));
  ctx.fillStyle = body;
  ctx.fill();
  glowStroke(ctx, CYAN, 128 * alpha, 1.5, 0.8);

  // Controlled highlight toward the upper left.
  const hx = centerX - radius * 0.38;
  const hy = centerY - radius * 0.42;
  const highlight = ctx.createRadialGradient(hx, hy, 0, hx, hy, radius * 0.34);
  highlight.addColorStop(0, rgba(INK, 34 * alpha));
  highlight.addColorStop(1, rgba(INK, 0));
  ctx.fillStyle = highlight;
  ctx.beginPath();
  ctx.arc(hx, hy, radius * 0.34, 0, TAU);
  ctx.fill();

  for (const latitude of [-0.55, 0, 0.55]) {
    ctx.beginPath();
    tracePolyline3D(
      ctx,
      POINTS,
      writeHorizontalCircle(
        POINTS,
        sphere.c + sphere.r * Math.sin(latitude),
        sphere.r * Math.cos(latitude),
        VIEW.circleSegments
      ),
      0
    );
    glowStroke(ctx, CYAN, (latitude === 0 ? 30 : 17) * alpha, 1, 0);
  }

  // Tangency with the cone: the whole contact circle, drawn on as it appears.
  const drawOn = smoothstep(0, 0.85, scene.sphereReveal);
  if (drawOn > 0.002) {
    ctx.beginPath();
    tracePolyline3D(
      ctx,
      POINTS,
      writeHorizontalCircle(
        POINTS,
        sphere.contactY,
        sphere.contactR,
        VIEW.circleSegments,
        -Math.PI / 2,
        -Math.PI / 2 + TAU * drawOn
      ),
      0
    );
    glowStroke(ctx, CYAN, 225 * sphere.visibility * scene.sphereReveal, 2.1);
  }
}

// Actual cone ∩ plane: sample generators, keep the in-extent runs, and cut
// run ends exactly on the rim by bisection in φ.
const CONIC_POINTS = new Float64Array(3 * (VIEW.conicSamples + 4));

function drawConicIntersection(ctx) {
  const samples = VIEW.conicSamples;
  let startIndex = 0;
  for (let k = 0; k < samples; k++) {
    if (!isInsideCone(conicParameter(k / samples * TAU))) {
      startIndex = k;
      break;
    }
  }
  ctx.beginPath();
  let count = 0;
  let previousInside = false;
  let previousPhi = 0;
  const pushPoint = (phi, t) => {
    CONIC_POINTS[count * 3] = t * SIN_A * Math.cos(phi);
    CONIC_POINTS[count * 3 + 1] = t * COS_A;
    CONIC_POINTS[count * 3 + 2] = t * SIN_A * Math.sin(phi);
    count++;
  };
  for (let j = 0; j <= samples; j++) {
    const phi = (startIndex + j) / samples * TAU;
    const t = conicParameter(phi);
    const inside = isInsideCone(t);
    if (inside && !previousInside && j > 0) {
      const edge = boundaryPhi(phi, previousPhi);
      pushPoint(edge, conicParameter(edge));
    }
    if (inside) pushPoint(phi, t);
    if (!inside && previousInside) {
      const edge = boundaryPhi(previousPhi, phi);
      pushPoint(edge, conicParameter(edge));
      tracePolyline3D(ctx, CONIC_POINTS, count, 0);
      count = 0;
    }
    previousInside = inside;
    previousPhi = phi;
  }
  if (count > 1) tracePolyline3D(ctx, CONIC_POINTS, count, 0);
  glowStroke(ctx, MAGENTA, 248 * scene.curveAlpha, VIEW.curveWeight);
}

function conicPoint(t, phi, out) {
  out.x = t * SIN_A * Math.cos(phi);
  out.y = t * COS_A;
  out.z = t * SIN_A * Math.sin(phi);
  return out;
}

const constructionPoint = { x: 0, y: 0, z: 0 };
const constructionContact = { x: 0, y: 0, z: 0 };

function drawConstructionLines(ctx) {
  const reveal = scene.constructionReveal;
  if (reveal <= 0.004 || !Number.isFinite(scene.pointT)) return;
  const phi = scene.pointPhi;
  const point = conicPoint(scene.pointT, phi, constructionPoint);
  let minT = scene.pointT;
  let maxT = scene.pointT;
  for (const sphere of scene.spheres) {
    if (!sphere.active || sphere.visibility < 0.05) continue;
    minT = Math.min(minT, sphere.c * COS_A);
    maxT = Math.max(maxT, sphere.c * COS_A);
  }

  // The generator through P, between the contact circles.
  const gx = SIN_A * Math.cos(phi);
  const gz = SIN_A * Math.sin(phi);
  ctx.beginPath();
  tracePolyline3D(ctx, POINTS, writeSegment(
    POINTS, gx * minT, COS_A * minT, gz * minT, gx * maxT, COS_A * maxT, gz * maxT
  ), 0);
  glowStroke(ctx, INK, 60 * reveal, 1, 0);

  for (const sphere of scene.spheres) {
    const alpha = reveal * sphere.visibility;
    if (!sphere.active || alpha <= 0.02) continue;
    const contact = conicPoint(sphere.c * COS_A, phi, constructionContact);
    ctx.beginPath();
    tracePolyline3D(ctx, POINTS, writeSegment(
      POINTS, point.x, point.y, point.z, contact.x, contact.y, contact.z
    ), 0);
    glowStroke(ctx, CYAN, 235 * alpha, 2.2);
    ctx.beginPath();
    tracePolyline3D(ctx, POINTS, writeSegment(
      POINTS, point.x, point.y, point.z, sphere.focusX, sphere.focusY, 0
    ), 0);
    glowStroke(ctx, ACID, 225 * alpha, 2);
    if (projectPoint(contact.x, contact.y, contact.z)) {
      glowDot(ctx, projX, projY, CYAN, 245 * alpha, 4.2);
    }
  }
  if (projectPoint(point.x, point.y, point.z)) {
    glowDot(ctx, projX, projY, INK, 240 * reveal, 5);
  }
}

function drawTangencyPoints(ctx) {
  const reveal = scene.focusReveal;
  if (reveal <= 0.004) return;
  const ux = scene.cosTilt;
  const uy = scene.sinTilt;
  for (const sphere of scene.spheres) {
    const alpha = reveal * sphere.visibility * scene.sphereReveal;
    if (!sphere.active || alpha <= 0.004) continue;

    // Radius to the tangency point: perpendicular to the plane.
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    tracePolyline3D(ctx, POINTS, writeSegment(
      POINTS, 0, sphere.c, 0, sphere.focusX, sphere.focusY, 0
    ), 0);
    glowStroke(ctx, CYAN, 150 * alpha, 1.2, 0);
    ctx.setLineDash([]);
    if (projectPoint(0, sphere.c, 0)) glowDot(ctx, projX, projY, CYAN, 190 * alpha, 2.8);

    // One expanding ring in the plane as the focus is found, then a fixed ring.
    const pulse = scene.focusLocal;
    for (const [radius, ringAlpha] of [
      [0.1 + 0.5 * pulse, 190 * (1 - pulse)],
      [0.12, 170],
    ]) {
      ctx.beginPath();
      tracePolyline3D(ctx, POINTS, writeCircle(
        POINTS,
        sphere.focusX, sphere.focusY, 0,
        ux, uy, 0, 0, 0, 1,
        radius, 64
      ), 0);
      glowStroke(ctx, ACID, ringAlpha * alpha, 1.5, 0.6);
    }
    if (projectPoint(sphere.focusX, sphere.focusY, 0)) {
      glowDot(ctx, projX, projY, ACID, 250 * alpha, 5.2);
    }
  }
}

const SUBSCRIPT_DIGITS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

function subscript(n) {
  return String(n).split("").map(d => SUBSCRIPT_DIGITS[Number(d)]).join("");
}

function drawGeometryLabel(graphics, label, x, y, alpha, colorValue) {
  graphics.noStroke();
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(26);
  graphics.textAlign(CENTER, CENTER);
  graphics.fill(colorValue.r, colorValue.g, colorValue.b, 225 * alpha);
  graphics.text(label, x, y);
}

function drawGeometryLabels(graphics) {
  const foci = [];
  for (const sphere of scene.spheres) {
    const alpha = scene.focusReveal * sphere.visibility * scene.sphereReveal;
    if (!sphere.active || alpha <= 0.02) continue;
    if (!projectPoint(sphere.focusX, sphere.focusY, 0)) continue;
    foci.push({ x: projX, y: projY, alpha, index: sphere.index + 1 });
  }
  if (foci.length === 0) return;
  const midX = foci.reduce((sum, focus) => sum + focus.x, 0) / foci.length;
  const midY = foci.reduce((sum, focus) => sum + focus.y, 0) / foci.length;
  for (const focus of foci) {
    let dx = focus.x - midX;
    let dy = focus.y - midY;
    const length = Math.hypot(dx, dy);
    if (length < 1) {
      dx = -1;
      dy = 0;
    } else {
      dx /= length;
      dy /= length;
    }
    drawGeometryLabel(
      graphics, `F${subscript(focus.index)}`,
      focus.x + dx * 40, focus.y + dy * 40 - 6, focus.alpha, ACID
    );
  }

  const reveal = scene.constructionReveal;
  if (reveal <= 0.02 || !Number.isFinite(scene.pointT)) return;
  const point = conicPoint(scene.pointT, scene.pointPhi, constructionPoint);
  if (projectPoint(point.x, point.y, point.z)) {
    const dx = projX - midX;
    const dy = projY - midY;
    const length = Math.max(1, Math.hypot(dx, dy));
    drawGeometryLabel(graphics, "P", projX + dx / length * 30, projY + dy / length * 30, reveal, INK);
  }
  for (const sphere of scene.spheres) {
    const alpha = reveal * sphere.visibility;
    if (!sphere.active || alpha <= 0.02) continue;
    const contact = conicPoint(sphere.c * COS_A, scene.pointPhi, constructionContact);
    if (!projectPoint(0, sphere.contactY, 0)) continue;
    const axisX = projX;
    const axisY = projY;
    if (!projectPoint(contact.x, contact.y, contact.z)) continue;
    const dx = projX - axisX;
    const dy = projY - axisY;
    const length = Math.max(1, Math.hypot(dx, dy));
    drawGeometryLabel(
      graphics, `T${subscript(sphere.index + 1)}`,
      projX + dx / length * 32, projY + dy / length * 32, alpha, CYAN
    );
  }
}

// Soft erase outside the Reel-safe stage, so nothing is cut with a hard edge.
function applyStageMask(ctx) {
  const f = VIEW.feather;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const bands = [
    [0, VIEW.maskTop, 0, VIEW.maskTop + f, 0, 0, W, VIEW.maskTop + f],
    [0, VIEW.maskBottom, 0, VIEW.maskBottom - f, 0, VIEW.maskBottom - f, W, H],
    [VIEW.maskLeft, 0, VIEW.maskLeft + f, 0, 0, 0, VIEW.maskLeft + f, H],
    [VIEW.maskRight, 0, VIEW.maskRight - f, 0, VIEW.maskRight - f, 0, W, H],
  ];
  for (const [x0, y0, x1, y1, rx, ry, rx2, ry2] of bands) {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(rx, ry, rx2 - rx, ry2 - ry);
  }
  ctx.restore();
}

// ================================================================
// LIVE RELATIONS
// ================================================================

// Tangent lengths from the construction point: PF_i against PT_i.
function measureConstruction() {
  const t = scene.pointT;
  if (!Number.isFinite(t)) return null;
  const point = conicPoint(t, scene.pointPhi, constructionPoint);
  const result = { focal: [], tangent: [] };
  // A sphere heading to infinity near the parabola drops out of the readout
  // as it fades, so the numbers stay on the scale of the visible geometry.
  for (const sphere of scene.spheres) {
    if (!sphere.active || sphere.visibility < 0.5) continue;
    result.focal.push(Math.hypot(point.x - sphere.focusX, point.y - sphere.focusY, point.z));
    result.tangent.push(Math.abs(t - sphere.c * COS_A));
  }
  if (result.focal.length === 2) {
    const [a, b] = scene.spheres;
    result.span = Math.abs(a.c - b.c) * COS_A;
  }
  return result;
}

function relationText() {
  const measured = measureConstruction();
  if (!measured) return "—";
  const [f1, f2] = measured.focal;
  if (measured.focal.length === 1) {
    return `PF · ${f1.toFixed(4)}   |   PT · ${measured.tangent[0].toFixed(4)}`;
  }
  const value = scene.type === "ELLIPSE" ? f1 + f2 : Math.abs(f1 - f2);
  const label = scene.type === "ELLIPSE" ? "PF₁ + PF₂" : "|PF₁ − PF₂|";
  return `${label} · ${value.toFixed(4)}   |   T₁T₂ · ${measured.span.toFixed(4)}`;
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
  graphics.text("DANDELIN SPHERES", W / 2, HUD.titleY);
  graphics.textFont("monospace");
  graphics.textStyle(NORMAL);
  graphics.textSize(34);
  graphics.fill(INK.r, INK.g, INK.b, 228);
  graphics.text("CONE ∩ PLANE → CONIC", W / 2, HUD.formulaY);
  graphics.textSize(23);
  graphics.fill(CYAN.r, CYAN.g, CYAN.b, 220);
  graphics.text("c = d / (cos β ± sin α) · e = sin β / cos α", W / 2, HUD.exponentY);
  graphics.textSize(26);
  graphics.fill(INK.r, INK.g, INK.b, 166);
  graphics.text("SPHERE TANGENCY → FOCUS", W / 2, HUD.subtitleY);
  graphics.fill(INK.r, INK.g, INK.b, 235);
  graphics.textAlign(LEFT, TOP);
  graphics.text(`${scene.type} · e ${scene.eccentricity.toFixed(3)}`, HUD.stageTextX, HUD.stageY);
  graphics.textAlign(RIGHT, TOP);
  graphics.textSize(22);
  graphics.text(
    `α ${(MATH.coneAngle * DEG).toFixed(0)}° · β ${(scene.tilt * DEG).toFixed(1)}°`,
    W - HUD.rightTextX,
    HUD.stageY + 3
  );
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
  const p = loopProgress;
  const captions = [
    [
      1 - smoothstep(0.40, 0.44, p) + smoothstep(0.95, 0.99, p),
      "TILT THE PLANE — THE SECTION CHANGES",
      "ELLIPSE → PARABOLA → HYPERBOLA",
    ],
    [
      envelope(p, [0.44, 0.48, 0.76, 0.80]),
      "EACH SPHERE TOUCHES CONE AND PLANE",
      "AT THE PARABOLA ONE SPHERE LEAVES TO ∞",
    ],
    [
      envelope(p, [0.80, 0.84, 0.95, 0.99]),
      "WHERE A SPHERE MEETS THE PLANE: A FOCUS",
      "PF = PT · EQUAL TANGENTS FROM P",
    ],
  ];
  for (const [weight, first, second] of captions) {
    if (weight <= 0.01) continue;
    graphics.fill(INK.r, INK.g, INK.b, HUD.bottomMainAlpha * weight);
    graphics.text(first, W / 2, HUD.bottomTextY);
    graphics.text(second, W / 2, HUD.bottomTextY + 38);
  }
  graphics.textSize(22);
  graphics.fill(INK.r, INK.g, INK.b, HUD.citationAlpha);
  graphics.text(relationText(), W / 2, HUD.citationY);
  compositeHUD(graphics);
}

// ================================================================
// AUDIT — ?audit=1 checks every loop frame and stores the report on
// window.dandelinAudit (tangency residuals, focal relations, bounds, loop).
// ================================================================

function runAudit() {
  const report = {
    frames: LOOP_FRAMES,
    nonFinite: 0,
    maxContactOnSphere: 0,
    maxContactTangent: 0,
    maxPlaneTangency: 0,
    maxFocusOnPlane: 0,
    maxConicOnCone: 0,
    maxConicOnPlane: 0,
    maxFocalVsTangent: 0,
    maxConstantVsSpan: 0,
    minEyeToSphere: Infinity,
    bounds: {},
    loopDelta: 0,
  };
  const grow = (key, frame) => {
    if (!Number.isFinite(projX) || !Number.isFinite(projY)) {
      report.nonFinite++;
      return;
    }
    const box = report.bounds[key] || (report.bounds[key] = {
      minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity,
    });
    if (projX < box.minX) { box.minX = projX; box.minXFrame = frame; }
    if (projX > box.maxX) { box.maxX = projX; box.maxXFrame = frame; }
    if (projY < box.minY) { box.minY = projY; box.minYFrame = frame; }
    if (projY > box.maxY) { box.maxY = projY; box.maxYFrame = frame; }
  };
  const worst = (key, value) => {
    if (!Number.isFinite(value)) report.nonFinite++;
    else report[key] = Math.max(report[key], Math.abs(value));
  };
  const snapshot = () => [
    scene.tilt, scene.curveAlpha, scene.sphereReveal, scene.focusReveal,
    scene.constructionReveal, cam.ex, cam.ey, cam.ez, cam.fx, cam.fy, cam.fz,
  ];
  const savedProgress = loopProgress;

  for (let frame = 0; frame < LOOP_FRAMES; frame++) {
    loopProgress = frame / LOOP_FRAMES;
    phase = loopProgress * TAU;
    updateAnimation();
    updateCamera();
    const heroPhase = loopProgress > 0.72 && loopProgress < 0.9;

    for (const sphere of scene.spheres) {
      if (!sphere.active) continue;
      // Contact circle point T: on the sphere, and the apex ray through T is
      // perpendicular to the radius there (T·(T − C) = 0).
      const dx = sphere.contactR;
      const dy = sphere.contactY - sphere.c;
      worst("maxContactOnSphere", Math.hypot(dx, dy) - sphere.r);
      worst("maxContactTangent", sphere.contactR * dx + sphere.contactY * dy);
      worst("maxPlaneTangency", Math.abs(sphere.planeGap) - sphere.r);
      worst("maxFocusOnPlane",
        scene.nx * sphere.focusX + scene.ny * sphere.focusY - MATH.planeDistance);
      const shown = sphere.visibility * scene.sphereReveal;
      if (shown > 0.1) {
        report.minEyeToSphere = Math.min(
          report.minEyeToSphere,
          Math.hypot(cam.ex, cam.ey - sphere.c, cam.ez) - sphere.r
        );
        const count = writeSphereSilhouette(POINTS, sphere);
        for (let i = 0; i < count; i += 6) {
          if (projectPoint(POINTS[i * 3], POINTS[i * 3 + 1], POINTS[i * 3 + 2])) {
            grow(heroPhase ? "spheresHero" : "spheres", frame);
          }
        }
      }
    }

    for (let k = 0; k < 90; k++) {
      const phi = k / 90 * TAU;
      const t = conicParameter(phi);
      if (!isInsideCone(t)) continue;
      const point = conicPoint(t, phi, constructionPoint);
      worst("maxConicOnCone",
        Math.hypot(point.x, point.z) - Math.abs(point.y) * TAN_A);
      worst("maxConicOnPlane",
        scene.nx * point.x + scene.ny * point.y - MATH.planeDistance);
      if (projectPoint(point.x, point.y, point.z)) grow("conic", frame);
      const focal = [];
      for (const sphere of scene.spheres) {
        if (!sphere.active) continue;
        const pf = Math.hypot(point.x - sphere.focusX, point.y - sphere.focusY, point.z);
        worst("maxFocalVsTangent", pf - Math.abs(t - sphere.c * COS_A));
        focal.push(pf);
      }
      if (focal.length === 2) {
        const span = Math.abs(scene.spheres[0].c - scene.spheres[1].c) * COS_A;
        const value = scene.eccentricity < 1 ? focal[0] + focal[1] : Math.abs(focal[0] - focal[1]);
        worst("maxConstantVsSpan", value - span);
      }
    }

    for (const y of [MATH.upperExtent, -MATH.lowerExtent]) {
      const count = writeHorizontalCircle(POINTS, y, Math.abs(y) * TAN_A, 36);
      for (let i = 0; i < count; i++) {
        const key = y > 0 ? "upperRim" : heroPhase ? "lowerRimHero" : "lowerRim";
        if (projectPoint(POINTS[i * 3], POINTS[i * 3 + 1], POINTS[i * 3 + 2])) grow(key, frame);
      }
    }
    const planeCount = writePlaneQuad(POINTS, 1);
    for (let i = 0; i < planeCount; i++) {
      if (projectPoint(POINTS[i * 3], POINTS[i * 3 + 1], POINTS[i * 3 + 2])) grow("planeOuter", frame);
    }
  }

  loopProgress = 0;
  phase = 0;
  updateAnimation();
  updateCamera();
  const first = snapshot();
  loopProgress = 1 - 1e-9;
  phase = loopProgress * TAU;
  updateAnimation();
  updateCamera();
  const last = snapshot();
  report.loopDelta = Math.max(...first.map((value, i) => Math.abs(value - last[i])));

  loopProgress = savedProgress;
  phase = loopProgress * TAU;
  console.log("[dandelin audit]", JSON.stringify(report, null, 2));
  return report;
}

const previewParam = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search).get("preview")
  : null;
const previewProgress = previewParam === null ? NaN : Number(previewParam);
const auditParam = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search).get("audit")
  : null;

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
    // frame / LOOP_FRAMES: the last recorded frame hands off seamlessly to
    // the first when the Reel loops (no duplicated frame).
    loopProgress = (recFrameCount % LOOP_FRAMES) / LOOP_FRAMES;
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
    saveCanvas(`dandelin_spheres_${getTimestamp()}`, "png");
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
    anchor.download = `dandelin_spheres_${getTimestamp()}.mp4`;
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
