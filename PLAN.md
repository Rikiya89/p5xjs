# PLAN: 20261029 — DESCARTES BLOOM

> Planned by: opus-5-5 at effort low on 2026-10-29
> Implement with: executed in the same session (user brief demanded full implementation). Check boxes as you go.

## 1. Goal
A new sketch `20261029/descartes.html` + `20261029/descartes.js`, sibling to the uncommitted Hopf sketch (untouched).
An Apollonian gasket built from Descartes' theorem reveals itself over an 8 s seamless loop:
Genesis (4 root circles) → Recursion → Bloom → Return. Recording via the folder's existing inline mp4-muxer recorder.

## 2. Constraints & decisions (final)
- Files: `20261029/descartes.html`, `20261029/descartes.js`. `index.html`, `sketch.js`, `cover.png` untouched.
- Canvas 1080×1920, `pixelDensity(1)`, 60 fps, P2D (circles need no WEBGL; the Hopf WEBGL finish pass is not ported).
- Loop: `MAX_DURATION = 8` → `LOOP_FRAMES = 480`. Time from `recFrameCount` while recording → deterministic export.
- Palette: BG `rgb(3,3,5)`, ink `rgb(255,255,255)`, additive (`blendMode(ADD)`), baked grain — same as sketch.js.
- Text overlay (T): ui-monospace bold 54 title at `SAFE_MARGIN_TOP+50`, normal 30 subtitle at `+106`, x = `(W−SAFE_MARGIN_RIGHT)/2`.
- Safe zone: top 250, bottom 440, right 140 → composition centre (470, 865); gasket radius 410 px (+2.5 % breath).
- Export: `descartes_bloom_<timestamp>.mp4` (avc1.640028, 18 Mbps). Fixes the copied `villarceau_` name.
- Cover (C) captures the bloom peak, not frame 0 (frame 0 is the sparse genesis state the brief asks for).

## 3. Math
Signed curvature k = 1/r, outer circle k < 0. Unit space: outer circle k = −1, centre 0.

Descartes: (k1+k2+k3+k4)² = 2(k1²+k2²+k3²+k4²)
⇒ k4 = k1+k2+k3 ± 2√(k1k2+k2k3+k3k1)
Complex Descartes (z = centre as complex number):
⇒ k4z4 = k1z1+k2z2+k3z3 ± 2√(k1k2z1z2 + k2k3z2z3 + k3k1z3z1)
The ± signs are not independently paired → evaluate all 4 combinations, keep those tangent to all three
(tangency: |zi − zj| = |1/ki + 1/kj| with signed radii; covers internal tangency to the outer circle).

Root (D3 symmetric): three equal circles inside the unit circle: r = 2√3 − 3 ≈ 0.464102, centres at distance
1 − r, angles −π/2 + 2πj/3. Check: k = 1 + 2/√3, roots of Descartes for (A,B,C): k(3 ± 2√3) = {13.9282, −1}.
The −1 root is the outer circle (validates the quadruple); the +root is the centre circle D (complex formula).

Recursion (Vieta jump, linear ⇒ no sign ambiguity, stable): if (c1,c2,c3,c4) is a Descartes quadruple,
the other circle tangent to c1,c2,c3 is k' = 2(k1+k2+k3) − k4, (kz)' = 2(k1z1+k2z2+k3z3) − k4z4.
Gap queue (i,j,l | old): new = reflect(old); push (i,j,new|l), (j,l,new|i), (i,l,new|j). Each circle is generated
exactly once (Apollonian group tree without backtracking). Stop if r·R_px < MIN_RADIUS_PX or depth > MAX_DEPTH.
k_child > max(k_parents) ⇒ reveal-by-size never shows a child before its parents.

