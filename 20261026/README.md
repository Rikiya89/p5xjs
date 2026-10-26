# 20261026 — Boy's Surface / Impossible Geometry

An interactive mathematical sculpture: the Bryant–Kusner immersion of the real projective plane RP² into R³, built with p5.js WEBGL. It exports a seamless 10-second Instagram Reel (1080×1920, 60 fps, 600 frames), with the same timing and animated HUD as 20261020.

## Run

```bash
npm run dev            # browser-sync on :3003 (repo root)
# open http://localhost:3003/20261026/
```

Any static server works. Export needs WebCodecs (Chrome or Edge).

## Files

| File | Role |
|---|---|
| `boy.js` | The maths, with no p5 dependency: `boyPoint`, `boyNormal`, `buildBoyMesh`, `auditBoyMesh`. It also loads in Node. |
| `sketch.js` | Rendering (one GLSL shader with 3 passes), choreography, UI, orbit and MP4 export. |
| `capture.js` | Every MP4 path: `exportAnimation` (the deterministic 600-frame Reel) and `startRecording` / `stopRecording` / `captureFrame` (live screen capture). |
| `index.html` | Control panel and script tags (`mp4-muxer@5.1.3`, the same pin as the rest of the repo). |

## Mathematics

For w = u + iv with |w| ≤ 1:

```
D  = w⁶ + √5 w³ − 1
g₁ = −3/2 Im[w(1 − w⁴)/D]   g₂ = −3/2 Re[w(1 + w⁴)/D]   g₃ = Im[(1 + w⁶)/D] − 1/2
(x, y, z) = (g₁, g₂, g₃) / (g₁² + g₂² + g₃²)
```

- **Triple point.** D has three zeros inside the disk (w³ = (3 − √5)/2, |w| ≈ 0.7256). These are the planar ends of the underlying minimal surface, and the inversion sends all three to the origin, which is the triple point. The code multiplies every g by |D|², so the map stays polynomial and finite there (x = G·|D|²/|G|²). It returns 0 exactly at the ends.
- **Seams.** The disk is sampled on a polar grid. Duplicated vertices get exactly copied positions, so the mesh is watertight:
  - the centre ring (all at w = 0)
  - the θ = 2π column
  - the antipodal boundary (w ~ −w on |w| = 1)
- **Normals and shading.** Normals are local (X_u × X_v). They are not shared across the antipodal weld, because RP² has no global normal. Shading is two-sided: whichever side faces the eye gets lit.
- **Symmetry.** The C₃ symmetry is w → e^{2πi/3}w, which is a −120° turn about z.
- **In-page audit**, logged at setup:
  - Euler characteristic V − E + F = 1 (RP²)
  - 0 open edges and 0 NaN vertices
  - symmetry, antipodal identity and triple-point error all ~1e-15

## Modes

- **Sculpture**: an opaque white-ink metal surface. At Surface opacity < 1, rims of the hidden sheets show through.
- **Wireframe**: an additive x-ray of the parameter grid (θ and r lines) plus z-contours. All sheets show, along with the self-intersections and the triple point.
- **Hybrid**: the surface with engraved grid lines and travelling z-contour bands. Hidden lines show faintly through the front sheet.

## Animation

`phase = TAU · frame / 600` (60 fps × 10 s, as in 20261020). The spin advances exactly 120° per loop, so the surface's own symmetry closes the loop. Tilt, camera breath and light use integer harmonics of phase only. The contours move 2 spacings per loop and the highlight band moves 1 period per loop. Frame 0 is the hero view (the cos peaks). Edit `choreography()` in `sketch.js` to restage it.

## Controls

| Control | Effect |
|---|---|
| Mode / Color | Sculpture · Wireframe · Hybrid / Monochrome (white ink) · Cyan · Magenta (default, the 20261019 palette: CYAN `#00e5ff` on the side the local normal faces, MAGENTA `#ff3dbf` on the other, ACID `#b6ff3d` on the seam \|w\| = 1; background `#030305`) |
| Mesh | Rings (cols = 3 × rings, snapped to a multiple of 6). The mesh is rebuilt only on slider release. |
| Wire density | Number of θ lines (a multiple of 6, so the grid respects the symmetry and the antipodal seam). There are 1/3 as many rings. |
| Line / Surface opacity, Highlight | Line strength, sheet visibility, band strength |
| Speed | Preview playback only. Export always renders frames 0–239. |
| Cam distance / rotation, Light dir | Static offsets. These are captured in the export. |
| Preview res | 50 % or 100 % canvas density. Export always renders at full 1080×1920. |
| Drag / wheel / double-click | Orbit / distance / reset. Input is locked during export. |
| Keys | `H` show or hide the UI · `Space` play/pause · `E` export · `R` start/stop live recording · `S` save a PNG still |

The caption is part of the artwork and is redrawn every frame in 20261019's layout. It has a Georgia title, the Bryant–Kusner formula (g₁, g₂ in CYAN; g₃ and x = g/|g|² in INK), live θ / tilt readouts, the seam relation `w ~ −w on |w| = 1` in ACID (the colour of the seam on the surface) and a loop progress track. Four story captions fade in on loop windows: one side, the triple point, the glued edge and the 120° symmetry. A citation line sits at the bottom. Toggle it all with **Caption**.

## Export

**Export** renders frames 0–239 by index (`noLoop` + `redraw`) into WebCodecs H.264 via mp4-muxer, with backpressure on the encoder queue. It saves `boys_surface_YYYYMMDD_HHMMSS.mp4`. Errors are reported in the status line, and the loop, density and UI are restored in all cases.

Low-powered devices: use Preview 50 % and a mesh of about 48.

### Live recording

**● Rec live** (or `R`) restarts the loop at frame 0 and records whatever is on screen, including orbit drags, slider moves and speed changes. It records at 1080×1920 with frame-count timestamps, stops automatically after one loop length (10 s), and saves `boys_surface_live_YYYYMMDD_HHMMSS.mp4`. Preview res and Export are locked while it runs. The result is not loop-exact, so use **Export** for the posted Reel.
