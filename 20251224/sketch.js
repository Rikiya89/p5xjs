// Cartesian Geometry - Black & White
// Grid-based geometric patterns with mathematical precision

let time = 0;
let gridSize = 40;
let nodes = [];
let particles = [];
let waves = [];

function setup() {
  createCanvas(720, 1280);

  // Create grid nodes based on Cartesian coordinates
  for (let x = 0; x <= width; x += gridSize) {
    for (let y = 0; y <= height; y += gridSize) {
      nodes.push({
        x: x,
        y: y,
        baseX: x,
        baseY: y,
        phase: random(TWO_PI),
        speed: random(0.5, 1.5),
        amplitude: random(2, 5)
      });
    }
  }

  // Create flowing particles
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      vx: random(-0.5, 0.5),
      vy: random(-0.5, 0.5),
      size: random(1, 3),
      alpha: random(100, 200),
      phase: random(TWO_PI)
    });
  }

  // Create wave generators
  for (let i = 0; i < 5; i++) {
    waves.push({
      amplitude: random(20, 60),
      frequency: random(0.01, 0.03),
      speed: random(0.5, 1.5),
      offset: random(TWO_PI)
    });
  }
}

function draw() {
  background(0);

  // Draw flowing particles in background
  drawParticles();

  // Draw coordinate axes at center
  drawAxes();

  // Draw grid with animated nodes
  drawGrid();

  // Draw wave interference patterns
  drawWaveInterference();

  // Draw geometric patterns
  drawGeometricPatterns();

  // Draw mathematical curves
  drawParametricCurves();

  // Draw field lines
  drawFieldLines();

  time += 0.01;
}

function drawAxes() {
  push();
  stroke(255, 100);
  strokeWeight(1);

  // Vertical axis (Y)
  line(width/2, 0, width/2, height);

  // Horizontal axis (X)
  line(0, height/2, width, height/2);

  // Draw tick marks
  noStroke();
  fill(255, 150);
  textSize(10);
  textAlign(CENTER, CENTER);

  // X-axis ticks
  for (let x = 0; x <= width; x += gridSize) {
    let cartesianX = x - width/2;
    stroke(255, 80);
    strokeWeight(1);
    line(x, height/2 - 5, x, height/2 + 5);

    if (x % (gridSize * 2) === 0) {
      noStroke();
      text(cartesianX, x, height/2 + 15);
    }
  }

  // Y-axis ticks
  for (let y = 0; y <= height; y += gridSize) {
    let cartesianY = height/2 - y;
    stroke(255, 80);
    strokeWeight(1);
    line(width/2 - 5, y, width/2 + 5, y);

    if (y % (gridSize * 2) === 0 && y !== height/2) {
      noStroke();
      text(cartesianY, width/2 + 20, y);
    }
  }
  pop();
}

function drawGrid() {
  push();
  stroke(255, 40);
  strokeWeight(0.5);

  // Horizontal grid lines
  for (let y = 0; y <= height; y += gridSize) {
    line(0, y, width, y);
  }

  // Vertical grid lines
  for (let x = 0; x <= width; x += gridSize) {
    line(x, 0, x, height);
  }

  // Animated nodes with enhanced movement
  for (let node of nodes) {
    let oscillation = sin(time * node.speed + node.phase) * node.amplitude;
    let x = node.baseX + oscillation;
    let y = node.baseY + cos(time * node.speed * 0.7 + node.phase) * node.amplitude;

    // Calculate distance from center for pulsing effect
    let distFromCenter = dist(x, y, width/2, height/2);
    let pulse = sin(time * 2 + distFromCenter * 0.01) * 0.5 + 1;

    fill(255, 120 * pulse);
    noStroke();
    circle(x, y, 2 * pulse);
  }
  pop();
}

function drawGeometricPatterns() {
  push();
  translate(width/2, height/2);

  // Rotating circles based on polar coordinates converted to Cartesian
  let numCircles = 8;
  for (let i = 0; i < numCircles; i++) {
    let angle = (i / numCircles) * TWO_PI + time;
    let radius = 150 + sin(time * 2 + i) * 30;

    // Convert polar to Cartesian
    let x = radius * cos(angle);
    let y = radius * sin(angle);

    noFill();
    stroke(255, 150);
    strokeWeight(1);
    circle(x, y, 40 + sin(time * 3 + i) * 20);

    // Draw connecting lines
    if (i > 0) {
      let prevAngle = ((i-1) / numCircles) * TWO_PI + time;
      let prevRadius = 150 + sin(time * 2 + (i-1)) * 30;
      let prevX = prevRadius * cos(prevAngle);
      let prevY = prevRadius * sin(prevAngle);

      stroke(255, 60);
      line(x, y, prevX, prevY);
    }
  }

  // Concentric circles at origin
  for (let r = 50; r <= 300; r += 50) {
    noFill();
    stroke(255, 30 + sin(time + r * 0.01) * 20);
    strokeWeight(0.5);
    circle(0, 0, r * 2);
  }

  pop();
}