Reveal level L = ln(1/r) / ln(R_px / MIN_RADIUS_PX) ∈ [0,1]; core family (descendants of gap A,B,C) leads by CORE_LEAD.
Frontier F(u) = F0 + (F1 − F0)·E(u), F0 = max root L + SOFT, F1 = 1 + SOFT.
E(u): 0 → smootherstep rise [riseStart, riseEnd] → 1 hold → smootherstep fall [fallStart, fallEnd] → 0 (C², periodic).
Per circle a = clamp((F − L)/SOFT) → alpha = s5(a), scale = EMERGE_FROM + (1−EMERGE_FROM)·s5(a).
Rotation θ(u) = ROT_TURNS·(2π/3)·(u − sin(2πu)/2π): gasket is D3-symmetric ⇒ θ(1) ≡ θ(0); θ'(0)=θ'(1)=0.
Breath scale 1 + BREATH·E(u).

## 4. Architecture
descartes.js: tunables → geometry (csqrt, solveDescartes, buildGasket) → buckets (Path2D cache per level bucket)
→ loop state (bloomEnvelope, frameState) → draw → checks (checkDescartes, checkLoopClosure) → grain/finish → recorder (verbatim).

## 5. Tasks
- [x] 1. Geometry + Node math check (tangency, Descartes residual, monotone k, containment, duplicates, count)
- [x] 2. Rendering (buckets, strokes, glow on large circles only), HTML copy with new titles
- [x] 3. Loop state + loop closure check (u=0 vs u=1, plus 120° symmetry mid-loop)
- [x] 4. Browser verification via headless CDP: exceptions, frames at u = 0 / .3 / peak / .82 / 1, timing, blowout
- [x] 5. Export check: 480 frames, 8.0 s (ffprobe)

### Round 2 (polish + text animation, 2026-10-29)
- [x] 6. Arc-sweep emergence (outline draws on from the side facing its host centre; radius fixed → tangency exact while emerging)
- [x] 7. NEST_TONE hierarchy [1, .62, .42], glow passes only on nest 0; 6 root kissing points (k_a z_a + k_b z_b)/(k_a + k_b) lit at Genesis
- [x] 8. World-space buckets across all gaskets (438 → 69 stroke groups)
- [x] 9. Per-frame HUD in the 20261026 layout, monochrome: tracked Georgia title, theorem, live Vieta relation, N / k_max readout, θ, loop track with phase ticks, letter-sweep captions per phase, citation
- [x] 10. Verify: lossless seam (text bands identical), export 480 f / 8.000 s, timings

### Round 3 (complex pattern from the formula, 2026-10-29)
- [x] 11. Dual lace: per gap (i,j,l|o) the dual circle k⊥ = (kᵢ+kⱼ+kₗ−kₒ)/2, (kz)⊥ likewise; drawn as its arcs inside the member circles (hyperbolic geodesics between kissing points). Check: orthogonality 6e-15, through kisses 5e-14, root dual r = 2−√3.
- [x] 12. LACE envelope rise .34–.50, fall .70–.86 (zero at seam); arcs spun from one kiss to the next; nest ≤ 1, chord ≥ 12 px → 3 204 arcs. Caption "THE DUAL LACE", live line switches to the k⊥ relation.

## 6. Verification
Console: `DESCARTES CHECK PASS`, `LOOP CHECK PASS`. Peak frame: saturated pixels are line cores only (worst 16 px cell ≤ 25 % blown, same as genesis), gasket bbox inside safe zone.

## 7. Out of scope
No GLSL, no new deps, no changes to Hopf files or shared libs.

## Deviations
- 2026-10-29: first render (single gasket, 563 circles) read as four empty discs, not "infinitely nested". Fix: every circle ≥ NEST_MIN_PX (40) hosts the same unit template as its own gasket (host = negative-curvature outer), NEST_LEVELS = 2, each nested gasket spins rigidly inside its host by NEST_SPIN = [−2, 2] × 120° per loop (tangency preserved: rigid rotation about the host centre; seam preserved: D3 symmetry). 40 gaskets, 2 933 circles.
- 2026-10-29: complex Descartes at the symmetric root has Σkᵢkⱼzᵢzⱼ = 0 → √ amplifies roundoff to ~1e-8; candidates selected at SOLVE_EPS = 1e-6 and the coinciding ± pair merged by mean.
