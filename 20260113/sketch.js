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

let particles = [];
const numParticles = 600;
let time = 0;
let colorObjects = [];
let flowField = [];
let ribbons = [];

// Recording variables
let capturer = null;
let isRecording = false;
let recordingFrameCount = 0;
const FPS = 60;
const MAX_DURATION = 15; // seconds
const MAX_FRAMES = FPS * MAX_DURATION;

// Initialize capturer
function initCapturer() {
  capturer = new CCapture({
    format: 'webm',
    framerate: FPS,
    verbose: true,
    name: '3d_generative_art',
    quality: 95
  });
}

// Start recording
function startRecording() {
  initCapturer();
  isRecording = true;
  recordingFrameCount = 0;
  time = 0; // Reset animation
  capturer.start();

  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('status').textContent = 'Recording...';
  document.getElementById('status').style.color = '#ff6b6b';
}

// Stop recording
function stopRecording() {
  if (capturer && isRecording) {
    isRecording = false;
    capturer.stop();
    capturer.save();

    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('status').textContent = 'Saving video... (please wait)';
    document.getElementById('status').style.color = '#84bae7';

    setTimeout(() => {
      document.getElementById('status').textContent = 'Ready';
    }, 3000);
  }
}

function setup() {
  createCanvas(720, 1280, WEBGL);

  // Pre-convert colors
  for (let c of colors) {
    colorObjects.push(color(c));
  }

  // Initialize particles
  for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle(i));
  }

  // Initialize flowing ribbons
  for (let i = 0; i < 8; i++) {
    ribbons.push(new Ribbon(i));
  }
}

function draw() {
  background(18, 15, 35);

  // Soft colored lighting
  ambientLight(40, 35, 60);
  directionalLight(120, 100, 160, 0.5, 0.5, -1);
  pointLight(150, 120, 180, 0, -300, 400);
  pointLight(80, 100, 160, 300, 200, -200);

  // Smooth camera movement with easing
  let targetCamX = sin(time * 0.08) * 500;
  let targetCamY = cos(time * 0.12) * 250 + sin(time * 0.05) * 100;
  let targetCamZ = 750 + sin(time * 0.06) * 150;
  camera(targetCamX, targetCamY, targetCamZ, 0, 0, 0, 0, 1, 0);

  // Draw central morphing structure
  drawMorphingCore();

  // Draw flowing ribbons
  for (let ribbon of ribbons) {
    ribbon.update();
    ribbon.display();
  }

  // Draw spiral galaxy
  drawSpiralGalaxy();

  // Draw particles
  for (let p of particles) {
    p.update();
    p.display();
  }

  // Draw floating rings
  drawFloatingRings();

  time += 0.008;

  // Capture frame if recording
  if (isRecording && capturer) {
    capturer.capture(document.querySelector('canvas'));
    recordingFrameCount++;

    // Update UI
    document.getElementById('frameCount').textContent = recordingFrameCount;
    document.getElementById('duration').textContent = (recordingFrameCount / FPS).toFixed(1);

    // Auto-stop at max duration
    if (recordingFrameCount >= MAX_FRAMES) {
      stopRecording();
    }
  }
}

// Morphing core - transitions between shapes
function drawMorphingCore() {
  push();
  rotateX(time * 0.2);
  rotateY(time * 0.3);
  rotateZ(time * 0.1);

  let morphPhase = (sin(time * 0.5) + 1) * 0.5; // 0 to 1
  let segments = 200;
  let radius = 80;

  for (let i = 0; i < segments; i++) {
    let t = map(i, 0, segments, 0, TWO_PI * 3);

    // Morph between torus knot and spherical harmonics
    let p = 2, q = 5;

    // Torus knot coordinates
    let r1 = radius * (0.6 + 0.4 * cos(q * t));
    let x1 = r1 * cos(p * t);
    let y1 = r1 * sin(p * t);
    let z1 = radius * 0.5 * sin(q * t);

    // Spherical harmonics coordinates
    let theta = t;
    let phi = t * 2;
    let r2 = radius * (1 + 0.5 * sin(4 * theta) * sin(3 * phi));
    let x2 = r2 * sin(theta) * cos(phi);
    let y2 = r2 * sin(theta) * sin(phi);
    let z2 = r2 * cos(theta);

    // Morph between shapes
    let x = lerp(x1, x2, morphPhase);
    let y = lerp(y1, y2, morphPhase);
    let z = lerp(z1, z2, morphPhase);

    // Add breathing effect
    let breathe = 1 + sin(time * 2 + t * 0.5) * 0.15;
    x *= breathe;
    y *= breathe;
    z *= breathe;

    // Color flows along the shape
    let colorT = (t / (TWO_PI * 3) + time * 0.2) % 1;
    let colorIndex = floor(colorT * (colorObjects.length - 1));
    let nextIndex = (colorIndex + 1) % colorObjects.length;
    let c = lerpColor(colorObjects[colorIndex], colorObjects[nextIndex], (colorT * (colorObjects.length - 1)) % 1);

    let size = 5 + sin(t * 6 + time * 4) * 2;

    push();
    translate(x, y, z);
    noStroke();
    ambientMaterial(c);
    specularMaterial(red(c) * 0.2, green(c) * 0.2, blue(c) * 0.2);
    shininess(3);
    sphere(size);
    pop();
  }
  pop();
}

