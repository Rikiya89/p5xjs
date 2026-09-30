# PLAN: 20260930 — Doubly Ruled Surface

> Planned by: opus-5-5 at effort low/medium on 2026-09-30
> Implement with: Sonnet 5 at default effort. Follow tasks in order. Check boxes as you go.
> Working folder: `20260930/` (a verbatim copy of `20260923/`, Poncelet's Porism). Edit only `20260930/sketch.js` and `20260930/index.html`.

## 1. Goal

Replace the Poncelet artwork in `20260930/sketch.js` with a new 3D piece: **three nested hyperboloids of one sheet, each drawn only with straight lines**. Every hyperboloid is made of two families of straight rulings, stretched between two circles and twisted by an angle α. The straight lines cross in a diamond lattice, and together they form a curved hourglass silhouette. Over one 10 s loop, each shell's twist breathes (pinch → open → pinch), the three shells run a quarter-loop out of phase, neighbouring shells counter-rotate, and bright beads travel along the lines as three helical streams. Frame 0 already shows the strongest state: the outer shell is at its maximum pinch and the beads are visible.

The task is done when:
- the sketch runs at 60 fps preview;
- the numeric loop self-check prints `LOOP CHECK PASS`;
- the object sits clear of the HUD bands at the four checked phases;
- `R` records a 600-frame 1080×1920 MP4 that loops with no visible seam.

## 2. Constraints & decisions (final — do not revisit)

### Files touched
- `20260930/sketch.js`: the artwork section is rewritten. The infrastructure below is preserved.
- `20260930/index.html`: only the `<title>` and the `<strong>` label text change.

### Preserve VERBATIM (do not modify, reorder, or "clean up")
- **Constants:** `W = 1080`, `H = 1920`, `FPS = 60`, `MAX_DURATION = 10`, `MAX_FRAMES`, `LOOP_FRAMES`, `TAU`, `BG_R/G/B = 3,3,5`, `INK_R/G/B = 255,255,255`, `SAFE_X = 120`, `SAFE_TOP = 270`, `SAFE_BOTTOM = 1460`, and the iPhone safe-area comment.
- **Functions:** `startRecording`, `stopRecording`, `captureFrame`, `setStatus`, `getTimestamp`, `updateRecordingUI`, `bakeGrain`, the `window.*` exports at the bottom, and the `setup()` wiring (canvas, `pixelDensity(1)`, `frameRate(FPS)`, grain/HUD graphics, button hookup).
  - The ONLY allowed edits inside these functions are:
    - the download filename prefix `"poncelet_porism_"` → `"doubly_ruled_"`, in `stopRecording` and `keyReleased`;
    - in `startRecording`, the dead `echoWrite = 0;` line and its stale comment may be removed.
  - `startRecording` still calls `primeState()`, so keep a `primeState()` function. It may be a no-op with a comment.
- **Recording system:** this project records with **WebCodecs `VideoEncoder` + `mp4-muxer` 5.1.3** (loaded in `index.html`), at avc1.640028, 18 Mbps, a keyframe every 60 frames, and `recFrameCount`-driven time. The original prompt calls this "CaptureJS"; mp4-muxer is the system meant, and it must be preserved. **Do NOT add CaptureJS, CCapture, or any other dependency.**
- **HUD layout in `drawScreenFinish()`:** keep every coordinate, size, alpha, font, the corner brackets, the track line, the markers, and the grain composite. Change only the strings and the value that drives the track (see §4).
- **Timing:** `updateLoopTime()` keeps the `frame = isRecording ? recFrameCount : frameCount - 1` logic, so a recording always starts at φ = 0.

### Visual decisions
- **Resolution / FPS / duration:** 1080×1920, 60 fps, 600 frames = 10 s, which is exactly one loop.
- **Palette: strict monochrome, unchanged.**
  - Background: `#030305` (`BG_R/G/B`).
  - Ink: `#FFFFFF` (`INK_R/G/B`).
  - All tonal variation comes from alpha and additive blending, as in the Poncelet sketch.
  - **Forbidden:** the Bio-Synthetic colours (`#00FF9F`, `#00CFFF`, `#8B00FF`, `#FF006E`), any hue, gradients to colour, bloom colour tints.
- **Rendering:** WEBGL, camera-facing ribbon strips evaluated on the GPU, using the same technique as the old `orbitShader`. Two passes: core, then halo (`uHalo`). Additive blend with `depthMask(false)`.
- **Shell intersection is INTENDED.** When the outer shell pinches (throat ≈ 142) while the inner shell is open (throat ≈ 169), the inner shell pokes through the outer one. Additive light makes this read as a glowing interpenetration. **Do not resize shells to avoid it.**
- **Frame 0 is the thumbnail.** Nothing may fade in. No intro, no build-up.
- **Must NOT do:**
  - no generic particle cloud, no random jitter, no `random()`/`noise()` in the artwork;
  - no lighting model (`lights()`, `normalMaterial`);
  - no filled surfaces, only lines;
  - no bloom post-pass;
  - no camera orbit larger than specified;
  - no extra UI controls;
  - no refactor of the recording code.
- **Export names:**
  - `doubly_ruled_YYYYMMDD_HHMMSS.mp4` / `.png`
  - HTML title: `20260930 — Doubly Ruled Surface`
  - controls label: `20260930 — DOUBLY RULED SURFACE`

## 3. Math & formulas (derived — transcribe verbatim)

### 3.1 Coordinate convention
p5 WEBGL world coordinates, **+Y points DOWN on screen**, and the hyperboloid axis is the Y axis:
- y = −h is the top rim on screen;
- y = +h is the bottom rim.

The camera sits above the equator at negative y, looking slightly down.

### 3.2 One ruling (straight line between two circles)
Shell `s` has rim radius `R_s` and half-height `h_s`. For ruling index `j ∈ {0..N−1}`, family sign `ε ∈ {+1 (family A), −1 (family B)}`, and parameter `t ∈ [0,1]`:

```
θ   = TAU*j/N + σ_s * SPIN * φ / N                 (start angle, rotates with loop)
A   = ( R_s cos θ,           −h_s, R_s sin θ )          (top rim point)
B   = ( R_s cos(θ + ε α_s),  +h_s, R_s sin(θ + ε α_s) ) (bottom rim point)
P(t) = A + t (B − A)
tangent = B − A   (constant; use this analytic tangent, no finite differences)
```

`σ_s = +1, −1, +1` for s = 0, 1, 2, so neighbouring shells counter-rotate.

**Why this is a hyperboloid (for the explanation; no code needed):**
1. At t = ½ the point is the chord midpoint, at radius `a = R cos(α/2)` and y = 0. This is the **throat**.
2. By symmetry every horizontal section is a circle, and the radius² along the line is quadratic in y. So the surface is `(x²+z²)/a² − y²/c² = 1`.
3. At y = h the radius is R, so `R²/a² − h²/c² = 1` gives `c = h·cot(α/2)`.
4. Family B (twist −α) lies on the SAME surface. That is why every point sits on two straight lines, and why the hyperboloid is a *doubly ruled surface*.

### 3.3 Twist breathing (main transformation)

```
α_s(φ) = ALPHA_MID + ALPHA_AMP * cos(φ − s * π/2)
ALPHA_MID = 0.5π,  ALPHA_AMP = 0.28π   →  α ∈ [0.22π, 0.78π]
```

At φ = 0:
| Shell | α | State |
|---|---|---|
| outer (s=0) | 0.78π | max pinch |
| middle (s=1) | 0.5π | |
| inner (s=2) | 0.22π | nearly cylindrical |

Throat ratio `cos(α/2)` ∈ [0.339, 0.940].

**Constraint:** `0 < ALPHA_MID − ALPHA_AMP` and `ALPHA_MID + ALPHA_AMP < π`. At α = π the throat is 0, the surface becomes a double cone, and the lines all cross at one point, which is ugly and blows out.

### 3.4 Height breathing (secondary oscillation)

```
h_s(φ) = SHELL_H[s] * (1 + 0.03 * sin(2φ − s))
```

### 3.5 Shell table

| s | SHELL_R | SHELL_H | σ | core width | core light (fam A) |
|---|---|---|---|---|---|
| 0 outer | 420 | 440 | +1 | 1.10 | 0.30 |
| 1 middle | 300 | 400 | −1 | 1.00 | 0.20 |
| 2 inner | 180 | 360 | +1 | 0.90 | 0.38 |

- Family B light = family A light × 0.6.
- Every rule light is multiplied by `RULE_LIGHT` (master, default 1.0, tuning range 0.6–1.3).

### 3.6 Beads (helical streams along the lines)

```
u    = (ε > 0) ? t : 1 − t                       (A beads travel down, B beads travel up)
arg  = u − φ/TAU − BEAD_STREAMS * θ / TAU
bead = pow(max(0, cos(TAU * arg)), 60)
light += 0.55 * bead * RULE_LIGHT ; width += 0.6 * bead ; glow = 0.4 * bead
```

`BEAD_STREAMS = 3` (integer).

### 3.7 Rims and throats (KIND_RIM_TOP, KIND_RIM_BOT, KIND_THROAT)
All three are circles, with `t ∈ [0, TAU]`:
- Rim top: `(R_s cos t, −h_s, R_s sin t)`, light 0.35, width 1.2.
- Rim bottom: `(R_s cos t, +h_s, R_s sin t)`, light 0.35, width 1.2.
- Throat: `(a_s cos t, 0, a_s sin t)` with `a_s = R_s cos(α_s/2)`, light 0.55, width 1.6, glow 0.3.

Rims and throats are drawn for all three shells. Their tangent is analytic: `(−r sin t, 0, r cos t)`.

### 3.8 Loop closure derivation (why φ = 2π equals φ = 0)
1. **α_s, h_s, camera:** these depend on φ only through sin/cos(kφ) with integer k, so they are periodic ✓.
2. **Ruling rotation:** at φ = 2π, line j's θ has increased by `σ_s·SPIN·TAU/N`, which is exactly the φ = 0 angle of line `j + σ_s·SPIN (mod N)`. The **set** of lines is identical as long as **SPIN is an integer** ✓.
3. **Bead phase:** it must be keyed on θ, NOT on the index j.
   - Line j at φ = 2π has `arg = u − 1 − 3(θ_j + σ·SPIN·TAU/N)/TAU`.
   - Line `j+σSPIN` at φ = 0 has `arg = u − 3(θ_j + σ·SPIN·TAU/N)/TAU`.
   - These differ by exactly 1, and cos(TAU·arg) is unchanged ✓.
   - This requires BEAD_STREAMS to be an integer.
   - If the phase were keyed on j·const, it would jump at the seam ✗.
4. **Rotation per loop:** with N = 48 and SPIN = 4, each shell turns 30° per loop, which is slow and readable.

### 3.9 Camera & framing

```
perspective(π/3.35, W/H, 10, 8000)                      (fovy ≈ 53.7°, tan(fovy/2) = 0.5067)
yaw  = 0.35 * sin(φ)
elev = 0.24 + 0.05 * sin(2φ)                            (radians, camera above)
camera(D cos(elev) sin(yaw), −D sin(elev), D cos(elev) cos(yaw),  0,0,0,  0,1,0)
D = CAM_DIST = 2450
```

- **Scale at the origin:** 1920 / (2·0.5067·2450) ≈ **0.773 px per world unit**.
- **Height:** the outer shell spans 880 world units of height, about 680 px. The rim ellipses add about 2·420·sin(0.24)·0.773 ≈ 156 px, for a total of about **836 px**.
- **Width:** 840 world units, about 650 px.
- **Placement:** the object is centred with `translate(0, −12, 0)` and `scale(OBJECT_SCALE)`, where `OBJECT_SCALE = 1.0`.
- **HUD bands that geometry must not enter:**
  - top band: y ≤ SAFE_TOP + 236 = **506 px**;
  - bottom band: y ≥ SAFE_BOTTOM − 80 = **1380 px**;
  - sides: x < 120 or x > 960.
- **Allowed fix if it overflows:** change only `CAM_DIST` (in the range 2300–2700) or `OBJECT_SCALE` (in the range 0.9–1.05).

### 3.10 Depth attenuation (in the vertex shader, eye space)

```
depth = clamp(1.0 − (−eye.z − (CAM_DIST − 420.)) / 1100., 0.3, 1.0)
vLight = light * depth ; vGlow = glow * depth
```

The near side is at full brightness and the far side dims to 0.3.

### 3.11 Parameter table (top of sketch.js)

| Name (prompt's knob) | Default | Range | Unit / note |
|---|---|---|---|
| `RULINGS` (DETAIL) | 48 | 24–72 | lines per family per shell (any integer; loop closure only needs SPIN to be an integer) |
| `SHELL_R`, `SHELL_H` (LAYERS) | see §3.5 | — | 3 shells fixed |
| `ALPHA_MID` | 0.5π | — | rad |
| `ALPHA_AMP` (DEFORMATION) | 0.28π | 0.1π–0.4π | rad; keep ALPHA_MID ± AMP inside (0, π) |
| `SPIN` (ROTATION_SPEED) | 4 | integer 0–8 | line spacings per loop |
| `BEAD_STREAMS` | 3 | integer 1–6 | helical bead streams |
| `RULE_LIGHT` | 1.0 | 0.6–1.3 | master brightness of rulings |
| `OBJECT_SCALE` | 1.0 | 0.9–1.05 | |
| `CAM_DIST` | 2450 | 2300–2700 | world units |
| `RULE_SAMPLES` | 16 | — | straight lines, so few samples; this gives per-vertex depth shading |
| `CIRCLE_SAMPLES` | 160 | — | rims/throats |

Vertex count ≈ 3·2·48·17·2 + 9·161·2 ≈ **12.7k**, which is trivial. The mesh is built once in `setup`.

## 4. Architecture / structure

### Replace (artwork section of sketch.js)
- Remove all Poncelet code:
  - constants `N_SIDES`, `M_*`, `R_*`, `PROJ_K`, `WORLD_R`, `LAYER_*`, `THETA_STEP`, `EDGE_SAMPLES`, `CONIC_SAMPLES`, `STRAND_SAMPLES`, `KIND_*`, `vertexCache`;
  - functions `mapPlane`, `worldPoint`, `createOrbitDefinitions`, `drawVertices`;
  - the shader strings `ORBIT_*`;
  - the globals `theta0`, `echoWrite`, `orbitMesh`, `orbitShader`.
- Replace the header comment with: `// Doubly ruled surface — three hyperboloids built only from straight lines.`
- Add the new constants from §3.11, and the kinds `KIND_RULE_A = 0, KIND_RULE_B = 1, KIND_RIM_TOP = 2, KIND_RIM_BOT = 3, KIND_THROAT = 4`.
- Add the globals `ruleMesh`, `ruleShader`, `twistMix` (replaces `sweepMix`).
- **`addStrip(samples, p0, p1, index, shell, kind)`:** keep the existing helper's logic. Vertices store `(t, side ±1, j)` and uvs store `(shell, kind)`.
- **`createRuleMesh()`:**
  - `ruleMesh = new p5.Geometry(); ruleMesh.gid = "doubly-ruled-mesh";` The gid must be NEW and unique, because p5 caches GPU buffers by gid.
  - For s in 0..2:
    - for j in 0..N−1: `addStrip(RULE_SAMPLES, 0, 1, j, s, KIND_RULE_A)` and `…KIND_RULE_B`;
    - then one strip each for RIM_TOP, RIM_BOT, THROAT, with `CIRCLE_SAMPLES` over 0..TAU.
- **`RULE_VERTEX` shader:**
  - Uniforms: `uPhase`, `uAlpha` (vec3: α for s = 0, 1, 2, computed in JS), `uHalo`.
  - Template these constants in as the old shader did: `N`, `SPIN`, `BEAD_STREAMS`, `RULE_LIGHT`, `CAM_DIST`, `SHELL_R`, `SHELL_H`.
  - Pick per-shell R / H / σ / α / width / light with **if-chains on the float `shell`** (`shell < .5`, `< 1.5`, else). GLSL ES 1.0 does not allow dynamic array indexing.
  - Compute `h_s(φ)` in the shader using §3.4.
  - Compute the position using §3.2 / §3.7, and the tangent analytically.
  - The ribbon side vector, `side`, `gl_Position`, and the halo width `(1. + uHalo*5.)` are identical to the old ORBIT_VERTEX.
  - Varyings are `vEdge`, `vLight`, `vGlow`.
- **`RULE_FRAGMENT`:** identical to the old `ORBIT_FRAGMENT`.
- **`updateLoopTime()`:**
  - keep the frame/phase lines;
  - `twistMix = .5 + .5*Math.cos(phase)`, the outer shell's normalized twist (1 at φ = 0);
  - compute `alphaNow = [α_0, α_1, α_2]` per §3.3 into a preallocated array, with no per-frame allocation.
- **`updateCamera()`:** per §3.9.
- **`draw()`:**
  1. background;
  2. camera;
  3. `push`, `translate(0,−12,0)`, `scale(OBJECT_SCALE)`;
  4. `noStroke`, `depthMask(false)`, `blendMode(ADD)`;
  5. `shader`, set uniforms, `uHalo = 0` → `model`, `uHalo = 1` → `model`;
  6. `resetShader`, `blendMode(BLEND)`, `depthMask(true)`, `pop`;
  7. `drawScreenFinish()`;
  8. the recording block unchanged.
- **`drawScreenFinish()`:** the same layout. Only these strings and values change:
  - title `"DOUBLY RULED SURFACE"`;
  - subtitle `"STRAIGHT LINES, CURVED FORM"`;
  - small line `"LINE FAMILY A  ·  LINE FAMILY B  ·  ONE SURFACE"`;
  - `info.label = "THREE NESTED HYPERBOLOIDS"`;
  - right label `"TWIST / " + Math.round(twistMix*100) + "%"`;
  - track fill uses `twistMix`;
  - bottom note alpha `58 + 132*twistMix`, text `info.note = "EVERY POINT LIES ON TWO LINES"`;
  - bottom small `"CIRCLE  +  CIRCLE  +  TWIST  =  HYPERBOLOID"`.
- **`keyReleased()`:**
  - keep R / S (with the S filename prefix change);
  - add a `D` key that toggles `debugFrame`. When on, draw the SAFE box and the two HUD band limits (y = 506, y = 1380, x = 120/960) as 1 px lines at alpha 90 on `hudPg` before compositing.
  - It is never on during recording: skip it when `isRecording`.
- **`checkLoopClosure()`:**
  - A JS mirror of §3.2 + §3.6 (`rulingEndpoints(s, j, eps, phi)` returns A, B, and the bead arg at u = 0).
  - Called once at the end of `setup()`.
  - For every s, j and ε: compare line j at φ = TAU with line `((j + σ_s*SPIN) % N + N) % N` at φ = 0.
    - Both endpoints must match within 1e-6.
    - `(argDiff mod 1)` must be within 1e-6 of 0 or 1.
  - Log `LOOP CHECK PASS` or `LOOP CHECK FAIL s=… j=…`.

## 5. Tasks (ordered, checkable)

- [ ] 1. Edit `index.html`: change the `<title>` to `20260930 — Doubly Ruled Surface` and the `<strong>` to `20260930 — DOUBLY RULED SURFACE`. Nothing else.
- [ ] 2. In `sketch.js`, add the new constants and parameters (§3.11), remove the Poncelet constants and globals, and rename `sweepMix` → `twistMix` everywhere, including `primeState`.
- [ ] 3. Write `createRuleMesh()` with rulings only, plus `RULE_VERTEX`/`RULE_FRAGMENT` with the ruling position and beads (§3.2, 3.3, 3.4, 3.6, 3.10). Wire it into `setup`/`draw`. Remove `drawVertices`. **The sketch should run and show three twisting hourglasses.**
- [ ] 4. Add the rims and throats (§3.7) to the mesh and the shader.
- [ ] 5. Implement `updateCamera()` per §3.9 and the `translate`/`scale` framing.
- [ ] 6. Update the HUD strings and the `twistMix` driver in `drawScreenFinish()`. Update the filename prefixes in `stopRecording` and `keyReleased`. Remove the dead `echoWrite` line.
- [ ] 7. Add `checkLoopClosure()` and call it in `setup`. Confirm `LOOP CHECK PASS` in the console.
- [ ] 8. Add the `D` debug overlay. Check framing at φ = 0, π/2, π, 3π/2 (temporarily force `frameCount` offsets, or pause with a debug phase override that is removed afterwards). Adjust only `CAM_DIST`/`OBJECT_SCALE` within the allowed ranges if needed.
- [ ] 9. Brightness pass at frame 0:
  - the outer throat region must not clip to a flat white blob, because individual lines must stay distinguishable;
  - the inner shell must remain visible through the outer one.
  - Tune only `RULE_LIGHT` (0.6–1.3). If that is insufficient, the bead coefficient 0.55 may be lowered to 0.40.
  - Record every tuned value under Deviations.
- [ ] 10. Final verification (§6). Then give the user the prompt's final output. Code is edited in place, so do not paste the whole file. Report:
  - (1) file paths changed;
  - (2) a 3–5 sentence concept explanation (doubly ruled hyperboloid, `a = R cos(α/2)`, `c = h cot(α/2)`, loop closure);
  - (3) the parameters worth experimenting with (§3.11 knobs);
  - (4) performance notes (≈12.7k verts, a static mesh, 2 draw passes, zero per-frame allocation);
  - (5) confirmation that the palette (`#030305` / `#FFFFFF`), 1080×1920 canvas, `pixelDensity(1)`, and the WebCodecs + mp4-muxer recording were preserved.

  Then suggest archiving PLAN.md to `docs/plans/2026-09-30-doubly-ruled.md`.

## 6. Verification

- **Run:** from the repo root, `npx http-server -c-1 .` (or any static server). Open `/20260930/`. `p5.min.js` loads from `../`.
- **Console:** no WebGL/shader errors, and `LOOP CHECK PASS`.
- **Visual at frame 0:**
  - a large bright hourglass (the outer shell, pinched throat) fills roughly y ≈ 540–1340 px;
  - a medium hourglass and a near-cylinder inner shell are visible inside it, the inner one poking through the outer throat;
  - the diamond lattice of crossing lines is clearly readable;
  - bright beads spiral in 3 streams;
  - the top rim ellipse reads as nearer than the bottom rim, so the camera is looking down;
  - black background, grain, corner brackets, HUD text intact.
- **Motion:** the pinch travels outer → middle → inner (quarter-loop lag). Middle counter-rotates against outer/inner. Beads on family A travel down and on family B travel up. The camera sways gently and is never disorienting.
- **Loop:** record with `R`. It auto-stops at 600 frames and downloads `doubly_ruled_*.mp4`. In QuickTime with loop playback, there is no jump at the wrap. Frame 599 → 0 differs only by one step of motion.
- **Framing:** with `D` on, no geometry crosses y = 506 or y = 1380, or x = 120 / 960, at any of the four checked phases.
- **Performance:** a steady 60 fps preview on the dev machine. The recording completes with the status going Recording… → Finalizing… → Complete.

## 7. Out of scope

- Colour of any kind, and a palette change.
- New dependencies (CaptureJS, CCapture, etc.), audio, UI sliders/GUI.
- Changing the canvas size, FPS, duration, bitrate, or codec.
- Refactoring the recording code or the HUD layout.
- Filled / lit surfaces, a bloom post-process, particles off the surface.
- Touching any folder other than `20260930/`.

## Deviations

(Executor appends here only if the plan proved wrong. Date + reason + fix.)
