let time = 0;
let particles = [];
let camDistance = 650;

function setup() {
  createCanvas(720, 1280, WEBGL);

  // Create elegant particle system
  for (let i = 0; i < 100; i++) {
    particles.push({
      angle: random(TWO_PI),
      radius: random(200, 400),
      speed: random(0.0005, 0.002),
      size: random(1, 3),
      offset: random(1000)
    });
  }
}

function draw() {
  background(0);
  time += 0.005;

  // Elegant lighting
  ambientLight(60);
  pointLight(255, 255, 255, 0, -300, 400);
  pointLight(150, 150, 150, sin(time * 2) * 300, 0, 200);

  // Gentle automatic orbit with mouse wheel zoom
  let camX = sin(time * 0.3) * camDistance * 0.25;
  let camY = cos(time * 0.15) * camDistance * 0.15 - 50;
  let camZ = cos(time * 0.3) * camDistance * 0.25 + camDistance;
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

  // Main centerpiece - elegant torus knot
  push();
  rotateY(time * 0.4);
  rotateX(time * 0.2);
  drawElegantTorusKnot();
  pop();

  // Flowing Möbius strip
  push();
  rotateY(time * 0.5);
  rotateX(PI / 6);
  scale(1.2);
  drawMobiusStrip();
  pop();

  // Nested spherical harmonics - creates flower-like patterns
  for (let layer = 0; layer < 3; layer++) {
    push();
    rotateY(time * (0.3 + layer * 0.1));
    rotateX(time * 0.2);
    scale(0.8 + layer * 0.15);
    drawSphericalFlower(layer);
    pop();
  }

  // Golden spiral particles
  drawGoldenSpiralParticles();

  // Elegant parametric ribbons
  for (let i = 0; i < 3; i++) {
    push();
    rotateZ(i * TWO_PI / 3);
    rotateY(time * 0.3 + i);
    drawParametricRibbon(i);
    pop();
  }

  // Outer ring with Vogel's spiral points
  push();
  rotateX(time * 0.1);
  drawVogelSpiral();
  pop();

  // Delicate connecting lines
  drawParticleConnections();
}

// Elegant torus knot with multiple strands
function drawElegantTorusKnot() {
  let p = 3;
  let q = 7;
  let R = 80;
  let r = 40;
  let steps = 400;

  for (let strand = 0; strand < 2; strand++) {
    stroke(255, 200);
    strokeWeight(1.5);
    noFill();

    beginShape();
    for (let i = 0; i <= steps; i++) {
      let t = map(i, 0, steps, 0, TWO_PI) + strand * PI;
      let offset = sin(t * 3 + time * 2) * 5;

      let x = (R + (r + offset) * cos(p * t)) * cos(q * t);
      let y = (R + (r + offset) * cos(p * t)) * sin(q * t);
      let z = (r + offset) * sin(p * t);

      vertex(x, y, z);
    }
    endShape();
  }
}

// Möbius strip with mathematical beauty
function drawMobiusStrip() {
  stroke(255, 150);
  strokeWeight(0.8);
  noFill();

  let uSteps = 80;
  let vSteps = 15;

  for (let i = 0; i < uSteps; i++) {
    beginShape(TRIANGLE_STRIP);
    for (let j = 0; j <= vSteps; j++) {
      for (let k = 0; k < 2; k++) {
        let u = map(i + k, 0, uSteps, 0, TWO_PI);
        let v = map(j, 0, vSteps, -0.3, 0.3);

        // Möbius strip equations
        let x = (1 + v * cos(u / 2)) * cos(u) * 100;
        let y = (1 + v * cos(u / 2)) * sin(u) * 100;
        let z = v * sin(u / 2) * 100;

        vertex(x, y, z);
      }
    }
    endShape();
  }
}

// Spherical flower using harmonics
function drawSphericalFlower(layer) {
  let m = 5 + layer;
  let n = 3;
  let size = 120;
  let detail = 40;

  stroke(255, 100 - layer * 20);
  strokeWeight(0.8);
  noFill();

  for (let i = 0; i < detail; i++) {
    beginShape();
    for (let j = 0; j <= detail; j++) {
      let theta = map(j, 0, detail, 0, TWO_PI);
      let phi = map(i, 0, detail, 0, PI);

      // Modified spherical harmonics for petal effect
      let r = size * (0.7 + 0.3 * abs(sin(m * theta) * cos(n * phi + time)));

      let x = r * sin(phi) * cos(theta);
      let y = r * sin(phi) * sin(theta);
      let z = r * cos(phi);

      vertex(x, y, z);
    }
    endShape();
  }
}