// Flowing ribbon class
class Ribbon {
  constructor(index) {
    this.index = index;
    this.segments = 80;
    this.points = [];
    this.baseAngle = (index / 8) * TWO_PI;
    this.radius = 180 + index * 25;
    this.speed = 0.3 + index * 0.05;
    this.colorStart = index % colorObjects.length;

    // Initialize ribbon points
    for (let i = 0; i < this.segments; i++) {
      this.points.push({ x: 0, y: 0, z: 0 });
    }
  }

  update() {
    for (let i = 0; i < this.segments; i++) {
      let t = map(i, 0, this.segments, 0, TWO_PI * 2);
      let timeOffset = time * this.speed + this.baseAngle;

      // 3D Lissajous-like curve with noise
      let nx = noise(i * 0.05, this.index, time * 0.3);
      let ny = noise(i * 0.05 + 100, this.index, time * 0.3);
      let nz = noise(i * 0.05 + 200, this.index, time * 0.3);

      let a = 3 + sin(time * 0.5) * 0.5;
      let b = 2 + cos(time * 0.4) * 0.5;
      let c = 4 + sin(time * 0.3) * 0.5;

      this.points[i].x = this.radius * cos(a * t + timeOffset) * (0.8 + nx * 0.4);
      this.points[i].y = this.radius * 0.6 * sin(b * t + timeOffset * 1.3) * (0.8 + ny * 0.4);
      this.points[i].z = this.radius * 0.4 * sin(c * t + timeOffset * 0.7) * (0.8 + nz * 0.4);

      // Add wave motion
      this.points[i].x += sin(t * 3 + time * 2) * 20;
      this.points[i].y += cos(t * 2 + time * 1.5) * 15;
    }
  }

  display() {
    push();
    rotateY(this.baseAngle * 0.3);
    rotateX(sin(time * 0.2 + this.index) * 0.2);

    for (let i = 0; i < this.segments; i++) {
      let p = this.points[i];

      // Color gradient along ribbon
      let colorT = (i / this.segments + time * 0.1) % 1;
      let colorIndex = floor((this.colorStart + colorT * 4) % colorObjects.length);
      let nextIndex = (colorIndex + 1) % colorObjects.length;
      let blend = (colorT * 4) % 1;
      let c = lerpColor(colorObjects[colorIndex], colorObjects[nextIndex], blend);

      // Size varies along ribbon - thicker in middle
      let sizeMod = sin(map(i, 0, this.segments, 0, PI));
      let size = 3 + sizeMod * 4 + sin(i * 0.3 + time * 3) * 1.5;

      push();
      translate(p.x, p.y, p.z);
      noStroke();
      ambientMaterial(c);
      sphere(size);
      pop();
    }
    pop();
  }
}

// Spiral galaxy effect
function drawSpiralGalaxy() {
  push();
  rotateX(PI * 0.15);
  rotateY(time * 0.05);

  let arms = 3;
  let pointsPerArm = 120;
  let maxRadius = 350;

  for (let arm = 0; arm < arms; arm++) {
    let armOffset = (arm / arms) * TWO_PI;

    for (let i = 0; i < pointsPerArm; i++) {
      let t = map(i, 0, pointsPerArm, 0, 1);
      let radius = t * maxRadius;

      // Spiral equation with golden angle
      let angle = armOffset + t * TWO_PI * 3 + time * 0.3;

      // Add noise for organic feel
      let noiseVal = noise(arm * 10 + i * 0.02, time * 0.2);
      angle += noiseVal * 0.5;
      radius += noiseVal * 30;

      let x = cos(angle) * radius;
      let z = sin(angle) * radius;
      let y = sin(t * PI * 2 + time + arm) * 30 * t; // Wave height

      // Color based on distance from center
      let colorT = (t + time * 0.05 + arm * 0.33) % 1;
      let colorIndex = floor(colorT * (colorObjects.length - 1));
      let c = colorObjects[colorIndex];

      // Fade out at edges
      let alpha = map(t, 0.7, 1, 1, 0.3);
      let size = (2 + (1 - t) * 3) * alpha;

      if (size > 0.5) {
        push();
        translate(x, y, z);
        noStroke();
        ambientMaterial(c);
        sphere(size);
        pop();
      }
    }
  }
  pop();
}

