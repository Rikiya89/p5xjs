// De Moivre's Theorem: (cos θ + i sin θ)^n = cos(nθ) + i sin(nθ)
// Enhanced Black and White 3D Generative Art

let time = 0;
let particles = [];
let spirals = [];
let rings = [];
let connections = [];
let orbiters = [];
const numParticles = 400;
const numSpirals = 12;
const numRings = 6;
const numOrbiters = 80;

function setup() {
  createCanvas(720, 1280, WEBGL);
  frameRate(60);
  colorMode(RGB, 255);
  smooth();

  // Create particles with trails
  for (let i = 0; i < numParticles; i++) {
    particles.push(new DeMoivreParticle(i));
  }

  // Create spiral structures
  for (let i = 0; i < numSpirals; i++) {
    spirals.push(new ComplexSpiral(i));
  }

  // Create De Moivre rings
  for (let i = 0; i < numRings; i++) {
    rings.push(new DeMoivreRing(i));
  }

  // Create orbital particles
  for (let i = 0; i < numOrbiters; i++) {
    orbiters.push(new OrbitalParticle(i));
  }
}

function draw() {
  // Deep black background with subtle fade
  background(0, 0, 0);

  // Dynamic camera with breathing motion
  let camX = sin(time * 0.15) * 250;
  let camY = cos(time * 0.12) * 200 + sin(time * 0.3) * 50;
  let camZ = 600 + sin(time * 0.08) * 150;
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

  // Enhanced white lighting with pulsing
  let pulse = sin(time * 2) * 0.3 + 0.7;
  ambientLight(35 * pulse);

  // Multiple white lights for depth
  pointLight(255, 255, 255, 300 * cos(time), -200, 300);
  pointLight(220, 220, 230, -300, 300 * sin(time * 0.7), -200);
  pointLight(180, 180, 200, 0, 400, 200 * sin(time * 0.5));

  // Background star field
  drawStarField();

  // Draw rings (back layer)
  rings.forEach(ring => {
    ring.update();
    ring.display();
  });

  // Draw spirals with enhanced detail
  spirals.forEach(spiral => {
    spiral.update();
    spiral.display();
  });

  // Draw connections between nearby particles
  drawConnections();

  // Draw particles with trails
  particles.forEach(particle => {
    particle.update();
    particle.display();
  });

  // Draw orbital particles
  orbiters.forEach(orbiter => {
    orbiter.update();
    orbiter.display();
  });

  // Draw central structures
  drawCentralStructure();
  drawDeMoivreFlower();
  drawGeometricCore();

  time += 0.008;
}

class DeMoivreParticle {
  constructor(index) {
    this.index = index;
    this.power = floor(random(2, 10));
    this.radius = random(80, 350);
    this.speed = random(0.3, 1.5);
    this.offset = random(TWO_PI);
    this.size = random(1.5, 5);
    this.opacity = random(180, 255);
    this.trail = [];
    this.trailLength = 15;
    this.phase = random(TWO_PI);
    this.brightness = random(200, 255);
  }

  update() {
    let theta = (time * this.speed + this.offset);
    let r = this.radius;
    let n = this.power;

    // De Moivre's theorem with modulation
    let angle = n * theta;
    let radiusPow = pow(r / 100, n / 4) * 45;
    let breathe = sin(time * 2 + this.phase) * 0.2 + 1;

    let x = radiusPow * cos(angle) * breathe;
    let y = radiusPow * sin(angle) * breathe;
    let z = sin(theta * 2 + this.phase) * 80 + cos(theta) * 40;

    // Store trail
    this.trail.push(createVector(x, y, z));
    if (this.trail.length > this.trailLength) {
      this.trail.shift();
    }

    this.x = x;
    this.y = y;
    this.z = z;
  }

  display() {
    // Draw trail with elegant fade
    push();
    noFill();
    beginShape();
    for (let i = 0; i < this.trail.length; i++) {
      let p = this.trail[i];
      let alpha = map(i, 0, this.trail.length, 0, this.opacity * 0.7);
      stroke(this.brightness, alpha);
      strokeWeight(map(i, 0, this.trail.length, 0.5, 2.5));
      vertex(p.x, p.y, p.z);
    }
    endShape();
    pop();

    // Draw particle with bright white
    push();
    translate(this.x, this.y, this.z);
    noStroke();
    fill(this.brightness, this.opacity);
    sphere(this.size);

    // Enhanced glow effect
    fill(this.brightness * 0.9, this.opacity * 0.5);
    sphere(this.size * 2);
    fill(this.brightness * 0.7, this.opacity * 0.2);
    sphere(this.size * 3);
    pop();
  }
}

class ComplexSpiral {
  constructor(index) {
    this.index = index;
    this.points = [];
    this.numPoints = 150;
    this.power = 2 + index * 0.5;
    this.rotationSpeed = 0.08 + index * 0.03;
    this.baseAngle = (index / numSpirals) * TWO_PI;
    this.phase = random(TWO_PI);
    this.brightness = 200 + index * 5;
  }

