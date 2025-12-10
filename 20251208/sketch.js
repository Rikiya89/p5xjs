// Theme colors
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

let points = [];
let numPoints = 8000;
let rotationX = 0;
let rotationY = 0;
let time = 0;

function setup() {
  createCanvas(720, 1280, WEBGL);
  colorMode(RGB);

  // Initialize point cloud with mathematical formulas
  for (let i = 0; i < numPoints; i++) {
    points.push(new PointParticle(i));
  }
}

function draw() {
  background('#0a0a0a');

  // Smooth camera rotation
  rotationX += 0.003;
  rotationY += 0.002;

  // Lighting
  ambientLight(60, 60, 80);
  pointLight(200, 200, 255, 0, 0, 200);
  pointLight(150, 100, 200, 200, 0, -200);

  rotateX(rotationX);
  rotateY(rotationY);

  // Update and display all points
  for (let point of points) {
    point.update();
    point.display();
  }

  time += 0.01;
}

class PointParticle {
  constructor(index) {
    this.index = index;
    this.baseRadius = 200;
    this.color = color(random(colors));
    this.offset = random(TWO_PI);
    this.speed = random(0.0005, 0.002);
    this.noiseOffset = random(1000);

    // Spherical harmonic parameters
    this.m = floor(random(1, 6));
    this.n = floor(random(1, 6));
  }

  update() {
    // Calculate position using spherical harmonics and parametric equations
    let t = time * this.speed + this.offset;

    // Spherical coordinates with harmonic modulation
    let theta = map(this.index, 0, numPoints, 0, TWO_PI * 4);
    let phi = map(this.index, 0, numPoints, 0, PI * 2);

    // Spherical harmonics formula
    let r1 = sin(this.m * phi) * cos(this.n * theta + t);
    let r2 = cos(this.m * phi + t * 0.5) * sin(this.n * theta);

    // Combine with noise for organic movement
    let noiseVal = noise(
      this.noiseOffset + cos(theta) * 0.5,
      this.noiseOffset + sin(phi) * 0.5,
      time * 0.1
    );

    // Final radius with multiple mathematical influences
    let radius = this.baseRadius * (1 + r1 * 0.3 + r2 * 0.2 + noiseVal * 0.4);

    // Lissajous curve influence
    let lissajousX = sin(theta * 3 + t) * 50;
    let lissajousY = cos(phi * 2 + t * 1.5) * 50;

    // Convert to Cartesian coordinates
    this.x = radius * sin(phi) * cos(theta) + lissajousX;
    this.y = radius * sin(phi) * sin(theta) + lissajousY;
    this.z = radius * cos(phi) + sin(t * 2) * 30;

    // Update size based on position and noise
    this.size = map(noiseVal, 0, 1, 1, 4) * (1 + sin(t * 5) * 0.3);
  }

  display() {
    push();
    translate(this.x, this.y, this.z);

    // Color with slight transparency
    let c = this.color;
    fill(red(c), green(c), blue(c), 200);
    noStroke();

    // Vary between spheres and boxes for visual interest
    if (this.index % 5 === 0) {
      box(this.size);
    } else {
      sphere(this.size);
    }

    pop();
  }
}

// Mouse interaction
function mouseDragged() {
  rotationY += (mouseX - pmouseX) * 0.01;
  rotationX += (mouseY - pmouseY) * 0.01;
}
