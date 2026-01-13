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
let stars = [];
let energyWaves = [];
let auroraOffset = 0;

function setup() {
  createCanvas(720, 1280);
  angleMode(DEGREES);
  colorMode(RGB);

  // Initialize mandala layers with more variety
  for (let i = 0; i < 12; i++) {
    mandalaLayers.push({
      radius: 40 + i * 45,
      sides: 6 + i,
      rotationSpeed: 0.15 + i * 0.08,
      color: colors[i % colors.length],
      thickness: 2 - i * 0.1,
      phase: random(360)
    });
  }

  // Create glowing particles
  for (let i = 0; i < 80; i++) {
    particles.push(new GlowParticle());
  }

  // Create twinkling stars
  for (let i = 0; i < 150; i++) {
    stars.push(new TwinklingStar());
  }

  // Create energy waves
  for (let i = 0; i < 5; i++) {
    energyWaves.push({
      radius: 0,
      maxRadius: 800,
      speed: 0.8 + i * 0.2,
      delay: i * 80,
      color: colors[i % colors.length]
    });
  }
}

function draw() {
  // Multi-layer gradient background
  drawComplexBackground();

  // Draw twinkling stars
  for (let star of stars) {
    star.update();
    star.display();
  }

  // Draw aurora effect
  drawAurora();

  translate(width / 2, height / 2);

  // Draw energy waves emanating from center
  drawEnergyWaves();

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

  // Draw sacred lotus center
  drawSacredCenter();

  // Draw energy connections
  drawEnergyConnections();

  // Draw glowing particles
  resetMatrix();
  for (let p of particles) {
    p.update();
    p.display();
  }

  angle += 0.25;
  auroraOffset += 0.005;
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
  for (let r = 900; r > 0; r -= 8) {
    let alpha = map(r, 0, 900, 30, 0);
    let c = color(colors[6]);
    c.setAlpha(alpha);
    fill(c);
    circle(width/2, height/2, r);
  }

  // Add secondary glow
  for (let r = 500; r > 0; r -= 10) {
    let alpha = map(r, 0, 500, 15, 0);
    let c = color(colors[3]);
    c.setAlpha(alpha);
    fill(c);
    circle(width/2, height/2, r);
  }

  pop();
}

// Aurora / Northern lights effect
function drawAurora() {
  push();
  noStroke();

  for (let i = 0; i < 5; i++) {
    let baseY = height * 0.3 + i * 60;
    let c = color(colors[(i + 2) % colors.length]);

    beginShape();
    for (let x = 0; x <= width; x += 10) {
      let noiseVal = noise(x * 0.003, auroraOffset + i * 0.5);
      let y = baseY + sin(x * 0.5 + angle + i * 30) * 30 + noiseVal * 100;
      let alpha = map(noiseVal, 0, 1, 3, 12);
      c.setAlpha(alpha);
      fill(c);
      ellipse(x, y, 40, 80 + noiseVal * 60);
    }
    endShape();
  }
  pop();
}

// Energy waves emanating from center
function drawEnergyWaves() {
  push();
  noFill();

  for (let wave of energyWaves) {
    let elapsed = frameCount - wave.delay;
    if (elapsed < 0) {
      continue;
    }
    wave.radius = (elapsed * wave.speed) % wave.maxRadius;

    if (wave.radius > 0) {
      let alpha = map(wave.radius, 0, wave.maxRadius, 40, 0);
      let c = color(wave.color);
      c.setAlpha(alpha);
      stroke(c);
      strokeWeight(2);
      circle(0, 0, wave.radius * 2);

      // Inner ripple
      c.setAlpha(alpha * 0.5);
      stroke(c);
      strokeWeight(1);
      circle(0, 0, wave.radius * 1.8);
    }
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

      // Distance from center for alpha variation
      let d = dist(x, y + offsetY, 0, 0);
      let distAlpha = map(d, 0, 600, 15, 3);

      let c = color(colors[2]);
      c.setAlpha(distAlpha + sin(angle + x * 0.1 + y * 0.1) * 3);
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
      // Center circle
      circle(0, 0, r * 2);
      pop();
    }
  }
  pop();
}