function drawParametricCurves() {
  push();
  translate(width/2, height/2);

  // Lissajous curve
  noFill();
  stroke(255, 200);
  strokeWeight(1.5);
  beginShape();
  for (let t = 0; t < TWO_PI; t += 0.02) {
    let a = 3;
    let b = 4;
    let delta = time;

    let x = 120 * sin(a * t + delta);
    let y = 120 * sin(b * t);

    vertex(x, y);
  }
  endShape(CLOSE);

  // Spirograph-like pattern
  stroke(255, 100);
  strokeWeight(0.5);
  beginShape();
  for (let t = 0; t < TWO_PI * 6; t += 0.05) {
    let R = 80;
    let r = 30;
    let d = 50;

    let x = (R - r) * cos(t + time * 0.5) + d * cos(((R - r) / r) * t);
    let y = (R - r) * sin(t + time * 0.5) - d * sin(((R - r) / r) * t);

    vertex(x, y);
  }
  endShape();

  // Rose curve
  stroke(255, 150);
  strokeWeight(1);
  beginShape();
  let k = 5;
  for (let theta = 0; theta < TWO_PI * k; theta += 0.01) {
    let r = 100 * cos(k * theta);
    let x = r * cos(theta + time * 0.3);
    let y = r * sin(theta + time * 0.3);
    vertex(x, y);
  }
  endShape();

  pop();
}

function drawParticles() {
  push();
  for (let p of particles) {
    // Update position
    p.x += p.vx + sin(time + p.phase) * 0.3;
    p.y += p.vy + cos(time * 0.7 + p.phase) * 0.3;

    // Wrap around edges
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;

    // Draw particle with trail effect
    let alpha = p.alpha * (0.5 + sin(time * 2 + p.phase) * 0.5);
    fill(255, alpha);
    noStroke();
    circle(p.x, p.y, p.size);

    // Draw connection to nearby particles
    for (let other of particles) {
      let d = dist(p.x, p.y, other.x, other.y);
      if (d < 100 && d > 0) {
        stroke(255, map(d, 0, 100, 50, 0));
        strokeWeight(0.5);
        line(p.x, p.y, other.x, other.y);
      }
    }
  }
  pop();
}

function drawWaveInterference() {
  push();
  translate(width/2, height/2);

  // Draw interference pattern
  noFill();
  for (let w of waves) {
    for (let r = 0; r < 300; r += 20) {
      let phase = time * w.speed + w.offset;
      let waveOffset = sin(r * w.frequency + phase) * w.amplitude;
      let alpha = map(r, 0, 300, 100, 20);

      stroke(255, alpha);
      strokeWeight(0.5);

      beginShape();
      for (let angle = 0; angle < TWO_PI; angle += 0.1) {
        let radius = r + waveOffset * sin(angle * 3 + phase);
        let x = radius * cos(angle);
        let y = radius * sin(angle);
        vertex(x, y);
      }
      endShape(CLOSE);
    }
  }
  pop();
}

function drawFieldLines() {
  push();
  translate(width/2, height/2);

  // Draw vector field lines
  stroke(255, 80);
  strokeWeight(1);

  let spacing = 60;
  for (let x = -width/2; x < width/2; x += spacing) {
    for (let y = -height/2; y < height/2; y += spacing) {
      let angle = atan2(y, x) + time * 0.5;
      let magnitude = sqrt(x*x + y*y) * 0.1;
      let fieldX = cos(angle) * magnitude;
      let fieldY = sin(angle) * magnitude;

      let alpha = map(magnitude, 0, 200, 150, 30);
      stroke(255, alpha);

      // Draw arrow
      line(x, y, x + fieldX, y + fieldY);

      // Draw arrowhead
      let arrowSize = 3;
      let arrowAngle = angle;
      push();
      translate(x + fieldX, y + fieldY);
      rotate(arrowAngle);
      line(0, 0, -arrowSize, -arrowSize/2);
      line(0, 0, -arrowSize, arrowSize/2);
      pop();
    }
  }

  pop();
}

function windowResized() {
  resizeCanvas(720, 1280);

  // Recreate nodes for new canvas size
  nodes = [];
  for (let x = 0; x <= width; x += gridSize) {
    for (let y = 0; y <= height; y += gridSize) {
      nodes.push({
        x: x,
        y: y,
        baseX: x,
        baseY: y,
        phase: random(TWO_PI),
        speed: random(0.5, 1.5),
        amplitude: random(2, 5)
      });
    }
  }
}
