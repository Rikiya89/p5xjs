// Color palette
const colors = [
  "#362d78",
  "#523fa3",
  "#916ccc",
  "#bda1e5",
  "#c8c0e9",
  "#84bae7",
  "#516ad4",
  "#333f87",
  "#293039",
  "#283631"
];

// Golden ratio constants
const PHI = 1.618033988749895;
const GOLDEN_ANGLE = 137.507764 * (Math.PI / 180); // 2.39996 radians

let time = 0;
let colorObjects;
let spiralElements;
let phyllotaxisPoints;

// Recording variables
let muxer = null;
let videoEncoder = null;
let isRecording = false;
let recordingFrameCount = 0;
const FPS = 60;
const MAX_DURATION = 15; // seconds
const MAX_FRAMES = FPS * MAX_DURATION;

// Start recording using MP4 Muxer
async function startRecording() {
  let canvas = document.querySelector('canvas');

  // Use the logical size (not the retina-scaled size)
  let videoWidth = 1080;
  let videoHeight = 1920;

  muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: videoWidth,
      height: videoHeight
    },
    fastStart: 'in-memory'
  });

  videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('VideoEncoder error:', e)
  });

  videoEncoder.configure({
    codec: 'avc1.640032',  // High Profile Level 5.0
    width: videoWidth,
    height: videoHeight,
    bitrate: 15000000,
    framerate: FPS
  });

  isRecording = true;
  recordingFrameCount = 0;
  time = 0;

  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('status').textContent = 'Recording...';
  document.getElementById('status').style.color = '#ff6b6b';
}

