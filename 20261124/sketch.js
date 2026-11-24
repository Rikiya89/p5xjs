"use strict";

// SODDY–GOSSET THEOREM — EXACT 3D APOLLONIAN SPHERE PACKING
// Five mutually tangent spheres in R³ (curvature k = 1/r, negative for an enclosing sphere) satisfy
//   (k₁ + k₂ + k₃ + k₄ + k₅)² = 3 (k₁² + k₂² + k₃² + k₄² + k₅²).
// Fix four spheres: the relation is quadratic in the fifth, 2k² − 2Sk + 3Q − S² = 0 (S, Q = Σ₄k, Σ₄k²),
// so its two roots obey k₅ + k₅′ = S. The same linear identity holds for the curvature-weighted centres:
//   k′ = (k₁ + k₂ + k₃ + k₄) − k₅,     k′c′ = (k₁c₁ + k₂c₂ + k₃c₃ + k₄c₄) − k₅c₅.
// Seed: bounding sphere R = 1 (k = −1) and four equal spheres on a regular tetrahedron. Edge 2r and
// circumradius r√(3/2) = 1 − r give r₀ = 1 / (1 + √1.5) ≈ 0.44949.
// Unlike the planar Apollonian group, the 3D reflection group has relations: reflection words cycle back to
// a 5-set already seen with no shrink in radius, so a plain recursion never terminates. Generation is a BFS
// over 5-sets with a visited table (spheres hashed by rounded k and centre), stopped by radius.
// The packing is invariant under the tetrahedral group Td: a spin of 2π/3 about a 3-fold axis (or π about a
// 2-fold axis) carries the image onto itself, which closes the loop.

const W = 1080;
const H = 1920;
const FPS = 60;

const MAX_DURATION = 10;
const MAX_FRAMES = FPS * MAX_DURATION;
const LOOP_FRAMES = MAX_FRAMES;
const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const SQRT3 = Math.sqrt(3);

// Neo-Swiss palette, same { r, g, b } structure as the rest of the series.
const BG = { r: 242, g: 240, b: 234 };      // #F2F0EA off-white
const INK = { r: 17, g: 17, b: 17 };        // #111111 near-black
const CHARCOAL = { r: 32, g: 32, b: 32 };   // #202020
const MUTED = { r: 168, g: 166, b: 159 };   // #A8A69F
const COBALT = { r: 36, g: 71, b: 255 };    // #2447FF

// Asymmetric 12-column grid: 84 px margins, 54 px columns, 24 px gutters.
const GRID = {
  left: 84,
  right: W - 84,
  colStep: 78,
};

function gridX(column) {
  return GRID.left + GRID.colStep * column;
}

// Reference layout; the technical column moves beside the second title line (the first, SODDY–GOSSET,
// reaches past column 7) and the loop track drops 30 px to make room for the subtitle row.
const HUD = {
  safeX: 56,
  headerY: 214,
  ruleTopY: 252,
  titleY: 278,
  titleLead: 76,
  subtitleY: 440,
  columnY: 364,
  columnLead: 34,
  trackY: 500,
  readoutY: 516,
  ruleBottomY: 1268,
  formulaY: 1284,
  citationY: 1410,
};

// Vertical section ruler in the left column: cut offset d ∈ [−1, 1] mapped to [rulerBottom, rulerTop].
const RULER = {
  x: 112,
  top: 640,
  bottom: 1120,
  tick: 8,
};

// ================================================================
// GEOMETRY — exact Soddy–Gosset reflection, generated once in setup()
// ================================================================

const PACK = {
  outerK: -1,
  seedR: 1 / (1 + Math.sqrt(1.5)),
  // Radius cut-off. Counts for this seed: 0.04 → 672 · 0.035 → 888 · 0.032 → 1032 · 0.030 → 1356 ·
  // 0.028 → 1596 · 0.020 → 3480 · 0.012 → 12 978.
  rMin: 0.03,
  // Hard cap, applied to whole generations only: a partial generation would break Td and the loop seam.
  maxSpheres: 1500,
  hash: 1e5,
  descartesTol: 1e-6,
  tangencyTol: 1e-6,
};

const TETRA = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];

function generatePacking() {
  const t0 = performance.now();
  const r0 = PACK.seedR, k0 = 1 / r0, s = (1 - r0) / SQRT3;
  const spheres = [], index = new Map();
  const keyOf = (k, c) => `${Math.round(k * PACK.hash)},${Math.round(c[0] * PACK.hash)},${Math.round(c[1] * PACK.hash)},${Math.round(c[2] * PACK.hash)}`;
  const add = (k, c, gen) => {
    const key = keyOf(k, c);
    const found = index.get(key);
    if (found !== undefined) return found;
    const id = spheres.length;
    spheres.push({ id, k, r: Math.abs(1 / k), c, gen, internal: k < 0 });
    index.set(key, id);
    return id;
  };
  add(PACK.outerK, [0, 0, 0], 0);
  for (const v of TETRA) add(k0, v.map((x) => x * s), 0);

  const pairs = [], pairKeys = new Set();
  const addPair = (i, j) => {
    const key = i < j ? `${i}|${j}` : `${j}|${i}`;
    if (pairKeys.has(key)) return;
    pairKeys.add(key);
    pairs.push(i < j ? [i, j] : [j, i]);
  };
  const residual = (set) => {
    let sum = 0, sumSq = 0;
    for (const id of set) { sum += spheres[id].k; sumSq += spheres[id].k * spheres[id].k; }
    return Math.abs(sum * sum - 3 * sumSq);
  };
  const configKey = (set) => set.slice().sort((a, b) => a - b).join(",");

  const seed = [0, 1, 2, 3, 4];
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) addPair(seed[i], seed[j]);
  const seen = new Set([configKey(seed)]);
  const verify = { sets: 1, maxDescartes: residual(seed), descartesFails: 0, duplicateHits: 0, capped: false };
  const perGeneration = [{ gen: 0, spheres: 5, sets: 1 }];

  let frontier = [{ set: seed, skip: -1 }];
  for (let gen = 1; frontier.length; gen++) {
    const sphereMark = spheres.length, pairMark = pairs.length, next = [];
    for (const { set, skip } of frontier) {
      for (let i = 0; i < 5; i++) {
        if (i === skip) continue;
        let sum = 0;
        const weighted = [0, 0, 0];
        for (let j = 0; j < 5; j++) {
          if (j === i) continue;
          const q = spheres[set[j]];
          sum += q.k;
          for (let a = 0; a < 3; a++) weighted[a] += q.k * q.c[a];
        }
        const old = spheres[set[i]];
        const k = sum - old.k;
        if (!(k > 0) || 1 / k < PACK.rMin) continue;
        const c = weighted.map((value, a) => (value - old.k * old.c[a]) / k);
        const before = spheres.length;
        const id = add(k, c, gen);
        if (spheres.length === before) verify.duplicateHits++;
        const grown = set.slice();
        grown[i] = id;
        const key = configKey(grown);
        if (seen.has(key)) continue;
        seen.add(key);
        const err = residual(grown);
        verify.sets++;
        verify.maxDescartes = Math.max(verify.maxDescartes, err);
        if (err >= PACK.descartesTol) verify.descartesFails++;
        for (let j = 0; j < 5; j++) if (j !== i) addPair(id, grown[j]);
        next.push({ set: grown, skip: i });
      }
    }
    if (spheres.length > PACK.maxSpheres) {
      spheres.length = sphereMark;
      pairs.length = pairMark;
      verify.capped = true;
      break;
    }
    if (spheres.length > sphereMark) perGeneration.push({ gen, spheres: spheres.length - sphereMark, sets: next.length });
    frontier = next;
  }

  const maxGen = spheres.reduce((m, q) => Math.max(m, q.gen), 0);
  return { spheres, pairs, perGeneration, maxGen, verify, ms: performance.now() - t0 };
}