  update() {
    this.points = [];

    for (let i = 0; i < this.numPoints; i++) {
      let t = map(i, 0, this.numPoints, 0, TWO_PI * 3);
      let theta = t + time * this.rotationSpeed + this.baseAngle;

      // De Moivre with complex modulation
      let r = map(i, 0, this.numPoints, 40, 220);
      let n = this.power + sin(time + this.phase) * 0.5;
      let angle = n * theta;
      let radiusPow = pow(r / 100, 1.1);
      let modulation = sin(i * 0.1 + time * 3) * 0.2 + 1;

      let x = radiusPow * cos(angle) * 45 * modulation;
      let y = radiusPow * sin(angle) * 45 * modulation;
      let z = map(i, 0, this.numPoints, -400, 400);

      this.points.push(createVector(x, y, z));
    }
  }

  display() {
    push();

    // Draw smooth curves with elegant white
    noFill();
    stroke(this.brightness, 200);
    strokeWeight(2);
    beginShape();
    for (let p of this.points) {
      vertex(p.x, p.y, p.z);
    }
    endShape();

    // Draw nodes with varying sizes
    for (let i = 0; i < this.points.length; i += 8) {
      let p = this.points[i];
      let size = map(sin(i * 0.2 + time * 3), -1, 1, 1.5, 4);
      push();
      translate(p.x, p.y, p.z);
      noStroke();
      fill(this.brightness, 240);
      sphere(size);
      // Multi-layer glow
      fill(this.brightness * 0.9, 120);
      sphere(size * 1.8);
      fill(this.brightness * 0.7, 60);
      sphere(size * 2.5);
      pop();
    }
    pop();
  }
}

class DeMoivreRing {
  constructor(index) {
    this.index = index;
    this.power = 3 + index;
    this.radius = 100 + index * 40;
    this.points = 80;
    this.thickness = random(2, 4);
    this.speed = random(0.1, 0.3);
    this.offset = random(TWO_PI);
    this.brightness = 180 + index * 10;
  }

  update() {
    this.currentTime = time * this.speed + this.offset;
  }

  display() {
    push();
    rotateX(sin(time * 0.3 + this.offset) * 0.5);
    rotateZ(time * this.speed);

    noFill();
    stroke(this.brightness, 160);
    strokeWeight(this.thickness);

    beginShape();
    for (let i = 0; i <= this.points; i++) {
      let theta = map(i, 0, this.points, 0, TWO_PI);

      // Apply De Moivre
      let angle = this.power * theta;
      let r = this.radius * (1 + sin(theta * 5 + this.currentTime) * 0.1);

      let x = r * cos(angle) / this.power;
      let y = r * sin(angle) / this.power;
      let z = sin(theta * 3 + this.currentTime) * 20;

      // Subtle brightness variation
      let segmentBrightness = this.brightness + sin(i * 0.1 + time) * 30;
      stroke(segmentBrightness, 180);

      vertex(x, y, z);
    }
    endShape(CLOSE);
    pop();
  }
}

class OrbitalParticle {
  constructor(index) {
    this.index = index;
    this.layer = floor(index / (numOrbiters / 4));
    this.power = 2 + this.layer;
    this.baseRadius = 150 + this.layer * 50;
    this.speed = random(0.5, 1.2);
    this.offset = random(TWO_PI);
    this.size = random(2, 4);
    this.brightness = random(180, 255);
  }

  update() {
    let theta = time * this.speed + this.offset;
    let n = this.power;
    let angle = n * theta;

    // Create orbital paths using De Moivre
    let r = this.baseRadius + sin(theta * 3) * 30;
    this.x = r * cos(angle) / n * 2;
    this.y = r * sin(angle) / n * 2;
    this.z = cos(theta * 2) * 60;
  }

  display() {
    push();
    translate(this.x, this.y, this.z);
    noStroke();
    fill(this.brightness, 220);
    sphere(this.size);
    // Multi-layer glow
    fill(this.brightness * 0.9, 110);
    sphere(this.size * 1.6);
    fill(this.brightness * 0.7, 50);
    sphere(this.size * 2.2);
    pop();
  }
}

