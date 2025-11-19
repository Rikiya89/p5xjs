let theShader;
let visualMode = 0;
let targetMode = 0;
let modeTransition = 0;
let zoomLevel = 1.0;
let targetZoom = 1.0;

function preload() {
  theShader = loadShader('shader.vert', 'shader.frag');
}

function setup() {
  createCanvas(720, 1280, WEBGL);
  noStroke();
  cursor(HAND);
}

function draw() {
  background(0);

  // Smooth mode transition with better easing
  modeTransition = lerp(modeTransition, targetMode, 0.08);

  // Smooth zoom
  zoomLevel = lerp(zoomLevel, targetZoom, 0.1);

  // Interactive mouse position (normalized)
  let mx = map(mouseX, 0, width, -1, 1);
  let my = map(mouseY, 0, height, -1, 1);

  // Pass uniforms to the shader
  theShader.setUniform('u_resolution', [width, height]);
  theShader.setUniform('u_time', millis() / 1000.0);
  theShader.setUniform('u_mouse', [mx, my]);
  theShader.setUniform('u_mode', modeTransition);
  theShader.setUniform('u_zoom', zoomLevel);

  // Apply shader
  shader(theShader);

  // Draw a rectangle that covers the whole canvas
  rect(-width/2, -height/2, width, height);
}

// Click to cycle through visual modes
function mousePressed() {
  visualMode = (visualMode + 1) % 3;
  targetMode = float(visualMode);
}

// Scroll to zoom
function mouseWheel(event) {
  targetZoom = constrain(targetZoom - event.delta * 0.001, 0.5, 2.0);
  return false;
}

// Keyboard shortcuts
function keyPressed() {
  if (key === 'r' || key === 'R') {
    // Reset
    visualMode = 0;
    targetMode = 0;
    targetZoom = 1.0;
  }
  if (key === ' ') {
    // Space to cycle modes
    visualMode = (visualMode + 1) % 3;
    targetMode = float(visualMode);
  }
}
