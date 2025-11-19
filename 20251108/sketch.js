let colors;
let time = 0;
let breathingPhase = 0;
let energyParticles = [];
let chakras = [];
let cosmicDust = [];
let auroras = [];
let stars = [];

function setup() {
  createCanvas(720, 1280);

  colors = [
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

  // Create layers for depth
  for (let i = 0; i < 200; i++) {
    stars.push(new Star());
  }

  for (let i = 0; i < 300; i++) {
    cosmicDust.push(new CosmicDust());
  }

  for (let i = 0; i < 100; i++) {
    energyParticles.push(new EnergyParticle());
  }

  for (let i = 0; i < 7; i++) {
    chakras.push(new Chakra(i));
  }

  for (let i = 0; i < 5; i++) {
    auroras.push(new Aurora(i));
  }

  background('#1a1525');
}

function draw() {
  // Deep cosmic background
  fill(26, 21, 37, 20);
  noStroke();
  rect(0, 0, width, height);

  time += 0.008;
  breathingPhase = sin(time * 0.5);

  // Draw stars in background
  for (let star of stars) {
    star.show();
  }

  // Draw aurora waves for depth
  for (let aurora of auroras) {
    aurora.update();
    aurora.show();
  }

  // Draw cosmic dust clouds
  for (let dust of cosmicDust) {
    dust.update();
    dust.show();
  }

  push();
  translate(width / 2, height / 2);

  // Draw radiating cosmic rays
  drawCosmicRays();

  // Draw nebula clouds
  drawNebulaClouds();

  // Draw rotating sacred geometries at different depths
  drawMultiLayerMandala();

  // Draw chakras with energy flow
  for (let chakra of chakras) {
    chakra.update();
    chakra.show();
  }

  // Draw energy vortex
  drawEnergyVortex();

  // Draw particles
  for (let particle of energyParticles) {
    particle.update();
    particle.show();
  }

  // Draw central portal
  drawCentralPortal();

  // Draw flower of life with depth
  drawFlowerOfLife();

  // Draw connecting energy lines
  drawEnergyConnections();

  pop();
}

function drawCosmicRays() {
  for (let i = 0; i < 72; i++) {
    let angle = (TWO_PI / 72) * i;
    let r1 = 300 + sin(time * 2 + i * 0.1) * 100;
    let r2 = 600 + sin(time + i * 0.05) * 150;

    let alpha = map(sin(time * 3 + i * 0.2), -1, 1, 5, 30);
    stroke(colors[i % colors.length] + hex(floor(alpha), 2));
    strokeWeight(0.5);

    let x1 = cos(angle) * r1;
    let y1 = sin(angle) * r1;
    let x2 = cos(angle) * r2;
    let y2 = sin(angle) * r2;

    line(x1, y1, x2, y2);
  }
}

function drawNebulaClouds() {
  noStroke();
  for (let i = 0; i < 8; i++) {
    let angle = time * 0.2 + i * PI / 4;
    let radius = 200 + sin(time + i) * 100;
    let x = cos(angle) * radius;
    let y = sin(angle) * radius;

    let size = 150 + sin(time * 2 + i) * 50;

    for (let j = 3; j > 0; j--) {
      fill(colors[i % colors.length] + hex(floor(8 / j), 2));
      circle(x, y, size * j);
    }
  }
}

function drawMultiLayerMandala() {
  let layers = 8;

  for (let layer = layers; layer > 0; layer--) {
    push();

    let depth = map(layer, 1, layers, 0.5, 1.5);
    let radius = 60 + layer * 50 + breathingPhase * 15;
    let points = 5 + layer;
    let rotationSpeed = time * 0.15 * (layer % 2 === 0 ? 1 : -1);

    rotate(rotationSpeed);

    // Outer ring
    stroke(colors[layer % colors.length]);
    strokeWeight(1 + depth);
    noFill();

    beginShape();
    for (let i = 0; i <= points; i++) {
      let angle = (TWO_PI / points) * i;
      let r = radius + sin(time * 3 + i + layer) * 8;
      let x = cos(angle) * r;
      let y = sin(angle) * r;
      vertex(x, y);
    }
    endShape(CLOSE);

    // Star pattern
    stroke(colors[layer % colors.length] + '80');
    for (let i = 0; i < points; i++) {
      let angle = (TWO_PI / points) * i;
      let x1 = cos(angle) * radius * 0.5;
      let y1 = sin(angle) * radius * 0.5;
      let x2 = cos(angle) * radius;
      let y2 = sin(angle) * radius;
      line(x1, y1, x2, y2);
    }

    pop();
  }
}

function drawEnergyVortex() {
  noFill();
  for (let v = 0; v < 5; v++) {
    stroke(colors[v % colors.length]);
    strokeWeight(1.5);

    beginShape();
    for (let i = 0; i < 150; i++) {
      let angle = i * 0.15 + time * 2 + v * TWO_PI / 5;
      let r = i * 2.5 + sin(time * 3 + i * 0.05) * 15;
      let x = cos(angle) * r;
      let y = sin(angle) * r;
      vertex(x, y);
    }
    endShape();
  }
}

function drawCentralPortal() {
  let pulse = 40 + breathingPhase * 25;

  // Outer portal rings
  noFill();
  for (let i = 6; i > 0; i--) {
    let r = pulse * i + sin(time * 2 + i) * 10;
    stroke(colors[i % colors.length]);
    strokeWeight(2);
    circle(0, 0, r);
  }

  // Inner light
  for (let i = 5; i > 0; i--) {
    fill(200, 180, 255, 40 / i);
    noStroke();
    circle(0, 0, pulse * i * 0.8);
  }

  // Core
  fill('#c8c0e9');
  circle(0, 0, pulse * 0.4);
}

function drawFlowerOfLife() {
  noFill();
  stroke('#84bae7');
  strokeWeight(1);

  let radius = 35 + breathingPhase * 8;

  // Multiple layers of flower of life
  for (let layer = 0; layer < 3; layer++) {
    let r = radius * (1 + layer * 0.5);
    circle(0, 0, r * 2);

    for (let i = 0; i < 6; i++) {
      let angle = (TWO_PI / 6) * i;
      let x = cos(angle) * r;
      let y = sin(angle) * r;
      circle(x, y, r * 2);

      // Second ring
      for (let j = 0; j < 6; j++) {
        let angle2 = (TWO_PI / 6) * j;
        let x2 = x + cos(angle2) * r;
        let y2 = y + sin(angle2) * r;
        circle(x2, y2, r * 2);
      }
    }
  }
}

function drawEnergyConnections() {
  stroke('#916ccc');
  strokeWeight(0.5);

  for (let i = 0; i < chakras.length - 1; i++) {
    let y1 = chakras[i].y;
    let y2 = chakras[i + 1].y;

    // Wavy connection
    noFill();
    beginShape();
    for (let t = 0; t <= 1; t += 0.1) {
      let y = lerp(y1, y2, t);
      let x = sin(time * 2 + t * PI * 2) * 30;
      vertex(x, y);
    }
    endShape();
  }
}

class Star {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.size = random(0.5, 2);
    this.brightness = random(100, 255);
    this.twinkleSpeed = random(0.02, 0.05);
    this.offset = random(TWO_PI);
  }

  show() {
    let twinkle = sin(time * this.twinkleSpeed + this.offset);
    let alpha = map(twinkle, -1, 1, 50, this.brightness);

    fill(255, 255, 255, alpha);
    noStroke();
    circle(this.x, this.y, this.size);
  }
}

