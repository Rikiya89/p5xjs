# 20261020 — Dini × Metatron

Thirteen Dini's surfaces standing on Metatron's Cube. 1080×1920 · 60 fps · 10 s seamless loop (600 frames).

## Formula

```
x(u,v) = a cos u sin v
y(u,v) = a sin u sin v
z(u,v) = a (cos v + ln tan(v/2)) + b u
```

- `u ∈ [−turns·π, turns·π]`, `v ∈ [vMin, vMax]` (avoids v = 0 and v = π).
- `K = −1/(a² + b²)`. Each spire twists as `|b| = twist + swing·cos(2πt − ring·2π/3)` with `a = √(C² − b²)`, so K stays
  exactly `−1/C²` on every spire, every frame (FD-checked in `checkDini()`).
- `v = π/2` is the cuspidal edge, the helix `(a cos u, a sin u, b u)`. Seen down the axis it is the circle r = a,
  which is also the spire's outline.

## Sacred geometry

- **Fruit of Life:** 13 spires at the centre plus six at distance 2 and six at distance 4 along the hexagonal axes.
  Their axial outlines (r = a, with a slightly under 1) are the 13 circles. Adjacent outlines nearly touch, and
  `checkDini()` verifies that no two spires interpenetrate.
- **Metatron's Cube:** all 78 lines between the 13 centres, plus bounding rings, on the floor plane under the spires.
- **Chirality:** `b → −b` is the exact mirror image (`P(u,v,−b) = mirror_y P(−u,v,b)`, checked). The centre and outer
  ring are right-handed and the inner ring left-handed, so the rings counter-rotate. The twist ripple runs outward
  ring by ring.

## Choreography

- Around the loop wrap the view is near-axial (`TILT_AXIAL`), so the opening hook is Metatron's Cube with 13 vortices.
- Mid-loop the view tilts to oblique (`TILT`): a field of counter-twisting spires on the sacred floor.
- Each view has its own framing, solved once over the phases it owns. `updateView()` dollies between them on the
  same envelope. A long lens (`CAM_DIST` 4000, FOV narrowed to keep the same pixel scale) keeps each outline over its
  floor circle.

## Parameters (`sketch.js`)

| Constant | Role |
|---|---|
| `DINI` | curvature radius C, twist / swing, turns, v range |
| `SPIRES`, `CHIRALITY` | Fruit of Life centres with ring index, handedness per ring |
| `WIRE` | meridians per turn (centre spire / others) |
| `TILT`, `TILT_AXIAL`, `CAM_DIST` | oblique and near-axial lean, lens distance |
| `densityEnvelope(p)` | how strongly the spires' meridians read over the loop |
| `MESH_ROWS`, `MESH_COLS` | surface resolution (rows evenly spaced in arc length, one row on the cusp) |

## Rendering

1. Static backdrop glow.
2. The 13 opaque surfaces, all drawn before any lines. Shading uses a wrapped raking key, sheen, Fresnel and tip
   occlusion. The centre spire is the focal point.
3. Hidden-line pass via `depthFunc(GREATER)`: the floor figure and cusp helices show faintly through the spires.
4. Visible lines: meridians lit by the key light, cusp helix, rim, each spire's outline circle on the floor, and
   Metatron's Cube. Then a faint halo pass.

## Recording

Uses the existing mp4-muxer + WebCodecs path (there is no CaptureJS in this project). Press **R** or *Record*.
Animation time comes from the recording frame index, and frames 0–599 cover one cycle; frame 600 ≡ frame 0 and is
not recorded, so the loop has no duplicate frame. **S** saves a PNG still, **D** toggles safe-area guides.
Output: `dini_metatron_YYYYMMDD_HHMMSS.mp4`.