// Seed of Life with enhanced glow
function drawSeedOfLife() {
  push();

  let pulse = sin(angle * 2) * 5;
  let breathe = sin(angle * 0.5) * 10;
  let r = 180 + pulse + breathe;

  // Outer ethereal glow
  for (let i = 5; i > 0; i--) {
    let c = color(colors[3]);
    c.setAlpha(10 * i);
    stroke(c);
    strokeWeight(4 - i * 0.5);
    noFill();

    circle(0, 0, r * 2 + i * 25);
    for (let j = 0; j < 6; j++) {
      let a = j * 60;
      let x = cos(a) * r;
      let y = sin(a) * r;
      circle(x, y, r * 2 + i * 25);
    }
  }

  // Main circles with shimmer
  let shimmer = sin(angle * 3) * 0.2 + 0.8;
  let c = color(colors[5]);
  c.setAlpha(60 * shimmer);
  stroke(c);
  strokeWeight(1.5);
  noFill();

  circle(0, 0, r * 2);
  for (let i = 0; i < 6; i++) {
    let a = i * 60;
    let x = cos(a) * r;
    let y = sin(a) * r;
    circle(x, y, r * 2);

    // Add small decorative circles at intersections
    let c2 = color(colors[4]);
    c2.setAlpha(40);
    fill(c2);
    noStroke();
    circle(x * 0.5, y * 0.5, 8 + sin(angle * 2 + i * 60) * 3);
  }

  pop();
}

// Vesica Piscis patterns with shimmer
function drawVesicaPiscis() {
  push();
  rotate(angle * 0.4);

  for (let layer = 0; layer < 3; layer++) {
    let r = 150 + layer * 80;
    let shimmer = sin(angle * 2 + layer * 30) * 0.3 + 0.7;

    for (let i = 0; i < 8; i++) {
      let a = i * 45;
      push();
      rotate(a);

      let c = color(colors[(3 + layer) % colors.length]);
      c.setAlpha((30 - layer * 8) * shimmer);
      stroke(c);
      strokeWeight(1);
      noFill();

      // Two overlapping circles
      circle(-r/4, 0, r);
      circle(r/4, 0, r);

      // Add vesica highlight
      c.setAlpha(15 * shimmer);
      fill(c);
      noStroke();
      ellipse(0, 0, r/3, r * 0.8);

      pop();
    }
  }

  pop();
}

