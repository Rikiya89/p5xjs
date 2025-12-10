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
let rings = [];
let waves = [];
let constellations = [];
let lightRays = [];
let time = 0;
let breathingScale = 1;
let colorCycle = 0;

// Optimized settings
const PARTICLE_COUNT = 350;
const RING_COUNT = 5;
const CONSTELLATION_COUNT = 22;
const LIGHT_RAY_COUNT = 6; // Reduced from 8
const WAVE_COUNT = 2; // Reduced from 3

function setup() {
  createCanvas(720, 1280);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle());
  }

  for (let i = 0; i < RING_COUNT; i++) {
    rings.push(new OrbitalRing(i));
  }

  for (let i = 0; i < WAVE_COUNT; i++) {
    waves.push(new Wave(i));
  }

  for (let i = 0; i < CONSTELLATION_COUNT; i++) {
    constellations.push(new Star());
  }

  for (let i = 0; i < LIGHT_RAY_COUNT; i++) {
    lightRays.push(new LightRay(i));
  }

  background(colors[8]);
}

function draw() {
  // Simple background
  fill(colors[8]);
  noStroke();
  rect(0, 0, width, height, 6);

  time += 0.01;
  breathingScale = 1 + sin(time * 2) * 0.11;
  colorCycle = (colorCycle + 0.003) % 1;

  // Draw light rays (optimized)
  if (frameCount % 2 === 0) { // Only update every other frame
    for (let ray of lightRays) {
      ray.update();
    }
  }
  for (let ray of lightRays) {
    ray.display();
  }

  // Background glow
  drawDynamicBackgroundGlow();

  // Draw waves
  for (let wave of waves) {
    wave.update();
    wave.display();
  }

  // Draw ripples (reduced)
  drawHarmonicRipples();

  // Draw constellations
  for (let star of constellations) {
    star.display();
  }

  // Draw rings with breathing
  push();
  translate(width / 2, height / 2);
  scale(breathingScale);
  translate(-width / 2, -height / 2);
  for (let ring of rings) {
    ring.update();
    ring.display();
  }
  pop();

  // Draw particles
  for (let particle of particles) {
    particle.update();
    particle.display();
  }

  // Draw glow bursts
  drawAnimatedGlowBursts();

  // Draw mandala
  drawSacredMandala();

  // Central bloom
  drawCentralBloom();

  // Ambient dust (reduced and optimized)
  if (frameCount % 3 === 0) {
    drawAmbientDust();
  }

  // Sparkles
  drawDynamicSparkles();

  // FPS
  displayFPS();
}

function drawDynamicBackgroundGlow() {
  let pulse = sin(time * 1.5) * 0.5 + 0.5;

  // Single color glow
  let glowColorIndex = floor(colorCycle * 3) + 1;
  let centerGlow = color(colors[glowColorIndex]);
  centerGlow.setAlpha(2 + pulse * 3);

  // Reduced to 4 layers
  for (let i = 4; i > 0; i--) {
    fill(centerGlow);
    let size = i * 210 * (1 + pulse * 0.18);
    circle(width / 2, height / 2, size);
  }
}

class LightRay {
  constructor(index) {
    this.angle = (TWO_PI / LIGHT_RAY_COUNT) * index;
    this.speed = 0.001 + index * 0.0003;
    this.length = 500;
    this.colorIndex = floor(random(3, 6));
    this.breathPhase = random(TWO_PI);
  }

  update() {
    this.angle += this.speed;
  }

  display() {
    push();
    translate(width / 2, height / 2);
    rotate(this.angle);

    let breath = sin(time * 2 + this.breathPhase) * 0.5 + 0.5;
    let c = color(colors[this.colorIndex]);

    // Optimized: fewer segments (10 instead of 30)
    for (let i = 0; i < this.length; i += 50) {
      let alpha = map(i, 0, this.length, 16, 0) * breath;
      c.setAlpha(alpha);
      fill(c);
      noStroke();
      let w = map(i, 0, this.length, 35, 4);
      ellipse(i, 0, w, w * 0.3);
    }

    pop();
  }
}

class Particle {
  constructor() {
    this.reset();
    this.trail = [];
    this.maxTrailLength = 3; // Reduced from 4
    this.type = random() > 0.75 ? 'bright' : 'normal'; // 25% bright
  }