// Tangency of every recorded pair, non-overlap of every inner pair, containment in the bound.
function verifyPacking(packing) {
  const { spheres, pairs, verify } = packing;
  let maxTangency = 0, tangencyFails = 0;
  for (const [i, j] of pairs) {
    const a = spheres[i], b = spheres[j];
    const d = Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1], a.c[2] - b.c[2]);
    const target = a.internal ? a.r - b.r : b.internal ? b.r - a.r : a.r + b.r;
    const err = Math.abs(d - target);
    maxTangency = Math.max(maxTangency, err);
    if (err >= PACK.tangencyTol) tangencyFails++;
  }
  // Brute force over every pair: overlaps, containment, and the true number of tangencies (must equal pairs).
  let overlaps = 0, outside = 0, touching = 0;
  for (let i = 1; i < spheres.length; i++) {
    const a = spheres[i];
    const toBound = 1 - Math.hypot(...a.c) - a.r;
    if (toBound < -1e-9) outside++;
    if (Math.abs(toBound) < 1e-9) touching++;
    for (let j = i + 1; j < spheres.length; j++) {
      const b = spheres[j];
      const gap = Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1], a.c[2] - b.c[2]) - a.r - b.r;
      if (gap < -1e-9) overlaps++;
      if (Math.abs(gap) < 1e-9) touching++;
    }
  }
  Object.assign(verify, { maxTangency, tangencyFails, overlaps, outside, touching });
  verify.ok = verify.descartesFails === 0 && tangencyFails === 0 && overlaps === 0 && outside === 0 &&
    touching === pairs.length;
  return verify;
}

function logPacking(packing) {
  const v = packing.verify;
  const tag = v.ok ? "PASS" : "FAIL";
  console.log(
    `[soddy] ${tag} · ${packing.spheres.length} spheres (incl. bound) · ${packing.pairs.length} tangencies · ` +
    `gens 0–${packing.maxGen} · r ≥ ${PACK.rMin} · ${packing.ms.toFixed(1)} ms`,
  );
  console.log(
    `[soddy] Descartes |(Σk)² − 3Σk²| max ${v.maxDescartes.toExponential(2)} over ${v.sets} sets (tol ${PACK.descartesTol}, fails ${v.descartesFails}) · ` +
    `tangency max ${v.maxTangency.toExponential(2)} (fails ${v.tangencyFails}, brute-force ${v.touching}/${packing.pairs.length}) · ` +
    `overlaps ${v.overlaps} · outside ${v.outside} · ` +
    `duplicate reflections ${v.duplicateHits}${v.capped ? " · CAPPED at a whole generation" : ""}`,
  );
  console.table(packing.perGeneration);
}

// ================================================================
// VIEW — presets, pose, projection and framing (same conventions as the series)
// ================================================================

// Ink weight per generation: 1 = full ink at gen 0, falling toward the paper as generations deepen.
function generationWeight(gen, maxGen) {
  const u = maxGen > 0 ? gen / maxGen : 0;
  return 1 - 0.78 * Math.pow(u, 0.8);
}

//   cutCentre — mean offset of the section plane from the centre (units of R)
//   cutSwing  — amplitude of the section sweep d(t) = cutCentre + cutSwing · sin 2πt
//   distance  — camera distance relative to the fitted framing
//   tilt      — camera elevation over the spin axis
//   spinTurns — symmetry periods 2π/n per loop
const PARAMS = {
  cutCentre: 0,
  cutSwing: 0.32,
  distance: 1,
  tilt: 0.3,
  spinTurns: 1,
  light: 1,
};

// View presets: the spin axis is a three- or two-fold axis of Td.
const PRESETS = [
  { key: "c3v", label: "C3 VERTEX", order: 3, axis: [1, 1, 1] },
  { key: "c3f", label: "C3 FACE", order: 3, axis: [-1, -1, -1] },
  { key: "c2", label: "C2 EDGE", order: 2, axis: [1, 0, 0] },
];

// Td mirror planes x = ±y, y = ±z, z = ±x; the ones containing the spin axis are drawn on the bound.
const MIRROR_NORMALS = [[1, -1, 0], [1, 1, 0], [0, 1, -1], [0, 1, 1], [-1, 0, 1], [1, 0, 1]];

// Stage box the packing is fitted into once per parameter set (never per frame).
const STAGE = {
  left: 176,
  right: GRID.right,
  top: 578,
  bottom: 1212,
  fov: 0.5,
  tiltSwing: 0.06,
  yawSwing: 0.05,
  fitSamples: 60,
  fitDirections: 400,
  // Spin at t = 0 as a fraction of the symmetry period 2π/n.
  spinPhase: 0.1,
  axisAbove: 0.3,
  axisBelow: 0.12,
  // Section plane normal in world space (camera at +z): the right-front half is removed, the left half stays
  // solid and the cut face is seen obliquely (foreshortened by n.z).
  cutNormal: [0.82, -0.12, 0.56],
};

const MESH = { pxPerUnit: 320, chordPx: 6, minLon: 10, maxLon: 72 };

// Lines: the gen ≤ 1 contact graph (seed tetrahedron, centre sphere, bound contacts). Dots: gen ≤ 4 contacts
// on the kept side of the section.
const NETWORK = { lineGen: 1, dotGen: 4, bigDotGen: 2, dotLift: 2.5, bigDot: 6, smallDot: 3.2 };

const frameState = {
  spin: 0,
  tilt: 0,
  yaw: 0,
  cut: 0,
  reveal: 1,
  light: 0,
};

const fit = { scale: 200, tx: 0, ty: 0, key: "" };

let presetIndex = 0;
let packing = null;

function preset() {
  return PRESETS[presetIndex];
}

function normalize3(p) {
  const length = Math.hypot(p[0], p[1], p[2]);
  return [p[0] / length, p[1] / length, p[2] / length];
}

function cross(p, q) {
  return [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
}

function dot(p, q) {
  return p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
}

function revealMax() {
  return packing ? packing.maxGen + 1 : 1;
}

function computeFrameState(p) {
  const phase = p * TAU;
  // 2π/n per loop: frame 600 is frame 0 carried onto itself by the n-fold rotation.
  frameState.spin = TAU / preset().order * (STAGE.spinPhase + PARAMS.spinTurns * p);
  frameState.tilt = PARAMS.tilt + STAGE.tiltSwing * Math.sin(phase);
  frameState.yaw = STAGE.yawSwing * Math.sin(phase + 0.7);
  frameState.cut = PARAMS.cutCentre + PARAMS.cutSwing * Math.sin(phase);
  // Generation reveal: all generations at t = 0, down to gen 0 alone at t = 1/2, rebuilt by t = 1.
  frameState.reveal = sim.layers.reveal
    ? 1 + (revealMax() - 1) * (0.5 + 0.5 * Math.cos(phase))
    : revealMax();
  frameState.light = 0.12 * Math.sin(phase - 0.6);
}

// Alignment A: the preset's symmetry axis becomes model +Z (rows e1, e2, axis; right-handed).
const align = { rows: null, key: -1 };

function alignment() {
  if (align.key === presetIndex) return align.rows;
  const axis = normalize3(preset().axis);
  const helper = Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const e1 = normalize3(cross(axis, helper)), e2 = cross(axis, e1);
  align.rows = [e1, e2, axis];
  align.key = presetIndex;
  return align.rows;
}

// Same pose renderFrame applies: alignment, spin about Z, tilt (elevation), yaw. Input in packing coordinates.
function posePoint(point, out) {
  const A = alignment(), spin = frameState.spin, tilt = HALF_PI - frameState.tilt, yaw = frameState.yaw;
  let x = dot(A[0], point), y = dot(A[1], point), z = dot(A[2], point);
  let c = Math.cos(spin), s = Math.sin(spin);
  [x, y] = [c * x - s * y, s * x + c * y];
  c = Math.cos(tilt); s = Math.sin(tilt);
  [y, z] = [c * y - s * z, s * y + c * z];
  c = Math.cos(yaw); s = Math.sin(yaw);
  [x, z] = [c * x + s * z, -s * x + c * z];
  out[0] = x; out[1] = y; out[2] = z;
  return out;
}

// Model → world rotation M (columns = posed basis vectors), row-major.
function poseMatrix() {
  const columns = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e) => posePoint(e, [0, 0, 0]));
  return [0, 1, 2].map((row) => columns.map((column) => column[row]));
}