// Sri Yantra inspired triangles with glow
function drawSriYantra() {
  push();
  rotate(-angle * 0.3);

  // Upward triangles with enhanced glow
  for (let i = 0; i < 5; i++) {
    let size = 100 + i * 60;
    let shimmer = sin(angle * 1.5 + i * 40) * 0.3 + 0.7;

    // Glow layer
    let cg = color(colors[(1 + i) % colors.length]);
    cg.setAlpha(20 * shimmer);
    stroke(cg);
    strokeWeight(4);
    noFill();

    push();
    rotate(i * 15);
    drawTriangle(0, -size/3, size + 10);
    pop();

    // Main triangle
    let c = color(colors[(1 + i) % colors.length]);
    c.setAlpha(50 * shimmer);
    stroke(c);
    strokeWeight(1.5);

    push();
    rotate(i * 15);
    drawTriangle(0, -size/3, size);
    pop();
  }

  // Downward triangles
  rotate(angle * 0.6);
  for (let i = 0; i < 4; i++) {
    let size = 120 + i * 55;
    let shimmer = sin(angle * 1.5 + i * 50 + 180) * 0.3 + 0.7;

    // Glow layer
    let cg = color(colors[(6 + i) % colors.length]);
    cg.setAlpha(20 * shimmer);
    stroke(cg);
    strokeWeight(4);
    noFill();

    push();
    rotate(180 + i * 12);
    drawTriangle(0, -size/3, size + 10);
    pop();

    // Main triangle
    let c = color(colors[(6 + i) % colors.length]);
    c.setAlpha(50 * shimmer);
    stroke(c);
    strokeWeight(1.5);

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

// Enhanced mandalas with more intricate details
function drawEnhancedMandalas() {
  push();

  for (let layer of mandalaLayers) {
    push();
    rotate(angle * layer.rotationSpeed);

    let shimmer = sin(angle * 2 + layer.phase) * 0.2 + 0.8;

    // Outer ethereal glow
    for (let g = 4; g > 0; g--) {
      let c = color(layer.color);
      c.setAlpha(15 * g * shimmer);
      stroke(c);
      strokeWeight(layer.thickness + g * 1.5);
      noFill();

      beginShape();
      for (let i = 0; i < layer.sides; i++) {
        let a = (360 / layer.sides) * i;
        let wobble = sin(angle * 3 + i * 30) * 2;
        let x = cos(a) * (layer.radius + g * 3 + wobble);
        let y = sin(a) * (layer.radius + g * 3 + wobble);
        vertex(x, y);
      }
      endShape(CLOSE);
    }

    // Main polygon
    let c = color(layer.color);
    c.setAlpha(100 * shimmer);
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

    // Inner decorative polygon
    c.setAlpha(40 * shimmer);
    stroke(c);
    strokeWeight(0.8);
    beginShape();
    for (let i = 0; i < layer.sides; i++) {
      let a = (360 / layer.sides) * i + (180 / layer.sides);
      let x = cos(a) * (layer.radius * 0.7);
      let y = sin(a) * (layer.radius * 0.7);
      vertex(x, y);
    }
    endShape(CLOSE);

    // Connecting lines with gradient fade
    for (let i = 0; i < layer.sides; i++) {
      let a = (360 / layer.sides) * i;
      let x = cos(a) * layer.radius;
      let y = sin(a) * layer.radius;

      // Gradient line
      for (let j = 0; j < 10; j++) {
        let t = j / 10;
        let alpha = map(t, 0, 1, 5, 30) * shimmer;
        c.setAlpha(alpha);
        stroke(c);
        strokeWeight(0.5);
        let x1 = x * t;
        let y1 = y * t;
        let x2 = x * (t + 0.1);
        let y2 = y * (t + 0.1);
        line(x1, y1, x2, y2);
      }
    }

    // Glowing vertices with pulsing effect
    for (let i = 0; i < layer.sides; i++) {
      let a = (360 / layer.sides) * i;
      let x = cos(a) * layer.radius;
      let y = sin(a) * layer.radius;
      let pulse = sin(angle * 4 + i * 30) * 2;

      // Outer glow
      for (let g = 3; g > 0; g--) {
        c.setAlpha(60 / g * shimmer);
        fill(c);
        noStroke();
        circle(x, y, 4 + g * 3 + pulse);
      }

      // Bright core
      c.setAlpha(200 * shimmer);
      fill(c);
      circle(x, y, 3 + pulse * 0.5);
    }

    pop();
  }
  pop();
}

// Golden spiral with enhanced beauty
function drawGoldenSpiral() {
  push();
  rotate(-angle * 0.5);

  // Multiple spiral arms
  for (let arm = 0; arm < 2; arm++) {
    push();
    rotate(arm * 180);

    // Glow layers
    for (let g = 4; g > 0; g--) {
      let c = color(colors[6]);
      c.setAlpha(12 * g);
      stroke(c);
      strokeWeight(2 + g * 1.5);
      noFill();

      beginShape();
      for (let i = 0; i < 400; i += 2) {
        let r = 5 * pow(goldenRatio, i / 90);
        if (r > 600) break;
        let x = cos(i) * r;
        let y = sin(i) * r;
        vertex(x, y);
      }
      endShape();
    }

    // Main spiral with color gradient
    beginShape();
    noFill();
    for (let i = 0; i < 400; i += 2) {
      let r = 5 * pow(goldenRatio, i / 90);
      if (r > 600) break;
      let t = map(i, 0, 400, 0, 1);
      let c = lerpColor(color(colors[5]), color(colors[6]), t);
      c.setAlpha(150);
      stroke(c);
      strokeWeight(1.5);
      let x = cos(i) * r;
      let y = sin(i) * r;
      vertex(x, y);
    }
    endShape();

    pop();
  }

  pop();
}

// Metatron's Cube with enhanced sacred geometry
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

  // Inner hexagon positions
  for (let i = 0; i < numCircles; i++) {
    let a = (360 / numCircles) * i + 30;
    let x = cos(a) * (radius * 0.5);
    let y = sin(a) * (radius * 0.5);
    positions.push({x: x, y: y});
  }

  // Draw all connections with varying opacity
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      let d = dist(positions[i].x, positions[i].y, positions[j].x, positions[j].y);
      let alpha = map(d, 0, radius * 2, 30, 8);
      let c = color(colors[4]);
      c.setAlpha(alpha);
      stroke(c);
      strokeWeight(0.5);
      line(positions[i].x, positions[i].y, positions[j].x, positions[j].y);
    }
  }

  // Draw circles with enhanced glow
  for (let i = 0; i < positions.length; i++) {
    let shimmer = sin(angle * 2 + i * 40) * 0.3 + 0.7;

    // Outer ethereal glow
    for (let g = 4; g > 0; g--) {
      let c = color(colors[i % colors.length]);
      c.setAlpha(15 * g * shimmer);
      fill(c);
      noStroke();
      circle(positions[i].x, positions[i].y, 50 + g * 18);
    }

    // Main circle outline
    let c = color(colors[i % colors.length]);
    c.setAlpha(80 * shimmer);
    stroke(c);
    strokeWeight(2);
    noFill();
    circle(positions[i].x, positions[i].y, 50);

    // Inner glow
    c.setAlpha(35 * shimmer);
    fill(c);
    noStroke();
    circle(positions[i].x, positions[i].y, 35);

    // Bright center dot
    c.setAlpha(150 * shimmer);
    fill(c);
    circle(positions[i].x, positions[i].y, 6);
  }

  pop();
}

