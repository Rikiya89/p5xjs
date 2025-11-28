let time = 0;
let lorenzPoints = [];
let lorenzParticles = [];
let sphericalHarmonics = [];
let torusKnotPoints = [];

// Lorenz attractor parameters
const lorenzParams = {
  sigma: 10,
  rho: 28,
  beta: 8/3,
  dt: 0.01,
  scale: 8
};

function setup() {
  createCanvas(720, 1280, WEBGL);

  // Initialize Lorenz attractor particles
  for (let i = 0; i < 3; i++) {
    lorenzParticles.push({
      x: random(-0.1, 0.1),
      y: random(-0.1, 0.1),
      z: random(-0.1, 0.1),
      trail: [],
      colorOffset: i * 85
    });
  }

  // Generate spherical harmonics points
  generateSphericalHarmonics();

  // Generate torus knot
  generateTorusKnot();
}

function generateSphericalHarmonics() {
  sphericalHarmonics = [];
  let resolution = 40;
  for (let theta = 0; theta < PI; theta += PI / resolution) {
    for (let phi = 0; phi < TWO_PI; phi += TWO_PI / resolution) {
      sphericalHarmonics.push({ theta, phi });
    }
  }
}

function generateTorusKnot() {
  torusKnotPoints = [];
  let p = 3; // number of times around the torus
  let q = 2; // number of loops through the hole

  for (let i = 0; i < 200; i++) {
    let t = map(i, 0, 200, 0, TWO_PI);
    torusKnotPoints.push({ t, p, q });
  }
}

// Lorenz attractor differential equations
function lorenzStep(particle) {
  let dx = lorenzParams.sigma * (particle.y - particle.x) * lorenzParams.dt;
  let dy = (particle.x * (lorenzParams.rho - particle.z) - particle.y) * lorenzParams.dt;
  let dz = (particle.x * particle.y - lorenzParams.beta * particle.z) * lorenzParams.dt;

  particle.x += dx;
  particle.y += dy;
  particle.z += dz;

  // Store trail
  particle.trail.push({
    x: particle.x * lorenzParams.scale,
    y: particle.y * lorenzParams.scale,
    z: particle.z * lorenzParams.scale
  });

  if (particle.trail.length > 300) {
    particle.trail.shift();
  }
}

// Spherical harmonics function
function sphericalHarmonic(theta, phi, m, n, t) {
  let r = 80 + 30 * sin(m * theta + t * 0.002) * cos(n * phi + t * 0.003);
  let x = r * sin(theta) * cos(phi);
  let y = r * sin(theta) * sin(phi);
  let z = r * cos(theta);
  return { x, y, z };
}

// Torus knot parametric equation
function torusKnotPoint(t, p, q, offset) {
  let r = 100 + 40 * cos(q * (t + offset));
  let x = r * cos(p * (t + offset));
  let y = r * sin(p * (t + offset));
  let z = -40 * sin(q * (t + offset));
  return { x, y, z };
}

// Fibonacci sphere distribution
function fibonacciSphere(i, n, radius) {
  let phi = acos(1 - 2 * (i + 0.5) / n);
  let theta = PI * (1 + sqrt(5)) * i;

  let x = radius * cos(theta) * sin(phi);
  let y = radius * sin(theta) * sin(phi);
  let z = radius * cos(phi);

  return { x, y, z };
}