function cameraDistance() {
  return (H / 2) / Math.tan(STAGE.fov / 2);
}

// Exact perspective projection of a posed model point (matches renderFrame).
function projectToScreen(posed, out) {
  const distance = cameraDistance();
  const x = fit.tx + posed[0] * fit.scale, y = fit.ty + posed[1] * fit.scale, z = posed[2] * fit.scale;
  const k = distance / (distance - z);
  out[0] = W / 2 + x * k;
  out[1] = H / 2 + y * k;
  return out;
}

// Camera position in packing coordinates: q = Mᵀ((0, 0, D) − (tx, ty, 0)) / s.
function cameraInModel(M) {
  const world = [-fit.tx, -fit.ty, cameraDistance()];
  return [0, 1, 2].map((i) => (M[0][i] * world[0] + M[1][i] * world[1] + M[2][i] * world[2]) / fit.scale);
}

function axisEnds() {
  const axis = normalize3(preset().axis);
  return [axis.map((v) => v * (1 + STAGE.axisAbove)), axis.map((v) => -v * (1 + STAGE.axisBelow))];
}

// The bounding sphere and the axis are the only features that reach the silhouette.
function forEachExtremePoint(visit) {
  const n = STAGE.fitDirections;
  for (let i = 0; i < n; i++) {
    const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5));
    visit([r * Math.cos(a), y, r * Math.sin(a)]);
  }
  for (const point of axisEnds()) visit(point);
}

function fitStage() {
  const key = [PARAMS.tilt, PARAMS.spinTurns, PARAMS.distance, presetIndex].join();
  if (key === fit.key) return;
  const posed = [0, 0, 0];
  let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity;
  for (let k = 0; k < STAGE.fitSamples; k++) {
    computeFrameState(k / STAGE.fitSamples);
    forEachExtremePoint((point) => {
      posePoint(point, posed);
      xLo = Math.min(xLo, posed[0]); xHi = Math.max(xHi, posed[0]);
      yLo = Math.min(yLo, posed[1]); yHi = Math.max(yHi, posed[1]);
    });
  }
  // 0.94 leaves room for perspective growth of the near side.
  const boxW = STAGE.right - STAGE.left, boxH = STAGE.bottom - STAGE.top;
  fit.scale = 0.94 * Math.min(boxW / (xHi - xLo), boxH / (yHi - yLo)) / PARAMS.distance;
  fit.tx = (STAGE.left + STAGE.right) / 2 - W / 2 - fit.scale * (xLo + xHi) / 2;
  fit.ty = (STAGE.top + STAGE.bottom) / 2 - H / 2 - fit.scale * (yLo + yHi) / 2;
  fit.key = key;
}

// ================================================================
// RENDER — one merged mesh for every inner sphere, one draw call
// ================================================================

// Unit packing coordinates. Vertex colour carries per-sphere data for the shader:
//   r = generation ink weight, g = radius, b = gen / 32, a = 1 (kept opaque so p5 never treats it as transparent).
function buildPackingMesh() {
  const geometry = new p5.Geometry(1, 1);
  geometry.gid = "soddy-packing-mesh";
  for (const sphere of packing.spheres) {
    if (sphere.internal) continue;
    const lon = clamp(Math.round(TAU * sphere.r * MESH.pxPerUnit / MESH.chordPx), MESH.minLon, MESH.maxLon);
    const lat = Math.max(6, lon >> 1);
    const base = geometry.vertices.length;
    const weight = generationWeight(sphere.gen, packing.maxGen);
    const [cx, cy, cz] = sphere.c, r = sphere.r;
    for (let i = 0; i <= lat; i++) {
      const theta = Math.PI * i / lat, st = Math.sin(theta), ct = Math.cos(theta);
      for (let j = 0; j <= lon; j++) {
        const phi = TAU * j / lon;
        const nx = st * Math.cos(phi), ny = ct, nz = st * Math.sin(phi);
        geometry.vertices.push(new p5.Vector(cx + r * nx, cy + r * ny, cz + r * nz));
        geometry.vertexNormals.push(new p5.Vector(nx, ny, nz));
        geometry.vertexColors.push(weight, r, sphere.gen / 32, 1);
      }
    }
    // Outward winding in packing coordinates: (a, a+1, b) has normal ∂φ × ∂θ pointing out.
    for (let i = 0; i < lat; i++) {
      for (let j = 0; j < lon; j++) {
        const a = base + i * (lon + 1) + j, b = a + lon + 1;
        if (i > 0) geometry.faces.push([a, a + 1, b]);
        if (i < lat - 1) geometry.faces.push([a + 1, b + 1, b]);
      }
    }
  }
  return geometry;
}

const PACKING_VERTEX = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
in vec4 aVertexColor;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;
uniform float uReveal;
out vec3 vEye;
out vec3 vNormal;
out float vWeight;
void main() {
  float r = aVertexColor.g;
  float gen = aVertexColor.b * 32.0;
  float grow = clamp(uReveal - gen, 0.0, 1.0);
  grow = grow * grow * (3.0 - 2.0 * grow);
  vec3 centre = aPosition - r * aNormal;
  vec4 eye = uModelViewMatrix * vec4(centre + aNormal * r * grow, 1.0);
  vEye = eye.xyz;
  vNormal = uNormalMatrix * aNormal;
  vWeight = aVertexColor.r;
  gl_Position = uProjectionMatrix * eye;
}
`;

const PACKING_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vEye;
in vec3 vNormal;
in float vWeight;
uniform vec3 uCentre;
uniform vec3 uCutNormal;
uniform float uCut;
uniform float uCutOn;
uniform float uScale;
uniform float uFrontSign;
uniform vec3 uBg;
uniform vec3 uInk;
uniform vec3 uCharcoal;
uniform vec3 uMuted;
uniform vec3 uCobalt;
uniform vec3 uKey;
uniform float uLight;
out vec4 outColor;

float pxLine(float d, float halfWidth) {
  return 1.0 - smoothstep(halfWidth - 0.6, halfWidth + 0.6, d);
}

void main() {
  vec3 rel = vEye - uCentre;
  float side = dot(rel, uCutNormal) - uCut;
  if (uCutOn > 0.5 && side > 0.0) discard;
  float depth = clamp(0.5 + 0.5 * rel.z / uScale, 0.0, 1.0);
  float rim = uCutOn * pxLine(abs(side) / max(fwidth(side), 1e-4), 0.9);
  bool front = (gl_FrontFacing ? 1.0 : -1.0) * uFrontSign > 0.0;

  // Back face seen through a cut = the solid cross-section of that sphere (shell-cap trick, exact for
  // non-overlapping convex solids).
  if (!front) {
    vec3 cap = mix(uBg, uCobalt, 0.05 + 0.15 * vWeight);
    cap = mix(cap, uCobalt, rim);
    outColor = vec4(mix(cap, uBg, 0.1 * (1.0 - depth)), 1.0);
    return;
  }

  vec3 n = normalize(vNormal);
  vec3 v = normalize(-vEye);
  vec3 key = normalize(uKey);
  float facing = dot(n, v);
  float diffuse = max(dot(n, key), 0.0);
  float soft = 0.5 + 0.5 * dot(n, key);
  float spec = pow(max(dot(reflect(-key, n), v), 0.0), 28.0);
  float sheen = pow(1.0 - max(facing, 0.0), 2.5);
  vec3 color = mix(mix(uInk, uCharcoal, 0.5), uMuted, uLight * (0.34 * diffuse + 0.1 * soft));
  color += vec3(0.16 * spec * uLight + 0.05 * sheen);
  color = mix(uBg, color, vWeight);
  float edge = 1.0 - smoothstep(0.0, 1.6 * max(fwidth(facing), 1e-4), facing);
  color = mix(color, uBg, 0.85 * edge);
  color = mix(color, uCobalt, rim);
  color = mix(color, uBg, 0.14 * (1.0 - depth));
  outColor = vec4(color, 1.0);
}
`;