// Golden spiral in 3D space
function drawGoldenSpiralParticles() {
  let phi = (1 + sqrt(5)) / 2; // Golden ratio

  stroke(255, 150);
  strokeWeight(2);

  for (let i = 0; i < 300; i++) {
    let theta = i * 2 * PI / (phi * phi);
    let r = 15 * sqrt(i);

    let x = r * cos(theta + time);
    let y = map(i, 0, 300, -300, 300);
    let z = r * sin(theta + time);

    push();
    translate(x, y, z);
    point(0, 0, 0);
    pop();

    // Connect spiral points elegantly
    if (i > 0 && i % 10 === 0) {
      let prevTheta = (i - 10) * 2 * PI / (phi * phi);
      let prevR = 15 * sqrt(i - 10);
      let prevX = prevR * cos(prevTheta + time);
      let prevY = map(i - 10, 0, 300, -300, 300);
      let prevZ = prevR * sin(prevTheta + time);

      stroke(255, 40);
      strokeWeight(0.5);
      line(x, y, z, prevX, prevY, prevZ);
    }
  }
}

// Elegant parametric ribbon
function drawParametricRibbon(index) {
  stroke(255, 120);
  strokeWeight(1);
  noFill();

  let steps = 150;
  let width = 25;

  beginShape(TRIANGLE_STRIP);
  for (let i = 0; i <= steps; i++) {
    let t = map(i, 0, steps, 0, TWO_PI * 2);

    // Base curve - elegant 3D path
    let baseX = 150 * cos(t);
    let baseY = t * 15 - 150;
    let baseZ = 150 * sin(t);

    // Add wave to the curve
    let wave = sin(t * 3 + time * 2 + index) * 20;

    // Create ribbon by offsetting perpendicular to curve
    let perpX = -sin(t);
    let perpZ = cos(t);

    for (let side = -1; side <= 1; side += 2) {
      let x = baseX + perpX * (width + wave) * side;
      let y = baseY;
      let z = baseZ + perpZ * (width + wave) * side;
      vertex(x, y, z);
    }
  }
  endShape();
}

// Vogel's spiral - mathematically perfect point distribution
function drawVogelSpiral() {
  let goldenAngle = PI * (3 - sqrt(5));
  let numPoints = 200;

  stroke(255, 100);
  strokeWeight(1.5);

  for (let i = 0; i < numPoints; i++) {
    let theta = i * goldenAngle + time;
    let r = 15 * sqrt(i);

    // Project on sphere
    let phi = acos(1 - 2 * i / numPoints);

    let x = r * sin(phi) * cos(theta);
    let y = r * sin(phi) * sin(theta);
    let z = r * cos(phi);

    push();
    translate(x, y, z);

    // Draw small sphere at each point
    noStroke();
    fill(255, 180);
    sphere(2);
    pop();
  }
}

// Connect nearby particles with delicate lines
function drawParticleConnections() {
  for (let p of particles) {
    p.angle += p.speed;

    let x = cos(p.angle) * p.radius;
    let y = sin(p.angle * 1.5 + time) * 150;
    let z = sin(p.angle) * p.radius;

    // Draw particle
    push();
    translate(x, y, z);
    stroke(255, 200);
    strokeWeight(p.size);
    point(0, 0, 0);
    pop();
  }

  // Connect close particles
  stroke(255, 30);
  strokeWeight(0.5);

  for (let i = 0; i < particles.length; i++) {
    let p1 = particles[i];
    let x1 = cos(p1.angle) * p1.radius;
    let y1 = sin(p1.angle * 1.5 + time) * 150;
    let z1 = sin(p1.angle) * p1.radius;

    for (let j = i + 1; j < particles.length; j++) {
      let p2 = particles[j];
      let x2 = cos(p2.angle) * p2.radius;
      let y2 = sin(p2.angle * 1.5 + time) * 150;
      let z2 = sin(p2.angle) * p2.radius;

      let d = dist(x1, y1, z1, x2, y2, z2);

      if (d < 60) {
        let alpha = map(d, 0, 60, 50, 0);
        stroke(255, alpha);
        line(x1, y1, z1, x2, y2, z2);
      }
    }
  }
}

// Mouse wheel zoom control
function mouseWheel(event) {
  // Adjust camera distance with mouse wheel
  camDistance += event.delta * 0.5;
  // Limit zoom range
  camDistance = constrain(camDistance, 200, 1200);
  return false; // Prevent page scrolling
}