function drawConnections() {
  strokeWeight(0.8);

  for (let i = 0; i < particles.length; i++) {
    let p1 = particles[i];
    let connections = 0;

    for (let j = i + 1; j < particles.length && connections < 2; j++) {
      let p2 = particles[j];
      let d = dist(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);

      if (d < 60) {
        let alpha = map(d, 0, 60, 60, 0);
        let connBrightness = (p1.brightness + p2.brightness) / 2;
        stroke(connBrightness, alpha);
        line(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        connections++;
      }
    }
  }
}

function drawStarField() {
  push();
  for (let i = 0; i < 200; i++) {
    let angle1 = random(TWO_PI);
    let angle2 = random(TWO_PI);
    let radius = random(400, 800);

    let x = radius * sin(angle1) * cos(angle2);
    let y = radius * sin(angle1) * sin(angle2);
    let z = radius * cos(angle1);

    push();
    translate(x, y, z);
    noStroke();
    let starBrightness = random(150, 255);
    let starAlpha = random(100, 200);
    fill(starBrightness, starAlpha);
    sphere(random(0.5, 2.5));
    pop();
  }
  pop();
}

function drawCentralStructure() {
  push();

  // Rotating geometric structure using De Moivre
  for (let layer = 0; layer < 3; layer++) {
    push();
    rotateX(time * (0.2 + layer * 0.1));
    rotateY(time * (0.15 - layer * 0.05));
    rotateZ(time * (0.25 + layer * 0.08));

    noFill();
    let baseBrightness = 200 - layer * 30;
    stroke(baseBrightness, 190 - layer * 30);
    strokeWeight(2.5);

    let sides = 6 + layer * 2;
    let radius = 40 + layer * 25;

    beginShape();
    for (let i = 0; i <= sides; i++) {
      let theta = map(i, 0, sides, 0, TWO_PI);
      let n = 3 + layer;
      let angle = n * theta;

      let r = radius + sin(theta * 4 + time * 2) * 5;
      let x = r * cos(angle) / n;
      let y = r * sin(angle) / n;
      let z = sin(i + time * 2) * 10;

      // Subtle brightness variation
      let vertexBrightness = baseBrightness + sin(i + time * 3) * 40;
      stroke(vertexBrightness, 200);

      vertex(x, y, z);
    }
    endShape(CLOSE);
    pop();
  }
  pop();
}

function drawDeMoivreFlower() {
  push();

  // Multi-layered flower using De Moivre
  for (let n = 2; n <= 8; n++) {
    push();
    rotateZ(time * 0.2 * n);
    rotateX(sin(time * 0.3) * 0.4);
    rotateY(cos(time * 0.25) * 0.3);

    noFill();
    let brightness = map(n, 2, 8, 240, 160);
    let alpha = map(n, 2, 8, 200, 120);
    stroke(brightness, alpha);
    strokeWeight(map(n, 2, 8, 3, 1.2));

    beginShape();
    for (let i = 0; i <= 360; i += 1) {
      let theta = radians(i);
      let angle = n * theta;

      // Modulated radius for petal effect
      let petals = 5 + floor(n / 2);
      let r = 35 + 25 * cos(petals * theta + time) + 10 * sin(n * theta);

      let x = r * cos(angle);
      let y = r * sin(angle);
      let z = 15 * sin(n * theta + time) * cos(theta * 2);

      // Subtle brightness modulation along petals
      let petalBrightness = brightness + sin(i * 0.05 + time * 2) * 40;
      stroke(petalBrightness, alpha);

      vertex(x, y, z);
    }
    endShape(CLOSE);
    pop();
  }

  // Pulsing center with white glow
  push();
  let centerPulse = sin(time * 3) * 0.3 + 1;
  noStroke();
  fill(255, 255);
  sphere(10 * centerPulse);
  fill(240, 180);
  sphere(15 * centerPulse);
  fill(220, 100);
  sphere(20 * centerPulse);
  fill(200, 50);
  sphere(25 * centerPulse);
  pop();

  pop();
}

function drawGeometricCore() {
  push();
  rotateX(time * 0.4);
  rotateY(time * 0.3);

  // Nested polyhedra using De Moivre spacing
  for (let i = 1; i <= 3; i++) {
    let n = i + 2;
    let r = i * 30;

    noFill();
    let coreBrightness = 220 - i * 30;
    stroke(coreBrightness, 200 - i * 40);
    strokeWeight(2.5);

    // Create vertices using De Moivre's theorem
    let vertices = [];
    for (let j = 0; j < 8; j++) {
      let theta = map(j, 0, 8, 0, TWO_PI);
      let angle = n * theta;
      let x = r * cos(angle) / n;
      let y = r * sin(angle) / n;
      let z = r * sin(theta * 2) / 2;
      vertices.push(createVector(x, y, z));
    }

    // Connect vertices with subtle brightness variation
    for (let j = 0; j < vertices.length; j++) {
      let v1 = vertices[j];
      let v2 = vertices[(j + 1) % vertices.length];
      let edgeBrightness = coreBrightness + sin(j + time * 3) * 30;
      stroke(edgeBrightness, 210);
      line(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    }
  }
  pop();
}

function keyPressed() {
  if (key === ' ') {
    particles = [];
    for (let i = 0; i < numParticles; i++) {
      particles.push(new DeMoivreParticle(i));
    }
    orbiters = [];
    for (let i = 0; i < numOrbiters; i++) {
      orbiters.push(new OrbitalParticle(i));
    }
  }

  if (key === 'r' || key === 'R') {
    time = 0;
  }
}
