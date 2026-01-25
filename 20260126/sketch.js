
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
  a.download = 'silver_ratio_art.mp4';
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

// Art variables
let time = 0;
const palette = [
  "#362d78", "#523fa3", "#916ccc", "#bda1e5", "#c8c0e9",
  "#84bae7", "#516ad4", "#333f87", "#293039", "#283631"
];

// Silver Ratio: delta_S = 1 + sqrt(2) ≈ 2.414
const SILVER_RATIO = 1 + Math.sqrt(2);
const SILVER_ANGLE = (2 * Math.PI) / SILVER_RATIO; 

function setup() {
  pixelDensity(1); // Ensure exact pixel dimensions for recording
  createCanvas(W, H, WEBGL);
  setAttributes('preserveDrawingBuffer', true);
  setAttributes('antialias', true);
  noStroke();
  frameRate(FPS);
}

function draw() {
  // Deep dark background from palette
  background(color("#293039")); 
  
  orbitControl();

  // 1. Dynamic Lighting
  // A mix of ambient and moving point lights to create depth
  ambientLight(50, 50, 70);
  
  // Rotating light 1 (Warm/Lilac)
  let lx1 = cos(time * 0.5) * 800;
  let lz1 = sin(time * 0.5) * 800;
  pointLight(189, 161, 229, lx1, -400, lz1);
  
  // Rotating light 2 (Cool/Blue)
  let lx2 = cos(time * 0.3 + PI) * 800;
  let lz2 = sin(time * 0.3 + PI) * 800;
  pointLight(81, 106, 212, lx2, 400, lz2);

  // Directional light for definition
  directionalLight(255, 255, 255, 0, 0, -1);
  
  // Slowly rotate the entire scene
  rotateY(time * 0.05);
  
  // 2. Generative Structure
  let numShapes = 500;
  let maxH = 1200;
  
  for (let i = 0; i < numShapes; i++) {
    push();
    
    // Normalized index (0 to 1)
    let t = i / numShapes;
    
    // Silver Ratio Spiral Distribution
    let theta = i * SILVER_ANGLE + time * 0.1; // Rotate spiral slowly
    
    // Vertical flow using sine wave offset
    // The '+ time' creates the upward flowing animation
    let verticalPhase = t * TWO_PI * 2 + time * 0.5;
    let yBase = map(i, 0, numShapes, -maxH/2, maxH/2);
    let yOffset = sin(verticalPhase) * 50; 
    let y = yBase + yOffset;
    
    // Radius modulation (Breathing effect)
    // Using Silver Ratio harmonics for frequencies
    let rBase = 300;
    let wave1 = sin(t * TWO_PI * SILVER_RATIO + time);
    let wave2 = cos(t * TWO_PI * 3 + time * 1.5);
    let rMod = map(wave1 + wave2, -2, 2, 0.5, 1.5);
    
    // Tapering radius at top and bottom for a spindle shape
    let taper = sin(t * PI); 
    let radius = rBase * rMod * taper;
    
    // Position
    let x = radius * cos(theta);
    let z = radius * sin(theta);
    
    translate(x, y, z);
    
    // 3. Individual Element Animation
    // Rotate each element to face center + dynamic spin
    rotateY(-theta + time);
    rotateX(time * 0.5 + t * 10);
    rotateZ(time * 0.2);
    
    // Dynamic Sizing based on "pulse"
    let pulse = 1 + 0.3 * sin(t * 20 + time * 3);
    let boxSize = 25 * pulse;
    
    // Color Selection & Material
    // Cycle through palette based on height and time
    let colIndex = floor(map(sin(t * 10 + time * 0.5), -1, 1, 0, palette.length));
    colIndex = constrain(colIndex, 0, palette.length - 1);
    let col = color(palette[colIndex]);
    
    // Make material slightly transparent or shiny
    specularMaterial(col);
    shininess(50);
    
    // Geometry
    if (i % 5 === 0) {
       // Occasional spheres for variety
       sphere(boxSize * 0.6);
    } else {
       // Elongated crystals
       box(boxSize, boxSize * 3, boxSize);
    }
    
    pop();
  }
  
  // 4. Central Core
  // A glowing, morphing shape in the center
  push();
  noStroke();
  let corePulse = 100 + 20 * sin(time * 2);
  rotateX(time);
  rotateZ(time * 0.6);
  
  // Use emissive material for "glow"
  emissiveMaterial(palette[3]); // #bda1e5
  // Create a complex core with tori
  torus(corePulse, 5);
  rotateY(PI/2);
  torus(corePulse * 0.8, 4);
  pop();

  // Increment animation time
  time += 0.015;

  // Handle recording and capture frames
  if (isRecording) {
    captureFrame();
    recordingFrameCount++;
    let elapsedSeconds = (Date.now() - recordingStartTime) / 1000;

    document.getElementById('frameCount').textContent = recordingFrameCount;
    document.getElementById('duration').textContent = elapsedSeconds.toFixed(1);

    if (elapsedSeconds >= MAX_DURATION) {
      stopRecording();
    }
  }
}

function windowResized() {
  // Fixed dimensions - no resize needed
}

// Keyboard controls
function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('silver_ratio_art', 'png');
  }
}