class CosmicDust {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.z = random(0.5, 2);
    this.size = random(1, 3);
    this.color = random(colors);
    this.speedX = random(-0.2, 0.2);
    this.speedY = random(-0.2, 0.2);
  }

  update() {
    this.x += this.speedX * this.z;
    this.y += this.speedY * this.z;

    if (this.x < 0) this.x = width;
    if (this.x > width) this.x = 0;
    if (this.y < 0) this.y = height;
    if (this.y > height) this.y = 0;
  }

  show() {
    fill(this.color + '40');
    noStroke();
    circle(this.x, this.y, this.size * this.z);
  }
}

class Aurora {
  constructor(index) {
    this.index = index;
    this.yOffset = random(height);
    this.speed = random(0.005, 0.02);
    this.amplitude = random(100, 200);
    this.frequency = random(0.003, 0.01);
    this.color = colors[index % colors.length];
    this.phase = 0;
  }

  update() {
    this.phase += this.speed;
  }

  show() {
    noFill();
    strokeWeight(3);

    for (let layer = 0; layer < 3; layer++) {
      stroke(this.color + hex(floor(30 - layer * 10), 2));

      beginShape();
      for (let x = 0; x <= width; x += 3) {
        let y = this.yOffset +
                sin(x * this.frequency + this.phase) * this.amplitude +
                sin(x * this.frequency * 2 + this.phase * 1.5) * this.amplitude * 0.5 +
                layer * 10;
        vertex(x, y);
      }
      endShape();
    }
  }
}

