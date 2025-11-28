let angle = 0;
let layers = [];
let spikes = [];
let particles = [];

function setup() {
  createCanvas(720, 1280, WEBGL);

  // Create multiple layers of serrated geometry with varying patterns
  for (let i = 0; i < 12; i++) {
    layers.push({
      radius: 80 + i * 35,
      segments: 8 + i * 3,
      depth: 40 + i * 15,
      rotation: random(TWO_PI),
      speed: 0.001 + i * 0.0008,
      offset: random(TWO_PI),
      wave: random(0.5, 1.5)
    });
  }

  // Create decorative spikes
  for (let i = 0; i < 30; i++) {
    spikes.push({
      theta: random(TWO_PI),
      phi: random(PI),
      length: random(150, 300),
      thickness: random(2, 8),
      speed: random(0.0005, 0.002),
      offset: random(TWO_PI)
    });
  }

  // Create floating particles
  for (let i = 0; i < 100; i++) {
    particles.push({
      x: random(-400, 400),
      y: random(-640, 640),
      z: random(-400, 400),
      size: random(1, 4),
      speed: random(0.5, 2)
    });
  }
}

function draw() {
  background(0);

  // Optimal camera position for dramatic view
  let camX = sin(angle * 0.3) * 200;
  let camY = -300;
  let camZ = 600 + cos(angle * 0.2) * 100;
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

  // Enhanced lighting
  ambientLight(80);
  pointLight(255, 255, 255, 200, -200, 200);
  pointLight(255, 255, 255, -200, 200, -200);
  directionalLight(255, 255, 255, 0, 0, -1);

  // Rotate the entire scene - smooth oscillating motion
  rotateX(sin(angle * 0.15) * PI / 3);
  rotateY(sin(angle * 0.25) * PI / 2.5);
  rotateZ(sin(angle * 0.1) * PI / 6);

  // Draw floating particles
  push();
  noStroke();
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    push();
    translate(p.x, p.y, p.z);
    fill(255);
    sphere(p.size);
    pop();

    // Animate particles
    p.y += p.speed;
    if (p.y > 640) {
      p.y = -640;
      p.x = random(-400, 400);
      p.z = random(-400, 400);
    }
  }
  pop();

  // Draw each layer of serrated geometry with more complex patterns
  for (let i = 0; i < layers.length; i++) {
    let layer = layers[i];

    push();
    rotateZ(layer.rotation + angle * layer.speed);
    rotateX(sin(angle * layer.wave + layer.offset) * 0.2);

    // Alternating black and white with different stroke weights
    if (i % 3 === 0) {
      fill(255);
      stroke(0);
      strokeWeight(2);
    } else if (i % 3 === 1) {
      fill(0);
      stroke(255);
      strokeWeight(1);
    } else {
      noFill();
      stroke(255);
      strokeWeight(1.5);
    }

    // Draw complex serrated ring
    drawComplexSerratedRing(layer.radius, layer.segments, layer.depth, i);

    pop();
  }

  // Draw animated spikes
  for (let i = 0; i < spikes.length; i++) {
    let spike = spikes[i];

    push();

    let dynamicLength = spike.length + sin(angle * spike.speed + spike.offset) * 50;

    rotateY(spike.theta);
    rotateX(spike.phi);

    if (i % 2 === 0) {
      fill(255);
      stroke(0);
    } else {
      fill(0);
      stroke(255);
    }
    strokeWeight(0.5);

    // Draw spike as elongated pyramid
    beginShape(TRIANGLES);
    let base = spike.thickness;

    vertex(0, 0, 0);
    vertex(base, 0, 0);
    vertex(base/2, dynamicLength, 0);

    vertex(0, 0, 0);
    vertex(0, 0, base);
    vertex(base/2, dynamicLength, base/2);

    vertex(base, 0, 0);
    vertex(0, 0, base);
    vertex(base/2, dynamicLength, base/2);

    endShape();

    pop();
  }

  // Draw central complex serrated structure
  push();
  rotateX(angle * 0.6);
  rotateZ(angle * 0.5);
  rotateY(angle * 0.3);

  // Multiple nested serrated spheres
  for (let s = 0; s < 3; s++) {
    push();
    rotateY(angle * (0.5 + s * 0.2));
    if (s % 2 === 0) {
      fill(255);
      stroke(0);
    } else {
      fill(0);
      stroke(255);
    }
    strokeWeight(1);
    drawSerratedSphere(60 - s * 15, 6 + s * 2);
    pop();
  }

  pop();

  angle += 0.008;
}

function drawComplexSerratedRing(radius, segments, depth, layerIndex) {
  // Draw outer serrated edge
  beginShape(TRIANGLE_STRIP);

  for (let i = 0; i <= segments * 2; i++) {
    let angle1 = (i / (segments * 2)) * TWO_PI;

    // Create complex serration pattern
    let serrationPattern = i % 4;
    let depthMod = 1;

    if (serrationPattern === 0) depthMod = 1.2;
    else if (serrationPattern === 1) depthMod = 0.6;
    else if (serrationPattern === 2) depthMod = 1.0;
    else depthMod = 0.3;

    // Add wave motion
    let wave = sin(angle1 * 3 + angle * 2) * 0.2 + 1;

    let x1 = cos(angle1) * radius * wave;
    let y1 = sin(angle1) * radius * wave;
    let z1 = depth * depthMod;

    let x2 = cos(angle1) * (radius * 0.65);
    let y2 = sin(angle1) * (radius * 0.65);
    let z2 = -depth * 0.3;

    vertex(x1, y1, z1);
    vertex(x2, y2, z2);
  }

  endShape(CLOSE);

  // Add connecting spikes between rings
  if (layerIndex % 2 === 0) {
    for (let i = 0; i < segments; i++) {
      let angle1 = (i / segments) * TWO_PI;

      push();
      rotateZ(angle1);
      translate(radius, 0, 0);

      beginShape(TRIANGLES);
      vertex(0, 0, 0);
      vertex(10, 5, depth * 0.5);
      vertex(10, -5, depth * 0.5);
      endShape();

      pop();
    }
  }
}

function drawSerratedSphere(radius, detail) {
  let segments = detail * 4;

  for (let i = 0; i < segments; i++) {
    beginShape(TRIANGLE_STRIP);

    for (let j = 0; j <= segments; j++) {
      let theta1 = (i / segments) * PI;
      let theta2 = ((i + 1) / segments) * PI;
      let phi = (j / segments) * TWO_PI;

      // Enhanced serration with multiple patterns
      let pattern = (i + j) % 3;
      let serration1, serration2;

      if (pattern === 0) {
        serration1 = 1.2;
        serration2 = 0.8;
      } else if (pattern === 1) {
        serration1 = 0.9;
        serration2 = 1.15;
      } else {
        serration1 = 1.0;
        serration2 = 1.0;
      }

      let x1 = radius * serration1 * sin(theta1) * cos(phi);
      let y1 = radius * serration1 * sin(theta1) * sin(phi);
      let z1 = radius * serration1 * cos(theta1);

      let x2 = radius * serration2 * sin(theta2) * cos(phi);
      let y2 = radius * serration2 * sin(theta2) * sin(phi);
      let z2 = radius * serration2 * cos(theta2);

      vertex(x1, y1, z1);
      vertex(x2, y2, z2);
    }

    endShape(CLOSE);
  }
}