let canvasEl;
let grainPg;
let hudPg;
let packingShader;
let packingMesh;
let loopProgress = 0;
let phase = 0;
let muxer = null;
let encoder = null;
let isRecording = false;
let isFinalizing = false;
let recFrameCount = 0;
// p5's projection flips winding: gl_FrontFacing is false for outward faces (checked in a headless probe).
let frontSign = -1;

const DEFAULT_LAYERS = { section: true, network: true, guides: true, reveal: false, notes: true, math: true };

const sim = {
  paused: false,
  playhead: 0,
  dragYaw: 0,
  dragTilt: 0,
  layers: { ...DEFAULT_LAYERS },
  frameCost: 0,
};

function setup() {
  createCanvas(W, H, WEBGL);
  // Multisampling for the guide strokes; size and density are untouched.
  setAttributes("antialias", true);
  canvasEl = drawingContext.canvas;
  pixelDensity(1);
  frameRate(FPS);
  colorMode(RGB, 255, 255, 255, 255);
  strokeCap(ROUND);
  grainPg = createGraphics(W, H);
  hudPg = createGraphics(W, H);
  for (const graphics of [grainPg, hudPg]) graphics.pixelDensity(1);
  bakeGrain();
  packing = generatePacking();
  verifyPacking(packing);
  logPacking(packing);
  packingMesh = buildPackingMesh();
  applyUrlParams();
  packingShader = createShader(PACKING_VERTEX, PACKING_FRAGMENT);
  fitStage();
  bindUI();
  updateStaticUI();
  syncControls();
  if (auditParam !== null) window.soddyAudit = runAudit();
  window.soddy = {
    PARAMS, frameState, fit, packing, sim, computeFrameState, posePoint, projectToScreen, poseMatrix,
    cameraInModel, setLoop, runAudit, setFrontSign: (value) => { frontSign = value; },
  };
}

// ================================================================
// OVERLAYS — bounding-sphere wireframe, spin axis and the tangency network
// ================================================================

const overlays = { key: "", circles: [], axis: null, lines: [] };

function contactPoint(a, b) {
  if (a.internal || b.internal) {
    const inner = a.internal ? b : a;
    return normalize3(inner.c);
  }
  const d = normalize3([b.c[0] - a.c[0], b.c[1] - a.c[1], b.c[2] - a.c[2]]);
  return [a.c[0] + a.r * d[0], a.c[1] + a.r * d[1], a.c[2] + a.r * d[2]];
}

// Great circle of the unit sphere in the plane with normal m.
function greatCircle(m, segments) {
  const n = normalize3(m);
  const helper = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = normalize3(cross(n, helper)), v = cross(n, u);
  const points = [];
  for (let i = 0; i < segments; i++) {
    const a = TAU * i / segments, c = Math.cos(a), s = Math.sin(a);
    points.push([c * u[0] + s * v[0], c * u[1] + s * v[1], c * u[2] + s * v[2]]);
  }
  return points;
}

// Vertices in model space (alignment applied, fitted pixel scale); the pose is applied by p5 transforms.
function toModel(q, out = [0, 0, 0]) {
  const A = alignment(), s = fit.scale;
  out[0] = dot(A[0], q) * s; out[1] = dot(A[1], q) * s; out[2] = dot(A[2], q) * s;
  return out;
}

function rebuildOverlays() {
  const key = [presetIndex, fit.scale].join();
  if (key === overlays.key) return;
  const axis = normalize3(preset().axis);
  const planes = [axis, ...MIRROR_NORMALS.filter((m) => Math.abs(dot(m, axis)) < 1e-9)];
  overlays.circles = planes.map((m) => greatCircle(m, 120).map((q) => toModel(q)));
  const [top, bottom] = axisEnds();
  overlays.axis = [...toModel(top), ...toModel(bottom)];
  const { spheres, pairs } = packing;
  overlays.lines = [];
  for (const [i, j] of pairs) {
    const a = spheres[i], b = spheres[j];
    const gen = Math.max(a.gen, b.gen);
    if (gen > NETWORK.lineGen) continue;
    const from = a.internal ? contactPoint(a, b) : a.c;
    const to = b.internal ? contactPoint(a, b) : b.c;
    overlays.lines.push({ gen, v: [...toModel(from), ...toModel(to)] });
  }
  overlays.key = key;
}

const contacts = { points: null };

function contactList() {
  if (contacts.points) return contacts.points;
  const { spheres, pairs } = packing;
  contacts.points = pairs
    .map(([i, j]) => ({ p: contactPoint(spheres[i], spheres[j]), gen: Math.max(spheres[i].gen, spheres[j].gen), a: spheres[i], b: spheres[j] }))
    .filter(({ gen }) => gen <= NETWORK.dotGen);
  return contacts.points;
}

// A sphere is fully grown once reveal ≥ gen + 1; contacts and lines show only between grown spheres.
function grown(gen) {
  return frameState.reveal >= gen + 1 - 1e-6;
}

// Hidden-line drawing: a faint pass without the depth test, then the visible pass against the spheres.
function drawWireframe() {
  push();
  noFill();
  const gl = drawingContext;
  for (const visible of [false, true]) {
    if (visible) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
    stroke(INK.r, INK.g, INK.b, visible ? 150 : 40);
    strokeWeight(1.2);
    line(...overlays.axis);
    if (sim.layers.guides) {
      stroke(MUTED.r, MUTED.g, MUTED.b, visible ? 230 : 70);
      strokeWeight(visible ? 1 : 0.8);
      for (const circle of overlays.circles) {
        beginShape();
        for (const q of circle) vertex(q[0], q[1], q[2]);
        endShape(CLOSE);
      }
    }
    if (sim.layers.network) {
      stroke(COBALT.r, COBALT.g, COBALT.b, visible ? 170 : 34);
      strokeWeight(visible ? 1.1 : 0.8);
      beginShape(LINES);
      for (const { gen, v } of overlays.lines) {
        if (!grown(gen)) continue;
        vertex(v[0], v[1], v[2]);
        vertex(v[3], v[4], v[5]);
      }
      endShape();
    }
  }
  gl.enable(gl.DEPTH_TEST);
  pop();
}

// Contact points, lifted a few pixels toward the camera so they win the depth test against both spheres.
const dotScratch = [0, 0, 0];

