let gridSize = 40;
let cols, rows;
let rotationOffset = 0;

function setup() {
  createCanvas(720, 1280, WEBGL);
  cols = floor(width / gridSize);
  rows = floor(height / gridSize);
}

function draw() {
  background(0);

  // Lighting setup
  ambientLight(60);
  pointLight(255, 255, 255, 0, 0, 400);

  // Camera rotation
  let camX = map(sin(frameCount * 0.005), -1, 1, -300, 300);
  let camY = map(cos(frameCount * 0.003), -1, 1, -200, 200);
  camera(camX, camY, 800, 0, 0, 0, 0, 1, 0);

  rotationOffset += 0.01;

  // Center the grid
  translate(-width / 2 + gridSize / 2, -height / 2 + gridSize / 2, 0);

  // Draw grid of 3D shapes
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      push();

      let x = i * gridSize;
      let y = j * gridSize;

      // Mathematical formula for wave-like z-position
      let distance = dist(i, j, cols / 2, rows / 2);
      let wave = sin(distance * 0.3 + rotationOffset * 2) * 50;
      let z = wave + cos(i * 0.2 + rotationOffset) * 30;

      translate(x, y, z);

      // Rotation based on position and time
      let rotX = map(sin(i * 0.5 + rotationOffset), -1, 1, 0, TWO_PI);
      let rotY = map(cos(j * 0.5 + rotationOffset), -1, 1, 0, TWO_PI);
      let rotZ = map(sin((i + j) * 0.3 + rotationOffset), -1, 1, 0, PI);

      rotateX(rotX);
      rotateY(rotY);
      rotateZ(rotZ);

      // Alternating colors based on mathematical pattern
      let colorPattern = (i + j) % 2;
      let pulseValue = map(sin(distance * 0.2 + rotationOffset * 3), -1, 1, 0, 1);

      if (colorPattern === 0) {
        fill(255 * pulseValue);
        stroke(0);
      } else {
        fill(0);
        stroke(255 * pulseValue);
      }

      strokeWeight(1);

      // Size variation based on mathematical formula
      let boxSize = map(sin(distance * 0.15 + rotationOffset * 1.5), -1, 1, 10, 25);

      // Draw shape - alternating between box and sphere
      if ((i * j) % 3 === 0) {
        box(boxSize);
      } else {
        sphere(boxSize / 2);
      }

      pop();
    }
  }
}
