// Color palette
const colors = [
  '#362d78',
  '#523fa3',
  '#916ccc',
  '#bda1e5',
  '#c8c0e9',
  '#84bae7',
  '#516ad4',
  '#333f87',
  '#293039',
  '#283631'
];

let angle = 0;
let particles = [];
let orbs = [];
let waves = [];
let goldenRatio = 1.618033988749895;

function setup() {
  createCanvas(720, 1280);
  background('#0a0a0f');

  // Create floating particles
  for (let i = 0; i < 150; i++) {
    particles.push(new Particle());
  }

  // Create glowing orbs
  for (let i = 0; i < 8; i++) {
    orbs.push(new GlowOrb(i));
  }

  // Create wave lines
  for (let i = 0; i < 5; i++) {
    waves.push(new WaveLine(i));
  }

  frameRate(30);
}

function draw() {
  // Darker trail effect
  fill(10, 10, 15, 25);
  noStroke();
  rect(0, 0, width, height);

  translate(width / 2, height / 2);

  // Draw wave lines in background
  for (let wave of waves) {
    wave.update();
    wave.display();
  }

  // Update and draw orbs with glow
  for (let orb of orbs) {
    orb.update();
    orb.display();
  }

  // Rotating sacred geometry layers with breathing effect
  let breathe = sin(angle * 2) * 0.15 + 1;

  // Draw hexagonal kaleidoscope pattern
  push();
  rotate(angle * 0.08);
  drawKaleidoscope(0, 0, 500);
  pop();

  push();
  rotate(angle * 0.3);
  scale(breathe);
  drawFlowerOfLife(0, 0, 100, colors[0], colors[1]);
  pop();

  push();
  rotate(-angle * 0.2);
  scale(1 / breathe);
  drawMetatronsCube(0, 0, 150, colors[2], colors[3]);
  pop();

  push();
  rotate(angle * 0.15);
  scale(breathe * 0.9);
  drawSriYantra(0, 0, 200, colors[4], colors[5]);
  pop();

  push();
  rotate(-angle * 0.25);
  drawSacredSpiral(0, 0, 250, colors[6], colors[7]);
  pop();

  push();
  rotate(angle * 0.1);
  scale(1 / (breathe * 0.95));
  drawPlatonicCircles(0, 0, 300, colors[8], colors[9]);
  pop();

  // Outer pulsing mandala
  push();
  rotate(-angle * 0.05);
  drawPulsingMandala(0, 0, 400 + sin(angle * 3) * 30);
  pop();

  // Draw vesica piscis pattern
  push();
  rotate(angle * 0.12);
  drawVesicaPiscis(0, 0, 180);
  pop();

  // Draw torus field
  push();
  drawTorusField(0, 0, 350);
  pop();

  // Draw connecting lines between orbs
  drawOrbConnections();

  // Update and draw particles
  for (let particle of particles) {
    particle.update();
    particle.display();
  }

  // Draw geometric flowers
  drawGeometricFlowers();

  angle += 0.008;
}

// Wave line system
class WaveLine {
  constructor(index) {
    this.index = index;
    this.yOffset = map(index, 0, 5, -height/2, height/2);
    this.color = colors[index % colors.length];
    this.points = 80;
    this.amplitude = 30 + index * 10;
    this.frequency = 0.02 + index * 0.005;
  }

  update() {
    // No update needed, animation happens in display
  }

  display() {
    push();
    noFill();
    stroke(this.color + '20');
    strokeWeight(1.5);

    beginShape();
    for (let i = 0; i < this.points; i++) {
      let x = map(i, 0, this.points, -width/2, width/2);
      let y = this.yOffset +
              sin(i * this.frequency + angle * 2) * this.amplitude +
              cos(i * this.frequency * 1.5 + angle) * (this.amplitude / 2);
      vertex(x, y);
    }
    endShape();
    pop();
  }
}

// Hexagonal kaleidoscope pattern
function drawKaleidoscope(x, y, radius) {
  noFill();
  strokeWeight(0.5);

  let segments = 6;
  for (let seg = 0; seg < segments; seg++) {
    push();
    rotate(TWO_PI / segments * seg);

    for (let i = 0; i < 8; i++) {
      let r = radius * (i + 1) / 10;
      let offset = sin(angle * 3 + i * 0.5) * 20;

      stroke(colors[i % colors.length] + '15');

      beginShape();
      for (let a = 0; a < TWO_PI / segments; a += 0.1) {
        let ripple = sin(a * 5 + angle * 4 + i) * 5;
        let px = cos(a) * (r + offset + ripple);
        let py = sin(a) * (r + offset + ripple);
        vertex(px, py);
      }
      endShape();
    }
    pop();
  }
}

