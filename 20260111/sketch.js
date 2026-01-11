// 3D Generative Art - Black & White Theme
// Beautiful Mathematical Forms
// 720 x 1280 - OPTIMIZED & ELEGANT

let time = 0;
let aizawaPoints = [];
let trailHistory = [];
let maxTrails = 8;

function setup() {
  createCanvas(720, 1280, WEBGL);
  generateAizawaAttractor();

  // Initialize trail history
  for (let i = 0; i < maxTrails; i++) {
    trailHistory.push([]);
  }
}

// SUPERFORMULA - organic mathematical beauty
function superformula(theta, m, n1, n2, n3) {
  let t1 = abs(cos(m * theta / 4));
  let t2 = abs(sin(m * theta / 4));
  return pow(pow(t1, n2) + pow(t2, n3), -1 / n1);
}

function superformula3D(lat, lon, m1, n1, m2, scale) {
  let r1 = superformula(lon, m1, n1, 1, 1);
  let r2 = superformula(lat, m2, n1, 1, 1);
  return createVector(
    r1 * cos(lon) * r2 * cos(lat) * scale,
    r1 * sin(lon) * r2 * cos(lat) * scale,
    r2 * sin(lat) * scale
  );
}

// AIZAWA ATTRACTOR - chaotic elegance
function generateAizawaAttractor() {
  let x = 0.1, y = 0, z = 0;
  let a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1;
  let dt = 0.01;

  for (let i = 0; i < 6000; i++) {
    let dx = (z - b) * x - d * y;
    let dy = d * x + (z - b) * y;
    let dz = c + a * z - pow(z, 3) / 3 - (x * x + y * y) * (1 + e * z) + f * z * pow(x, 3);
    x += dx * dt;
    y += dy * dt;
    z += dz * dt;
    aizawaPoints.push(createVector(x * 95, y * 95, z * 95));
  }
}

// SPHERICAL HARMONIC - quantum beauty
function sphericalHarmonic(theta, phi, l, m, scale) {
  let r = 0;
  if (l === 2) {
    r = m === 0 ? 3 * pow(cos(theta), 2) - 1 : pow(sin(theta), 2) * cos(m * phi);
  } else if (l === 3) {
    r = sin(theta) * (5 * pow(cos(theta), 2) - 1) * cos(m * phi);
  }
  r = abs(r) * scale;
  return createVector(
    r * sin(theta) * cos(phi),
    r * sin(theta) * sin(phi),
    r * cos(theta)
  );
}

