// Color palette
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
let time = 0;
let colorPalette = [];

function setup() {
  createCanvas(720, 1280, WEBGL);

  // Convert hex colors to p5 color objects
  colorPalette = colors.map(c => color(c));

  // Create particles with mathematical positions
  for (let i = 0; i < 800; i++) {
    particles.push(new Particle(i));
  }
}

function draw() {
  background('#0a0a0a');

  // Ambient lighting
  ambientLight(60, 60, 80);
  pointLight(255, 255, 255, 0, 0, 400);

  // Rotate the entire scene
  rotateX(time * 0.3);
  rotateY(time * 0.2);

  // Draw multiple layers of mathematical forms
  push();
  drawSphericalHarmonics();
  pop();

  push();
  drawTorusKnot();
  pop();

  // Draw particles
  for (let p of particles) {
    p.update();
    p.display();
  }

  time += 0.005;
}

// Spherical harmonics - beautiful mathematical surface
function drawSphericalHarmonics() {
  let m = 3;
  let n = 5;

  noFill();
  strokeWeight(1);

  for (let theta = 0; theta < PI; theta += PI / 20) {
    beginShape();
    for (let phi = 0; phi < TWO_PI; phi += PI / 30) {
      // Spherical harmonic formula
      let r = 100 + 30 * sin(m * phi + time * 2) * cos(n * theta + time * 3);
      r += 20 * noise(theta * 2, phi * 2, time);

      let x = r * sin(theta) * cos(phi);
      let y = r * sin(theta) * sin(phi);
      let z = r * cos(theta);

      // Color based on position
      let colorIndex = floor(map(sin(phi * 2 + time * 2), -1, 1, 0, colorPalette.length));
      stroke(colorPalette[colorIndex % colorPalette.length]);

      vertex(x, y, z);
    }
    endShape(CLOSE);
  }
}

// Torus knot - parametric curve in 3D
function drawTorusKnot() {
  let p = 3;
  let q = 7;
  let scale = 80;

  strokeWeight(2);
  noFill();

  beginShape();
  for (let t = 0; t < TWO_PI; t += 0.05) {
    // Torus knot parametric equations
    let r = cos(q * t + time * 2) + 2;
    let x = scale * r * cos(p * t);
    let y = scale * r * sin(p * t);
    let z = scale * -sin(q * t + time * 2);

    // Add noise for organic feel
    x += 10 * noise(t * 2, time, 0);
    y += 10 * noise(t * 2, time, 100);
    z += 10 * noise(t * 2, time, 200);

    let colorIndex = floor(map(t, 0, TWO_PI, 0, colorPalette.length));
    stroke(colorPalette[colorIndex % colorPalette.length]);

    vertex(x, y, z);
  }
  endShape(CLOSE);
}

// Particle class following mathematical paths
class Particle {
  constructor(index) {
    this.index = index;
    this.offset = index * 0.1;
    this.size = random(2, 6);
    this.colorIndex = floor(random(colorPalette.length));
    this.speed = random(0.5, 1.5);
  }

  update() {
    // Keep offset progressing
    this.offset += 0.002 * this.speed;
  }

  display() {
    push();

    // Lissajous curve in 3D with additional complexity
    let a = 3;
    let b = 4;
    let c = 5;
    let delta = PI / 2;

    let t = this.offset + time;

    // Parametric equations with spherical influence
    let radius = 150 + 50 * sin(t * 0.5);
    let x = radius * sin(a * t + delta) * cos(b * t);
    let y = radius * sin(b * t) * sin(c * t);
    let z = radius * cos(c * t + delta);

    // Add flow field using noise
    x += 50 * noise(this.index * 0.1, t * 0.5, 0);
    y += 50 * noise(this.index * 0.1, t * 0.5, 100);
    z += 50 * noise(this.index * 0.1, t * 0.5, 200);

    translate(x, y, z);

    // Color based on position and time
    let col = colorPalette[this.colorIndex];
    let alpha = map(sin(t * 2), -1, 1, 100, 255);
    fill(red(col), green(col), blue(col), alpha);
    noStroke();

    // Sphere with dynamic size
    let dynamicSize = this.size * (1 + 0.3 * sin(t * 3));
    sphere(dynamicSize);

    pop();
  }
}

// Interactive: click to randomize
function mousePressed() {
  particles = [];
  for (let i = 0; i < 800; i++) {
    particles.push(new Particle(i));
  }
}