function drawContacts() {
  if (!sim.layers.network) return;
  const camera3 = cameraInModel(poseMatrix()), lift = NETWORK.dotLift / fit.scale;
  const n = normalize3(STAGE.cutNormal), posed = [0, 0, 0];
  // A sphere the plane touches shows its back face as a cap, so its contacts would sit on the cap: hide them.
  const touched = (q) => !q.internal && dot(posePoint(q.c, posed), n) > frameState.cut - q.r;
  const hidden = (a, b) => sim.layers.section && (touched(a) || touched(b));
  push();
  stroke(COBALT.r, COBALT.g, COBALT.b, 235);
  for (const big of [false, true]) {
    strokeWeight(big ? NETWORK.bigDot : NETWORK.smallDot);
    beginShape(POINTS);
    for (const { p, gen, a, b } of contactList()) {
      if ((gen <= NETWORK.bigDotGen) !== big || !grown(gen) || hidden(a, b)) continue;
      const d = normalize3([camera3[0] - p[0], camera3[1] - p[1], camera3[2] - p[2]]);
      toModel([p[0] + d[0] * lift, p[1] + d[1] * lift, p[2] + d[2] * lift], dotScratch);
      vertex(dotScratch[0], dotScratch[1], dotScratch[2]);
    }
    endShape();
  }
  pop();
}

// Silhouette of the bound |p| = 1: a sphere at distance D projects to a circle of radius D·Rs / √(D² − Rs²).
function drawBoundSilhouette(graphics) {
  if (!sim.layers.guides) return;
  const distance = cameraDistance(), rs = fit.scale;
  const radius = distance * rs / Math.sqrt(distance * distance - rs * rs);
  graphics.noFill();
  graphics.stroke(INK.r, INK.g, INK.b, 110);
  graphics.strokeWeight(1);
  graphics.circle(W / 2 + fit.tx, H / 2 + fit.ty, 2 * radius);
}

// ================================================================
// ANIMATION — pose, section sweep and reveal per frame
// ================================================================

function colorVector(colorValue) {
  return [colorValue.r / 255, colorValue.g / 255, colorValue.b / 255];
}

function applyAlignment() {
  const [e1, e2, a] = alignment();
  // Column-major 4×4 of p ↦ (e1·p, e2·p, a·p).
  applyMatrix(e1[0], e2[0], a[0], 0, e1[1], e2[1], a[1], 0, e1[2], e2[2], a[2], 0, 0, 0, 0, 1);
}

function renderFrame() {
  background(BG.r, BG.g, BG.b);
  computeFrameState(loopProgress);
  const free = !isRecording && !Number.isFinite(previewProgress);
  if (free) {
    frameState.yaw += sim.dragYaw;
    frameState.tilt += sim.dragTilt;
  }
  const distance = cameraDistance(), near = distance * 0.5, far = distance * 2;
  perspective(STAGE.fov, W / H, near, far);
  camera(0, 0, distance, 0, 0, 0, 0, 1, 0);

  push();
  translate(fit.tx, fit.ty, 0);
  rotateY(frameState.yaw);
  // Z (the symmetry axis) points up the screen, tipped toward the viewer by the elevation.
  rotateX(HALF_PI - frameState.tilt);
  rotateZ(frameState.spin);

  push();
  applyAlignment();
  scale(fit.scale);
  noStroke();
  shader(packingShader);
  packingShader.setUniform("uReveal", frameState.reveal);
  packingShader.setUniform("uCentre", [fit.tx, fit.ty, -distance]);
  packingShader.setUniform("uCutNormal", normalize3(STAGE.cutNormal));
  packingShader.setUniform("uCut", frameState.cut * fit.scale);
  packingShader.setUniform("uCutOn", sim.layers.section ? 1 : 0);
  packingShader.setUniform("uScale", fit.scale);
  packingShader.setUniform("uFrontSign", frontSign);
  packingShader.setUniform("uBg", colorVector(BG));
  packingShader.setUniform("uInk", colorVector(INK));
  packingShader.setUniform("uCharcoal", colorVector(CHARCOAL));
  packingShader.setUniform("uMuted", colorVector(MUTED));
  packingShader.setUniform("uCobalt", colorVector(COBALT));
  packingShader.setUniform("uKey", [-0.5 + frameState.light, -0.75, 0.62]);
  packingShader.setUniform("uLight", PARAMS.light);
  model(packingMesh);
  resetShader();
  pop();

  rebuildOverlays();
  drawWireframe();
  drawContacts();
  pop();
}

// ================================================================
// LAYOUT / TEXT — Neo-Swiss editorial layer (existing fonts and size scale: 72 / 34 / 26 / 23 / 22)
// ================================================================

function pad2(value) {
  return String(value).padStart(2, "0");
}

function spinLabel() {
  const turns = PARAMS.spinTurns, n = preset().order;
  if (turns === 0) return "0";
  const sign = turns < 0 ? "−" : "";
  const coefficient = Math.abs(turns) === 1 ? "" : `${Math.abs(turns)}·`;
  return `${sign}${coefficient}2πt / ${n}`;
}

function signed(value, digits = 2) {
  return `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(digits)}`;
}

function innerCount() {
  return packing.spheres.length - 1;
}

function generationLabel() {
  if (!sim.layers.reveal) return `GENERATIONS / 0–${packing.maxGen}`;
  const shown = clamp(Math.floor(frameState.reveal + 1e-6) - 1, 0, packing.maxGen);
  return `GENERATION ≤ ${pad2(shown)} / ${packing.maxGen}`;
}

function hudText() {
  return {
    header: "MATHEMATICAL STUDIES / 003",
    headerRight: `SODDY–GOSSET / 0${pad2(presetIndex + 1)}`,
    title: ["SODDY–GOSSET", "THEOREM"],
    subtitle: "3D APOLLONIAN SPHERE PACKING",
    column: [
      ["SYMMETRY / TETRAHEDRAL Td", INK],
      [`SPHERES / ${innerCount()} · r ≥ ${PACK.rMin.toFixed(3)}`, CHARCOAL],
      [generationLabel(), CHARCOAL],
    ],
    relation: "5 MUTUALLY TANGENT SPHERES, i = 1…5",
    formula: "(Σ kᵢ)² = 3 Σ kᵢ²",
    reflection: "k' = k₁+k₂+k₃+k₄ − k₅ · k_out = −1 < 0",
    legend: [
      [INK, `SPHERES / GEN 0 → ${packing.maxGen}`, "INK FADES BY GENERATION"],
      [COBALT, "SECTION d(t) / CONTACTS", `${packing.pairs.length} TANGENCIES`],
    ],
    citation: `r₀ = 1/(1+√1.5) = ${PACK.seedR.toFixed(5)} · |Δ| < ${packing.verify.maxDescartes.toExponential(0)}`,
    citationRight: `${MAX_DURATION} S / ${LOOP_FRAMES} F`,
    axis: `${preset().label} AXIS`,
  };
}

function setType(graphics, font, style, size) {
  graphics.textFont(font);
  graphics.textStyle(style);
  graphics.textSize(size);
}

function fillColor(graphics, colorValue, alpha) {
  graphics.fill(colorValue.r, colorValue.g, colorValue.b, alpha);
}

