// 3D Generative Art with Mathematical Formulas
// Using: Spherical Harmonics, Lissajous Curves, Fibonacci Spheres, and Parametric Equations

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

let particles = [];
let numParticles = 200;
let rotationX = 0;
let rotationY = 0;
let time = 0;
let mathematicalCurves = [];

function setup() {
  createCanvas(720, 1280, WEBGL);

  // Initialize particles using Fibonacci Sphere distribution
  for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle(i, numParticles));
  }

  // Create mathematical curves
  mathematicalCurves.push(new LissajousCurve(3, 2, 5, 0));
  mathematicalCurves.push(new LissajousCurve(5, 4, 3, PI/2));
  mathematicalCurves.push(new SphericalHarmonics(3, 2));
  mathematicalCurves.push(new SphericalHarmonics(4, 3));
}

function draw() {
  background('#0a0a0f');

  // Lighting
  ambientLight(60, 60, 80);
  pointLight(150, 150, 200, 200, -200, 200);
  pointLight(100, 80, 150, -200, 200, -200);
  pointLight(120, 100, 180, 0, 300, 0);

  // Smooth rotation
  rotationX += 0.003;
  rotationY += 0.002;

  rotateX(rotationX);
  rotateY(rotationY);

  time += 0.01;

  // Draw mathematical curves
  for (let curve of mathematicalCurves) {
    curve.update(time);
    curve.display();
  }

  // Draw Fibonacci spiral in 3D
  drawFibonacciSpiral();

  // Draw connecting lines with mathematical decay
  drawConnections();

  // Update and draw particles
  for (let particle of particles) {
    particle.update(time);
    particle.display();
  }

  // Draw central structure using Hopf fibration inspired patterns
  drawHopfFibration();
}

// Fibonacci Sphere distribution for optimal particle placement
function fibonacciSphere(i, n) {
  const goldenRatio = (1 + sqrt(5)) / 2;
  const theta = TWO_PI * i / goldenRatio;
  const phi = acos(1 - 2 * (i + 0.5) / n);

  return {
    theta: theta,
    phi: phi
  };
}

// Draw 3D Fibonacci spiral
function drawFibonacciSpiral() {
  push();
  noFill();
  stroke(colors[8]);
  strokeWeight(1);

  beginShape();
  for (let i = 0; i < 100; i++) {
    let angle = i * 0.1;
    let radius = 10 * sqrt(i);
    let z = i * 3 - 150;

    // Golden angle spiral
    let x = radius * cos(angle * 2.39996322972865332);
    let y = radius * sin(angle * 2.39996322972865332);

    vertex(x, y, z);
  }
  endShape();
  pop();
}

// Draw connections using exponential decay
function drawConnections() {
  stroke(colors[6]);
  strokeWeight(0.5);

  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      let d = dist(
        particles[i].pos.x, particles[i].pos.y, particles[i].pos.z,
        particles[j].pos.x, particles[j].pos.y, particles[j].pos.z
      );

      if (d < 120) {
        // Exponential decay for alpha
        let alpha = 100 * exp(-d / 60);
        stroke(colors[6] + hex(floor(alpha), 2));
        line(
          particles[i].pos.x, particles[i].pos.y, particles[i].pos.z,
          particles[j].pos.x, particles[j].pos.y, particles[j].pos.z
        );
      }
    }
  }
}

// Hopf fibration inspired central structure
function drawHopfFibration() {
  push();
  noFill();
  strokeWeight(1.5);

  // Create interlocking circles using Hopf map
  for (let i = 0; i < 8; i++) {
    let phase = (i / 8) * TWO_PI;

    push();
    stroke(colors[i % colors.length]);

    // Rotate based on Hopf coordinates
    rotateY(phase);
    rotateX(time * 0.5 + phase);

    // Draw circle using parametric equation
    beginShape();
    for (let t = 0; t < TWO_PI; t += 0.1) {
      let r = 120;
      let x = r * cos(t) * cos(time + phase);
      let y = r * sin(t);
      let z = r * cos(t) * sin(time + phase);
      vertex(x, y, z);
    }
    endShape(CLOSE);
    pop();
  }
  pop();
}

// Lissajous 3D Curve
class LissajousCurve {
  constructor(a, b, c, delta) {
    this.a = a; // Frequency on X
    this.b = b; // Frequency on Y
    this.c = c; // Frequency on Z
    this.delta = delta; // Phase shift
    this.scale = 80;
    this.color = random(colors);
  }

  update(t) {
    this.phase = t;
  }

  display() {
    push();
    noFill();
    stroke(this.color);
    strokeWeight(1);

    beginShape();
    for (let t = 0; t < TWO_PI; t += 0.05) {
      // Lissajous parametric equations
      let x = this.scale * sin(this.a * t + this.phase);
      let y = this.scale * sin(this.b * t + this.delta);
      let z = this.scale * sin(this.c * t);
      vertex(x, y, z);
    }
    endShape();
    pop();
  }
}

// Spherical Harmonics
class SphericalHarmonics {
  constructor(m, n) {
    this.m = m;
    this.n = n;
    this.scale = 100;
    this.color = random(colors);
  }

  update(t) {
    this.phase = t;
  }

  display() {
    push();
    noFill();
    stroke(this.color + '80');
    strokeWeight(0.8);

    // Draw spherical harmonic surface
    for (let theta = 0; theta < PI; theta += PI / 12) {
      beginShape();
      for (let phi = 0; phi < TWO_PI; phi += PI / 12) {
        // Simplified spherical harmonics
        let r = this.scale * (1 + 0.3 * sin(this.m * phi + this.phase) * cos(this.n * theta));

        let x = r * sin(theta) * cos(phi);
        let y = r * sin(theta) * sin(phi);
        let z = r * cos(theta);

        vertex(x, y, z);
      }
      endShape(CLOSE);
    }
    pop();
  }
}

class Particle {
  constructor(index, total) {
    // Use Fibonacci sphere for uniform distribution
    let fib = fibonacciSphere(index, total);
    let radius = 250 + 100 * sin(index * 0.5);

    this.pos = new p5.Vector(
      radius * sin(fib.phi) * cos(fib.theta),
      radius * sin(fib.phi) * sin(fib.theta),
      radius * cos(fib.phi)
    );

    this.originalPos = this.pos.copy();
    this.color = colors[index % colors.length];
    this.size = random(3, 8);
    this.index = index;
    this.total = total;

    // Use golden ratio for speed variation
    this.speed = 0.5 + (index % 10) / 10;
    this.offset = index * 0.1;
  }

  update(t) {
    // Movement using spherical harmonics
    let m = 3;
    let n = 2;

    // Modulate radius using spherical harmonics
    let radiusModulation = 30 * sin(m * (t * this.speed + this.offset)) * cos(n * t * this.speed);

    // Apply perturbation
    let scale = 1 + radiusModulation / 300;

    this.pos.x = this.originalPos.x * scale + 20 * sin(t * this.speed + this.offset);
    this.pos.y = this.originalPos.y * scale + 20 * cos(t * this.speed * 1.1 + this.offset);
    this.pos.z = this.originalPos.z * scale + 20 * sin(t * this.speed * 0.9 + this.offset);
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);

    // Particle with glow
    noStroke();
    fill(this.color);
    sphere(this.size);

    // Outer glow
    fill(this.color + '40');
    sphere(this.size * 1.5);

    pop();
  }
}
