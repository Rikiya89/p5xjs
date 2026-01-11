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

let angle = 0;
let mandalaLayers = [];
let goldenRatio = 1.618033988749895;
let particles = [];

function setup() {
  createCanvas(720, 1280);
  angleMode(DEGREES);

  // Initialize mandala layers
  for (let i = 0; i < 12; i++) {
    mandalaLayers.push({
      radius: 40 + i * 45,
      sides: 6 + i,
      rotationSpeed: 0.15 + i * 0.08,
      color: colors[i % colors.length],
      thickness: 2 - i * 0.1
    });
  }

  // Create glowing particles
  for (let i = 0; i < 60; i++) {
    particles.push(new GlowParticle());
  }
}

function draw() {
  // Multi-layer gradient background
  drawComplexBackground();

  translate(width / 2, height / 2);

  // Draw subtle flower of life grid
  drawFlowerOfLife();

  // Draw seed of life
  drawSeedOfLife();

  // Draw vesica piscis patterns
  drawVesicaPiscis();

  // Draw Sri Yantra inspired pattern
  drawSriYantra();

  // Draw rotating mandalas with glow
  drawEnhancedMandalas();

  // Draw Metatron's cube
  drawMetatronCube();

  // Draw golden spiral
  drawGoldenSpiral();

  // Draw platonic solids projection
  drawPlatonicSolids();

  // Draw glowing particles
  resetMatrix();
  for (let p of particles) {
    p.update();
    p.display();
  }

  angle += 0.25;
}

// Complex gradient background with multiple layers
function drawComplexBackground() {
  push();
  resetMatrix();

  // Base gradient
  for (let i = 0; i < height; i++) {
    let inter = map(i, 0, height, 0, 1);
    let c1 = color(colors[9]);
    let c2 = color(colors[8]);
    let c3 = color(colors[0]);

    let c;
    if (inter < 0.5) {
      c = lerpColor(c1, c2, inter * 2);
    } else {
      c = lerpColor(c2, c3, (inter - 0.5) * 2);
    }

    stroke(c);
    line(0, i, width, i);
  }

  // Add subtle radial glow in center
  noStroke();
  for (let r = 800; r > 0; r -= 10) {
    let alpha = map(r, 0, 800, 25, 0);
    let c = color(colors[6]);
    c.setAlpha(alpha);
    fill(c);
    circle(width/2, height/2, r);
  }

  pop();
}

// Flower of Life pattern
function drawFlowerOfLife() {
  push();
  let spacing = 100;

  for (let y = -height/2 - spacing; y < height/2 + spacing; y += spacing) {
    for (let x = -width/2 - spacing; x < width/2 + spacing; x += spacing) {
      let offsetY = (x / spacing) % 2 === 0 ? 0 : spacing / 2;

      push();
      translate(x, y + offsetY);

      let c = color(colors[2]);
      c.setAlpha(8 + sin(angle + x * 0.1 + y * 0.1) * 3);
      noFill();
      stroke(c);
      strokeWeight(0.5);

      let r = 35;
      for (let i = 0; i < 6; i++) {
        let a = i * 60;
        let cx = cos(a) * r;
        let cy = sin(a) * r;
        circle(cx, cy, r * 2);
      }
      pop();
    }
  }
  pop();
}

// Seed of Life
function drawSeedOfLife() {
  push();

  let pulse = sin(angle * 2) * 5;
  let r = 180 + pulse;

  // Outer glow
  for (let i = 3; i > 0; i--) {
    let c = color(colors[3]);
    c.setAlpha(15 * i);
    stroke(c);
    strokeWeight(3 - i);
    noFill();

    circle(0, 0, r * 2 + i * 20);
    for (let j = 0; j < 6; j++) {
      let a = j * 60;
      let x = cos(a) * r;
      let y = sin(a) * r;
      circle(x, y, r * 2 + i * 20);
    }
  }

  // Main circles
  let c = color(colors[5]);
  c.setAlpha(60);
  stroke(c);
  strokeWeight(1.5);
  noFill();

  circle(0, 0, r * 2);
  for (let i = 0; i < 6; i++) {
    let a = i * 60;
    let x = cos(a) * r;
    let y = sin(a) * r;
    circle(x, y, r * 2);
  }

  pop();
}

