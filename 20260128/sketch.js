
// Canvas dimensions
const W = 1080;
const H = 1920;

// Recording variables
let encoder = null;
let muxer = null;
let isRecording = false;
let recordingFrameCount = 0;
let recordingStartTime = 0;
let time = 0;
const FPS = 24;
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
const palette = [
  "#362d78", "#523fa3", "#916ccc", "#bda1e5", "#c8c0e9",
  "#84bae7", "#516ad4", "#333f87", "#293039", "#283631"
];

// Mathematical constants
const PHI = (1 + Math.sqrt(5)) / 2;
const SILVER = 1 + Math.sqrt(2);

let mainShader;
let pg;
let particles = [];

function preload() {
  mainShader = loadShader('shader.vert', 'shader.frag');
}

function setup() {
  const canvas = createCanvas(W, H, WEBGL);
  canvas.elt.style.width = 'auto';
  canvas.elt.style.height = '90vh';

  pixelDensity(1);
  frameRate(FPS);

  pg = createGraphics(W, H, WEBGL);
  pg.pixelDensity(1);

  // Particles - faster
  for (let i = 0; i < 60; i++) {
    particles.push({
      angle: random(TWO_PI),
      radius: random(350, 600),
      speed: random(0.008, 0.018),
      z: random(-250, 250),
      zSpeed: random(2.0, 4.0),
      size: random(3, 7),
      colorIdx: floor(random(palette.length)),
      phase: random(TWO_PI)
    });
  }

  document.getElementById('maxDuration').textContent = MAX_DURATION;
}

function draw() {
  pg.background(6, 6, 15);

  // Fast camera movement
  let camAngle = time * 0.25;
  let camRadius = 1000 + 150 * sin(time * 0.18);
  let camX = camRadius * sin(camAngle);
  let camZ = camRadius * cos(camAngle);
  let camY = 200 * sin(time * 0.22);
  pg.camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

  // Dynamic lights
  pg.ambientLight(35, 30, 65);
  pg.pointLight(180, 160, 255, 500 * sin(time * 0.4), 300, 500 * cos(time * 0.4));
  pg.pointLight(100, 180, 255, -400 * cos(time * 0.35), -200, 400 * sin(time * 0.35));

  // Draw layers
  drawFlowingRibbons(pg);
  drawCelticTorusKnot(pg);
  drawTriquetraFlower(pg);
  drawSacredSpirals(pg);
  drawEtherealParticles(pg);
  drawInnerCore(pg);

  // Apply shader
  shader(mainShader);
  mainShader.setUniform('uTexture', pg);
  mainShader.setUniform('uTime', time);
  rect(-width/2, -height/2, width, height);

  time += 0.02;

  if (isRecording) {
    captureFrame();
    recordingFrameCount++;
    document.getElementById('duration').textContent = (recordingFrameCount / FPS).toFixed(1);
    document.getElementById('frameCount').textContent = recordingFrameCount;
    if (recordingFrameCount >= MAX_DURATION * FPS) {
      stopRecording();
    }
  }
}

// Flowing ribbon streams
function drawFlowingRibbons(target) {
  const ribbons = 5;
  const segments = 80;

  for (let r = 0; r < ribbons; r++) {
    let ribbonPhase = (r / ribbons) * TWO_PI;
    let col = color(palette[r % palette.length]);

    target.push();
    target.rotateY(ribbonPhase + time * 0.18);
    target.rotateX(sin(time * 0.25 + ribbonPhase) * 0.25);
    target.noFill();
    target.stroke(col);
    target.strokeWeight(4);

    target.beginShape();
    for (let i = 0; i <= segments; i++) {
      let t = map(i, 0, segments, 0, TWO_PI * 3);

      let k = 5/3;
      let baseR = 250 * cos(k * t);
      let wave = 30 * sin(t * 4 + time * 3 + ribbonPhase);
      let rr = abs(baseR) + wave + 100;

      let x = rr * cos(t);
      let y = rr * sin(t);
      let z = 120 * sin(t * 2 + time * 1.8 + ribbonPhase) * cos(t * 0.5);

      target.curveVertex(x, y, z);
    }
    target.endShape();
    target.pop();
  }
}