  reset() {
    this.x = random(width);
    this.y = random(height);
    this.vx = random(-0.7, 0.7);
    this.vy = random(-0.7, 0.7);
    this.size = this.type === 'bright' ? random(2, 4.5) : random(1.5, 3.5);
    this.life = random(500, 850);
    this.maxLife = this.life;
    this.colorIndex = floor(random(2, 7));
    this.depth = random(0.45, 1);
    this.twinkle = random(TWO_PI);
  }

  update() {
    // Single noise layer
    let n = noise(this.x * 0.004, this.y * 0.004, time * 0.5);
    let flowAngle = n * TWO_PI * 2 + sin(time + this.twinkle) * PI;

    this.vx += cos(flowAngle) * 0.033;
    this.vy += sin(flowAngle) * 0.033;

    // Simplified attraction
    let dx = width / 2 - this.x;
    let dy = height / 2 - this.y;
    let d = sqrt(dx * dx + dy * dy);

    if (d > 145) {
      let rhythm = sin(time * 2 + this.twinkle);
      let attractionAngle = atan2(dy, dx) + rhythm * HALF_PI;
      this.vx += cos(attractionAngle) * 0.0006;
      this.vy += sin(attractionAngle) * 0.0006;
    }

    this.vx *= 0.96;
    this.vy *= 0.96;

    // Trail (every 3rd frame)
    if (frameCount % 3 === 0) {
      this.trail.push({x: this.x, y: this.y});
      if (this.trail.length > this.maxTrailLength) {
        this.trail.shift();
      }
    }

    this.x += this.vx * this.depth;
    this.y += this.vy * this.depth;
    this.life--;

    if (this.x < -70) this.x = width + 70;
    if (this.x > width + 70) this.x = -70;
    if (this.y < -70) this.y = height + 70;
    if (this.y > height + 70) this.y = -70;

    if (this.life <= 0) {
      this.reset();
    }
  }

  display() {
    let alpha = map(this.life, 0, this.maxLife, 0, this.type === 'bright' ? 210 : 175);
    let twinkleAlpha = sin(time * 4 + this.twinkle) * 0.25 + 0.75;
    alpha *= twinkleAlpha;

    let colorHex = colors[this.colorIndex];

    // Trail
    if (this.trail.length > 1) {
      for (let i = 0; i < this.trail.length - 1; i++) {
        let trailAlpha = alpha * (i / this.trail.length) * 0.28;
        let tc = color(colorHex);
        tc.setAlpha(trailAlpha);
        stroke(tc);
        strokeWeight(this.size * 0.45);
        line(this.trail[i].x, this.trail[i].y,
             this.trail[i + 1].x, this.trail[i + 1].y);
      }
    }

    // Glow
    let glowLayers = this.type === 'bright' ? 3 : 2;
    for (let i = glowLayers; i >= 1; i--) {
      let glowAlpha = (alpha / (i * 2.2)) * this.depth;
      let gc = color(colorHex);
      gc.setAlpha(glowAlpha);
      fill(gc);
      noStroke();
      circle(this.x, this.y, this.size * i * 2.1);
    }

    // Core
    let core = color(this.type === 'bright' ? colors[4] : colors[5]);
    core.setAlpha(alpha);
    fill(core);
    circle(this.x, this.y, this.size);
  }
}

class OrbitalRing {
  constructor(index) {
    this.centerX = width / 2;
    this.centerY = height / 2;
    this.baseRadius = 90 + index * 75;
    this.radius = this.baseRadius;
    this.speed = 0.0015 + index * 0.0008;
    this.angle = random(TWO_PI);
    this.nodes = [];
    this.colorIndex = (index + 1) % colors.length;
    this.morphSpeed = 0.01 + index * 0.005;

    let nodeCount = 16 + index * 4;
    for (let i = 0; i < nodeCount; i++) {
      this.nodes.push({
        angle: (TWO_PI / nodeCount) * i,
        offset: 0
      });
    }
  }

  update() {
    this.angle += this.speed;
    this.radius = this.baseRadius + sin(time * this.morphSpeed) * 20;

    // Update every 2nd node
    for (let i = 0; i < this.nodes.length; i += 2) {
      let n = noise(i * 0.18, time * 1.3, this.baseRadius * 0.01);
      this.nodes[i].offset = map(n, 0, 1, -26, 26);
      if (i + 1 < this.nodes.length) {
        this.nodes[i + 1].offset = this.nodes[i].offset;
      }
    }
  }