// Vesica Piscis (sacred geometry)
function drawVesicaPiscis(x, y, size) {
  noFill();
  strokeWeight(1);

  let numLayers = 8;
  for (let i = 0; i < numLayers; i++) {
    let s = size * (1 - i * 0.08);
    let offset = s / 2;
    let opacity = map(sin(angle * 2 + i * 0.4), -1, 1, 30, 70);

    stroke(colors[i % colors.length] + hex(floor(opacity), 2));

    // Left circle
    circle(x - offset, y, s);
    // Right circle
    circle(x + offset, y, s);

    // Draw the vesica (intersection)
    push();
    strokeWeight(1.5);
    stroke(colors[(i + 3) % colors.length] + hex(floor(opacity * 1.2), 2));

    let startAngle = -PI / 3;
    let endAngle = PI / 3;
    arc(x - offset, y, s, s, startAngle, endAngle);
    arc(x + offset, y, s, s, PI - endAngle, PI - startAngle);
    pop();
  }
}

// Torus field energy pattern
function drawTorusField(x, y, radius) {
  noFill();
  strokeWeight(0.5);

  let rings = 20;
  for (let i = 0; i < rings; i++) {
    let progress = i / rings;
    let r = radius * progress;
    let z = sin(progress * PI) * 100;
    let opacity = map(sin(angle * 2 + i * 0.3), -1, 1, 10, 40);

    stroke(colors[i % 4] + hex(floor(opacity), 2));

    push();
    scale(1, 0.5); // Flatten for perspective

    // Top half of torus
    let topY = y - z;
    ellipse(x, topY, r * 2, r * 0.8);

    // Bottom half
    let bottomY = y + z;
    ellipse(x, bottomY, r * 2, r * 0.8);
    pop();
  }

  // Energy flow lines
  for (let i = 0; i < 12; i++) {
    let a = (TWO_PI / 12) * i;
    let flowOffset = angle * 2 + i * 0.5;

    stroke(colors[i % colors.length] + '20');
    strokeWeight(1);

    beginShape();
    for (let t = 0; t < TWO_PI; t += 0.2) {
      let r = radius * sin(t) * 0.8;
      let px = x + cos(a) * r;
      let py = y + sin(t + flowOffset) * 80;
      vertex(px, py);
    }
    endShape();
  }
}

// Geometric flowers scattered around
function drawGeometricFlowers() {
  let numFlowers = 6;

  for (let i = 0; i < numFlowers; i++) {
    let flowerAngle = (TWO_PI / numFlowers) * i + angle * 0.3;
    let distance = 420 + sin(angle * 2 + i) * 40;
    let fx = cos(flowerAngle) * distance;
    let fy = sin(flowerAngle) * distance;

    push();
    translate(fx, fy);
    rotate(angle * 0.5 + i);

    let petals = 8;
    let petalSize = 25 + sin(angle * 3 + i) * 8;

    noFill();
    strokeWeight(1);

    for (let p = 0; p < petals; p++) {
      let pa = (TWO_PI / petals) * p;

      push();
      rotate(pa);

      stroke(colors[(i + p) % colors.length] + '50');

      beginShape();
      for (let a = 0; a < PI; a += 0.1) {
        let r = sin(a) * petalSize;
        let px = cos(a) * r;
        let py = sin(a) * r * 1.5;
        vertex(px, py);
      }
      endShape();
      pop();
    }

    // Flower center
    fill(colors[i % colors.length] + '80');
    noStroke();
    circle(0, 0, 8);

    pop();
  }
}

// Particle system
class Particle {
  constructor() {
    this.reset();
    this.y = random(-height/2, height/2);
  }

  reset() {
    this.x = random(-width/2, width/2);
    this.y = -height/2 - 20;
    this.z = random(1, 3);
    this.speed = random(0.5, 2);
    this.color = random(colors);
    this.size = random(1, 3);
    this.alpha = random(100, 200);
  }

  update() {
    this.y += this.speed * this.z;
    this.x += sin(angle + this.y * 0.01) * 0.5;

    if (this.y > height/2 + 20) {
      this.reset();
    }
  }

