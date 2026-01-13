// Color palette
const colors = [
  "#362d78",
  "#523fa3",
  "#916ccc",
  "#bda1e5",
  "#c8c0e9",
  "#84bae7",
  "#516ad4",
  "#333f87",
  "#293039",
  "#283631"
];

let theShader;

function preload() {
  theShader = loadShader('shader.vert', 'shader.frag');
}

function setup() {
  createCanvas(720, 1280, WEBGL);
  noStroke();
}

function draw() {
  shader(theShader);

  theShader.setUniform('u_time', millis() / 1000.0);
  theShader.setUniform('u_resolution', [width, height]);
  theShader.setUniform('u_mouse', [mouseX / width, mouseY / height]);

  rect(0, 0, width, height);
}

function windowResized() {
  // Keep fixed size
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('shader_art', 'png');
  }
}