// Stop recording
async function stopRecording() {
  if (isRecording) {
    isRecording = false;

    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('status').textContent = 'Encoding video... (please wait)';
    document.getElementById('status').style.color = '#84bae7';

    await videoEncoder.flush();
    muxer.finalize();

    let buffer = muxer.target.buffer;
    let blob = new Blob([buffer], { type: 'video/mp4' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = '3d_generative_art.mp4';
    a.click();
    URL.revokeObjectURL(url);

    document.getElementById('status').textContent = 'Ready';
    document.getElementById('status').style.color = '#84bae7';

    videoEncoder = null;
    muxer = null;
  }
}

// Offscreen canvas for scaling
let offscreenCanvas = null;
let offscreenCtx = null;

// Capture frame for MP4
function captureFrame() {
  if (!isRecording || !videoEncoder) return;

  let canvas = document.querySelector('canvas');
  let videoWidth = 1080;
  let videoHeight = 1920;

  // Create offscreen canvas if needed
  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = videoWidth;
    offscreenCanvas.height = videoHeight;
    offscreenCtx = offscreenCanvas.getContext('2d');
  }

  // Scale down the main canvas to the target resolution
  offscreenCtx.drawImage(canvas, 0, 0, videoWidth, videoHeight);

  let frame = new VideoFrame(offscreenCanvas, {
    timestamp: recordingFrameCount * (1000000 / FPS)
  });

  videoEncoder.encode(frame, { keyFrame: recordingFrameCount % 60 === 0 });
  frame.close();
}

// Convert hex to p5 color
function hexToColor(hex) {
  return color(hex);
}

// Fibonacci sequence generator
function fibonacci(n) {
  let seq = [0, 1];
  for (let i = 2; i < n; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
  }
  return seq;
}

// Create golden spiral points in 3D
function createGoldenSpiral(numPoints, scale, zSpread) {
  let points = [];
  for (let i = 0; i < numPoints; i++) {
    let angle = i * GOLDEN_ANGLE;
    let radius = scale * sqrt(i);
    let x = radius * cos(angle);
    let y = radius * sin(angle);
    let z = (i / numPoints - 0.5) * zSpread;
    points.push({ x, y, z, angle, radius, index: i });
  }
  return points;
}

// Create phyllotaxis pattern (sunflower-like)
function createPhyllotaxis(numPoints, scale) {
  let points = [];
  for (let i = 0; i < numPoints; i++) {
    let angle = i * GOLDEN_ANGLE;
    let radius = scale * sqrt(i);
    let x = radius * cos(angle);
    let y = radius * sin(angle);
    let z = sin(i * 0.1) * 50;
    points.push({ x, y, z, angle, radius, index: i });
  }
  return points;
}

function setup() {
  createCanvas(1080, 1920, WEBGL);
  colorMode(RGB);

  // Initialize arrays
  colorObjects = [];
  spiralElements = [];
  phyllotaxisPoints = [];

  // Convert colors to p5 color objects
  for (let c of colors) {
    colorObjects.push(hexToColor(c));
  }

  // Initialize spiral elements
  spiralElements = createGoldenSpiral(300, 8, 800);
  phyllotaxisPoints = createPhyllotaxis(500, 12);
}

function draw() {
  background(20, 25, 35);

  // Smooth camera rotation based on golden ratio
  let camX = 400 * sin(time * 0.3);
  let camY = 300 * cos(time * 0.3 / PHI);
  let camZ = 600 + 200 * sin(time * 0.2);
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

  // Ambient and directional lighting
  ambientLight(60, 60, 80);
  directionalLight(200, 180, 255, 0.5, 0.5, -1);
  pointLight(150, 200, 255, 300 * sin(time), 300 * cos(time), 200);

  // Draw central golden spiral structure
  push();
  rotateY(time * 0.2);
  rotateX(time * 0.15 / PHI);
  drawGoldenSpiralStructure();
  pop();

  // Draw phyllotaxis layers
  push();
  rotateZ(time * 0.1);
  drawPhyllotaxisLayers();
  pop();

  // Draw Fibonacci rings
  push();
  rotateX(PI / 2);
  rotateZ(-time * 0.15);
  drawFibonacciRings();
  pop();

  // Draw floating golden rectangles
  push();
  rotateY(-time * 0.12);
  drawGoldenRectangles();
  pop();

  // Draw connecting golden spirals
  push();
  rotateX(time * 0.08);
  rotateY(time * 0.1 / PHI);
  drawConnectingSpirals();
  pop();

  // Update time
  time += 0.016;

  // Recording logic
  if (isRecording) {
    captureFrame();
    recordingFrameCount++;

    let duration = recordingFrameCount / FPS;
    document.getElementById('duration').textContent = duration.toFixed(1);
    document.getElementById('frameCount').textContent = recordingFrameCount;

    if (recordingFrameCount >= MAX_FRAMES) {
      stopRecording();
    }
  }
}

// Draw the main golden spiral structure
function drawGoldenSpiralStructure() {
  noStroke();

  for (let i = 0; i < spiralElements.length; i++) {
    let p = spiralElements[i];
    let colorIndex = floor(i / spiralElements.length * (colorObjects.length - 1));
    let col = colorObjects[colorIndex];

    // Animate position
    let animatedZ = p.z + sin(time * 2 + p.index * 0.05) * 30;
    let animatedRadius = p.radius + sin(time * 1.5 + p.angle) * 5;
    let x = animatedRadius * cos(p.angle + time * 0.3);
    let y = animatedRadius * sin(p.angle + time * 0.3);

    push();
    translate(x, y, animatedZ);

    // Size based on golden ratio
    let size = 3 + (p.radius / 80) * PHI;
    size *= 1 + 0.3 * sin(time * 3 + p.index * 0.1);

    // Color with transparency
    let alpha = map(p.index, 0, spiralElements.length, 150, 255);
    fill(red(col), green(col), blue(col), alpha);

    sphere(size);
    pop();
  }
}

// Draw phyllotaxis pattern layers
function drawPhyllotaxisLayers() {
  let numLayers = 3;

  for (let layer = 0; layer < numLayers; layer++) {
    push();
    let layerOffset = layer * 150 - 150;
    translate(0, 0, layerOffset);
    rotateZ(layer * PI / PHI + time * 0.1 * (layer + 1));

    for (let i = 0; i < phyllotaxisPoints.length; i += 2) {
      let p = phyllotaxisPoints[i];
      let colorIndex = (floor(i / 50) + layer) % colorObjects.length;
      let col = colorObjects[colorIndex];

      let scale = 0.6 + layer * 0.2;
      let x = p.x * scale;
      let y = p.y * scale;
      let z = p.z * 0.5 + sin(time * 2 + i * 0.02) * 20;

      push();
      translate(x, y, z);
      rotateX(time + i * 0.01);
      rotateY(time * PHI + i * 0.01);

      let alpha = map(p.radius, 0, 200, 200, 100);
      fill(red(col), green(col), blue(col), alpha);
      noStroke();

      // Draw as small boxes for variety
      let boxSize = 4 + sin(time * 2 + i * 0.05) * 2;
      box(boxSize, boxSize * PHI, boxSize);
      pop();
    }
    pop();
  }
}

// Draw Fibonacci-based rings
function drawFibonacciRings() {
  let fib = fibonacci(12);

  for (let i = 3; i < fib.length; i++) {
    let radius = fib[i] * 2;
    let colorIndex = i % colorObjects.length;
    let col = colorObjects[colorIndex];

    push();
    let zOffset = (i - 3) * 40 - 160;
    zOffset += sin(time * 1.5 + i * 0.5) * 30;
    translate(0, 0, zOffset);
    rotateZ(time * 0.2 * (i % 2 === 0 ? 1 : -1));

    // Draw ring as connected segments
    stroke(red(col), green(col), blue(col), 180);
    strokeWeight(2 + i * 0.3);
    noFill();

    beginShape();
    for (let angle = 0; angle <= TWO_PI; angle += 0.1) {
      let wobble = sin(angle * fib[i] * 0.1 + time * 2) * 5;
      let x = (radius + wobble) * cos(angle);
      let y = (radius + wobble) * sin(angle);
      let z = sin(angle * 3 + time) * 10;
      vertex(x, y, z);
    }
    endShape(CLOSE);
    pop();
  }
}

// Draw golden rectangles floating in space
function drawGoldenRectangles() {
  let numRects = 8;

  for (let i = 0; i < numRects; i++) {
    let angle = (i / numRects) * TWO_PI + time * 0.2;
    let radius = 200 + sin(time + i) * 50;
    let x = radius * cos(angle);
    let y = radius * sin(angle);
    let z = sin(time * 0.5 + i * PHI) * 200;

    push();
    translate(x, y, z);
    rotateX(time * 0.3 + i);
    rotateY(time * 0.2 / PHI + i);
    rotateZ(time * 0.1 + i * 0.5);

    let colorIndex = i % colorObjects.length;
    let col = colorObjects[colorIndex];

    // Golden rectangle proportions
    let w = 30 + i * 5;
    let h = w * PHI;

    fill(red(col), green(col), blue(col), 120);
    stroke(red(col), green(col), blue(col), 200);
    strokeWeight(1);

    // Draw as thin 3D box
    box(w, h, 3);

    // Inner golden rectangle
    let innerW = w / PHI;
    let innerH = h / PHI;
    fill(red(col), green(col), blue(col), 80);
    box(innerW, innerH, 5);
    pop();
  }
}

// Draw connecting spiral lines
function drawConnectingSpirals() {
  let numSpirals = 5;

  for (let s = 0; s < numSpirals; s++) {
    let colorIndex = s % colorObjects.length;
    let col = colorObjects[colorIndex];

    push();
    rotateY(s * TWO_PI / numSpirals);

    stroke(red(col), green(col), blue(col), 150);
    strokeWeight(1.5);
    noFill();

    beginShape();
    for (let i = 0; i < 100; i++) {
      let t = i * 0.1;
      let spiralRadius = 20 + t * 8;
      let angle = t * PHI + time * 0.5;

      let x = spiralRadius * cos(angle);
      let y = spiralRadius * sin(angle);
      let z = t * 15 - 250 + sin(time * 2 + t) * 20;

      vertex(x, y, z);
    }
    endShape();
    pop();
  }

  // Golden ratio spiral in center
  push();
  stroke(colorObjects[2]);
  strokeWeight(2);
  noFill();

  beginShape();
  for (let i = 0; i < 200; i++) {
    let t = i * 0.05;
    let r = pow(PHI, t * 0.3) * 5;
    let angle = t * 2 + time * 0.3;

    let x = r * cos(angle);
    let y = r * sin(angle);
    let z = t * 8 - 200;

    vertex(x, y, z);
  }
  endShape();
  pop();
}
