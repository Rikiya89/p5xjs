// Riemannian Geometry - 3D Generative Art
// Visualizing curved spaces, geodesics, and manifold curvature

let colors = [];
let manifolds = [];
let geodesics = [];
let particles = [];
let time = 0;

function setup() {
  createCanvas(720, 1280, WEBGL);

  // Color palette
  colors = [
    color('#362d78'),
    color('#523fa3'),
    color('#916ccc'),
    color('#bda1e5'),
    color('#c8c0e9'),
    color('#84bae7'),
    color('#516ad4'),
    color('#333f87'),
    color('#293039'),
    color('#283631')
  ];

  // Initialize manifold layers
  for (let i = 0; i < 5; i++) {
    manifolds.push(new RiemannianManifold(i));
  }

  // Initialize geodesic curves
  for (let i = 0; i < 12; i++) {
    geodesics.push(new Geodesic(i));
  }

  // Initialize particles for parallel transport visualization
  for (let i = 0; i < 80; i++) {
    particles.push(new TransportParticle());
  }
}

function draw() {
  background(colors[8]);

  // Camera movement
  let camX = sin(time * 0.1) * 200;
  let camY = cos(time * 0.08) * 150;
  let camZ = 600 + sin(time * 0.05) * 100;
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

  // Ambient lighting
  ambientLight(60, 60, 80);
  directionalLight(150, 140, 180, -1, 1, -1);
  pointLight(colors[5], 200, -200, 300);

  // Draw manifolds (curved surfaces)
  push();
  for (let manifold of manifolds) {
    manifold.update(time);
    manifold.display();
  }
  pop();

  // Draw geodesic curves
  push();
  for (let geo of geodesics) {
    geo.update(time);
    geo.display();
  }
  pop();

  // Draw transport particles
  push();
  for (let particle of particles) {
    particle.update(time);
    particle.display();
  }
  pop();

  // Central curvature tensor visualization
  drawCurvatureTensor();

  time += 0.01;
}

// Riemannian Manifold class - curved surface representation
class RiemannianManifold {
  constructor(index) {
    this.index = index;
    this.offset = index * 80;
    this.baseRadius = 150 + index * 40;
    this.colorIndex = index % colors.length;
    this.rotationSpeed = 0.2 + random(0.1);
    this.curvature = random(0.5, 2);
  }

  update(t) {
    this.phase = t * this.rotationSpeed;
  }

  display() {
    push();
    rotateX(this.phase * 0.3);
    rotateY(this.phase * 0.5);
    rotateZ(this.phase * 0.2);

    noFill();
    let c = colors[this.colorIndex];
    stroke(red(c), green(c), blue(c), 80);
    strokeWeight(0.8);

    // Draw curved surface using parametric equations
    let segments = 40;
    for (let u = 0; u < segments; u++) {
      beginShape();
      for (let v = 0; v <= segments; v++) {
        let theta = map(u, 0, segments, 0, TWO_PI);
        let phi = map(v, 0, segments, -PI / 2, PI / 2);

        // Riemannian metric deformation
        let curveFactor = 1 + 0.3 * sin(theta * 3 + this.phase) * cos(phi * 2);
        let r = this.baseRadius * curveFactor;

        // Gaussian curvature visualization
        let gaussianCurve = sin(theta * 2 + phi * 3 + this.phase * 2) * 20;

        let x = r * cos(phi) * cos(theta) + gaussianCurve * sin(this.phase);
        let y = r * cos(phi) * sin(theta) + gaussianCurve * cos(this.phase);
        let z = r * sin(phi) * this.curvature;

        vertex(x, y, z);
      }
      endShape();
    }

    // Meridian lines
    for (let v = 0; v < segments; v++) {
      beginShape();
      for (let u = 0; u <= segments; u++) {
        let theta = map(u, 0, segments, 0, TWO_PI);
        let phi = map(v, 0, segments, -PI / 2, PI / 2);

        let curveFactor = 1 + 0.3 * sin(theta * 3 + this.phase) * cos(phi * 2);
        let r = this.baseRadius * curveFactor;
        let gaussianCurve = sin(theta * 2 + phi * 3 + this.phase * 2) * 20;

        let x = r * cos(phi) * cos(theta) + gaussianCurve * sin(this.phase);
        let y = r * cos(phi) * sin(theta) + gaussianCurve * cos(this.phase);
        let z = r * sin(phi) * this.curvature;

        vertex(x, y, z);
      }
      endShape();
    }
    pop();
  }
}

// Geodesic class - shortest paths on curved surfaces
class Geodesic {
  constructor(index) {
    this.index = index;
    this.points = [];
    this.colorIndex = (index + 2) % colors.length;
    this.phase = random(TWO_PI);
    this.speed = random(0.3, 0.8);
    this.radius = random(100, 300);
    this.spiralFactor = random(1, 4);

    // Generate geodesic path
    this.generatePath();
  }

  generatePath() {
    this.points = [];
    let numPoints = 100;

    for (let i = 0; i < numPoints; i++) {
      let t = map(i, 0, numPoints, 0, TWO_PI * 2);

      // Geodesic on a deformed sphere (great circle with perturbation)
      let x = this.radius * cos(t) * sin(t * this.spiralFactor * 0.5);
      let y = this.radius * sin(t) * cos(t * 0.3);
      let z = this.radius * 0.5 * sin(t * this.spiralFactor);

      this.points.push(createVector(x, y, z));
    }
  }