// Vesica Piscis patterns
function drawVesicaPiscis() {
  push();
  rotate(angle * 0.4);

  for (let layer = 0; layer < 3; layer++) {
    let r = 150 + layer * 80;

    for (let i = 0; i < 8; i++) {
      let a = i * 45;
      push();
      rotate(a);

      let c = color(colors[(3 + layer) % colors.length]);
      c.setAlpha(30 - layer * 8);
      stroke(c);
      strokeWeight(1);
      noFill();

      // Two overlapping circles
      circle(-r/4, 0, r);
      circle(r/4, 0, r);

      pop();
    }
  }

  pop();
}

// Sri Yantra inspired triangles
function drawSriYantra() {
  push();
  rotate(-angle * 0.3);

  // Upward triangles
  for (let i = 0; i < 5; i++) {
    let size = 100 + i * 60;
    let c = color(colors[(1 + i) % colors.length]);
    c.setAlpha(40);
    stroke(c);
    strokeWeight(1.5);
    noFill();

    push();
    rotate(i * 15);
    drawTriangle(0, -size/3, size);
    pop();
  }

  // Downward triangles
  rotate(angle * 0.6);
  for (let i = 0; i < 4; i++) {
    let size = 120 + i * 55;
    let c = color(colors[(6 + i) % colors.length]);
    c.setAlpha(40);
    stroke(c);
    strokeWeight(1.5);
    noFill();

    push();
    rotate(180 + i * 12);
    drawTriangle(0, -size/3, size);
    pop();
  }

  pop();
}

function drawTriangle(x, y, size) {
  let h = size * sqrt(3) / 2;
  beginShape();
  vertex(x, y - h/2);
  vertex(x - size/2, y + h/2);
  vertex(x + size/2, y + h/2);
  endShape(CLOSE);
}

// Enhanced mandalas with glow
function drawEnhancedMandalas() {
  push();

  for (let layer of mandalaLayers) {
    push();
    rotate(angle * layer.rotationSpeed);

    // Outer glow
    for (let g = 3; g > 0; g--) {
      let c = color(layer.color);
      c.setAlpha(20 * g);
      stroke(c);
      strokeWeight(layer.thickness + g);
      noFill();

      beginShape();
      for (let i = 0; i < layer.sides; i++) {
        let a = (360 / layer.sides) * i;
        let x = cos(a) * (layer.radius + g * 2);
        let y = sin(a) * (layer.radius + g * 2);
        vertex(x, y);
      }
      endShape(CLOSE);
    }

    // Main polygon with gradient effect
    let c = color(layer.color);
    c.setAlpha(100);
    stroke(c);
    strokeWeight(layer.thickness);
    noFill();

    beginShape();
    for (let i = 0; i < layer.sides; i++) {
      let a = (360 / layer.sides) * i;
      let x = cos(a) * layer.radius;
      let y = sin(a) * layer.radius;
      vertex(x, y);
    }
    endShape(CLOSE);

    // Connecting lines with fade
    c.setAlpha(30);
    stroke(c);
    strokeWeight(0.5);
    for (let i = 0; i < layer.sides; i++) {
      let a = (360 / layer.sides) * i;
      let x = cos(a) * layer.radius;
      let y = sin(a) * layer.radius;
      line(0, 0, x, y);
    }

    // Glowing vertices
    for (let g = 2; g > 0; g--) {
      c.setAlpha(80 / g);
      fill(c);
      noStroke();
      for (let i = 0; i < layer.sides; i++) {
        let a = (360 / layer.sides) * i;
        let x = cos(a) * layer.radius;
        let y = sin(a) * layer.radius;
        circle(x, y, 3 + g * 2);
      }
    }

    pop();
  }
  pop();
}