// Platonic solids projection with depth
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
  vertices.push(createVector(a, phi * a, 0));
  vertices.push(createVector(-a, phi * a, 0));

  // Glow effect
  let cg = color(colors[7]);
  cg.setAlpha(15);
  stroke(cg);
  strokeWeight(4);

  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      line(vertices[i].x, vertices[i].y, vertices[j].x, vertices[j].y);
    }
  }

  // Main lines
  let c = color(colors[7]);
  c.setAlpha(40);
  stroke(c);
  strokeWeight(1);

  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      line(vertices[i].x, vertices[i].y, vertices[j].x, vertices[j].y);
    }
  }

  // Vertex points
  for (let v of vertices) {
    c.setAlpha(80);
    fill(c);
    noStroke();
    circle(v.x, v.y, 8);
  }

  pop();
}

// Sacred center - lotus/eye of consciousness
function drawSacredCenter() {
  push();

  let breathe = sin(angle * 0.8) * 15;
  let innerBreath = sin(angle * 1.2) * 8;

  // Outer rings with glow
  for (let ring = 5; ring > 0; ring--) {
    let r = 30 + ring * 12 + breathe;
    let c = color(colors[3]);
    c.setAlpha(25 * ring);
    stroke(c);
    strokeWeight(2);
    noFill();
    circle(0, 0, r * 2);
  }

  // Lotus petals
  let petalCount = 12;
  for (let layer = 2; layer >= 0; layer--) {
    let petalSize = 25 + layer * 15 + breathe * 0.5;

    for (let i = 0; i < petalCount; i++) {
      let a = (360 / petalCount) * i + angle * (layer + 1) * 0.3;
      push();
      rotate(a);

      let c = color(colors[(3 + layer) % colors.length]);
      c.setAlpha(50 - layer * 10);
      fill(c);

      c.setAlpha(80 - layer * 15);
      stroke(c);
      strokeWeight(1);

      // Petal shape
      beginShape();
      vertex(0, 0);
      bezierVertex(petalSize * 0.3, -petalSize * 0.5, petalSize * 0.7, -petalSize * 0.3, petalSize, 0);
      bezierVertex(petalSize * 0.7, petalSize * 0.3, petalSize * 0.3, petalSize * 0.5, 0, 0);
      endShape(CLOSE);

      pop();
    }
  }

  // Inner sacred eye / bindu
  // Outer glow
  for (let g = 6; g > 0; g--) {
    let c = color(colors[5]);
    c.setAlpha(20 * g);
    fill(c);
    noStroke();
    circle(0, 0, 20 + g * 8 + innerBreath);
  }

  // Core
  let c = color(colors[4]);
  c.setAlpha(200);
  fill(c);
  circle(0, 0, 18 + innerBreath * 0.5);

  // Bright center point
  c = color(colors[5]);
  c.setAlpha(255);
  fill(c);
  circle(0, 0, 6);

  // Inner spark
  fill(255, 255, 255, 200);
  circle(0, 0, 3);

  pop();
}

