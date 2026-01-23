
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
  angle = 0; // Reset animation
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
  a.download = 'supershape_3d.mp4';
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

// Supershape variables
let angle = 0;
// Reduced resolution slightly to allow for thicker, smoother lines
let total = 45;

let n1 = 0.2;
let n2 = 1.7;
let n3 = 1.7;

function setup() {
  pixelDensity(1); // Ensure exact pixel dimensions for recording
  createCanvas(W, H, WEBGL);
  setAttributes('preserveDrawingBuffer', true);
  setAttributes('antialias', true);
  noFill();
  frameRate(FPS);
}

function supershape(theta, m, n1, n2, n3) {
  let t1 = abs(cos(m * theta / 4));
  t1 = pow(t1, n2);
  let t2 = abs(sin(m * theta / 4));
  t2 = pow(t2, n3);
  let r = pow(t1 + t2, -1 / n1);
  return r;
}

function draw() {
  background(0);
  orbitControl();

  rotateY(angle * 0.2);
  rotateX(angle * 0.2);

  // Dynamic Morphing: 'm' oscillates between 0 and 7
  let m = map(sin(frameCount * 0.02), -1, 1, 0, 7);

  stroke(255);
  strokeWeight(1.2); // Increased weight for visibility

  // Rendering using TRIANGLE_STRIP for a connected "Net" look
  for (let i = 0; i < total; i++) {
    let lat1 = map(i, 0, total, -HALF_PI, HALF_PI);
    let lat2 = map(i + 1, 0, total, -HALF_PI, HALF_PI);

    beginShape(TRIANGLE_STRIP);
    for (let j = 0; j <= total; j++) {
      let lon = map(j, 0, total, -PI, PI);

      // Calculate Vertex 1 (Current Latitude)
      let r1 = supershape(lon, m, n1, n2, n3);
      let r2 = supershape(lat1, m, n1, n2, n3);
      let x1 = 200 * r1 * cos(lon) * r2 * cos(lat1);
      let y1 = 200 * r1 * sin(lon) * r2 * cos(lat1);
      let z1 = 200 * r2 * sin(lat1);

      // Calculate Vertex 2 (Next Latitude) to create the strip
      let r3 = supershape(lat2, m, n1, n2, n3);
      let x2 = 200 * r1 * cos(lon) * r3 * cos(lat2);
      let y2 = 200 * r1 * sin(lon) * r3 * cos(lat2);
      let z2 = 200 * r3 * sin(lat2);

      vertex(x1, y1, z1);
      vertex(x2, y2, z2);
    }
    endShape();
  }

  angle += 0.01;

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
    saveCanvas('supershape_3d', 'png');
  }
}