// Floating rings with wave motion
function drawFloatingRings() {
  for (let ring = 0; ring < 4; ring++) {
    push();

    let ringTime = time + ring * 0.5;
    let yOffset = sin(ringTime * 0.8) * 150;

    translate(0, yOffset, 0);
    rotateX(PI * 0.5 + sin(ringTime * 0.3) * 0.3);
    rotateZ(ringTime * 0.2);

    let radius = 200 + ring * 60;
    let segments = 60;

    for (let i = 0; i < segments; i++) {
      let angle = map(i, 0, segments, 0, TWO_PI);

      // Wobble effect
      let wobble = sin(angle * 3 + ringTime * 2) * 15;
      let r = radius + wobble;

      let x = cos(angle) * r;
      let z = sin(angle) * r;
      let y = sin(angle * 4 + ringTime * 3) * 10;

      // Color cycles around ring
      let colorIndex = floor((i / segments * colorObjects.length + ring * 2 + time * 0.5) % colorObjects.length);
      let c = colorObjects[colorIndex];

      let size = 4 + sin(angle * 6 + ringTime * 4) * 2;

      push();
      translate(x, y, z);
      noStroke();
      ambientMaterial(c);
      sphere(size);
      pop();
    }
    pop();
  }
}

// Particle class with swarm behavior
class Particle {
  constructor(index) {
    this.index = index;
    this.reset();
  }

  reset() {
    this.phi = random(TWO_PI);
    this.theta = random(PI);
    this.targetRadius = random(280, 420);
    this.radius = this.targetRadius;
    this.speed = random(0.008, 0.025);
    this.noiseOffset = random(1000);
    this.size = random(2, 5);
    this.colorIndex = floor(random(colorObjects.length));

    this.freqA = random(1, 3);
    this.freqB = random(1, 3);
    this.phaseOffset = random(TWO_PI);
  }

  update() {
    // Smooth organic movement
    let noiseX = noise(this.noiseOffset, time * 0.5);
    let noiseY = noise(this.noiseOffset + 100, time * 0.5);

    this.phi += this.speed * (0.5 + noiseX);
    this.theta += sin(time * 0.3 + this.phaseOffset) * 0.008 * noiseY;

    // Pulsing radius
    this.radius = this.targetRadius + sin(time * this.freqA + this.index * 0.05) * 50;

    // Slowly shift color
    if (random() < 0.001) {
      this.colorIndex = (this.colorIndex + 1) % colorObjects.length;
    }
  }

  display() {
    // Spherical coordinates with distortion
    let r = this.radius * (1 + 0.2 * sin(this.freqB * this.theta + time));

    let x = r * sin(this.theta) * cos(this.phi);
    let y = r * sin(this.theta) * sin(this.phi);
    let z = r * cos(this.theta);

    // Add flowing wave distortion
    x += sin(time * 1.5 + this.theta * 2) * 25;
    y += cos(time * 1.2 + this.phi * 2) * 25;
    z += sin(time + this.theta + this.phi) * 20;

    let c = colorObjects[this.colorIndex];

    // Blend with adjacent color for variety
    let nextColor = colorObjects[(this.colorIndex + 1) % colorObjects.length];
    let blend = (sin(time + this.index * 0.1) + 1) * 0.5;
    c = lerpColor(c, nextColor, blend * 0.5);

    push();
    translate(x, y, z);
    noStroke();
    ambientMaterial(c);
    let pulsedSize = this.size + sin(time * 2.5 + this.index * 0.5) * 1.5;
    sphere(pulsedSize);
    pop();
  }
}

function mousePressed() {
  // Trigger visual burst
  for (let p of particles) {
    p.targetRadius = random(200, 500);
    p.freqA = random(1, 4);
    p.freqB = random(1, 4);
  }
  for (let r of ribbons) {
    r.speed = random(0.2, 0.6);
  }
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('3d_generative_art', 'png');
  }
  // R to toggle recording
  if (key === 'r' || key === 'R') {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }
}
