# PLAN: 20261102 — DUPIN CYCLIDE

> Planned by: opus-5-5 at effort high on 2026-11-02
> Implement with: executed in the same session (user brief demanded full implementation + verification). Check boxes as you go.

## 1. Goal
`20261102/` (a byte-identical copy of the 20261019 Dini sketch) becomes a ring Dupin cyclide simulator for a seamless Reel.
The cyclide breathes between a near-torus and a strongly asymmetric ring; both families of lines of curvature (all circles)
are drawn as the wireframe, the K>0 / K<0 regions use CYAN / MAGENTA and the two parabolic circles (K=0) are ACID.
Done = renders in Chrome, `?audit=1` reports `ok: true`, loop seam ≤ interior step, preserved items diff-clean vs 20261019.

## 2. Constraints & decisions (final)
- Files: `20261102/sketch.js`, `20261102/index.html` only. Same architecture (PARAMS / STAGE / frameState / fitStage / shader mesh / HUD / audit / UI / recorder).
- Canvas 1080×1920, `pixelDensity(1)`, 60 fps, **10 s = 600 frames kept** (series convention; all phase terms integer-periodic so `MAX_DURATION = 8` is a one-line switch).
- Palette unchanged: BG (3,3,5) · INK white · CYAN (0,229,255) · MAGENTA (255,61,191) · ACID (182,255,61).
- Typography unchanged: Georgia bold 72 title "DUPIN CYCLIDE"; monospace 34 / 23 CYAN / 26 / 26 readout / 22 ACID / 28 captions / 22 citation; all HUD anchors unchanged.
- Recorder (inline mp4-muxer + WebCodecs, avc1.640028, 18 Mbps) unchanged except filename prefix `dini_surface_` → `dupin_cyclide_` (mp4 + S still).
- Ring condition enforced by `sanitizeParams`: `μ ≤ a − 0.05`, `cMid + swing ≤ μ − 0.05`.

## 3. Math (verified in Node, scratchpad `cyc.mjs`, `ksweep.mjs`)
a = 1, c ∈ [0, μ), b = √(a² − c²), D = a − c cos u cos v > 0
- x = [μ(c − a cos u cos v) + b² cos u] / D
- y = b sin u (a − μ cos v) / D
- z = b sin v (c cos u − μ) / D
- Implicit: (x² + y² + z² − μ² + b²)² = 4(ax − cμ)² + 4b²y²  (residual ≤ 1e-14)
- u = const and v = const curves are exact circles (err ≤ 1e-15); F = M = 0 → they are the lines of curvature.
- Tube (v-circle) radius ranges μ − c … μ + c. c = 0 → torus R = a, r = μ.
- K > 0 ⟺ cos v < 0; parabolic circles at v = π/2, 3π/2 (0 mismatches over μ∈[0.3,0.85], c∈[0,μ−0.05]).
- x-extent [−(a+c+μ), a−c+μ] → shift x by +c so the spin axis passes through the bounding centre; z odd in v → zCenter = 0.
- Normals: central differences (h = 2e-3) of the position in JS and GLSL, n = r_u × r_v.

Schedule (phase = p·2π): c(p) = cMid + swing·cos(phase) (hero = max asymmetry at p=0, near-torus at p=0.5);
spin = spinTurns·phase; tilt = tilt + 0.06 sin(phase); yaw = 0.08 sin(phase + 0.7);
travelling circles: u* = −2·phase (a meridian), v* = phase (a parallel).

| param | range | default |
|---|---|---|
| cMid | 0 … 0.5 | 0.24 |
| swing | 0 … 0.2 | 0.18 |
| μ | 0.3 … 0.85 | 0.6 |
| rows (cols = 2·rows) | 40 … 120 | 96 |
| wire (u-circles; v-circles = wire/2) | 6 … 48 | 24 |
| tilt | 0 … 1.4 | 0.8 |
| spinTurns | −2 … 2 | 1 |
| light | 0.3 … 1.8 | 1 |

## 4. Architecture
Replace Dini math/mesh/shaders/frame state/HUD strings/audit/presets/sliders; keep setup, loop clock, grain, corner guides, HUD composite, recorder.
Shader uniforms: uA uB uC uMu uScale uDistance uDepthSpan uPos(K>0) uNeg(K<0) uEdge uInk uLight uWireU uWireV uWireOn uEdgeOn uTrace(u*, v*).

## 5. Tasks
- [x] 1. Math + mesh + shaders + render (runnable slice)
- [x] 2. Frame state, fitStage, HUD text, captions, citation
- [x] 3. Audit (circles, implicit, K sign, mesh finiteness, framing, typography, seam)
- [x] 4. UI: sliders/presets/toggles in sketch.js + index.html
- [x] 5. Verification: CDP render probe, audit ok, seam crop, preservation diffs, viewports

## 6. Verification
Headless Chrome + CDP against `http://localhost:3003/20261102/`: no exceptions, frameCount advances, `?audit=1` ok,
toDataURL lit%/blowout%, geometry-crop seam diff (frame 599 vs 0 ≈ interior step), diff constants/text/recorder vs 20261019.

## 7. Out of scope
New dependencies, capture.js split, palette/typography/HUD layout changes, horn/spindle cyclides.

## Deviations
(none)