function drawScreenFinish() {
  const graphics = hudPg;
  const text = hudText();
  graphics.clear();
  graphics.image(grainPg, 0, 0);
  drawCornerGuides(graphics);
  drawBoundSilhouette(graphics);
  graphics.noStroke();

  // Header row + top rule.
  setType(graphics, "monospace", NORMAL, 22);
  graphics.textAlign(LEFT, TOP);
  fillColor(graphics, INK, 235);
  graphics.text(text.header, GRID.left, HUD.headerY);
  graphics.textAlign(RIGHT, TOP);
  graphics.text(text.headerRight, GRID.right, HUD.headerY);
  hairline(graphics, GRID.left, HUD.ruleTopY, GRID.right, HUD.ruleTopY, INK, 200, 1);

  // Title block, flush left on column 0, subtitle below it.
  setType(graphics, "Georgia", BOLD, 72);
  graphics.textAlign(LEFT, TOP);
  fillColor(graphics, INK, 250);
  text.title.forEach((line, i) => graphics.text(line, GRID.left - 4, HUD.titleY + i * HUD.titleLead));
  setType(graphics, "monospace", NORMAL, 26);
  fillColor(graphics, INK, 235);
  graphics.text(text.subtitle, GRID.left, HUD.subtitleY);

  // Technical column, flush left on column 7, beside the second title line.
  if (sim.layers.notes) {
    setType(graphics, "monospace", NORMAL, 22);
    text.column.forEach(([line, colorValue], i) => {
      fillColor(graphics, colorValue, 235);
      graphics.text(line, gridX(7), HUD.columnY + i * HUD.columnLead);
    });
  }

  // Loop track.
  const progress = clamp(Math.round(loopProgress * LOOP_FRAMES) / (LOOP_FRAMES - 1), 0, 1);
  const indicatorX = GRID.left + (GRID.right - GRID.left) * progress;
  hairline(graphics, GRID.left, HUD.trackY, GRID.right, HUD.trackY, MUTED, 255, 1);
  hairline(graphics, GRID.left, HUD.trackY, indicatorX, HUD.trackY, INK, 230, 2);
  graphics.noStroke();
  fillColor(graphics, COBALT, 255);
  graphics.rect(indicatorX - 1, HUD.trackY - 7, 2, 14);
  setType(graphics, "monospace", NORMAL, 22);
  graphics.textAlign(LEFT, TOP);
  fillColor(graphics, CHARCOAL, 220);
  graphics.text(`t = ${progress.toFixed(3)}`, GRID.left, HUD.readoutY);
  graphics.textAlign(RIGHT, TOP);
  graphics.text(`θ(t) = ${spinLabel()}`, GRID.right, HUD.readoutY);

  drawSectionRuler(graphics);
  drawAxisLabel(graphics, text.axis);
  drawRegistrationMark(graphics, GRID.right - 14, STAGE.top);
  drawRegistrationMark(graphics, gridX(0) + 14, HUD.ruleBottomY - 40);

  // Lower band: relation (columns 0–6) + legend (columns 7–11).
  hairline(graphics, GRID.left, HUD.ruleBottomY, GRID.right, HUD.ruleBottomY, INK, 200, 1);
  graphics.noStroke();
  graphics.textAlign(LEFT, TOP);
  setType(graphics, "monospace", NORMAL, 22);
  fillColor(graphics, CHARCOAL, 230);
  graphics.text(text.relation, GRID.left, HUD.formulaY);
  setType(graphics, "monospace", NORMAL, 34);
  fillColor(graphics, COBALT, 255);
  graphics.text(text.formula, GRID.left, HUD.formulaY + 32);
  setType(graphics, "monospace", NORMAL, 23);
  fillColor(graphics, INK, 235);
  graphics.text(text.reflection, GRID.left, HUD.formulaY + 78);

  if (sim.layers.notes) {
    text.legend.forEach(([colorValue, label, detail], i) => {
      const y = HUD.formulaY + i * 52;
      hairline(graphics, gridX(7), y + 11, gridX(7) + 30, y + 11, colorValue, 255, colorValue === COBALT ? 2.4 : 2);
      graphics.noStroke();
      setType(graphics, "monospace", NORMAL, 22);
      fillColor(graphics, INK, 235);
      graphics.text(label, gridX(7) + 42, y);
      fillColor(graphics, CHARCOAL, 200);
      graphics.text(detail, gridX(7) + 42, y + 24);
    });
  }

  setType(graphics, "monospace", NORMAL, 22);
  fillColor(graphics, CHARCOAL, 200);
  graphics.textAlign(LEFT, TOP);
  graphics.text(text.citation, GRID.left, HUD.citationY);
  graphics.textAlign(RIGHT, TOP);
  graphics.text(text.citationRight, GRID.right, HUD.citationY);
  compositeHUD(graphics);
}

function hairline(graphics, x0, y0, x1, y1, colorValue, alpha, weight) {
  graphics.stroke(colorValue.r, colorValue.g, colorValue.b, alpha);
  graphics.strokeWeight(weight);
  graphics.line(x0, y0, x1, y1);
}

// Section ruler: d ∈ [−1, 1] in steps of 1/4, long tick at the centre, cobalt marker at the live cut d(t).
function drawSectionRuler(graphics) {
  const toY = (d) => RULER.bottom - (RULER.bottom - RULER.top) * (d + 1) / 2;
  hairline(graphics, RULER.x, RULER.top, RULER.x, RULER.bottom, INK, 200, 1);
  for (let k = -4; k <= 4; k++) {
    hairline(graphics, RULER.x - RULER.tick, toY(k / 4), RULER.x, toY(k / 4), INK, 200, 1);
  }
  hairline(graphics, RULER.x - 2 * RULER.tick, toY(0), RULER.x, toY(0), INK, 230, 1.4);
  graphics.noFill();
  graphics.stroke(COBALT.r, COBALT.g, COBALT.b, 235);
  graphics.strokeWeight(1.4);
  graphics.circle(RULER.x - 2 * RULER.tick - 8, toY(0), 7);
  graphics.noStroke();
  setType(graphics, "monospace", NORMAL, 22);
  fillColor(graphics, CHARCOAL, 220);
  graphics.textAlign(LEFT, BOTTOM);
  graphics.text("d", GRID.left, RULER.top - 12);
  graphics.textAlign(LEFT, TOP);
  graphics.text("−1", GRID.left, RULER.bottom + 12);
  const alpha = sim.layers.section ? 255 : 90;
  const y = toY(clamp(frameState.cut, -1, 1));
  hairline(graphics, RULER.x - 18, y, RULER.x + 18, y, COBALT, alpha, 2.4);
  graphics.noStroke();
  fillColor(graphics, COBALT, alpha);
  graphics.textAlign(LEFT, CENTER);
  graphics.text(signed(frameState.cut), RULER.x + 24, y - 1);
}

// Label at the top of the symmetry axis, projected with the live pose.
const axisScratch = [[0, 0, 0], [0, 0, 0]];
const AXIS_LABEL = { dx: 8, dy: -2, height: 24 };

function axisLabelAnchor() {
  return projectToScreen(posePoint(axisEnds()[0], axisScratch[0]), axisScratch[1]);
}

function drawAxisLabel(graphics, label) {
  if (!sim.layers.notes) return;
  const screen = axisLabelAnchor();
  graphics.noStroke();
  setType(graphics, "monospace", NORMAL, 22);
  fillColor(graphics, INK, 230);
  graphics.textAlign(LEFT, BOTTOM);
  graphics.text(label, screen[0] + AXIS_LABEL.dx, screen[1] + AXIS_LABEL.dy);
}

function drawRegistrationMark(graphics, x, y) {
  graphics.noFill();
  graphics.stroke(INK.r, INK.g, INK.b, 170);
  graphics.strokeWeight(0.8);
  graphics.circle(x, y, 14);
  graphics.line(x - 13, y, x + 13, y);
  graphics.line(x, y - 13, x, y + 13);
}

// ================================================================
// AUDIT — ?audit=1: packing verification, Td loop closure, framing, typography fit and the loop seam
// (report stored on window.soddyAudit)
// ================================================================

function rotateAbout(axis, angle, p) {
  const c = Math.cos(angle), s = Math.sin(angle), k = dot(axis, p), x = cross(axis, p);
  return [0, 1, 2].map((i) => p[i] * c + x[i] * s + axis[i] * k * (1 - c));
}