// Energy connections flowing between elements
function drawEnergyConnections() {
  push();

  let numConnections = 6;
  for (let i = 0; i < numConnections; i++) {
    let a = (360 / numConnections) * i + angle * 0.5;

    // Calculate path points
    let innerR = 60 + sin(angle * 2 + i * 60) * 10;
    let outerR = 400 + cos(angle * 1.5 + i * 45) * 30;

    let x1 = cos(a) * innerR;
    let y1 = sin(a) * innerR;
    let x2 = cos(a) * outerR;
    let y2 = sin(a) * outerR;

    // Control points for curve
    let cx1 = cos(a + 20) * (innerR + outerR) * 0.3;
    let cy1 = sin(a + 20) * (innerR + outerR) * 0.3;
    let cx2 = cos(a - 15) * (innerR + outerR) * 0.6;
    let cy2 = sin(a - 15) * (innerR + outerR) * 0.6;

    // Glow
    let c = color(colors[(i + 5) % colors.length]);
    c.setAlpha(20);
    stroke(c);
    strokeWeight(6);
    noFill();
    bezier(x1, y1, cx1, cy1, cx2, cy2, x2, y2);

    // Main line
    c.setAlpha(40);
    stroke(c);
    strokeWeight(1.5);
    bezier(x1, y1, cx1, cy1, cx2, cy2, x2, y2);

    // Energy nodes along path
    for (let t = 0; t <= 1; t += 0.2) {
      let px = bezierPoint(x1, cx1, cx2, x2, t);
      let py = bezierPoint(y1, cy1, cy2, y2, t);
      let pulse = sin(angle * 4 + t * 360 + i * 60) * 3;

      c.setAlpha(60);
      fill(c);
      noStroke();
      circle(px, py, 4 + pulse);
    }
  }

  pop();
}

// Twinkling star class
class TwinklingStar {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.size = random(1, 3);
    this.twinkleSpeed = random(0.02, 0.08);
    this.twinkleOffset = random(TWO_PI);
    this.color = color(random(colors.slice(3, 7)));
  }

  update() {
    this.twinkleOffset += this.twinkleSpeed;
  }

  display() {
    let brightness = (sin(this.twinkleOffset) + 1) * 0.5;
    let alpha = brightness * 150 + 30;

    // Glow
    let c = this.color;
    c.setAlpha(alpha * 0.3);
    fill(c);
    noStroke();
    circle(this.x, this.y, this.size * 4);

    // Core
    c.setAlpha(alpha);
    fill(c);
    circle(this.x, this.y, this.size);

    // Sparkle cross
    if (brightness > 0.7) {
      stroke(c);
      strokeWeight(0.5);
      let len = this.size * 3 * brightness;
      line(this.x - len, this.y, this.x + len, this.y);
      line(this.x, this.y - len, this.x, this.y + len);
    }
  }
}

// Enhanced glowing particle class
class GlowParticle {
  constructor() {
    this.reset();
    this.y = random(height);
  }

  reset() {
    this.x = random(width);
    this.y = 0;
    this.speed = random(0.3, 1.5);
    this.size = random(2, 6);
    this.color = color(random(colors));
    this.wobble = random(TWO_PI);
    this.wobbleSpeed = random(0.02, 0.05);
    this.wobbleAmp = random(20, 50);
    this.alpha = random(100, 200);
  }

  update() {
    this.y += this.speed;
    this.wobble += this.wobbleSpeed;

    if (this.y > height + 20) {
      this.reset();
    }
  }

  display() {
    let xOffset = sin(this.wobble) * this.wobbleAmp;
    let x = this.x + xOffset;

    // Trail effect
    let c = this.color;
    for (let i = 3; i > 0; i--) {
      let trailY = this.y - i * 8;
      c.setAlpha(this.alpha * 0.1 / i);
      fill(c);
      noStroke();
      circle(x + sin(this.wobble - i * 0.1) * this.wobbleAmp, trailY, this.size * 0.8);
    }

    // Outer glow
    for (let i = 4; i > 0; i--) {
      c.setAlpha(this.alpha * 0.15 / i);
      fill(c);
      noStroke();
      circle(x, this.y, this.size * i * 2.5);
    }

    // Bright core
    c.setAlpha(this.alpha);
    fill(c);
    circle(x, this.y, this.size);

    // Highlight
    fill(255, 255, 255, this.alpha * 0.5);
    circle(x - this.size * 0.2, this.y - this.size * 0.2, this.size * 0.4);
  }
}
