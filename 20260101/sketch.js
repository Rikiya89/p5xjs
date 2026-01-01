let colors;
let particles = [];
let numParticles = 150;
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

  // Initialize particles with mathematical properties
  for (let i = 0; i < numParticles; i++) {
    particles.push({
      angle: (TWO_PI / numParticles) * i,
      radius: random(100, 400),
      speed: random(0.001, 0.003),
      phase: random(TWO_PI),
      color: random(colors),
      size: random(5, 20),
      verticalPhase: random(TWO_PI)
    });
  }
}

function draw() {
  background(20, 15, 35);

  // Lighting
  ambientLight(60, 60, 80);
  pointLight(255, 255, 255, 0, 0, 400);
  pointLight(150, 100, 200, 200, -200, 0);

  // Rotate the whole scene
  rotateY(time * 0.2);
  rotateX(sin(time * 0.15) * 0.3);

  // Draw connecting lines based on mathematical relationships
  stroke(255, 255, 255, 20);
  strokeWeight(1);
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      let p1 = particles[i];
      let p2 = particles[j];

      // Calculate positions using parametric equations
      let x1 = p1.radius * cos(p1.angle + time * p1.speed) * cos(time * 0.5 + p1.verticalPhase);
      let y1 = p1.radius * sin(time * 0.3 + p1.phase) * sin(p1.verticalPhase);
      let z1 = p1.radius * sin(p1.angle + time * p1.speed) * cos(time * 0.5 + p1.verticalPhase);

      let x2 = p2.radius * cos(p2.angle + time * p2.speed) * cos(time * 0.5 + p2.verticalPhase);
      let y2 = p2.radius * sin(time * 0.3 + p2.phase) * sin(p2.verticalPhase);
      let z2 = p2.radius * sin(p2.angle + time * p2.speed) * cos(time * 0.5 + p2.verticalPhase);

      let d = dist(x1, y1, z1, x2, y2, z2);

      // Draw line if particles are close using Fibonacci sequence relationship
      if (d < 150 && (i * j) % 8 === 0) {
        line(x1, y1, z1, x2, y2, z2);
      }
    }
  }

  // Draw particles
  noStroke();
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];

    push();

    // Parametric equations for 3D position
    // Using spherical coordinates with time-based modulation
    let x = p.radius * cos(p.angle + time * p.speed) * cos(time * 0.5 + p.verticalPhase);
    let y = p.radius * sin(time * 0.3 + p.phase) * sin(p.verticalPhase);
    let z = p.radius * sin(p.angle + time * p.speed) * cos(time * 0.5 + p.verticalPhase);

    translate(x, y, z);

    // Color variation based on position using golden ratio
    let goldenRatio = 1.618033988749;
    let colorIndex = floor((i * goldenRatio) % colors.length);
    let c = p.color;
    fill(c);

    // Size pulsates using sine wave
    let pulseSize = p.size * (1 + sin(time * 2 + p.phase) * 0.3);

    // Fibonacci spiral influence on shape
    let fibRotation = time * 0.5 + (i * goldenRatio);
    rotateZ(fibRotation);
    rotateX(fibRotation * 0.5);

    // Draw as box or sphere based on mathematical sequence
    if (i % 3 === 0) {
      box(pulseSize);
    } else if (i % 3 === 1) {
      sphere(pulseSize * 0.5);
    } else {
      torus(pulseSize * 0.8, pulseSize * 0.3);
    }

    pop();
  }

  // Central rotating structure using Lissajous curves
  push();
  noFill();
  strokeWeight(2);
  for (let i = 0; i < 5; i++) {
    stroke(colors[i * 2 % colors.length]);
    let a = 3 + i;
    let b = 4 + i;
    beginShape();
    for (let t = 0; t < TWO_PI; t += 0.1) {
      let x = 150 * sin(a * t + time * 0.5);
      let y = 150 * sin(b * t);
      let z = 150 * cos(a * t + time * 0.3) * sin(b * t);
      vertex(x, y, z);
    }
    endShape(CLOSE);
  }
  pop();

  time += 0.01;
}