// The loop's net spin maps every sphere onto a sphere of the same curvature.
function auditSymmetry() {
  const axis = normalize3(preset().axis), angle = TAU / preset().order * PARAMS.spinTurns;
  const inner = packing.spheres.filter((q) => !q.internal);
  let maxError = 0;
  for (const q of inner) {
    const p = rotateAbout(axis, angle, q.c);
    let best = Infinity;
    for (const o of inner) {
      if (Math.abs(o.k - q.k) > 1e-6) continue;
      best = Math.min(best, Math.hypot(o.c[0] - p[0], o.c[1] - p[1], o.c[2] - p[2]));
    }
    maxError = Math.max(maxError, best);
  }
  return { angleDeg: angle * 180 / Math.PI, maxError, ok: maxError < 1e-9 };
}

function auditTypography() {
  const g = hudPg, text = hudText();
  const width = (font, style, size, value) => { setType(g, font, style, size); return g.textWidth(value); };
  const title = text.title.map((line) => width("Georgia", BOLD, 72, line));
  const column = Math.max(...text.column.map(([line]) => width("monospace", NORMAL, 22, line)));
  const legend = Math.max(...text.legend.flatMap(([, a, b]) => [a, b]).map((line) => width("monospace", NORMAL, 22, line)));
  const lower = Math.max(
    width("monospace", NORMAL, 22, text.relation),
    width("monospace", NORMAL, 34, text.formula),
    width("monospace", NORMAL, 23, text.reflection),
  );
  const report = {
    titleLine1Right: GRID.left - 4 + title[0],
    titleLine1Bottom: HUD.titleY + 72,
    titleLine2Right: GRID.left - 4 + title[1],
    subtitleRight: GRID.left + width("monospace", NORMAL, 26, text.subtitle),
    columnLeft: gridX(7),
    columnTop: HUD.columnY,
    columnRight: gridX(7) + column,
    columnBottom: HUD.columnY + (text.column.length - 1) * HUD.columnLead + 22,
    legendRight: gridX(7) + 42 + legend,
    lowerLeftRight: GRID.left + lower,
    citationRight: GRID.left + width("monospace", NORMAL, 22, text.citation),
    citationRightLeft: GRID.right - width("monospace", NORMAL, 22, text.citationRight),
    axisLabelWidth: width("monospace", NORMAL, 22, text.axis),
  };
  report.ok = report.titleLine1Bottom < report.columnTop &&
    report.titleLine2Right < report.columnLeft - 24 &&
    report.subtitleRight < report.columnLeft - 16 &&
    report.columnBottom < HUD.trackY - 12 && HUD.subtitleY + 26 < HUD.trackY - 12 &&
    report.columnRight <= GRID.right && report.legendRight <= GRID.right &&
    report.lowerLeftRight < report.columnLeft - 16 &&
    report.citationRight < report.citationRightLeft - 24;
  return report;
}

function runAudit() {
  const t0 = performance.now();
  const report = { packing: packing.verify, symmetry: auditSymmetry(), typography: auditTypography(), framing: null, loop: null };
  const framing = { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity, labelTop: Infinity, labelRight: -Infinity };
  const posed = [0, 0, 0], screen = [0, 0];
  let previous = null, first = null, maxInteriorStep = 0;
  // Symmetry-reduced pose: the image depends on the spin only modulo 2π/n.
  const n = preset().order;
  const snapshot = () => [
    Math.cos(n * frameState.spin), Math.sin(n * frameState.spin), frameState.tilt, frameState.yaw,
    frameState.cut, frameState.reveal / revealMax(), frameState.light,
  ];
  const step = (p, q) => Math.max(...p.map((value, i) => Math.abs(value - q[i])));
  for (let frame = 0; frame <= LOOP_FRAMES; frame++) {
    computeFrameState(frame / LOOP_FRAMES);
    const current = snapshot();
    if (frame === LOOP_FRAMES) { report.loopClosure = step(current, first); break; }
    if (previous) maxInteriorStep = Math.max(maxInteriorStep, step(current, previous));
    else first = current;
    previous = current;
    if (frame % 6 !== 0) continue;
    forEachExtremePoint((point) => {
      projectToScreen(posePoint(point, posed), screen);
      framing.top = Math.min(framing.top, Math.round(screen[1]));
      framing.bottom = Math.max(framing.bottom, Math.round(screen[1]));
      framing.left = Math.min(framing.left, Math.round(screen[0]));
      framing.right = Math.max(framing.right, Math.round(screen[0]));
    });
    const anchor = axisLabelAnchor();
    framing.labelTop = Math.min(framing.labelTop, Math.round(anchor[1] + AXIS_LABEL.dy - AXIS_LABEL.height));
    framing.labelRight = Math.max(framing.labelRight, Math.round(anchor[0] + AXIS_LABEL.dx + report.typography.axisLabelWidth));
  }
  framing.clearsTop = framing.top > HUD.readoutY + 40 && framing.labelTop > HUD.readoutY + 32;
  framing.clearsBottom = framing.bottom < HUD.ruleBottomY - 12;
  framing.clearsRuler = framing.left > RULER.x + 24;
  framing.clearsRight = framing.right <= GRID.right + 4 && framing.labelRight <= GRID.right;
  report.framing = framing;
  report.loop = {
    frames: LOOP_FRAMES,
    seconds: LOOP_FRAMES / FPS,
    seamStep: step(first, previous),
    maxInteriorStep,
    auditMs: performance.now() - t0,
  };
  report.ok = report.packing.ok && report.symmetry.ok && report.typography.ok &&
    framing.clearsTop && framing.clearsBottom && framing.clearsRuler && framing.clearsRight &&
    report.loopClosure < 1e-9 && report.loop.seamStep <= report.loop.maxInteriorStep * 1.01;
  computeFrameState(loopProgress);
  console.log("[soddy audit]", JSON.stringify(report, null, 2));
  return report;
}

// ================================================================
// UI + LOOP CLOCK
// ================================================================

function urlParam(name) {
  return typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get(name)
    : null;
}

const previewParam = urlParam("preview");
const previewProgress = previewParam === null ? NaN : Number(previewParam);
const auditParam = urlParam("audit");

// ?preset=2&cut=0.1&swing=0.4&reveal=1&net=0 — handy for stills and headless probes.
function applyUrlParams() {
  const index = Number(urlParam("preset")) - 1;
  if (urlParam("preset") !== null && PRESETS[index]) presetIndex = index;
  const numeric = (name, key) => {
    const value = Number(urlParam(name));
    if (urlParam(name) !== null && Number.isFinite(value)) PARAMS[key] = value;
  };
  numeric("cut", "cutCentre");
  numeric("swing", "cutSwing");
  numeric("dist", "distance");
  numeric("tilt", "tilt");
  numeric("spin", "spinTurns");
  numeric("light", "light");
  const layer = (name, key) => {
    if (urlParam(name) !== null) sim.layers[key] = urlParam(name) !== "0";
  };
  layer("section", "section");
  layer("net", "network");
  layer("guides", "guides");
  layer("reveal", "reveal");
  layer("notes", "notes");
  sanitizeParams();
  for (const [id, key] of Object.entries(TOGGLES)) {
    const element = getElement(id);
    if (element) element.checked = sim.layers[key];
  }
}

function sanitizeParams() {
  PARAMS.cutCentre = clamp(PARAMS.cutCentre, -0.6, 0.6);
  PARAMS.cutSwing = clamp(PARAMS.cutSwing, 0, 0.6);
  PARAMS.distance = clamp(PARAMS.distance, 1, 1.4);
  PARAMS.tilt = clamp(PARAMS.tilt, 0.1, 0.8);
  PARAMS.spinTurns = clamp(Math.round(PARAMS.spinTurns), -2, 2);
  PARAMS.light = clamp(PARAMS.light, 0.4, 1.6);
}

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

function setLoop(progress) {
  loopProgress = progress;
  phase = loopProgress * TAU;
}

