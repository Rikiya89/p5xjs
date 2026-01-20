// Recording variables
let encoder = null;
let isRecording = false;
let recordingFrameCount = 0;
const FPS = 60;
const MAX_DURATION = 15;
const MAX_FRAMES = FPS * MAX_DURATION;
let encoderReady = false;

// Art variables
const W = 1080;
const H = 1920;
let time = 0;

// De Moivre's theorem parameters
let particles = [];
const NUM_LAYERS = 12;
const POINTS_PER_LAYER = 60;

// Lissajous curve parameters
let LISSAJOUS_CURVES = [];

function setup() {
  pixelDensity(1); // Ensure exact pixel dimensions for recording
  createCanvas(W, H, WEBGL);
  setAttributes('preserveDrawingBuffer', true);
  frameRate(FPS);

  // Initialize Lissajous curve parameters (PI is now available)
  LISSAJOUS_CURVES = [
    { a: 3, b: 2, c: 5, delta: 0, scale: 350 },
    { a: 5, b: 4, c: 3, delta: PI / 4, scale: 400 },
    { a: 3, b: 4, c: 7, delta: PI / 2, scale: 450 },
    { a: 5, b: 6, c: 4, delta: PI / 3, scale: 380 }
  ];

  // Initialize particles using De Moivre's theorem
  initializeParticles();
}

function initializeParticles() {
  particles = [];

  for (let layer = 0; layer < NUM_LAYERS; layer++) {
    for (let i = 0; i < POINTS_PER_LAYER; i++) {
      let theta = map(i, 0, POINTS_PER_LAYER, 0, TWO_PI);
      let n = map(layer, 0, NUM_LAYERS, 2, 8); // Power for De Moivre's theorem

      particles.push({
        baseTheta: theta,
        n: n,
        layer: layer,
        index: i
      });
    }
  }
}

// De Moivre's theorem: (cos θ + i sin θ)^n = cos(nθ) + i sin(nθ)
function deMoivre(theta, n, r) {
  let x = r * cos(n * theta);
  let y = r * sin(n * theta);
  return { x: x, y: y };
}

function draw() {
  background(0);

  // Smooth camera rotation (slower)
  let camX = 800 * sin(time * 0.15);
  let camY = 400 * cos(time * 0.1);
  let camZ = 800 + 200 * sin(time * 0.08);
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

  // Ambient lighting for depth
  ambientLight(60);
  pointLight(255, 255, 255, 0, -500, 500);

  // Draw the De Moivre structure
  drawDeMoivreStructure();

  // Draw connecting lines
  drawConnections();

  // Draw central helix
  drawCentralHelix();

  // Draw Lissajous curves
  drawLissajousCurves();

  // Update time (slower animation)
  time += 0.008;

  // Update recording UI and capture frames
  if (isRecording && encoder && encoderReady) {
    recordingFrameCount++;
    document.getElementById('frameCount').textContent = recordingFrameCount;
    document.getElementById('duration').textContent = (recordingFrameCount / FPS).toFixed(1);

    // Capture canvas frame for MP4 using p5.js drawingContext
    let gl = drawingContext;

    // Read pixels from WebGL
    let pixels = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Flip vertically (WebGL has origin at bottom-left)
    let flippedPixels = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let srcIdx = (y * W + x) * 4;
        let dstIdx = ((H - 1 - y) * W + x) * 4;
        flippedPixels[dstIdx] = pixels[srcIdx];
        flippedPixels[dstIdx + 1] = pixels[srcIdx + 1];
        flippedPixels[dstIdx + 2] = pixels[srcIdx + 2];
        flippedPixels[dstIdx + 3] = pixels[srcIdx + 3];
      }
    }

    encoder.addFrameRgba(flippedPixels);

    if (recordingFrameCount >= MAX_FRAMES) {
      stopRecording();
    }
  }
}

function drawDeMoivreStructure() {
  push();

  for (let p of particles) {
    // Animate the power and radius (slower)
    let animatedN = p.n + 2 * sin(time * 0.5 + p.layer * 0.5);
    let animatedTheta = p.baseTheta + time * 0.25;
    let baseRadius = 200 + p.layer * 30;
    let animatedRadius = baseRadius + 50 * sin(time * 0.8 + p.index * 0.1);

    // Apply De Moivre's theorem
    let pos = deMoivre(animatedTheta, animatedN, animatedRadius);

    // Z position based on layer and animation (slower)
    let z = map(p.layer, 0, NUM_LAYERS, -400, 400) + 100 * sin(time * 0.5 + p.baseTheta);

    // Size varies with position (slower)
    let size = 4 + 3 * sin(time * 1.2 + p.index * 0.2);

    // Grayscale color based on depth and layer
    let brightness = map(z, -500, 500, 80, 255);
    let alpha = map(abs(z), 0, 500, 255, 150);

    push();
    translate(pos.x, pos.y, z);

    // Draw point
    noStroke();
    fill(brightness, alpha);
    sphere(size);
    pop();
  }

  pop();
}