// Main Celtic torus knot
function drawCelticTorusKnot(target) {
  const strands = 4;
  const points = 300;

  for (let s = 0; s < strands; s++) {
    let phase = (s / strands) * TWO_PI;
    let col = color(palette[(s + 2) % palette.length]);

    target.push();
    target.rotateZ(time * 0.12);
    target.rotateX(PI * 0.1 + sin(time * 0.2) * 0.15);
    target.noFill();
    target.stroke(col);
    target.strokeWeight(5);

    target.beginShape();
    for (let i = 0; i <= points; i++) {
      let t = map(i, 0, points, 0, TWO_PI * 2);

      let p = 3, q = 7;
      let r1 = 200 + 45 * sin(time * 0.9 + phase);
      let r2 = 80 + 20 * sin(t * SILVER + time * 1.4);

      let phi = p * t + phase;
      let theta = q * t;

      let x = (r1 + r2 * cos(theta)) * cos(phi);
      let y = (r1 + r2 * cos(theta)) * sin(phi);
      let z = r2 * sin(theta) + 42 * sin(t * 8 + time * 2.5);

      let breathe = 1 + 0.06 * sin(time * 0.8 + s);
      target.vertex(x * breathe, y * breathe, z * breathe);
    }
    target.endShape(CLOSE);
    target.pop();
  }
}

// Triquetra flower
function drawTriquetraFlower(target) {
  const petals = 6;
  const points = 100;

  target.push();
  target.rotateY(time * 0.18);
  target.rotateZ(time * 0.14);

  for (let p = 0; p < petals; p++) {
    let petalAngle = (p / petals) * TWO_PI;
    let col = color(palette[(p + 4) % palette.length]);

    target.push();
    target.rotateZ(petalAngle);
    target.noFill();
    target.stroke(col);
    target.strokeWeight(3);

    target.beginShape();
    for (let i = 0; i <= points; i++) {
      let t = map(i, 0, points, 0, TWO_PI);

      let r = 150 * (1 + 0.3 * cos(3 * t));
      let wave = 22 * sin(t * 6 + time * 3.5);

      let x = (r + wave) * cos(t) + 100;
      let y = (r + wave) * sin(t);
      let z = 60 * sin(t * 3 + time * 1.8) * cos(petalAngle + time * 0.9);

      target.vertex(x, y, z);
    }
    target.endShape(CLOSE);
    target.pop();
  }
  target.pop();
}

// Sacred golden spirals
function drawSacredSpirals(target) {
  const numSpirals = 8;

  target.push();
  target.rotateX(PI * 0.15);

  for (let sp = 0; sp < numSpirals; sp++) {
    let spiralPhase = (sp / numSpirals) * TWO_PI;
    let direction = sp % 2 === 0 ? 1 : -1;
    let col = color(palette[sp % palette.length]);

    target.push();
    target.rotateZ(spiralPhase + time * 0.08 * direction);
    target.noFill();
    target.stroke(col);
    target.strokeWeight(2);

    target.beginShape();
    for (let i = 0; i < 80; i++) {
      let theta = i * 0.15 + time * 0.8 * direction;
      let r = 25 * exp(0.12 * theta);

      if (r > 450) break;

      let x = r * cos(theta);
      let y = r * sin(theta);
      let z = 52 * sin(theta * 0.5 + time * 1.4) * (r / 450);

      target.vertex(x, y, z);
    }
    target.endShape();
    target.pop();
  }
  target.pop();
}

// Ethereal floating particles
function drawEtherealParticles(target) {
  target.push();

  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];

    p.angle += p.speed;
    p.z += sin(time * 1.8 + p.phase) * p.zSpeed * 0.6;
    if (p.z > 300) p.z = -300;
    if (p.z < -300) p.z = 300;

    let x = p.radius * cos(p.angle);
    let y = p.radius * sin(p.angle);
    let z = p.z;

    let col = color(palette[p.colorIdx]);
    let alpha = map(abs(z), 0, 300, 255, 80);

    target.stroke(red(col), green(col), blue(col), alpha);
    target.strokeWeight(p.size);
    target.point(x, y, z);
  }
  target.pop();
}

// Glowing inner core
function drawInnerCore(target) {
  target.push();
  target.rotateX(time * 0.28);
  target.rotateY(time * 0.38);
  target.rotateZ(time * 0.18);

  // Core with fast pulse
  let pulse = 1 + 0.12 * sin(time * 3.5);

  target.noStroke();
  target.fill(140, 120, 220, 60);
  target.sphere(80 * pulse);

  target.fill(160, 140, 230, 180);
  target.sphere(40 * pulse);

  // Fast orbiting rings
  for (let r = 0; r < 3; r++) {
    target.push();
    target.rotateX(r * PI / 3 + time * 0.6);
    target.rotateY(r * PI / 4);
    target.noFill();
    target.stroke(palette[r + 3]);
    target.strokeWeight(2);
    target.ellipse(0, 0, 160 + r * 50, 160 + r * 50, 32);
    target.pop();
  }

  target.pop();
}