const SLIDERS = {
  cutCentreSlider: ["cutCentre", (v) => `d₀ = ${signed(v)}`],
  cutSwingSlider: ["cutSwing", (v) => `± ${v.toFixed(2)}`],
  distanceSlider: ["distance", (v) => `${v.toFixed(2)} ×`],
  tiltSlider: ["tilt", (v) => `${(v * 180 / Math.PI).toFixed(0)}°`],
  spinSlider: ["spinTurns", (v) => `${v.toFixed(0)} × 2π/${preset().order}`],
  lightSlider: ["light", (v) => v.toFixed(2)],
};

function applyParams() {
  sanitizeParams();
  fitStage();
  syncControls();
}

function bindUI() {
  const startButton = getElement("startBtn");
  const stopButton = getElement("stopBtn");
  if (startButton) startButton.onclick = startRecording;
  if (stopButton) stopButton.onclick = stopRecording;

  for (const [id, [key]] of Object.entries(SLIDERS)) {
    const element = getElement(id);
    if (!element) continue;
    element.oninput = () => {
      PARAMS[key] = Number(element.value);
      applyParams();
    };
  }
  const onClick = (id, handler) => {
    const element = getElement(id);
    if (element) element.onclick = handler;
  };
  PRESETS.forEach((item, index) => onClick(`preset-${item.key}`, () => selectPreset(index)));
  onClick("pauseBtn", togglePause);
  onClick("resetBtn", resetSimulator);
  for (const [id, layer] of Object.entries(TOGGLES)) {
    const element = getElement(id);
    if (element) element.onchange = () => {
      sim.layers[layer] = element.checked;
      syncControls();
    };
  }
}

const TOGGLES = {
  showSection: "section", showNetwork: "network", showGuides: "guides",
  showReveal: "reveal", showNotes: "notes", showMath: "math",
};
const DEFAULT_PARAMS = { ...PARAMS };
const DEFAULT_PRESET = presetIndex;

function selectPreset(index) {
  if (isRecording) return;
  presetIndex = index;
  applyParams();
}

function togglePause() {
  if (isRecording) return;
  sim.paused = !sim.paused;
  syncControls();
}

function resetSimulator() {
  if (isRecording) return;
  Object.assign(PARAMS, DEFAULT_PARAMS);
  presetIndex = DEFAULT_PRESET;
  Object.assign(sim, { paused: false, playhead: 0, dragYaw: 0, dragTilt: 0 });
  Object.assign(sim.layers, DEFAULT_LAYERS);
  for (const [id, key] of Object.entries(TOGGLES)) {
    const element = getElement(id);
    if (element) element.checked = sim.layers[key];
  }
  applyParams();
}

const CONTROL_IDS = [
  ...Object.keys(SLIDERS),
  ...PRESETS.map((item) => `preset-${item.key}`),
  "pauseBtn", "resetBtn", ...Object.keys(TOGGLES),
];

function syncControls() {
  for (const [id, [key, format]] of Object.entries(SLIDERS)) {
    const element = getElement(id);
    if (element) element.value = PARAMS[key];
    setText(id.replace("Slider", "Value"), format(PARAMS[key]));
  }
  PRESETS.forEach((item, index) => {
    const element = getElement(`preset-${item.key}`);
    if (element) element.style.borderColor = index === presetIndex ? "rgba(255,255,255,0.6)" : "";
  });
  setText("pauseBtn", sim.paused ? "Play" : "Pause");
  const math = getElement("math");
  if (math) math.hidden = !sim.layers.math;
  for (const id of CONTROL_IDS) setDisabled(id, isRecording);
}

function updateLiveUI() {
  if (frameCount % 6 !== 0 || !sim.layers.math) return;
  const v = packing.verify;
  setText("countInfo", `${innerCount()} spheres · ${packing.pairs.length} tangencies · r ≥ ${PACK.rMin}`);
  setText("descartesValue", `max ${v.maxDescartes.toExponential(1)} · ${v.sets} sets`);
  setText("tangencyValue", `max ${v.maxTangency.toExponential(1)} · overlaps ${v.overlaps}`);
  setText("gensValue", packing.perGeneration.map((row) => row.spheres).join(" · "));
  setText("cutValue", sim.layers.section ? `d(t) = ${signed(frameState.cut, 3)}` : "off");
  setText("costValue", `${sim.frameCost.toFixed(1)} ms CPU · ${frameRate().toFixed(0)} fps`);
}

function updateStaticUI() {
  setText("maxDuration", MAX_DURATION);
  setText("canvasSize", `${W} × ${H}`);
  setText("maxFrames", MAX_FRAMES);
}

function updateLoopTime() {
  if (Number.isFinite(previewProgress) && !isRecording) {
    setLoop(clamp(previewProgress, 0, 0.999999));
  } else if (isRecording) {
    // frame / LOOP_FRAMES: the last recorded frame hands off seamlessly to
    // the first when the Reel loops (no duplicated frame).
    setLoop((recFrameCount % LOOP_FRAMES) / LOOP_FRAMES);
  } else {
    setLoop((sim.playhead % LOOP_FRAMES) / LOOP_FRAMES);
    if (!sim.paused) sim.playhead++;
  }
}

function draw() {
  const t0 = performance.now();
  updateLoopTime();
  renderFrame();
  drawScreenFinish();
  sim.frameCost = 0.9 * sim.frameCost + 0.1 * (performance.now() - t0);
  updateLiveUI();
  if (isRecording) {
    captureFrame();
    recFrameCount++;
    updateRecordingUI();
    if (recFrameCount >= MAX_FRAMES) stopRecording();
  }
}

// Debug orbit — ignored while recording or previewing a fixed frame.
function mouseDragged(event) {
  if (isRecording || !event || event.target !== canvasEl) return true;
  sim.dragYaw += movedX * 0.005;
  sim.dragTilt = clamp(sim.dragTilt + movedY * 0.004, -0.6, 0.9);
  return false;
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
    saveCanvas(`soddy_gosset_${getTimestamp()}`, "png");
    return false;
  }
  if (key === "p" || key === "P") {
    togglePause();
    return false;
  }
  const digit = Number(key);
  if (digit >= 1 && digit <= PRESETS.length) {
    selectPreset(digit - 1);
    return false;
  }
  return true;
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

// ================================================================
// SCREEN FINISH — paper grain, corner guides and HUD composite
// ================================================================

// Dark specks at very low alpha: print grain on off-white paper.
function bakeGrain() {
  grainPg.clear();
  grainPg.noStroke();
  randomSeed(20260904);
  const subtleCount = Math.floor(W * H * 0.0016);
  for (let i = 0; i < subtleCount; i++) {
    const value = random(40, 110);
    grainPg.fill(value, value, value, random(2, 6));
    grainPg.circle(random(W), random(H), random(0.15, 0.85));
  }
  const darkCount = Math.floor(W * H * 0.000035);
  for (let i = 0; i < darkCount; i++) {
    const value = random(10, 60);
    grainPg.fill(value, value, value, random(8, 20));
    grainPg.circle(random(W), random(H), random(0.4, 1.2));
  }
}

function drawCornerGuides(graphics) {
  graphics.noFill();
  graphics.stroke(INK.r, INK.g, INK.b, 110);
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

// ================================================================
// CAPTURE — retained mp4-muxer + WebCodecs pipeline
// ================================================================

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
  setLoop(0);
  isRecording = true;
  syncControls();
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
    anchor.download = `soddy_gosset_${getTimestamp()}.mp4`;
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
    syncControls();
  }
}

function captureFrame() {
  if (!encoder || encoder.state !== "configured") return;
  const timestamp = Math.round(recFrameCount * 1_000_000 / FPS);
  // mp4-muxer rejects chunks without a duration; same frame duration as the series' capture.js.
  const frame = new VideoFrame(canvasEl, { timestamp, duration: Math.round(1_000_000 / FPS) });
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