// Golden spiral with enhancement
function drawGoldenSpiral() {
  push();
  rotate(-angle * 0.5);

  // Glow layers
  for (let g = 3; g > 0; g--) {
    let c = color(colors[6]);
    c.setAlpha(15 * g);
    stroke(c);
    strokeWeight(2 + g);
    noFill();

    beginShape();
    for (let i = 0; i < 360; i += 2) {
      let r = 5 * pow(goldenRatio, i / 90);
      if (r > 600) break;
      let x = cos(i) * r;
      let y = sin(i) * r;
      vertex(x, y);
    }
    endShape();
  }

  pop();
}

// Metatron's Cube
function drawMetatronCube() {
  push();
  rotate(angle * 0.35);

  let numCircles = 6;
  let radius = 280;
  let positions = [{x: 0, y: 0}];

  // Outer circles
  for (let i = 0; i < numCircles; i++) {
    let a = (360 / numCircles) * i;
    let x = cos(a) * radius;
    let y = sin(a) * radius;
    positions.push({x: x, y: y});
  }

  // Draw connections
  let c = color(colors[4]);
  c.setAlpha(20);
  stroke(c);
  strokeWeight(0.5);

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      line(positions[i].x, positions[i].y, positions[j].x, positions[j].y);
    }
  }

  // Draw circles with glow
  for (let i = 0; i < positions.length; i++) {
    // Outer glow
    for (let g = 3; g > 0; g--) {
      c = color(colors[i % colors.length]);
      c.setAlpha(20 * g);
      fill(c);
      noStroke();
      circle(positions[i].x, positions[i].y, 50 + g * 15);
    }

    // Main circle
    c = color(colors[i % colors.length]);
    c.setAlpha(80);
    stroke(c);
    strokeWeight(2);
    noFill();
    circle(positions[i].x, positions[i].y, 50);

    c.setAlpha(30);
    fill(c);
    noStroke();
    circle(positions[i].x, positions[i].y, 35);
  }

  pop();
}

// Platonic solids projection
function drawPlatonicSolids() {
  push();
  rotate(angle * 0.6);

  // Icosahedron projection
  let vertices = [];
  let phi = (1 + sqrt(5)) / 2;
  let a = 80;

  vertices.push(createVector(0, a, phi * a));
  vertices.push(createVector(0, a, -phi * a));
  vertices.push(createVector(0, -a, phi * a));
  vertices.push(createVector(0, -a, -phi * a));

  let c = color(colors[7]);
  c.setAlpha(30);
  stroke(c);
  strokeWeight(0.8);

  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      line(vertices[i].x, vertices[i].y, vertices[j].x, vertices[j].y);
    }
  }

  pop();
}

// Glowing particle class
class GlowParticle {
  constructor() {
    this.reset();
    this.y = random(height);
  }

  reset() {
    this.x = random(width);
    this.y = 0;
    this.speed = random(0.5, 2);
    this.size = random(2, 5);
    this.color = color(random(colors));
    this.wobble = random(TWO_PI);
    this.wobbleSpeed = random(0.02, 0.05);
  }

  update() {
    this.y += this.speed;
    this.wobble += this.wobbleSpeed;

    if (this.y > height) {
      this.reset();
    }
  }

  display() {
    let xOffset = sin(this.wobble) * 30;
    let x = this.x + xOffset;

    // Glow effect
    for (let i = 3; i > 0; i--) {
      let c = this.color;
      c.setAlpha(40 / i);
      fill(c);
      noStroke();
      circle(x, this.y, this.size * i * 2);
    }

    // Core
    let c = this.color;
    c.setAlpha(200);
    fill(c);
    circle(x, this.y, this.size);
  }
}
