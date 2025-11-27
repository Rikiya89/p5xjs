let attractors = [];
let time = 0;
let particles = [];
let stars = [];

function setup() {
  createCanvas(720, 1280);
  background(0);

  // Create multiple attractors with different parameters
  for (let i = 0; i < 6; i++) {
    attractors.push({
      a: random(-2.5, 2.5),
      b: random(-2.5, 2.5),
      c: random(-2.5, 2.5),
      d: random(-2.5, 2.5),
      x: random(-0.1, 0.1),
      y: random(-0.1, 0.1),
      speed: random(0.5, 1.5),
      depth: i,
      rotationSpeed: random(-0.0002, 0.0002)
    });
  }

  // Create background stars
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: random(width),
      y: random(height),
      brightness: random(100, 255),
      twinkleSpeed: random(0.01, 0.05),
      size: random(0.5, 2)
    });
  }
}

function draw() {
  // Subtle fade for smooth trails
  fill(0, 6);
  noStroke();
  rect(0, 0, width, height);

  // Draw twinkling background stars
  for (let star of stars) {
    let twinkle = (sin(time * star.twinkleSpeed) + 1) / 2;
    let alpha = star.brightness * twinkle;
    noStroke();
    fill(255, alpha * 0.6);
    ellipse(star.x, star.y, star.size);
  }

  push();
  translate(width / 2, height / 2);

  // Complex multi-layered rotation
  let rotation1 = sin(time * 0.0003) * 0.15;
  let rotation2 = cos(time * 0.0005) * 0.1;
  rotate(rotation1 + rotation2);

  // Pulsing scale effect with multiple waves
  let pulse1 = 1 + sin(time * 0.001) * 0.05;
  let pulse2 = 1 + cos(time * 0.0007) * 0.03;
  scale(pulse1 * pulse2);

  // Draw each attractor with depth
  for (let att of attractors) {
    push();

    // Individual rotation for each attractor layer
    rotate(att.rotationSpeed * time);

    let iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      // Clifford Attractor formula
      let nextX = sin(att.a * att.y) + att.c * cos(att.a * att.x);
      let nextY = sin(att.b * att.x) + att.d * cos(att.b * att.y);

      att.x = nextX;
      att.y = nextY;

      // Scale and position
      let scaleFactor = width / 5;
      let px = att.x * scaleFactor;
      let py = att.y * scaleFactor;

      // Calculate brightness based on multiple factors
      let distFromCenter = dist(px, py, 0, 0);
      let maxDist = width / 2;

      // Depth-based layering
      let depthFactor = map(att.depth, 0, 5, 0.3, 1.0);

      // Dynamic brightness with wave patterns
      let timeFactor = (sin(time * 0.002 + att.depth) + 1) / 2;
      let positionFactor = (sin(att.x * 2 + time * 0.001) + 1) / 2;
      let waveFactor = (cos(distFromCenter * 0.05 + time * 0.003) + 1) / 2;
      let brightness = 255 * depthFactor * timeFactor * positionFactor * (0.5 + waveFactor * 0.5);

      // Distance-based alpha for depth of field
      let alpha = map(distFromCenter, 0, maxDist, 70, 15);
      alpha *= depthFactor;

      // Draw multiple layers for enhanced glow effect
      for (let layer = 5; layer > 0; layer--) {
        let layerAlpha = alpha / (layer * 1.1);
        let layerWeight = layer * 1.5;
        let layerBright = brightness * (0.6 + (layer / 5) * 0.4);

        stroke(layerBright, layerAlpha);
        strokeWeight(layerWeight);
        point(px, py);
      }

      // Core ultra-bright point
      stroke(255, alpha * 2.5);
      strokeWeight(1);
      point(px, py);

      // Enhanced connection lines with flowing patterns
      if (i % 40 === 0 && random() > 0.65) {
        let connectionAlpha = alpha * 0.4;
        stroke(255, connectionAlpha);
        strokeWeight(0.4);
        let angle = atan2(py, px);
        let nextAngle = angle + sin(time * 0.001) * 0.3;
        let lineDist = random(15, 40);
        line(px, py, px + cos(nextAngle) * lineDist, py + sin(nextAngle) * lineDist);
      }

      // Occasional energy bursts
      if (i % 200 === 0 && random() > 0.8) {
        noFill();
        stroke(255, alpha * 0.3);
        strokeWeight(0.5);
        let radius = random(5, 15);
        ellipse(px, py, radius, radius);
      }
    }

    pop();
  }

  pop();

  // Add floating particles for atmosphere with varied movement
  if (frameCount % 2 === 0 && particles.length < 120) {
    particles.push({
      x: random(width),
      y: random(height),
      vx: random(-0.8, 0.8),
      vy: random(-0.8, 0.8),
      life: 255,
      size: random(1, 4),
      pulseSpeed: random(0.02, 0.08)
    });
  }

  // Update and draw particles with pulsing effect
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];

    // Flowing movement with sine wave
    p.x += p.vx + sin(time * 0.01 + p.y * 0.01) * 0.3;
    p.y += p.vy + cos(time * 0.01 + p.x * 0.01) * 0.3;
    p.life -= 0.8;

    if (p.life <= 0 || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
      particles.splice(i, 1);
    } else {
      // Pulsing brightness
      let pulse = (sin(time * p.pulseSpeed) + 1) / 2;
      let particleAlpha = (p.life / 255) * (0.6 + pulse * 0.4);

      // Draw glow around particle
      noStroke();
      fill(255, particleAlpha * 0.3 * 255);
      ellipse(p.x, p.y, p.size * 3);

      // Draw core particle
      fill(255, particleAlpha * 255);
      ellipse(p.x, p.y, p.size);
    }
  }

  time++;
}

