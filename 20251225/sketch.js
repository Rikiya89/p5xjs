// 3D Generative Art - Circular Measure (Enhanced)
// Theme: Black and White
// Size: 720 x 1280

let time = 0;
let layers = [];
let numLayers = 10;
let rotationSpeed = 0.002;
let particles = [];

function setup() {
  createCanvas(720, 1280, WEBGL);
  frameRate(30);
  smooth();

  // Create multiple circular measurement layers
  for (let i = 0; i < numLayers; i++) {
    layers.push({
      radius: map(i, 0, numLayers - 1, 80, 420),
      segments: 12 + i * 2,
      offset: random(TWO_PI),
      rotSpeed: random(-0.015, 0.015),
      zPos: map(i, 0, numLayers - 1, -280, 280),
      thickness: map(i, 0, numLayers - 1, 2.5, 0.8),
      rings: 2,
      pulsePhase: random(TWO_PI)
    });
  }

  // Create orbital particles
  for (let i = 0; i < 30; i++) {
    particles.push({
      angle: random(TWO_PI),
      radius: random(100, 400),
      speed: random(0.002, 0.008),
      size: random(2, 5),
      zOffset: random(-200, 200),
      orbitTilt: random(-0.3, 0.3)
    });
  }
}

function draw() {
  background(0);

  // Enhanced lighting with pulsing effect
  let pulseLight = 100 + sin(time * 0.05) * 20;
  ambientLight(pulseLight);
  pointLight(255, 255, 255,
    sin(time * 0.01) * 300,
    cos(time * 0.01) * 300,
    400);
  pointLight(200, 200, 200, -200, -200, -200);

  // Dynamic camera with smooth motion
  let camX = sin(time * 0.0015) * 120;
  let camY = cos(time * 0.001) * 60 - 50;
  let camZ = 580 + sin(time * 0.002) * 30;
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

  // Main rotation
  push();
  rotateY(time * rotationSpeed);
  rotateX(sin(time * 0.0008) * 0.25);
  rotateZ(cos(time * 0.0006) * 0.1);

  // Draw particles in orbit
  drawOrbitalParticles();

  // Draw circular measurement structures
  for (let i = 0; i < layers.length; i++) {
    drawCircularMeasure(layers[i], time, i);
  }

  // Draw connecting spirals between layers
  drawConnectingSpirals();

  pop();

  // Draw enhanced central axis with glow
  drawCentralAxis();

  time++;
}

function drawOrbitalParticles() {
  for (let p of particles) {
    push();

    p.angle += p.speed;
    let x = cos(p.angle) * p.radius;
    let y = sin(p.angle) * p.radius * 0.7;
    let z = p.zOffset + sin(p.angle * 3) * 50;

    translate(x, y, z);

    // Glowing particles
    fill(255, 200);
    noStroke();
    sphere(p.size);

    // Particle trail effect
    stroke(255, 100);
    strokeWeight(1);
    let trailX = cos(p.angle - 0.3) * p.radius;
    let trailY = sin(p.angle - 0.3) * p.radius * 0.7;
    let trailZ = p.zOffset + sin((p.angle - 0.3) * 3) * 50;
    line(0, 0, 0, trailX - x, trailY - y, trailZ - z);

    pop();
  }
}

