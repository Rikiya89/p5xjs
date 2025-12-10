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

let time = 0;
let layers = [];
let numLayers = 12;
let meshObjects = [];
let rotationSpeed = 0.003;

function setup() {
  createCanvas(720, 1280, WEBGL);
  colorMode(RGB);

  // Create multiple rotating layers
  for (let i = 0; i < numLayers; i++) {
    layers.push(new RotatingLayer(i));
  }

  // Create flowing mesh objects
  for (let i = 0; i < 6; i++) {
    meshObjects.push(new FlowingMesh(i));
  }
}

function draw() {
  background('#0a0a0a');

  // Dynamic lighting
  ambientLight(40, 40, 60);
  directionalLight(150, 120, 200, -1, 1, -0.5);
  pointLight(100, 180, 255, 300 * sin(time * 0.5), 0, 200);
  pointLight(180, 100, 255, -300 * cos(time * 0.3), 200, 0);

  // Camera movement
  let camX = 600 * sin(time * 0.2);
  let camY = 300 * sin(time * 0.15);
  let camZ = 800 + 200 * cos(time * 0.1);
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

  // Draw layers
  for (let layer of layers) {
    layer.update();
    layer.display();
  }

  // Draw flowing meshes
  for (let mesh of meshObjects) {
    mesh.update();
    mesh.display();
  }

  time += 0.01;
}

class RotatingLayer {
  constructor(index) {
    this.index = index;
    this.radius = 150 + index * 40;
    this.height = -600 + index * 100;
    this.rotationOffset = index * 0.5;
    this.numSegments = 6 + index * 2;
    this.color = color(colors[index % colors.length]);
    this.thickness = 8 - index * 0.4;
  }

  update() {
    this.rotation = time * (0.5 + this.index * 0.1) + this.rotationOffset;
    this.wave = sin(time * 2 + this.index) * 20;
  }

  display() {
    push();
    translate(0, this.height + this.wave, 0);
    rotateY(this.rotation);

    let c = this.color;
    fill(red(c), green(c), blue(c), 150);
    noStroke();

    // Create ring segments
    for (let i = 0; i < this.numSegments; i++) {
      let angle = (TWO_PI / this.numSegments) * i;
      let nextAngle = (TWO_PI / this.numSegments) * (i + 1);

      let x1 = cos(angle) * this.radius;
      let z1 = sin(angle) * this.radius;
      let x2 = cos(nextAngle) * this.radius;
      let z2 = sin(nextAngle) * this.radius;

      push();
      translate((x1 + x2) / 2, 0, (z1 + z2) / 2);
      rotateY(angle + PI / 2);

      // Animated size variations
      let scaleVar = 1 + sin(time * 3 + i + this.index) * 0.3;
      box(this.thickness * scaleVar, 30, 40);
      pop();
    }

    // Add central connector
    push();
    rotateX(PI / 2);
    fill(red(c), green(c), blue(c), 100);
    torus(this.radius * 0.3, 3);
    pop();

    pop();
  }
}

class FlowingMesh {
  constructor(index) {
    this.index = index;
    this.angle = (TWO_PI / 6) * index;
    this.distance = 250;
    this.color = color(colors[(index + 3) % colors.length]);
    this.detailX = 20;
    this.detailY = 20;
    this.noiseScale = 0.05;
  }

  update() {
    this.rotationY = time * 0.5 + this.angle;
    this.wobble = sin(time + this.index) * 30;
  }

  display() {
    push();

    let x = cos(this.angle + time * 0.3) * this.distance;
    let y = sin(time * 0.4 + this.index) * 200;
    let z = sin(this.angle + time * 0.3) * this.distance;

    translate(x, y, z);
    rotateY(this.rotationY);
    rotateX(sin(time * 0.7 + this.index) * 0.5);

    let c = this.color;
    fill(red(c), green(c), blue(c), 180);
    stroke(red(c), green(c), blue(c), 100);
    strokeWeight(0.5);

    // Create flowing parametric surface
    beginShape(TRIANGLE_STRIP);
    for (let i = 0; i <= this.detailX; i++) {
      for (let j = 0; j <= this.detailY; j++) {
        let u = map(i, 0, this.detailX, -PI, PI);
        let v = map(j, 0, this.detailY, -PI, PI);

        // Parametric equations with noise
        let noiseVal = noise(
          u * this.noiseScale + time * 0.1,
          v * this.noiseScale,
          this.index
        );

        let r = 50 + noiseVal * 40;
        let px = r * sin(u) * cos(v);
        let py = r * sin(u) * sin(v) + sin(v * 3 + time) * 15;
        let pz = r * cos(u) + cos(u * 2 + time) * 15;

        vertex(px, py, pz);
      }
    }
    endShape();

    pop();
  }
}

function mousePressed() {
  rotationSpeed = rotationSpeed === 0.003 ? 0.006 : 0.003;
}

function keyPressed() {
  if (key === ' ') {
    time = 0;
  }
}