function draw() {
  background(0);

  // Smooth camera rotation
  let camX = sin(time * 0.0005) * 400;
  let camY = cos(time * 0.0003) * 300;
  let camZ = cos(time * 0.0005) * 400 + 200;
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

  // Ambient lighting
  ambientLight(100);
  pointLight(255, 255, 255, 200, -200, 200);

  // Draw Lorenz attractors
  for (let particle of lorenzParticles) {
    lorenzStep(particle);

    // Draw trail with gradient
    push();
    noFill();
    beginShape();
    for (let i = 0; i < particle.trail.length; i++) {
      let p = particle.trail[i];
      let alpha = map(i, 0, particle.trail.length, 0, 255);
      let brightness = map(i, 0, particle.trail.length, 100, 255);
      stroke(brightness, alpha);
      strokeWeight(map(i, 0, particle.trail.length, 0.5, 2));
      vertex(p.x, p.y, p.z);
    }
    endShape();
    pop();
  }

  // Draw spherical harmonics (morphing sphere)
  push();
  rotateY(time * 0.001);
  rotateX(time * 0.0007);

  noFill();
  stroke(255, 150);
  strokeWeight(1);

  let m = floor(3 + 2 * sin(time * 0.0003));
  let n = floor(3 + 2 * cos(time * 0.0005));

  beginShape(POINTS);
  for (let point of sphericalHarmonics) {
    let pos = sphericalHarmonic(point.theta, point.phi, m, n, time);
    strokeWeight(2);
    vertex(pos.x, pos.y, pos.z);
  }
  endShape();
  pop();

  // Draw torus knot
  push();
  rotateX(time * 0.0008);
  rotateY(time * 0.0012);

  stroke(255, 180);
  strokeWeight(2);
  noFill();

  beginShape();
  for (let point of torusKnotPoints) {
    let pos = torusKnotPoint(point.t, point.p, point.q, time * 0.001);
    vertex(pos.x, pos.y, pos.z);
  }
  endShape();

  // Draw connecting tube
  stroke(255, 80);
  strokeWeight(1);
  beginShape();
  for (let point of torusKnotPoints) {
    let pos = torusKnotPoint(point.t, point.p, point.q, time * 0.001 + PI);
    vertex(pos.x, pos.y, pos.z);
  }
  endShape();
  pop();

  // Draw Fibonacci sphere
  push();
  rotateY(time * 0.0006);

  let fibCount = 100;
  for (let i = 0; i < fibCount; i++) {
    let radius = 150 + 20 * sin(time * 0.001 + i * 0.1);
    let pos = fibonacciSphere(i, fibCount, radius);

    push();
    translate(pos.x, pos.y, pos.z);

    let size = 3 + 2 * sin(time * 0.01 + i);
    noStroke();
    fill(255, 200);
    sphere(size);
    pop();
  }
  pop();

  // Draw rotating platonic solid wireframes
  push();
  rotateX(time * 0.0015);
  rotateY(time * 0.001);
  rotateZ(time * 0.0008);

  // Dodecahedron approximation with icosahedron
  noFill();
  stroke(255, 120);
  strokeWeight(1.5);

  let icoRadius = 180;
  drawIcosahedron(icoRadius);
  pop();

  // Draw parametric wave surface
  push();
  rotateX(PI / 4);
  translate(0, 0, -100);

  stroke(255, 100);
  strokeWeight(1);
  noFill();

  let waveRes = 20;
  for (let i = 0; i < waveRes; i++) {
    beginShape();
    for (let j = 0; j < waveRes; j++) {
      let u = map(i, 0, waveRes, -PI, PI);
      let v = map(j, 0, waveRes, -PI, PI);

      let x = u * 40;
      let y = v * 40;
      let z = 30 * sin(u + time * 0.002) * cos(v + time * 0.003);

      vertex(x, y, z);
    }
    endShape();
  }
  pop();

  // Draw golden spiral particles
  push();
  rotateY(time * 0.0004);

  let spiralPoints = 50;
  let goldenAngle = PI * (3 - sqrt(5)); // Golden angle

  for (let i = 0; i < spiralPoints; i++) {
    let theta = i * goldenAngle;
    let r = 15 * sqrt(i);
    let z = map(i, 0, spiralPoints, -200, 200);

    let x = r * cos(theta + time * 0.001);
    let y = r * sin(theta + time * 0.001);

    push();
    translate(x, y, z);
    noStroke();
    fill(255, 180);
    let size = map(i, 0, spiralPoints, 6, 2);
    sphere(size);
    pop();
  }
  pop();

  // Draw nested rotating rings (Borromean rings inspired)
  for (let i = 0; i < 3; i++) {
    push();

    if (i === 0) {
      rotateX(time * 0.001);
    } else if (i === 1) {
      rotateY(time * 0.001);
    } else {
      rotateZ(time * 0.001);
    }

    noFill();
    stroke(255, 100);
    strokeWeight(2);

    let ringRadius = 120 + i * 20;
    torus(ringRadius, 8, 32, 16);
    pop();
  }

  time++;
}

// Helper function to draw icosahedron
function drawIcosahedron(r) {
  let phi = (1 + sqrt(5)) / 2; // Golden ratio

  let vertices = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
  ];

  // Normalize and scale vertices
  for (let i = 0; i < vertices.length; i++) {
    let len = sqrt(vertices[i][0]**2 + vertices[i][1]**2 + vertices[i][2]**2);
    vertices[i] = vertices[i].map(v => (v / len) * r);
  }

  // Draw edges
  let edges = [
    [0,11],[0,5],[0,1],[0,7],[0,10],[1,5],[5,11],[11,10],[10,7],[7,1],
    [3,9],[3,4],[3,2],[3,6],[3,8],[4,9],[9,8],[8,6],[6,2],[2,4],
    [1,9],[5,4],[11,2],[10,6],[7,8]
  ];

  for (let edge of edges) {
    let v1 = vertices[edge[0]];
    let v2 = vertices[edge[1]];
    line(v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);
  }
}