function draw() {
  // Soft gradient background effect
  background(5);

  // Elegant lighting setup
  ambientLight(35);
  directionalLight(255, 255, 255, 0.2, 0.4, -1);
  pointLight(200, 200, 200, 0, -600, 400);

  // Smooth camera orbit
  let camX = sin(time * 0.2) * 580;
  let camZ = cos(time * 0.2) * 580;
  let camY = sin(time * 0.12) * 100 - 60;
  camera(camX, camY, camZ, 0, 30, 0, 0, 1, 0);

  // ===== Outer glow rings =====
  push();
  noFill();
  for (let i = 0; i < 5; i++) {
    let alpha = map(i, 0, 5, 40, 10);
    stroke(255, alpha);
    strokeWeight(0.5);

    push();
    rotateX(PI/2 + sin(time * 0.15 + i * 0.5) * 0.2);
    rotateY(time * 0.08 + i * 0.3);
    let size = 400 + i * 40 + sin(time * 0.3 + i) * 20;
    ellipse(0, 0, size, size);
    pop();
  }
  pop();

  // ===== Aizawa Attractor with glow effect =====
  push();
  translate(0, -160, 0);
  rotateY(time * 0.35);
  rotateX(sin(time * 0.2) * 0.15);

  let startIdx = floor((time * 180) % aizawaPoints.length);

  // Glow layer (thicker, more transparent)
  stroke(255, 40);
  strokeWeight(3);
  noFill();
  beginShape();
  for (let i = 0; i < 3500; i += 2) {
    let idx = (startIdx + i) % aizawaPoints.length;
    let p = aizawaPoints[idx];
    vertex(p.x, p.y, p.z);
  }
  endShape();

  // Main line
  stroke(255, 180);
  strokeWeight(0.8);
  beginShape();
  for (let i = 0; i < 3500; i++) {
    let idx = (startIdx + i) % aizawaPoints.length;
    let p = aizawaPoints[idx];
    let alpha = map(i, 0, 3500, 80, 220);
    stroke(255, alpha);
    vertex(p.x, p.y, p.z);
  }
  endShape();

  // Elegant glowing orbs along path
  noStroke();
  for (let i = 0; i < 20; i++) {
    let idx = floor((startIdx + i * 175) % aizawaPoints.length);
    let p = aizawaPoints[idx];
    push();
    translate(p.x, p.y, p.z);

    // Outer glow
    fill(255, 30);
    sphere(6 + sin(time * 1.5 + i * 0.4) * 2);

    // Inner bright core
    fill(255, 200);
    sphere(1.5 + sin(time * 2 + i * 0.3) * 0.5);
    pop();
  }
  pop();

  // ===== Superformula with elegant wireframe =====
  push();
  translate(0, 300, 0);
  rotateX(time * 0.4);
  rotateY(time * 0.3);
  rotateZ(time * 0.1);

  let m1 = 5 + sin(time * 0.5) * 2;
  let m2 = 4 + cos(time * 0.4) * 1.5;
  let n1 = 1 + sin(time * 0.35) * 0.35;

  let detail = 30;

  // Glow effect
  stroke(255, 25);
  strokeWeight(2.5);
  noFill();
  for (let i = 0; i <= detail; i += 3) {
    beginShape();
    let lat = map(i, 0, detail, -HALF_PI, HALF_PI);
    for (let j = 0; j <= detail; j++) {
      let lon = map(j, 0, detail, -PI, PI);
      let v = superformula3D(lat, lon, m1, n1, m2, 85);
      vertex(v.x, v.y, v.z);
    }
    endShape();
  }

  // Main wireframe
  stroke(255, 120);
  strokeWeight(0.6);
  for (let i = 0; i <= detail; i += 2) {
    beginShape();
    let lat = map(i, 0, detail, -HALF_PI, HALF_PI);
    for (let j = 0; j <= detail; j++) {
      let lon = map(j, 0, detail, -PI, PI);
      let v = superformula3D(lat, lon, m1, n1, m2, 85);
      vertex(v.x, v.y, v.z);
    }
    endShape();
  }

  // Longitude accent lines
  stroke(255, 80);
  strokeWeight(0.4);
  for (let j = 0; j <= detail; j += 5) {
    beginShape();
    let lon = map(j, 0, detail, -PI, PI);
    for (let i = 0; i <= detail; i++) {
      let lat = map(i, 0, detail, -HALF_PI, HALF_PI);
      let v = superformula3D(lat, lon, m1, n1, m2, 85);
      vertex(v.x, v.y, v.z);
    }
    endShape();
  }
  pop();

  // ===== Spherical Harmonics - floating quantum orbitals =====
  push();
  let orbitals = [
    {l: 2, m: 0, scale: 55, ox: -130, oy: 20},
    {l: 2, m: 2, scale: 55, ox: 130, oy: 20},
    {l: 3, m: 1, scale: 45, ox: 0, oy: -40}
  ];

  for (let k = 0; k < orbitals.length; k++) {
    let orb = orbitals[k];
    push();

    let floatX = orb.ox + sin(time * 0.4 + k * 2) * 15;
    let floatY = orb.oy + cos(time * 0.35 + k * 2) * 15;
    let floatZ = sin(time * 0.25 + k) * 30;
    translate(floatX, floatY, floatZ);

    rotateY(time * 0.5 + k * 0.7);
    rotateX(time * 0.4 + k * 0.5);

    // Glow
    stroke(255, 20);
    strokeWeight(2);
    noFill();

    let res = 18;
    for (let i = 0; i < res; i += 3) {
      beginShape();
      let theta = map(i, 0, res, 0, PI);
      for (let j = 0; j <= res; j++) {
        let phi = map(j, 0, res, 0, TWO_PI);
        let v = sphericalHarmonic(theta, phi, orb.l, orb.m, orb.scale);
        vertex(v.x, v.y, v.z);
      }
      endShape();
    }

    // Main lines
    stroke(255, 100);
    strokeWeight(0.5);
    for (let i = 0; i < res; i += 2) {
      beginShape();
      let theta = map(i, 0, res, 0, PI);
      for (let j = 0; j <= res; j++) {
        let phi = map(j, 0, res, 0, TWO_PI);
        let v = sphericalHarmonic(theta, phi, orb.l, orb.m, orb.scale);
        vertex(v.x, v.y, v.z);
      }
      endShape();
    }
    pop();
  }
  pop();

  // ===== Elegant Lissajous ribbon =====
  push();
  rotateX(time * 0.12);
  rotateY(time * 0.08);
  rotateZ(time * 0.05);

  // Ribbon glow
  stroke(255, 15);
  strokeWeight(4);
  noFill();
  beginShape();
  for (let t = 0; t < TWO_PI * 2.5; t += 0.04) {
    let x = sin(3 * t + time * 0.25) * 240;
    let y = sin(4 * t + time * 0.2) * 350;
    let z = sin(5 * t + time * 0.15) * 240;
    vertex(x, y, z);
  }
  endShape();

  // Main ribbon
  stroke(255, 60);
  strokeWeight(1);
  beginShape();
  for (let t = 0; t < TWO_PI * 2.5; t += 0.04) {
    let x = sin(3 * t + time * 0.25) * 240;
    let y = sin(4 * t + time * 0.2) * 350;
    let z = sin(5 * t + time * 0.15) * 240;
    vertex(x, y, z);
  }
  endShape();
  pop();

  // ===== Floating dust particles =====
  push();
  noStroke();

  for (let i = 0; i < 80; i++) {
    let angle = i * 0.18 + time * 0.3;
    let r = 300 + sin(i * 0.4 + time * 0.6) * 80;
    let x = cos(angle) * r;
    let y = sin(i * 0.25 + time * 0.4) * 520;
    let z = sin(angle) * r;

    push();
    translate(x, y, z);

    // Soft glow
    let brightness = 40 + sin(i * 0.3 + time * 0.8) * 30;
    fill(255, brightness);
    sphere(2.5 + sin(i + time * 0.5) * 1);

    // Bright center
    fill(255, brightness + 60);
    sphere(0.8);
    pop();
  }
  pop();

  // ===== Central light source effect =====
  push();
  translate(0, 50, 0);
  noStroke();

  // Layered glow spheres
  for (let i = 4; i >= 0; i--) {
    let size = 8 + i * 12;
    let alpha = map(i, 0, 4, 80, 5);
    fill(255, alpha);
    sphere(size + sin(time * 0.8) * 3);
  }
  pop();

  // ===== Delicate connecting threads =====
  push();
  stroke(255, 12);
  strokeWeight(0.5);

  for (let i = 0; i < 15; i++) {
    let angle = i * 0.42 + time * 0.15;
    let y1 = -300 + sin(time * 0.3 + i) * 50;
    let y2 = 300 + cos(time * 0.25 + i) * 50;
    let r = 150 + sin(i * 0.5 + time * 0.4) * 30;

    line(
      cos(angle) * r, y1, sin(angle) * r,
      cos(angle + PI) * r * 0.5, y2, sin(angle + PI) * r * 0.5
    );
  }
  pop();

  time += 0.016;
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('mathematical_art', 'png');
  }
}
