
// Canvas dimensions
const W = 1080;
const H = 1920;

// Metallic ratios - solutions to x² - nx - 1 = 0
const GOLDEN = (1 + Math.sqrt(5)) / 2;      // φ ≈ 1.618
const SILVER = 1 + Math.sqrt(2);             // δs ≈ 2.414
const BRONZE = (3 + Math.sqrt(13)) / 2;      // ≈ 3.303

// Animation time
let time = 0;

// Recording variables
let encoder = null;
let muxer = null;
let isRecording = false;
let recordingFrameCount = 0;
let recordingStartTime = 0;
const FPS = 60;
const MAX_DURATION = 15; // seconds

// Start recording with MP4 encoding
async function startRecording() {
  // Check for WebCodecs support
  if (typeof VideoEncoder === 'undefined') {
    alert('Your browser does not support WebCodecs API. Please use Chrome or Edge.');
    return;
  }

  isRecording = true;
  recordingFrameCount = 0;
  time = 0; // Reset animation time
  recordingStartTime = Date.now();

  // Initialize MP4 muxer
  muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: W,
      height: H
    },
    fastStart: 'in-memory'
  });

  // Initialize video encoder
  encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('Encoder error:', e)
  });

  encoder.configure({
    codec: 'avc1.640028',
    width: W,
    height: H,
    bitrate: 8_000_000,
    framerate: FPS
  });

  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('status').textContent = 'Recording...';
  document.getElementById('status').style.color = '#ff6b6b';
}

// Stop recording and download MP4
async function stopRecording() {
  if (!isRecording) return;

  isRecording = false;
  document.getElementById('status').textContent = 'Processing...';
  document.getElementById('status').style.color = '#84bae7';

  // Flush encoder and finalize muxer
  await encoder.flush();
  muxer.finalize();

  // Get the MP4 data
  let buffer = muxer.target.buffer;
  let blob = new Blob([buffer], { type: 'video/mp4' });

  // Download the file
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = 'metallic_ratios_3d.mp4';
  a.click();
  URL.revokeObjectURL(url);

  // Cleanup
  encoder = null;
  muxer = null;

  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
  document.getElementById('status').textContent = 'Download started!';
  document.getElementById('status').style.color = '#4caf50';

  setTimeout(() => {
    document.getElementById('status').textContent = 'Ready';
    document.getElementById('status').style.color = '#84bae7';
  }, 3000);
}

// Capture frame for MP4 encoding
function captureFrame() {
  if (!isRecording || !encoder) return;

  const canvas = document.querySelector('canvas');
  const timestamp = recordingFrameCount * (1_000_000 / FPS); // microseconds

  const frame = new VideoFrame(canvas, {
    timestamp: timestamp
  });

  encoder.encode(frame, { keyFrame: recordingFrameCount % 60 === 0 });
  frame.close();
}

// p5.js setup
function setup() {
  createCanvas(W, H, WEBGL);
  noStroke();
}

// p5.js draw loop
function draw() {
  background(0);

  // Update time
  time += 0.008;

  // Camera setup with slow rotation
  let camRadius = 800;
  let camX = camRadius * sin(time * 0.3);
  let camZ = camRadius * cos(time * 0.3);
  let camY = 200 * sin(time * 0.2);
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

  // Ambient lighting for depth
  ambientLight(60);
  directionalLight(255, 255, 255, 0.5, 0.5, -1);
  pointLight(255, 255, 255, 0, -300, 200);

  // Draw the three ratio-based structures
  push();
  drawGoldenSpiral();
  pop();

  push();
  drawSilverTowers();
  pop();

  push();
  drawBronzeRings();
  pop();

  // Central core pulsing with combined ratios
  push();
  drawCentralCore();
  pop();

  // Recording logic
  if (isRecording) {
    captureFrame();
    recordingFrameCount++;

    let duration = recordingFrameCount / FPS;
    document.getElementById('duration').textContent = duration.toFixed(1);
    document.getElementById('frameCount').textContent = recordingFrameCount;

    if (duration >= MAX_DURATION) {
      stopRecording();
    }
  }
}

// Golden ratio spiral structure
function drawGoldenSpiral() {
  let numPoints = 120;
  let baseRadius = 50;

  for (let i = 0; i < numPoints; i++) {
    let t = i / numPoints;
    let angle = i * TWO_PI / GOLDEN; // Golden angle
    let radius = baseRadius * pow(GOLDEN, i * 0.03);
    let height = (i - numPoints / 2) * 4;

    let x = radius * cos(angle + time);
    let z = radius * sin(angle + time);
    let y = height + 50 * sin(time * 2 + i * 0.1);

    push();
    translate(x, y, z);

    // Size based on golden ratio
    let size = 8 + 12 * pow(1 / GOLDEN, (numPoints - i) * 0.02);

    // Black and white based on position
    let brightness = map(sin(angle + time * 1.5), -1, 1, 50, 255);
    fill(brightness);
    specularMaterial(brightness);

    sphere(size);
    pop();
  }
}