  display() {
    push();
    noStroke();
    fill(this.color + hex(floor(this.alpha), 2));
    circle(this.x, this.y, this.size * this.z);

    // Glow effect
    for (let i = 3; i > 0; i--) {
      fill(this.color + hex(floor(this.alpha / (i * 3)), 2));
      circle(this.x, this.y, this.size * this.z + i * 4);
    }
    pop();
  }
}

// Glowing orb system
class GlowOrb {
  constructor(index) {
    this.angle = (TWO_PI / 8) * index;
    this.distance = 200;
    this.size = random(15, 30);
    this.color = colors[index % colors.length];
    this.speed = random(0.002, 0.005);
    this.offset = random(TWO_PI);
  }

  update() {
    this.angle += this.speed;
    this.distance = 200 + sin(angle * 3 + this.offset) * 50;
    this.size = 20 + sin(angle * 4 + this.offset) * 10;
  }

  display() {
    let x = cos(this.angle) * this.distance;
    let y = sin(this.angle) * this.distance;

    push();
    // Multiple glow layers
    for (let i = 5; i > 0; i--) {
      noStroke();
      fill(this.color + hex(floor(30 / i), 2));
      circle(x, y, this.size + i * 8);
    }
    // Core
    fill(this.color + 'dd');
    circle(x, y, this.size);
    pop();
  }
}

// Draw connections between orbs
function drawOrbConnections() {
  stroke(colors[5] + '15');
  strokeWeight(1);

  for (let i = 0; i < orbs.length; i++) {
    for (let j = i + 1; j < orbs.length; j++) {
      let x1 = cos(orbs[i].angle) * orbs[i].distance;
      let y1 = sin(orbs[i].angle) * orbs[i].distance;
      let x2 = cos(orbs[j].angle) * orbs[j].distance;
      let y2 = sin(orbs[j].angle) * orbs[j].distance;

      let d = dist(x1, y1, x2, y2);
      if (d < 200) {
        let alpha = map(d, 0, 200, 50, 5);
        stroke(colors[3] + hex(floor(alpha), 2));
        line(x1, y1, x2, y2);
      }
    }
  }
}

// Pulsing outer mandala
function drawPulsingMandala(cx, cy, radius) {
  noFill();
  strokeWeight(1);

  let petals = 12;
  for (let i = 0; i < petals; i++) {
    let a = (TWO_PI / petals) * i;
    let petalSize = 80 + sin(a * 4 + frameCount * 0.05) * 20;

    stroke(colors[i % colors.length] + '30');

    push();
    rotate(a);
    translate(radius / 2, 0);

    beginShape();
    for (let ang = 0; ang < TWO_PI; ang += 0.2) {
      let r = petalSize + sin(ang * 3) * 15;
      let px = cos(ang) * r / 3;
      let py = sin(ang) * r / 2;
      vertex(px, py);
    }
    endShape(CLOSE);
    pop();
  }
}

// Enhanced Flower of Life with animation
function drawFlowerOfLife(x, y, radius, col1, col2) {
  let r = radius / 3;
  noFill();
  strokeWeight(1.5);

  // Animated center circle
  let pulseSize = sin(angle * 5) * 5;
  stroke(col1 + '80');
  circle(x, y, r * 2 + pulseSize);

  // Six surrounding circles with rotation
  for (let i = 0; i < 6; i++) {
    let a = TWO_PI / 6 * i + angle;
    let px = x + cos(a) * r;
    let py = y + sin(a) * r;
    let opacity = map(sin(angle * 3 + i), -1, 1, 40, 90);
    stroke(col2 + hex(floor(opacity), 2));
    circle(px, py, r * 2);
  }

  // Outer rings
  stroke(col1 + '60');
  circle(x, y, r * 4);
  stroke(col1 + '30');
  circle(x, y, r * 5);
}

