
// Canvas dimensions
const W = 1080;
const H = 1920;

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
  if (typeof VideoEncoder === 'undefined') {
    alert('Your browser does not support WebCodecs API. Please use Chrome or Edge.');
    return;
  }

  isRecording = true;
  recordingFrameCount = 0;
  time = 0;
  recordingStartTime = Date.now();

  muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H },
    fastStart: 'in-memory'
  });

  encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('Encoder error:', e)
  });

  encoder.configure({
    codec: 'avc1.640028',
    width: W,
    height: H,
    bitrate: 15_000_000, // Maximized bitrate for smoothness
    framerate: FPS
  });

  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('status').textContent = 'Recording...';
  document.getElementById('status').style.color = '#ff6b6b';
}

async function stopRecording() {
  if (!isRecording) return;

  isRecording = false;
  document.getElementById('status').textContent = 'Processing...';
  document.getElementById('status').style.color = '#84bae7';

  await encoder.flush();
  muxer.finalize();

  let buffer = muxer.target.buffer;
  let blob = new Blob([buffer], { type: 'video/mp4' });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = 'bronze_ethereal_flow.mp4';
  a.click();
  URL.revokeObjectURL(url);

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

function captureFrame() {
  if (!isRecording || !encoder) return;
  const canvas = document.querySelector('canvas');
  const timestamp = recordingFrameCount * (1_000_000 / FPS);
  const frame = new VideoFrame(canvas, { timestamp: timestamp });
  encoder.encode(frame, { keyFrame: recordingFrameCount % 60 === 0 });
  frame.close();
}

// Art variables
let time = 0;
const palette = [
  "#362d78", "#523fa3", "#916ccc", "#bda1e5", "#c8c0e9",
  "#84bae7", "#516ad4", "#333f87", "#293039", "#283631"
];

// Bronze Ratio
const BRONZE_RATIO = (3 + Math.sqrt(13)) / 2; 
const BRONZE_ANGLE = (2 * Math.PI) / BRONZE_RATIO;

function setup() {
  pixelDensity(1);
  createCanvas(W, H, WEBGL);
  setAttributes('preserveDrawingBuffer', true);
  setAttributes('antialias', true);
  noStroke();
  frameRate(FPS);
}

function draw() {
  // Deep elegant background
  background(color("#283631"));

  orbitControl();

  // --- Ethereal Lighting ---
  // Soft ambient
  ambientLight(70, 70, 90);
  
  // Rotating Prism Lights
  // creates shifting colors on the shiny surfaces
  let t = time * 0.5;
  pointLight(189, 161, 229, 800 * cos(t), -600, 800 * sin(t)); // Lilac
  pointLight(81, 106, 212, 800 * cos(t + 2), 600, 800 * sin(t + 2)); // Blue
  pointLight(255, 255, 255, 0, 0, 800); // Front fill

  // Camera Movement
  // Subtle swaying to make the scene feel immersive
  rotateZ(sin(time * 0.1) * 0.05);
  rotateY(time * 0.05);

  // --- Layer 1: The Core ---
  push();
  rotateX(time * 0.2);
  rotateZ(time * 0.3);
  emissiveMaterial(palette[3]); 
  sphere(50 + 10 * sin(time * 4)); // Pulsing heart
  // Energy rings
  noFill();
  stroke(palette[5]);
  strokeWeight(2);
  rotateY(time);
  torus(100, 1);
  pop();

  // --- Layer 2: Bronze Flow Sculpture ---
  noStroke();
  let numShapes = 700;
  let maxH = 1600;

  for (let i = 0; i < numShapes; i++) {
    push();
    
    let progress = i / numShapes; 
    
    // Bronze Ratio Distribution
    let theta = i * BRONZE_ANGLE + time * 0.1;
    
    // Fluid Y Position
    // We create a "standing wave" that moves up
    let yBase = map(i, 0, numShapes, -maxH / 2, maxH / 2);
    let wave = sin(progress * PI * 6 + time) * 30; // Small ripples
    let y = yBase + wave;

    // Radius Dynamics (The Breathing Flower shape)
    let rBase = 350;
    // Envelope: Taper at top and bottom
    let envelope = sin(progress * PI); 
    // Bronze Modulation: Creates the spiral arms
    let spiralArm = cos(theta * 3 - time * 0.5); 
    // Pulse: The whole structure breathes
    let breathe = 1 + 0.1 * sin(time * 0.8);
    
    let radius = rBase * envelope * (0.8 + 0.4 * spiralArm) * breathe;

    // Calculate Cartesian
    let x = radius * cos(theta);
    let z = radius * sin(theta);

    translate(x, y, z);

    // Orientation: Elements flow with the spiral
    rotateY(-theta);
    rotateX(time * 0.5 + progress * 10);
    rotateZ(progress * PI);

    // Dynamic Sizing
    // Elements are smaller at the tips, larger in the belly
    let size = 20 * envelope;
    size *= (1 + 0.5 * sin(i * 0.5 + time * 2)); // Twinkle size

    // Advanced Color Blending
    // We mix 3 colors based on height and time to create gradients
    let colT = (progress + time * 0.05) % 1;
    let idx1 = floor(colT * palette.length);
    let idx2 = (idx1 + 1) % palette.length;
    let lerpAmt = (colT * palette.length) % 1;
    let c1 = color(palette[idx1]);
    let c2 = color(palette[idx2]);
    let finalCol = lerpColor(c1, c2, lerpAmt);

    // Material
    specularMaterial(finalCol);
    shininess(60); // Soft gloss

    // Geometry Mixing
    if (i % 25 === 0) {
      // "Gems" - Emissive for sparkle
      emissiveMaterial(finalCol);
      sphere(size * 0.5);
    } else if (i % 2 === 0) {
      // "Petals" - Flat boxes
      box(size, size * 0.2, size * 2);
    } else {
      // "Needles" - Vertical lines
      box(size * 0.2, size * 3, size * 0.2);
    }

    pop();
  }

  // --- Layer 3: Distant Orbitals (Parallax) ---
  push();
  strokeWeight(3);
  for(let k=0; k<100; k++) {
    let pTime = time * 0.2;
    // Bronze Ratio distribution for stars too, but wider
    let pTheta = k * BRONZE_ANGLE + pTime;
    let pY = map(k, 0, 100, -1000, 1000);
    let pRad = 700 + 200 * sin(k * 0.5 + pTime);
    
    let px = pRad * cos(pTheta);
    let pz = pRad * sin(pTheta);
    
    stroke(255, 120); // Ghostly white
    point(px, pY, pz);
  }
  pop();

  time += 0.015;

  if (isRecording) {
    captureFrame();
    recordingFrameCount++;
    let elapsedSeconds = (Date.now() - recordingStartTime) / 1000;
    document.getElementById('frameCount').textContent = recordingFrameCount;
    document.getElementById('duration').textContent = elapsedSeconds.toFixed(1);
    if (elapsedSeconds >= MAX_DURATION) stopRecording();
  }
}

function windowResized() {}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('bronze_ethereal_flow', 'png');
}
