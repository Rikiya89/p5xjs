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
  // Fade effect for trails
  background(0);

  // Dynamic camera with breathing motion
  let camX = sin(time * 0.15) * 250;
  let camY = cos(time * 0.12) * 200 + sin(time * 0.3) * 50;
  let camZ = 600 + sin(time * 0.08) * 150;
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

  // Enhanced lighting with pulsing
  let pulse = sin(time * 2) * 0.3 + 0.7;
  ambientLight(30 * pulse);
  pointLight(255, 255, 255, 300 * cos(time), -200, 300);
  pointLight(200, 200, 200, -300, 300 * sin(time * 0.7), -200);
  pointLight(150, 150, 150, 0, 400, 200 * sin(time * 0.5));

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
    this.opacity = random(120, 255);
    this.trail = [];
    this.trailLength = 15;
    this.phase = random(TWO_PI);
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
    // Draw trail
    push();
    noFill();
    beginShape();
    for (let i = 0; i < this.trail.length; i++) {
      let p = this.trail[i];
      let alpha = map(i, 0, this.trail.length, 0, this.opacity * 0.6);
      stroke(255, alpha);
      strokeWeight(map(i, 0, this.trail.length, 0.5, 2));
      vertex(p.x, p.y, p.z);
    }
    endShape();
    pop();

    // Draw particle
    push();
    translate(this.x, this.y, this.z);
    noStroke();
    fill(255, this.opacity);
    sphere(this.size);

    // Glow effect
    fill(255, this.opacity * 0.3);
    sphere(this.size * 2);
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

    // Draw smooth curves
    noFill();
    stroke(255, 180);
    strokeWeight(1.5);
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
      fill(255, 220);
      sphere(size);
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
    this.thickness = random(1, 3);
    this.speed = random(0.1, 0.3);
    this.offset = random(TWO_PI);
  }

  update() {
    this.currentTime = time * this.speed + this.offset;
  }

  display() {
    push();
    rotateX(sin(time * 0.3 + this.offset) * 0.5);
    rotateZ(time * this.speed);

    noFill();
    stroke(255, 100);
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
    fill(255, 180);
    sphere(this.size);
    pop();
  }
}

function drawConnections() {
  stroke(255, 30);
  strokeWeight(0.5);

  for (let i = 0; i < particles.length; i++) {
    let p1 = particles[i];
    let connections = 0;

    for (let j = i + 1; j < particles.length && connections < 2; j++) {
      let p2 = particles[j];
      let d = dist(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);

      if (d < 60) {
        let alpha = map(d, 0, 60, 50, 0);
        stroke(255, alpha);
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
    let brightness = random(100, 255);
    fill(brightness, brightness * 0.4);
    sphere(random(0.5, 2));
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
    stroke(255, 120 - layer * 20);
    strokeWeight(1);

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
    let alpha = map(n, 2, 8, 180, 80);
    stroke(255, alpha);
    strokeWeight(map(n, 2, 8, 2, 0.8));

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

      vertex(x, y, z);
    }
    endShape(CLOSE);
    pop();
  }

  // Pulsing center
  push();
  let centerPulse = sin(time * 3) * 0.3 + 1;
  noStroke();
  fill(255);
  sphere(10 * centerPulse);
  fill(255, 100);
  sphere(15 * centerPulse);
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
    stroke(255, 150 - i * 30);
    strokeWeight(1.5);

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

    // Connect vertices
    for (let j = 0; j < vertices.length; j++) {
      let v1 = vertices[j];
      let v2 = vertices[(j + 1) % vertices.length];
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