class Chakra {
  constructor(index) {
    this.index = index;
    this.y = map(index, 0, 6, -500, 500);
    this.color = colors[index % colors.length];
    this.phase = random(TWO_PI);
  }

  update() {}

  show() {
    push();
    translate(0, this.y);

    let pulse = 1 + sin(time * 2 + this.phase) * 0.3;
    let size = 35 * pulse;

    // Energy field
    noStroke();
    for (let i = 5; i > 0; i--) {
      fill(this.color + hex(floor(20 / i), 2));
      circle(0, 0, size * i * 1.8);
    }

    // Core
    stroke(this.color);
    strokeWeight(2.5);
    noFill();
    circle(0, 0, size);

    // Rotating symbol
    rotate(time + this.phase);
    for (let i = 0; i < 8; i++) {
      let angle = (TWO_PI / 8) * i;
      let x1 = cos(angle) * size * 0.3;
      let y1 = sin(angle) * size * 0.3;
      let x2 = cos(angle) * size * 0.7;
      let y2 = sin(angle) * size * 0.7;
      line(x1, y1, x2, y2);
    }

    pop();
  }
}

class EnergyParticle {
  constructor() {
    this.angle = random(TWO_PI);
    this.radius = random(50, 600);
    this.speed = random(0.003, 0.015);
    this.size = random(2, 6);
    this.color = random(colors);
    this.offset = random(TWO_PI);
    this.orbitSpeed = random(0.01, 0.03);
  }

  update() {
    this.angle += this.speed;
    this.radius += sin(time * 2 + this.offset) * 0.8;
    this.offset += this.orbitSpeed;
  }

  show() {
    let x = cos(this.angle) * this.radius + width / 2;
    let y = sin(this.angle) * this.radius + height / 2;

    // Glow
    noStroke();
    for (let i = 2; i > 0; i--) {
      fill(this.color + hex(floor(40 / i), 2));
      circle(x, y, this.size * i * 1.5);
    }

    // Core
    fill(this.color);
    circle(x, y, this.size);
  }
}

function mousePressed() {
  // Regenerate everything
  cosmicDust = [];
  for (let i = 0; i < 300; i++) {
    cosmicDust.push(new CosmicDust());
  }

  energyParticles = [];
  for (let i = 0; i < 100; i++) {
    energyParticles.push(new EnergyParticle());
  }

  chakras = [];
  for (let i = 0; i < 7; i++) {
    chakras.push(new Chakra(i));
  }

  auroras = [];
  for (let i = 0; i < 5; i++) {
    auroras.push(new Aurora(i));
  }

  background('#1a1525');
}