function drawConnections() {
  push();
  stroke(255, 40);
  strokeWeight(0.5);
  noFill();

  // Draw spiral connections between layers
  for (let layer = 0; layer < NUM_LAYERS - 1; layer++) {
    beginShape();
    for (let i = 0; i <= POINTS_PER_LAYER; i++) {
      let idx = i % POINTS_PER_LAYER;
      let theta = map(idx, 0, POINTS_PER_LAYER, 0, TWO_PI);

      let n1 = map(layer, 0, NUM_LAYERS, 2, 8) + 2 * sin(time * 0.5 + layer * 0.5);
      let n2 = map(layer + 1, 0, NUM_LAYERS, 2, 8) + 2 * sin(time * 0.5 + (layer + 1) * 0.5);

      let animatedTheta = theta + time * 0.25;
      let r1 = 200 + layer * 30 + 50 * sin(time * 0.8 + idx * 0.1);
      let r2 = 200 + (layer + 1) * 30 + 50 * sin(time * 0.8 + idx * 0.1);

      let pos1 = deMoivre(animatedTheta, n1, r1);
      let pos2 = deMoivre(animatedTheta, n2, r2);

      let z1 = map(layer, 0, NUM_LAYERS, -400, 400) + 100 * sin(time * 0.5 + theta);
      let z2 = map(layer + 1, 0, NUM_LAYERS, -400, 400) + 100 * sin(time * 0.5 + theta);

      // Interpolate between layers (slower)
      let t = map(sin(time * 0.8 + i * 0.1), -1, 1, 0.3, 0.7);
      let x = lerp(pos1.x, pos2.x, t);
      let y = lerp(pos1.y, pos2.y, t);
      let z = lerp(z1, z2, t);

      vertex(x, y, z);
    }
    endShape();
  }

  pop();
}

function drawCentralHelix() {
  push();

  // Double helix inspired by De Moivre's theorem
  let helixPoints = 200;

  for (let h = 0; h < 2; h++) {
    let offset = h * PI;

    stroke(255, 100 + h * 50);
    strokeWeight(1.5);
    noFill();

    beginShape();
    for (let i = 0; i < helixPoints; i++) {
      let t = map(i, 0, helixPoints, -PI, PI);
      let animT = t + time;

      // De Moivre's theorem application (slower)
      let n = 3 + sin(time * 0.25);
      let radius = 80 + 30 * sin(animT * 0.8);
      let pos = deMoivre(animT + offset, n, radius);

      let z = map(i, 0, helixPoints, -500, 500);

      vertex(pos.x, pos.y, z);
    }
    endShape();
  }

  // Central axis particles
  for (let i = 0; i < 30; i++) {
    let z = map(i, 0, 30, -450, 450);
    let pulse = 5 + 3 * sin(time * 1.5 + i * 0.3);
    let brightness = map(sin(time * 0.8 + i * 0.2), -1, 1, 150, 255);

    push();
    translate(0, 0, z);
    noStroke();
    fill(brightness);
    sphere(pulse);
    pop();
  }

  pop();
}

// Lissajous curves: x = A·sin(at + δ), y = B·sin(bt), z = C·sin(ct)
function drawLissajousCurves() {
  push();

  for (let c = 0; c < LISSAJOUS_CURVES.length; c++) {
    let curve = LISSAJOUS_CURVES[c];
    let points = 300;

    // Animate the phase offset
    let animDelta = curve.delta + time * 0.3;

    // Varying brightness for each curve
    let baseBrightness = map(c, 0, LISSAJOUS_CURVES.length, 180, 255);

    // Draw the main curve
    stroke(baseBrightness, 60);
    strokeWeight(1);
    noFill();

    beginShape();
    for (let i = 0; i < points; i++) {
      let t = map(i, 0, points, 0, TWO_PI * 2);

      // 3D Lissajous equations
      let x = curve.scale * sin(curve.a * t + animDelta);
      let y = curve.scale * sin(curve.b * t);
      let z = curve.scale * 0.8 * sin(curve.c * t + animDelta * 0.5);

      vertex(x, y, z);
    }
    endShape(CLOSE);

    // Draw particles along the curve
    let numParticles = 20;
    for (let i = 0; i < numParticles; i++) {
      let t = map(i, 0, numParticles, 0, TWO_PI * 2) + time * 0.2;

      let x = curve.scale * sin(curve.a * t + animDelta);
      let y = curve.scale * sin(curve.b * t);
      let z = curve.scale * 0.8 * sin(curve.c * t + animDelta * 0.5);

      // Particle size pulses
      let size = 3 + 2 * sin(time * 1.5 + i * 0.5);
      let brightness = map(z, -curve.scale, curve.scale, 100, 255);

      push();
      translate(x, y, z);
      noStroke();
      fill(brightness, 200);
      sphere(size);
      pop();
    }
  }

  // Draw Lissajous knot in the center
  drawLissajousKnot();

  pop();
}

