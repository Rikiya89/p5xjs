let shaderProgram;
let time = 0;

function preload() {
  shaderProgram = loadShader('shader.vert', 'shader.frag');
}

function setup() {
  createCanvas(720, 1280, WEBGL);
  noStroke();
}

function draw() {
  shader(shaderProgram);

  // Send uniforms to shader
  shaderProgram.setUniform('u_resolution', [width, height]);
  shaderProgram.setUniform('u_time', time);
  shaderProgram.setUniform('u_mouse', [mouseX, mouseY]);

  // Draw a rectangle covering the entire canvas
  rect(0, 0, width, height);

  time += 0.01;
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('shader_art', 'png');
  }
  if (key === ' ') {
    time = 0;
  }
}