  display() {
    push();
    translate(this.centerX, this.centerY);
    rotate(this.angle);

    let ringPulse = sin(time * 2 + this.baseRadius * 0.01) * 0.3 + 0.7;
    let c = color(colors[this.colorIndex]);
    c.setAlpha(45 * ringPulse);
    stroke(c);
    strokeWeight(2.3);
    noFill();

    // Draw connections
    for (let i = 0; i < this.nodes.length; i++) {
      let node1 = this.nodes[i];
      let node2 = this.nodes[(i + 1) % this.nodes.length];

      let r1 = this.radius + node1.offset;
      let x1 = cos(node1.angle) * r1;
      let y1 = sin(node1.angle) * r1;

      let r2 = this.radius + node2.offset;
      let x2 = cos(node2.angle) * r2;
      let y2 = sin(node2.angle) * r2;

      line(x1, y1, x2, y2);
    }

    // Glowing nodes
    for (let i = 0; i < this.nodes.length; i++) {
      let node = this.nodes[i];
      let r = this.radius + node.offset;
      let x = cos(node.angle) * r;
      let y = sin(node.angle) * r;

      let nodePulse = sin(time * 3 + i * 0.5) * 0.5 + 0.5;

      // Only 2 glow layers
      for (let j = 2; j >= 1; j--) {
        let gc = color(colors[this.colorIndex]);
        gc.setAlpha((32 + nodePulse * 18) / j);
        fill(gc);
        noStroke();
        circle(x, y, (11 + nodePulse * 3) * j);
      }
    }

    pop();
  }
}

class Wave {
  constructor(index) {
    this.baseY = height / 3 + index * 400;
    this.y = this.baseY;
    this.speed = 0.022 + index * 0.014;
    this.offset = random(1000);
    this.colorIndex = 3 + index;
    this.amplitude = 55 + index * 28;
  }

  update() {
    this.offset += this.speed;
    this.y = this.baseY + sin(time * 0.8 + this.colorIndex) * 32;
  }

  display() {
    let c = color(colors[this.colorIndex % colors.length]);

    // Single wave layer for performance
    c.setAlpha(22);
    stroke(c);
    strokeWeight(2.8);
    noFill();

    for (let x = 0; x < width + 20; x += 14) {
      let y1 = this.y + sin(x * 0.013 + this.offset) * this.amplitude;
      let y2 = this.y + sin((x + 14) * 0.013 + this.offset) * this.amplitude;
      line(x, y1, x + 14, y2);
    }
  }
}

class Star {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.brightness = random(0.5, 1);
    this.twinkleSpeed = random(0.03, 0.09);
    this.colorIndex = floor(random(4, 7));
    this.phase = random(TWO_PI);
    this.size = random(2, 3.5);
  }

  display() {
    let twinkle = (sin(time * this.twinkleSpeed * 10 + this.phase) + 1) * 0.5;
    let alpha = twinkle * this.brightness * 115;

    let c = color(colors[this.colorIndex]);
    c.setAlpha(alpha);

    // Single glow
    fill(c);
    noStroke();
    circle(this.x, this.y, this.size * 1.8);

    // Core
    c.setAlpha(alpha * 1.3);
    fill(c);
    circle(this.x, this.y, this.size);
  }
}

function drawHarmonicRipples() {
  // Reduced to 3 ripples
  for (let i = 0; i < 3; i++) {
    let rippleTime = (time * 1.7 + i * 0.8) % 5;
    let rippleRadius = rippleTime * 185;
    let rippleAlpha = map(rippleTime, 0, 5, 38, 0);

    let colorIdx = (i + 4) % colors.length;
    let c = color(colors[colorIdx]);
    c.setAlpha(rippleAlpha);
    stroke(c);
    strokeWeight(2);
    noFill();
    circle(width / 2, height / 2, rippleRadius);
  }
}