// Enhanced Metatron's Cube
function drawMetatronsCube(x, y, size, col1, col2) {
  let r = size / 4;
  let points = [];

  points.push({x: x, y: y});

  for (let i = 0; i < 6; i++) {
    let a = TWO_PI / 6 * i;
    points.push({
      x: x + cos(a) * r,
      y: y + sin(a) * r
    });
  }

  for (let i = 0; i < 6; i++) {
    let a = TWO_PI / 6 * i + PI / 6;
    points.push({
      x: x + cos(a) * r * 2,
      y: y + sin(a) * r * 2
    });
  }

  // Animated connections
  strokeWeight(0.5);
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      let d = dist(points[i].x, points[i].y, points[j].x, points[j].y);
      let opacity = map(sin(angle * 2 + d * 0.1), -1, 1, 20, 50);
      stroke(col1 + hex(floor(opacity), 2));
      line(points[i].x, points[i].y, points[j].x, points[j].y);
    }
  }

  // Glowing circles
  noFill();
  strokeWeight(1);
  for (let i = 0; i < points.length; i++) {
    let opacity = map(sin(angle * 4 + i * 0.5), -1, 1, 40, 80);
    stroke(col2 + hex(floor(opacity), 2));
    circle(points[i].x, points[i].y, r / 2);
  }
}

// Enhanced Sri Yantra
function drawSriYantra(x, y, size, col1, col2) {
  noFill();
  strokeWeight(1.5);

  let numTriangles = 9;
  for (let i = 0; i < numTriangles; i++) {
    let s = size * (1 - i * 0.08);
    let offset = i % 2 === 0 ? 0 : PI;
    let wobble = sin(angle * 2 + i) * 0.05;

    let opacity = map(sin(angle * 3 + i * 0.3), -1, 1, 50, 80);
    stroke(i % 2 === 0 ? col1 + hex(floor(opacity), 2) : col2 + hex(floor(opacity), 2));

    push();
    rotate(offset + wobble);
    beginShape();
    for (let j = 0; j < 3; j++) {
      let a = TWO_PI / 3 * j - PI / 2;
      let px = x + cos(a) * s / 2;
      let py = y + sin(a) * s / 2;
      vertex(px, py);
    }
    endShape(CLOSE);
    pop();
  }

  // Pulsing outer circles
  stroke(col1 + '40');
  circle(x, y, size + sin(angle * 4) * 10);
  stroke(col1 + '20');
  circle(x, y, size * 1.2 + cos(angle * 3) * 15);
}

// Animated Golden Spiral
function drawSacredSpiral(x, y, size, col1, col2) {
  noFill();
  strokeWeight(2);

  let points = 120;
  let maxRadius = size / 2;

  // Main spiral with gradient
  for (let i = 0; i < points - 1; i++) {
    let a = i * 0.2 + angle;
    let radius = (i / points) * maxRadius;
    let px1 = x + cos(a) * radius;
    let py1 = y + sin(a) * radius;

    let a2 = (i + 1) * 0.2 + angle;
    let radius2 = ((i + 1) / points) * maxRadius;
    let px2 = x + cos(a2) * radius2;
    let py2 = y + sin(a2) * radius2;

    let opacity = map(i, 0, points, 80, 30);
    stroke(col1 + hex(floor(opacity), 2));
    line(px1, py1, px2, py2);
  }

  // Pulsing Fibonacci circles
  strokeWeight(1);
  let fib = [1, 1, 2, 3, 5, 8, 13, 21];
  for (let i = 0; i < fib.length; i++) {
    let r = fib[i] * 5 + sin(angle * 3 + i) * 3;
    let opacity = map(sin(angle * 2 + i * 0.5), -1, 1, 30, 60);
    stroke(col2 + hex(floor(opacity), 2));
    circle(x, y, r);
  }
}

// Enhanced Platonic Circles
function drawPlatonicCircles(x, y, radius, col1, col2) {
  noFill();
  strokeWeight(0.8);

  let layers = 15;
  for (let i = 0; i < layers; i++) {
    let numPoints = 3 + i;
    let r = radius * (i + 1) / layers;
    let rotation = angle * (i % 2 === 0 ? 0.5 : -0.5);

    let opacity = map(sin(angle * 2 + i * 0.2), -1, 1, 15, 40);
    stroke(i % 2 === 0 ? col1 + hex(floor(opacity), 2) : col2 + hex(floor(opacity), 2));

    push();
    rotate(rotation);
    beginShape();
    for (let j = 0; j <= numPoints; j++) {
      let a = TWO_PI / numPoints * j;
      let px = x + cos(a) * r;
      let py = y + sin(a) * r;
      vertex(px, py);
    }
    endShape(CLOSE);
    pop();
  }
}

// Press any key to save
function keyPressed() {
  saveCanvas('sacred-geometry-animated', 'png');
}