function drawCircularMeasure(layer, t, index) {
  push();
  translate(0, 0, layer.zPos);
  rotateZ(t * layer.rotSpeed + layer.offset);

  // Pulsing effect for radius
  let pulse = 1 + sin(t * 0.02 + layer.pulsePhase) * 0.03;

  // Draw concentric measurement rings with enhanced detail
  for (let ring = 0; ring < layer.rings; ring++) {
    let r = layer.radius * (1 - ring * 0.3) * pulse;
    let alpha = 220 - ring * 60 - index * 8;

    // Main circle with wave distortion
    noFill();
    stroke(255, alpha);
    strokeWeight(layer.thickness);

    beginShape();
    for (let a = 0; a < TWO_PI; a += 0.15) {
      let waveOffset = sin(a * 5 + t * 0.03) * 12 + cos(a * 3 - t * 0.02) * 8;
      let x = cos(a) * r;
      let y = sin(a) * r;
      let z = waveOffset;
      vertex(x, y, z);
    }
    endShape(CLOSE);

    // Secondary harmonic circle
    stroke(255, alpha * 0.4);
    strokeWeight(layer.thickness * 0.5);
    beginShape();
    for (let a = 0; a < TWO_PI; a += 0.2) {
      let waveOffset = sin(a * 8 - t * 0.025) * 6;
      let x = cos(a) * r * 0.92;
      let y = sin(a) * r * 0.92;
      let z = waveOffset;
      vertex(x, y, z);
    }
    endShape(CLOSE);

    // Enhanced measurement markers
    for (let j = 0; j < layer.segments; j++) {
      let angle = map(j, 0, layer.segments, 0, TWO_PI);
      let waveZ = sin(angle * 5 + t * 0.03) * 12;

      // Radial lines with varying lengths
      stroke(255, alpha * 0.8);
      strokeWeight(layer.thickness * 0.6);

      let lengthMod = 1 + sin(t * 0.02 + j) * 0.1;
      let x1 = cos(angle) * r * 0.82;
      let y1 = sin(angle) * r * 0.82;
      let x2 = cos(angle) * r * (1.12 * lengthMod);
      let y2 = sin(angle) * r * (1.12 * lengthMod);

      line(x1, y1, waveZ, x2, y2, waveZ);

      // Degree markers with variety
      if (ring === 0) {
        if (j % 4 === 0) {
          // Major markers - larger spheres
          push();
          translate(cos(angle) * r, sin(angle) * r, waveZ);
          fill(255);
          noStroke();
          sphere(4);
          pop();
        } else if (j % 2 === 0) {
          // Minor markers - smaller spheres
          push();
          translate(cos(angle) * r, sin(angle) * r, waveZ);
          fill(255, 180);
          noStroke();
          sphere(2);
          pop();
        }
      }
    }
  }

  // Enhanced central hub with glow
  push();
  fill(255, 240);
  noStroke();
  sphere(layer.radius * 0.1 * pulse);

  // Glow effect
  fill(255, 100);
  sphere(layer.radius * 0.14 * pulse);
  pop();

  // Outer protractor ticks with improved distribution
  for (let angle = 0; angle < TWO_PI; angle += PI / 24) {
    let isMajor = angle % (PI / 6) < 0.01;
    let tickLength = isMajor ? 25 : 12;
    let innerR = layer.radius * pulse * 1.18;
    let outerR = innerR + tickLength;

    stroke(255, isMajor ? 220 : 120);
    strokeWeight(isMajor ? 2.5 : 1.2);

    let x1 = cos(angle) * innerR;
    let y1 = sin(angle) * innerR;
    let x2 = cos(angle) * outerR;
    let y2 = sin(angle) * outerR;

    line(x1, y1, 0, x2, y2, 0);

    // Add caps to major ticks
    if (isMajor) {
      push();
      translate(x2, y2, 0);
      fill(255, 180);
      noStroke();
      sphere(2);
      pop();
    }
  }

  pop();
}

function drawConnectingSpirals() {
  // Draw elegant spirals connecting the layers
  for (let i = 0; i < 3; i++) {
    push();
    rotateY(time * 0.001 + i * TWO_PI / 3);

    noFill();
    stroke(255, 80);
    strokeWeight(0.8);

    beginShape();
    for (let t = 0; t < TWO_PI * 3; t += 0.2) {
      let r = 50 + t * 30;
      let x = cos(t) * r;
      let y = sin(t) * r;
      let z = map(t, 0, TWO_PI * 3, -280, 280);
      vertex(x, y, z);
    }
    endShape();
    pop();
  }
}

function drawCentralAxis() {
  // Main axis with gradient effect
  push();
  for (let i = 0; i < 5; i++) {
    stroke(255, 200 - i * 35);
    strokeWeight(3 - i * 0.5);
    line(0, -450, 0, 0, 450, 0);
  }
  pop();

  // Axis markers
  for (let y = -400; y <= 400; y += 100) {
    push();
    translate(0, y, 0);
    fill(255, 150);
    noStroke();
    sphere(3);

    // Ring markers
    rotateX(HALF_PI);
    noFill();
    stroke(255, 100);
    strokeWeight(1);
    circle(0, 0, 30);
    pop();
  }
}

// Mouse interaction - change rotation direction
function mousePressed() {
  rotationSpeed *= -1;
  rotationSpeed += random(-0.001, 0.001);
}

// Save frame
function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('circular_measure_enhanced', 'png');
  }
}