function drawAnimatedGlowBursts() {
  let burstCount = 5;

  for (let i = 0; i < burstCount; i++) {
    let angle = (TWO_PI / burstCount) * i + time * 0.72;
    let radiusBase = 265 + sin(time * 1.35 + i) * 65;
    let x = width / 2 + cos(angle) * radiusBase;
    let y = height / 2 + sin(angle) * radiusBase;

    let pulse = sin(time * 4.3 + i * 2.1) * 0.5 + 0.5;
    let size = 125 + pulse * 85;

    // Simplified to 3 layers
    let burstColor = color(colors[3]);
    for (let j = 3; j >= 1; j--) {
      burstColor.setAlpha((11 + pulse * 7) / j);
      fill(burstColor);
      noStroke();
      circle(x, y, size * j * 0.52);
    }

    // Core
    let coreColor = color(colors[5]);
    coreColor.setAlpha(48 + pulse * 38);
    fill(coreColor);
    circle(x, y, size * 0.2);
  }
}

function drawSacredMandala() {
  push();
  translate(width / 2, height / 2);

  let mandalaPulse = sin(time * 2.1) * 0.5 + 0.5;
  scale(0.91 + mandalaPulse * 0.26);

  let layers = 5; // Reduced from 6
  for (let layer = 0; layer < layers; layer++) {
    let petals = 8 + layer * 4;
    let radius = 36 + layer * 33;

    for (let i = 0; i < petals; i++) {
      let angle = (TWO_PI / petals) * i + time * (0.12 + layer * 0.07);
      let x = cos(angle) * radius;
      let y = sin(angle) * radius;

      let petalPulse = sin(time * 3.3 + layer) * 0.5 + 0.5;
      let petalSize = (16 + petalPulse * 6.5) * (0.86 + mandalaPulse * 0.32);

      let c = color(colors[(2 + layer) % colors.length]);
      c.setAlpha(28 + petalPulse * 16);
      fill(c);
      noStroke();
      circle(x, y, petalSize);

      // Inner glow
      let gc = color(colors[4]);
      gc.setAlpha(46 + petalPulse * 26);
      fill(gc);
      circle(x, y, petalSize * 0.48);
    }
  }

  pop();
}

function drawCentralBloom() {
  push();
  translate(width / 2, height / 2);

  let bloomPulse = sin(time * 3.6) * 0.5 + 0.5;
  let bloomSize = 68 + bloomPulse * 42;

  // Reduced to 4 layers
  for (let i = 4; i >= 1; i--) {
    let bloomColor = color(colors[5]);
    bloomColor.setAlpha((26 + bloomPulse * 16) / i);
    fill(bloomColor);
    noStroke();
    circle(0, 0, bloomSize * i * 0.62);
  }

  // Center
  let centerColor = color(colors[4]);
  centerColor.setAlpha(135 + bloomPulse * 95);
  fill(centerColor);
  circle(0, 0, bloomSize * 0.26);

  pop();
}

function drawAmbientDust() {
  // Reduced to 18 particles
  for (let i = 0; i < 18; i++) {
    let x = (noise(i * 10, time * 0.3) * width * 1.2 - width * 0.1);
    let y = (noise(i * 10 + 100, time * 0.25) * height * 1.2 - height * 0.1);

    let dustAlpha = noise(i * 5, time * 0.4) * 55;
    let c = color(colors[5]);
    c.setAlpha(dustAlpha);
    fill(c);
    noStroke();
    circle(x, y, 2);
  }
}

function drawDynamicSparkles() {
  // Reduced to 9 sparkles
  for (let i = 0; i < 9; i++) {
    let sparkleTime = (time * 13 + i * 110) % 110;
    if (sparkleTime < 7) {
      let x = (i * 234 + sparkleTime * 45) % width;
      let y = (i * 567) % height;
      let alpha = map(sparkleTime, 0, 7, 135, 0);

      let sparkColor = color(colors[4 + (i % 2)]);
      sparkColor.setAlpha(alpha);
      fill(sparkColor);
      noStroke();

      let sparkSize = map(sparkleTime, 0, 7, 2, 10);
      circle(x, y, sparkSize);

      // Cross
      stroke(sparkColor);
      strokeWeight(1.6);
      let crossSize = sparkSize * 1.35;
      line(x - crossSize, y, x + crossSize, y);
      line(x, y - crossSize, x, y + crossSize);
    }
  }
}

function displayFPS() {
  let fps = frameRate();
  let fpsColor = fps > 50 ? colors[4] : fps > 30 ? colors[6] : colors[2];
  fill(fpsColor);
  noStroke();
  textSize(14);
  textAlign(LEFT, TOP);
  text('FPS: ' + floor(fps), 10, 10);
}