// Silver ratio tower structures
function drawSilverTowers() {
  let numTowers = 8;
  let towerRadius = 280;

  for (let t = 0; t < numTowers; t++) {
    let angle = t * TWO_PI / numTowers + time * 0.2;
    let tx = towerRadius * cos(angle);
    let tz = towerRadius * sin(angle);

    push();
    translate(tx, 0, tz);
    rotateY(angle);

    // Stack boxes using silver ratio proportions
    let numBoxes = 12;
    let currentY = 200;
    let currentSize = 60;

    for (let b = 0; b < numBoxes; b++) {
      let boxHeight = currentSize / SILVER;
      let boxWidth = currentSize;
      let boxDepth = currentSize / SILVER;

      // Animate vertical position
      let yOffset = 20 * sin(time * 3 + t + b * 0.5);

      push();
      translate(0, currentY + yOffset, 0);
      rotateY(time * 0.5 + b * 0.2);

      // Alternating black and white
      let brightness = (b + t) % 2 === 0 ? 240 : 30;
      fill(brightness);
      specularMaterial(brightness);

      box(boxWidth, boxHeight, boxDepth);
      pop();

      currentY -= boxHeight * 1.2;
      currentSize /= pow(SILVER, 0.3);
    }
    pop();
  }
}

// Bronze ratio ring structures
function drawBronzeRings() {
  let numRings = 7;

  for (let r = 0; r < numRings; r++) {
    let ringRadius = 100 + r * 40 * BRONZE / 2;
    let ringY = (r - numRings / 2) * 80;
    let numElements = floor(6 + r * BRONZE);

    push();
    translate(0, ringY, 0);
    rotateY(time * (0.3 + r * 0.1) * (r % 2 === 0 ? 1 : -1));
    rotateX(sin(time + r) * 0.2);

    for (let e = 0; e < numElements; e++) {
      let angle = e * TWO_PI / numElements;
      let ex = ringRadius * cos(angle);
      let ez = ringRadius * sin(angle);

      push();
      translate(ex, 0, ez);
      rotateY(-angle);
      rotateZ(time * 2 + e);

      // Size based on bronze ratio
      let size = 15 + 10 * sin(time * 2 + r + e * BRONZE);

      // Gradient from black to white across rings
      let brightness = map(r, 0, numRings - 1, 30, 230);
      brightness += 50 * sin(time * 3 + e);
      brightness = constrain(brightness, 0, 255);

      fill(brightness);
      specularMaterial(brightness);

      // Use torus shape for rings
      torus(size, size / BRONZE);
      pop();
    }
    pop();
  }
}

// Central core combining all ratios
function drawCentralCore() {
  // Pulsing core
  let pulse = 0.5 + 0.5 * sin(time * 2);
  let coreSize = 30 + 20 * pulse;

  // Nested icosahedrons at ratio-based sizes
  let sizes = [
    coreSize,
    coreSize * GOLDEN,
    coreSize * SILVER,
    coreSize * BRONZE * 0.5
  ];

  for (let i = 0; i < sizes.length; i++) {
    push();
    rotateX(time * (i + 1) * 0.3);
    rotateY(time * (i + 1) * 0.2);
    rotateZ(time * (i + 1) * 0.1);

    // Alternate between filled and wireframe
    if (i % 2 === 0) {
      let brightness = map(i, 0, sizes.length - 1, 255, 100);
      fill(brightness);
      specularMaterial(brightness);
      noStroke();
    } else {
      noFill();
      stroke(255);
      strokeWeight(1);
    }

    // Draw different platonic solids for variety
    if (i === 0) {
      sphere(sizes[i] * 0.8);
    } else if (i === 1) {
      box(sizes[i] * 0.6);
    } else if (i === 2) {
      // Octahedron-like shape using two pyramids
      drawOctahedron(sizes[i] * 0.4);
    } else {
      torus(sizes[i] * 0.3, sizes[i] * 0.1);
    }
    pop();
  }
}

// Helper function to draw octahedron
function drawOctahedron(size) {
  beginShape(TRIANGLES);
  // Top pyramid
  vertex(0, -size, 0);
  vertex(size, 0, 0);
  vertex(0, 0, size);

  vertex(0, -size, 0);
  vertex(0, 0, size);
  vertex(-size, 0, 0);

  vertex(0, -size, 0);
  vertex(-size, 0, 0);
  vertex(0, 0, -size);

  vertex(0, -size, 0);
  vertex(0, 0, -size);
  vertex(size, 0, 0);

  // Bottom pyramid
  vertex(0, size, 0);
  vertex(0, 0, size);
  vertex(size, 0, 0);

  vertex(0, size, 0);
  vertex(-size, 0, 0);
  vertex(0, 0, size);

  vertex(0, size, 0);
  vertex(0, 0, -size);
  vertex(-size, 0, 0);

  vertex(0, size, 0);
  vertex(size, 0, 0);
  vertex(0, 0, -size);
  endShape();
}
