// Boy's surface — Bryant–Kusner immersion of RP² in R³, w = u + iv on the closed unit disk |w| ≤ 1.
//   D  = w⁶ + √5 w³ − 1
//   g₁ = −3/2 Im[w(1 − w⁴)/D],  g₂ = −3/2 Re[w(1 + w⁴)/D],  g₃ = Im[(1 + w⁶)/D] − 1/2
//   (x, y, z) = (g₁, g₂, g₃)/(g₁² + g₂² + g₃²)
// D has three zeros inside the disk (w³ = (3 − √5)/2): the planar ends of the minimal surface, which the
// inversion sends to the origin — that is the triple point. Multiplying every g by |D|² keeps the map
// polynomial there: x = G·|D|²/|G|², with G = g·|D|², finite everywhere and → 0 at the ends.
// X(w) = X(−1/w̄), so on |w| = 1 the point w is identified with −w; w → e^{2πi/3}w is a −120° turn about z.
(function (root) {
  const S5 = Math.sqrt(5);

  function boyPoint(u, v, out = [0, 0, 0]) {
    const w2r = u * u - v * v, w2i = 2 * u * v;
    const w3r = w2r * u - w2i * v, w3i = w2r * v + w2i * u;
    const w4r = w2r * w2r - w2i * w2i, w4i = 2 * w2r * w2i;
    const w5r = w4r * u - w4i * v, w5i = w4r * v + w4i * u;
    const w6r = w3r * w3r - w3i * w3i, w6i = 2 * w3r * w3i;
    const Dr = w6r + S5 * w3r - 1, Di = w6i + S5 * w3i, D2 = Dr * Dr + Di * Di;
    // a·D̄ for each numerator a = ar + i·ai
    const G1 = -1.5 * ((v - w5i) * Dr - (u - w5r) * Di);
    const G2 = -1.5 * ((u + w5r) * Dr + (v + w5i) * Di);
    const G3 = (w6i * Dr - (1 + w6r) * Di) - 0.5 * D2;
    const g = G1 * G1 + G2 * G2 + G3 * G3;
    if (!(g > 1e-300)) { out[0] = 0; out[1] = 0; out[2] = 0; return out; }
    const k = D2 / g;
    out[0] = G1 * k; out[1] = G2 * k; out[2] = G3 * k;
    return out;
  }

  // Local normal X_u × X_v (central differences in the complex plane). It is only locally meaningful:
  // RP² is non-orientable, so the two sides of the identified boundary disagree — shading is two-sided.
  function boyNormal(u, v, out = [0, 0, 0]) {
    const h = 1e-5, a = boyPoint(u + h, v), b = boyPoint(u - h, v), c = boyPoint(u, v + h), d = boyPoint(u, v - h);
    const xu = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], xv = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
    let nx = xu[1] * xv[2] - xu[2] * xv[1], ny = xu[2] * xv[0] - xu[0] * xv[2], nz = xu[0] * xv[1] - xu[1] * xv[0];
    const l = Math.hypot(nx, ny, nz);
    if (!(l > 1e-30)) { out[0] = 0; out[1] = 0; out[2] = 1; return out; }
    out[0] = nx / l; out[1] = ny / l; out[2] = nz / l;
    return out;
  }

  // Polar grid on the disk: rings j = 0..rings (r = j/rings), columns i = 0..cols (θ = 2πi/cols).
  // cols is a multiple of 6: even so boundary column i meets i + cols/2 (antipodal identification),
  // a multiple of 3 so the grid maps onto itself under the threefold symmetry.
  // Three kinds of duplicated vertex get EXACTLY copied positions, so the rendered mesh is watertight:
  //   centre ring (all = w = 0), seam column i = cols (= i = 0), boundary i ≥ cols/2 (= i − cols/2).
  // Normals are not copied across the antipodal weld — each side keeps its own local normal.
  function buildBoyMesh(rings, cols) {
    cols = Math.max(6, Math.round(cols / 6) * 6);
    rings = Math.max(4, Math.round(rings));
    const row = cols + 1, n = (rings + 1) * row;
    const pos = new Float64Array(n * 3), nor = new Float64Array(n * 3), uv = new Float64Array(n * 2);
    const weld = new Int32Array(n);
    const p = [0, 0, 0], q = [0, 0, 0];
    for (let j = 0; j <= rings; j++) {
      const r = j / rings;
      for (let i = 0; i <= cols; i++) {
        const k = j * row + i, t = (i / cols) * Math.PI * 2;
        const u = r * Math.cos(t), v = r * Math.sin(t);
        let src = k;
        if (j === 0) src = 0;
        else if (i === cols) src = j * row;
        if (j === rings && (i % cols) >= cols / 2) src = j * row + (i % cols) - cols / 2;
        weld[k] = src;
        if (src !== k) { pos.copyWithin(k * 3, src * 3, src * 3 + 3); }
        else { boyPoint(u, v, p); pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2]; }
        boyNormal(u, v, q);
        nor[k * 3] = q[0]; nor[k * 3 + 1] = q[1]; nor[k * 3 + 2] = q[2];
        uv[k * 2] = r; uv[k * 2 + 1] = i / cols;
      }
    }
    // Ring 0 is one point: its quads collapse to single triangles (the degenerate half is dropped).
    const faces = [];
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * row + i;
        if (j === 0) { faces.push([k, k + row, k + row + 1]); continue; }
        faces.push([k, k + row, k + row + 1], [k, k + row + 1, k + 1]);
      }
    }
    return { rings, cols, row, pos, nor, uv, weld, faces };
  }

  // Topology audit on the welded mesh: RP² has Euler characteristic 1, and every edge of a closed
  // surface is shared by exactly two triangles. Also reports non-finite vertices and degenerate faces.
  function auditBoyMesh(mesh) {
    const root = (k) => { while (mesh.weld[k] !== k) k = mesh.weld[k]; return k; };
    const verts = new Set(), edges = new Map(), n = mesh.weld.length;
    let degenerate = 0, nonFinite = 0, maxEdge = 0, minEdge = Infinity;
    for (let k = 0; k < mesh.pos.length; k++) if (!Number.isFinite(mesh.pos[k])) nonFinite++;
    for (const f of mesh.faces) {
      const r = f.map(root);
      if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) { degenerate++; continue; }
      r.forEach((x) => verts.add(x));
      for (let e = 0; e < 3; e++) {
        const a = r[e], b = r[(e + 1) % 3], key = a < b ? a * n + b : b * n + a;
        edges.set(key, (edges.get(key) || 0) + 1);
        const P = mesh.pos;
        const l = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
        maxEdge = Math.max(maxEdge, l); minEdge = Math.min(minEdge, l);
      }
    }
    let open = 0;
    for (const c of edges.values()) if (c !== 2) open++;
    const F = mesh.faces.length - degenerate;
    return { V: verts.size, E: edges.size, F, euler: verts.size - edges.size + F, open, degenerate, nonFinite, minEdge, maxEdge };
  }

  const api = { boyPoint, boyNormal, buildBoyMesh, auditBoyMesh };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis);