// Special Lissajous knot pattern
function drawLissajousKnot() {
  push();

  let knotPoints = 500;

  // Trefoil-like Lissajous knot
  stroke(255, 80);
  strokeWeight(1.5);
  noFill();

  beginShape();
  for (let i = 0; i < knotPoints; i++) {
    let t = map(i, 0, knotPoints, 0, TWO_PI * 2);
    let animT = t + time * 0.15;

    // Lissajous knot equations with animated phase
    let r = 120 + 40 * sin(3 * animT);
    let x = r * sin(2 * animT + time * 0.1);
    let y = r * sin(3 * animT);
    let z = 150 * sin(5 * animT + time * 0.2);

    vertex(x, y, z);
  }
  endShape(CLOSE);

  // Glowing particles on the knot
  for (let i = 0; i < 15; i++) {
    let t = map(i, 0, 15, 0, TWO_PI * 2) + time * 0.3;

    let r = 120 + 40 * sin(3 * t);
    let x = r * sin(2 * t + time * 0.1);
    let y = r * sin(3 * t);
    let z = 150 * sin(5 * t + time * 0.2);

    let pulse = 4 + 3 * sin(time * 2 + i * 0.4);
    let brightness = map(sin(time + i * 0.3), -1, 1, 180, 255);

    push();
    translate(x, y, z);
    noStroke();
    fill(brightness);
    sphere(pulse);
    pop();
  }

  pop();
}

// Start recording
async function startRecording() {
  document.getElementById('startBtn').disabled = true;
  document.getElementById('status').textContent = 'Initializing encoder...';
  document.getElementById('status').style.color = '#ffaa00';

  try {
    // Initialize H264 MP4 encoder
    encoder = await HME.createH264MP4Encoder();
    encoder.width = W;
    encoder.height = H;
    encoder.frameRate = FPS;
    encoder.quantizationParameter = 18; // Lower = better quality (10-51)
    encoder.initialize();

    encoderReady = true;
    isRecording = true;
    recordingFrameCount = 0;
    time = 0;

    document.getElementById('stopBtn').disabled = false;
    document.getElementById('status').textContent = 'Recording...';
    document.getElementById('status').style.color = '#ff6b6b';
  } catch (err) {
    console.error('Encoder initialization failed:', err);
    document.getElementById('status').textContent = 'Encoder failed! ' + err.message;
    document.getElementById('status').style.color = '#ff0000';
    document.getElementById('startBtn').disabled = false;
  }
}

// Stop recording
async function stopRecording() {
  if (encoder && isRecording) {
    isRecording = false;
    encoderReady = false;

    document.getElementById('stopBtn').disabled = true;
    document.getElementById('status').textContent = 'Encoding MP4...';
    document.getElementById('status').style.color = '#ffaa00';

    try {
      // Finalize and get MP4 data
      encoder.finalize();
      const mp4Data = encoder.FS.readFile(encoder.outputFilename);
      encoder.delete();
      encoder = null;

      // Download MP4 file
      const blob = new Blob([mp4Data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'demoivre_lissajous_3d.mp4';
      a.click();
      URL.revokeObjectURL(url);

      document.getElementById('status').textContent = 'MP4 Downloaded!';
      document.getElementById('status').style.color = '#4caf50';
    } catch (err) {
      console.error('Encoding failed:', err);
      document.getElementById('status').textContent = 'Encoding failed!';
      document.getElementById('status').style.color = '#ff0000';
    }

    document.getElementById('startBtn').disabled = false;

    setTimeout(() => {
      document.getElementById('status').textContent = 'Ready';
      document.getElementById('status').style.color = '#aaa';
    }, 3000);
  }
}
