let particles = [];
let flowField = [];
let numParticles = 800;
let noiseScale = 0.01;
let timeOffset = 0;
let layers = [];

function setup() {
  createCanvas(720, 1280, WEBGL);

  // Create multiple flowing layers
  for (let i = 0; i < 5; i++) {
    layers.push({
      rotation: random(TWO_PI),
      speed: random(0.001, 0.003),
      radius: random(150, 300),
      points: []
    });

    // Initialize points for each layer
    for (let j = 0; j < 100; j++) {
      layers[i].points.push({
        angle: (j / 100) * TWO_PI,
        noiseOffset: random(1000)
      });
    }
  }

  // Create particles
  for (let i = 0; i < numParticles; i++) {
    particles.push({
      pos: createVector(
        random(-width/2, width/2),
        random(-height/2, height/2),
        random(-300, 300)
      ),
      vel: createVector(0, 0, 0),
      size: random(1, 3),
      alpha: random(50, 255),
      offset: random(1000)
    });
  }
}

function draw() {
  background(0);

  // Subtle lighting
  ambientLight(150);
  pointLight(255, 255, 255, 0, 0, 400);

  // Camera movement
  let camX = sin(frameCount * 0.001) * 100;
  let camY = cos(frameCount * 0.0015) * 50;
  camera(camX, camY, 600, 0, 0, 0, 0, 1, 0);

  // Rotate the entire scene slowly
  rotateY(frameCount * 0.002);

  // Draw flowing ribbon layers
  noFill();
  for (let layer of layers) {
    push();
    rotateZ(layer.rotation);
    layer.rotation += layer.speed;

    strokeWeight(1.5);

    // Draw multiple ribbons per layer
    for (let r = 0; r < 3; r++) {
      beginShape();
      for (let point of layer.points) {
        let radius = layer.radius + r * 30;
        let x = cos(point.angle) * radius;
        let y = sin(point.angle) * radius;

        // Add noise-based displacement
        let noiseVal = noise(
          point.noiseOffset + timeOffset,
          point.angle * 2,
          r * 0.5
        );

        let z = map(noiseVal, 0, 1, -150, 150);

        // Color variation based on depth
        let brightness = map(z, -150, 150, 100, 255);
        stroke(brightness, map(r, 0, 2, 150, 50));

        vertex(x, y, z);
      }
      endShape(CLOSE);
    }
    pop();
  }

  // Draw particles
  for (let p of particles) {
    // Noise-based movement
    let noiseX = noise(p.pos.x * noiseScale, p.pos.y * noiseScale, timeOffset);
    let noiseY = noise(p.pos.x * noiseScale + 1000, p.pos.y * noiseScale, timeOffset);
    let noiseZ = noise(p.pos.x * noiseScale, p.pos.y * noiseScale + 1000, timeOffset);

    // Update velocity
    p.vel.x = map(noiseX, 0, 1, -0.5, 0.5);
    p.vel.y = map(noiseY, 0, 1, -0.5, 0.5);
    p.vel.z = map(noiseZ, 0, 1, -1, 1);

    // Update position
    p.pos.add(p.vel);

    // Wrap around edges
    if (p.pos.x > width/2) p.pos.x = -width/2;
    if (p.pos.x < -width/2) p.pos.x = width/2;
    if (p.pos.y > height/2) p.pos.y = -height/2;
    if (p.pos.y < -height/2) p.pos.y = height/2;
    if (p.pos.z > 300) p.pos.z = -300;
    if (p.pos.z < -300) p.pos.z = 300;

    // Draw particle
    push();
    translate(p.pos.x, p.pos.y, p.pos.z);

    // Size and brightness based on depth
    let depthFactor = map(p.pos.z, -300, 300, 0.3, 1.5);
    let brightness = map(p.pos.z, -300, 300, 100, 255);

    noStroke();
    fill(brightness, p.alpha * depthFactor);
    sphere(p.size * depthFactor);
    pop();
  }

  // Draw central geometric structure
  push();
  rotateX(frameCount * 0.003);
  rotateY(frameCount * 0.005);

  strokeWeight(1);
  noFill();

  // Nested boxes with varying sizes
  for (let i = 0; i < 5; i++) {
    let size = 50 + i * 40;
    let brightness = 255 - i * 30;
    stroke(brightness, 200);

    push();
    rotateZ(frameCount * 0.002 * (i + 1));
    box(size);
    pop();
  }
  pop();

  // Update time
  timeOffset += 0.005;
}