  update(t) {
    this.currentPhase = t * this.speed + this.phase;

    // Update points with time-based deformation
    for (let i = 0; i < this.points.length; i++) {
      let baseT = map(i, 0, this.points.length, 0, TWO_PI * 2);
      let deform = sin(baseT * 2 + this.currentPhase * 2) * 0.02;

      this.points[i].x += sin(this.currentPhase + i * 0.1) * deform;
      this.points[i].y += cos(this.currentPhase + i * 0.1) * deform;
    }
  }

  display() {
    push();
    rotateY(this.currentPhase * 0.2);
    rotateX(this.currentPhase * 0.1);

    let c = colors[this.colorIndex];
    stroke(red(c), green(c), blue(c), 150);
    strokeWeight(1.5);
    noFill();

    beginShape();
    for (let p of this.points) {
      vertex(p.x, p.y, p.z);
    }
    endShape();

    // Highlight points along geodesic
    let highlightIndex = floor((this.currentPhase * 10) % this.points.length);
    let hp = this.points[highlightIndex];

    push();
    translate(hp.x, hp.y, hp.z);
    fill(colors[4]);
    noStroke();
    sphere(5);
    pop();

    pop();
  }
}

// Transport Particle - visualizing parallel transport
class TransportParticle {
  constructor() {
    this.reset();
  }

  reset() {
    this.theta = random(TWO_PI);
    this.phi = random(-PI / 2, PI / 2);
    this.radius = random(80, 350);
    this.speed = random(0.005, 0.02);
    this.size = random(2, 6);
    this.colorIndex = floor(random(colors.length));
    this.orbitOffset = random(TWO_PI);
    this.verticalSpeed = random(0.002, 0.01);
  }

  update(t) {
    // Move along geodesic path on curved surface
    this.theta += this.speed;
    this.phi = sin(t * this.verticalSpeed + this.orbitOffset) * PI / 3;

    // Parallel transport - vector rotates as it moves on curved surface
    this.transportAngle = t + this.theta * 2;
  }

  display() {
    // Curvature-affected position
    let curveFactor = 1 + 0.2 * sin(this.theta * 4 + this.phi * 2);
    let r = this.radius * curveFactor;

    let x = r * cos(this.phi) * cos(this.theta);
    let y = r * cos(this.phi) * sin(this.theta);
    let z = r * sin(this.phi);

    push();
    translate(x, y, z);

    // Draw particle
    let c = colors[this.colorIndex];
    fill(red(c), green(c), blue(c), 200);
    noStroke();
    sphere(this.size);

    // Draw transport vector (shows how vectors rotate during parallel transport)
    stroke(colors[5]);
    strokeWeight(1);
    let vecLen = 15;
    let vx = vecLen * cos(this.transportAngle);
    let vy = vecLen * sin(this.transportAngle);
    line(0, 0, 0, vx, vy, 0);

    pop();
  }
}

// Central curvature tensor visualization
function drawCurvatureTensor() {
  push();

  // Riemann curvature tensor as interlocking rings
  for (let i = 0; i < 4; i++) {
    push();
    rotateX(time * 0.3 + i * PI / 4);
    rotateY(time * 0.2 + i * PI / 3);
    rotateZ(time * 0.1);

    let c = colors[i % colors.length];
    stroke(red(c), green(c), blue(c), 120);
    strokeWeight(2);
    noFill();

    // Tensor component rings
    let ringRadius = 60 + i * 15;
    beginShape();
    for (let a = 0; a <= TWO_PI; a += 0.1) {
      let wobble = sin(a * 4 + time * 2) * 10;
      let x = (ringRadius + wobble) * cos(a);
      let y = (ringRadius + wobble) * sin(a);
      let z = sin(a * 3 + time) * 20;
      vertex(x, y, z);
    }
    endShape(CLOSE);
    pop();
  }

  // Christoffel symbols visualization - connection coefficients
  for (let j = 0; j < 6; j++) {
    push();
    rotateX(j * PI / 3);
    rotateY(time * 0.15);

    let c = colors[(j + 5) % colors.length];
    stroke(red(c), green(c), blue(c), 100);
    strokeWeight(1);

    // Connection lines
    for (let k = 0; k < 8; k++) {
      let angle = k * PI / 4 + time * 0.5;
      let r = 40 + sin(time + k) * 15;
      let x1 = r * cos(angle);
      let y1 = r * sin(angle);
      let x2 = (r + 30) * cos(angle + 0.3);
      let y2 = (r + 30) * sin(angle + 0.3);
      line(x1, y1, 0, x2, y2, 10);
    }
    pop();
  }

  // Central glowing sphere - metric tensor
  push();
  let pulseSize = 25 + sin(time * 2) * 5;

  // Inner glow
  for (let layer = 0; layer < 3; layer++) {
    let layerSize = pulseSize + layer * 8;
    let alpha = 80 - layer * 20;
    let c = colors[2];
    fill(red(c), green(c), blue(c), alpha);
    noStroke();
    sphere(layerSize);
  }
  pop();

  pop();
}

// Handle window resize
function windowResized() {
  resizeCanvas(720, 1280);
}
