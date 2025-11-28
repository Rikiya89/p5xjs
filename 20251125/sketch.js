const CONFIG = {
  canvas: { width: 720, height: 1280 },
  particles: {
    count: 30,
    minRadius: 280,
    maxRadius: 450,
    minSize: 3,
    maxSize: 6,
    trailLength: 5,
    connectionDistance: 120
  },
  aura: { rings: 5, baseRadius: 160, ringGap: 35 },
  torusKnot: { strands: 2, vertices: 80, p: 3, q: 2 },
  lotus: { layers: 2, baseRadius: 45 },
  heart: { glowLayers: 2, merkaba: 55, icosa: 85 },
  dna: { vertices: 50, connections: 8, radius: 130 },
  moons: { count: 5, orbitRadius: 200 },
  sparkles: { count: 12, threshold: 0.75 },
  tunnel: { rings: 25, segments: 16, spacing: 80 },
  cubes: { count: 8, maxDepth: 600 },
  spiralGalaxy: { arms: 3, starsPerArm: 40, depth: 400 },
  depthFog: { near: 300, far: 800, intensity: 0.7 }
};

const COLORS = [
  '#362d78', '#523fa3', '#916ccc', '#bda1e5', '#c8c0e9',
  '#84bae7', '#516ad4', '#333f87', '#293039', '#283631'
];

let time = 0;
let particles = [];
let floatingCubes = [];
let galaxyStars = [];

function setup() {
  createCanvas(CONFIG.canvas.width, CONFIG.canvas.height, WEBGL);
  initializeParticles();
  initializeFloatingCubes();
  initializeGalaxyStars();
}

function initializeParticles() {
  for (let i = 0; i < CONFIG.particles.count; i++) {
    particles.push({
      angle: random(TWO_PI),
      radius: random(CONFIG.particles.minRadius, CONFIG.particles.maxRadius),
      yPos: random(-400, 400),
      speed: random(0.1, 0.4),
      baseSize: random(CONFIG.particles.minSize, CONFIG.particles.maxSize),
      colorIndex: floor(random(COLORS.length)),
      phaseOffset: random(100),
      noiseOffset: random(1000),
      orbitSpeed: random(0.3, 0.8),
      trail: [],
      spiralPhase: random(TWO_PI)
    });
  }
}

function initializeFloatingCubes() {
  for (let i = 0; i < CONFIG.cubes.count; i++) {
    floatingCubes.push({
      x: random(-300, 300),
      y: random(-400, 400),
      z: random(-CONFIG.cubes.maxDepth, CONFIG.cubes.maxDepth),
      size: random(15, 50),
      rotationX: random(TWO_PI),
      rotationY: random(TWO_PI),
      rotationZ: random(TWO_PI),
      speedX: random(0.01, 0.03),
      speedY: random(0.01, 0.03),
      speedZ: random(0.01, 0.03),
      driftSpeed: random(0.2, 0.8),
      colorIndex: floor(random(COLORS.length)),
      noiseOffset: random(1000)
    });
  }
}

function initializeGalaxyStars() {
  for (let arm = 0; arm < CONFIG.spiralGalaxy.arms; arm++) {
    for (let i = 0; i < CONFIG.spiralGalaxy.starsPerArm; i++) {
      const t = i / CONFIG.spiralGalaxy.starsPerArm;
      const armAngle = (arm * TWO_PI) / CONFIG.spiralGalaxy.arms;
      const spiralTightness = 4;

      galaxyStars.push({
        armAngle: armAngle,
        t: t,
        spiralTightness: spiralTightness,
        radius: t * 350,
        yOffset: random(-50, 50),
        size: random(1, 3),
        colorIndex: floor(random(COLORS.length)),
        phaseOffset: random(TWO_PI),
        depth: random(-CONFIG.spiralGalaxy.depth, CONFIG.spiralGalaxy.depth)
      });
    }
  }
}

function draw() {
  background(8, 6, 18);

  setupCamera();
  setupLighting();

  // Background depth layers
  drawSpiralGalaxy();
  draw3DTunnel();

  drawCosmicDust();
  drawAura();
  drawTorusKnot();
  drawLotusFlower();
  drawCrystalHeart();
  drawDNAHelixes();
  drawOrbitingMoons();
  drawSparkles();

  // Foreground 3D elements
  drawFloatingCubes();
  drawDepthFog();

  time += 0.008;
}

function setupCamera() {
  // Enhanced camera with more dramatic 3D movement
  const camX = sin(time * 0.15) * 480 + cos(time * 0.08) * 150;
  const camY = cos(time * 0.1) * 280 + sin(time * 0.2) * 80;
  const camZ = 650 + sin(time * 0.08) * 180 + cos(time * 0.05) * 100;

  // Dynamic look-at point for swooping effect
  const lookX = sin(time * 0.05) * 50;
  const lookY = cos(time * 0.08) * 30;
  const lookZ = sin(time * 0.03) * 20;

  camera(camX, camY, camZ, lookX, lookY, lookZ, 0, 1, 0);
}

function setupLighting() {
  ambientLight(35, 30, 55);
  pointLight(255, 160, 255, 250, -400, 300);
  pointLight(80, 150, 255, -250, 200, -200);
}

function drawCosmicDust() {
  // Draw energy connections first (behind particles)
  drawParticleConnections();

  noStroke();

  for (const particle of particles) {
    // Spiral + orbital motion with Perlin noise
    particle.spiralPhase += 0.015;
    particle.angle += particle.speed * 0.01 * particle.orbitSpeed;
    const noiseY = noise(particle.noiseOffset + time * 0.3) * 2 - 1;
    const spiralOffset = sin(particle.spiralPhase) * 15;
    particle.yPos += sin(time + particle.phaseOffset) * 0.3 + noiseY * 0.5;

    const currentX = (cos(particle.angle) * particle.radius) + spiralOffset;
    const currentZ = (sin(particle.angle) * particle.radius) + spiralOffset;

    // Store trail positions
    particle.trail.push({ x: currentX, y: particle.yPos, z: currentZ });
    if (particle.trail.length > CONFIG.particles.trailLength) {
      particle.trail.shift();
    }

    // Draw particle trails (motion blur effect)
    drawParticleTrail(particle);

    push();
    translate(currentX, particle.yPos, currentZ);

    // Dynamic size with depth and breathing
    const breathe = sin(time * 1.5 + particle.phaseOffset) * 0.3 + 1;
    const depthScale = map(currentZ, -particle.radius, particle.radius, 0.7, 1.3);
    const finalSize = particle.baseSize * breathe * depthScale;

    // Advanced color cycling with rainbow shimmer
    const colorShift = (time * 0.3 + particle.phaseOffset) % 1;
    const currentColorIndex = particle.colorIndex;
    const nextColorIndex = (currentColorIndex + 1) % COLORS.length;
    const currentColor = color(COLORS[currentColorIndex]);
    const nextColor = color(COLORS[nextColorIndex]);
    const dustColor = lerpColor(currentColor, nextColor, colorShift);

    // Pulsing alpha with depth fog
    const depthFog = map(abs(currentZ), 0, 500, 1, 0.6);
    const alpha = (120 + sin(time * 2 + particle.phaseOffset) * 80) * depthFog;
    dustColor.setAlpha(alpha);

    // Triple-layer rendering for maximum beauty
    // Layer 1: Far outer glow (very soft)
    const farGlow = color(dustColor);
    farGlow.setAlpha(alpha * 0.15);
    emissiveMaterial(farGlow);
    sphere(finalSize * 3.5, 4, 4);

    // Layer 2: Mid glow (soft halo)
    const midGlow = color(dustColor);
    midGlow.setAlpha(alpha * 0.4);
    emissiveMaterial(midGlow);
    sphere(finalSize * 2, 5, 5);

    // Layer 3: Inner core (bright center)
    emissiveMaterial(dustColor);
    sphere(finalSize, 6, 6);

    // Radial gradient effect with tiny orbs
    for (let i = 0; i < 3; i++) {
      const orbitAngle = time * (2 + i) + particle.phaseOffset;
      const orbitRadius = finalSize * 1.5;
      push();
      translate(
        cos(orbitAngle) * orbitRadius,
        sin(orbitAngle * 1.3) * orbitRadius,
        sin(orbitAngle * 0.7) * orbitRadius
      );
      const tinyColor = color(dustColor);
      tinyColor.setAlpha(alpha * 0.6);
      emissiveMaterial(tinyColor);
      sphere(finalSize * 0.2, 3, 3);
      pop();
    }

    // Enhanced sparkle with star burst
    const sparkleIntensity = sin(time * 5 + particle.phaseOffset * 3);
    if (sparkleIntensity > 0.75) {
      drawStarBurst(finalSize, alpha, sparkleIntensity);
    }

    pop();
  }
}

function drawParticleTrail(particle) {
  if (particle.trail.length < 2) return;

  for (let i = 0; i < particle.trail.length - 1; i++) {
    const trailPos = particle.trail[i];
    const fade = i / particle.trail.length;

    push();
    translate(trailPos.x, trailPos.y, trailPos.z);

    const trailColor = color(COLORS[particle.colorIndex]);
    trailColor.setAlpha(fade * 60);
    emissiveMaterial(trailColor);

    const trailSize = particle.baseSize * fade * 0.6;
    sphere(trailSize, 3, 3);
    pop();
  }
}

function drawParticleConnections() {
  stroke(150, 100, 255, 30);
  strokeWeight(0.5);

  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const p1 = particles[i];
      const p2 = particles[j];

      const x1 = cos(p1.angle) * p1.radius;
      const z1 = sin(p1.angle) * p1.radius;
      const x2 = cos(p2.angle) * p2.radius;
      const z2 = sin(p2.angle) * p2.radius;

      const distance = dist(x1, p1.yPos, z1, x2, p2.yPos, z2);

      if (distance < CONFIG.particles.connectionDistance) {
        const connectionAlpha = map(distance, 0, CONFIG.particles.connectionDistance, 60, 0);
        const energyColor = lerpColor(
          color(COLORS[p1.colorIndex]),
          color(COLORS[p2.colorIndex]),
          0.5
        );
        energyColor.setAlpha(connectionAlpha);
        stroke(energyColor);

        line(x1, p1.yPos, z1, x2, p2.yPos, z2);
      }
    }
  }
}

function drawStarBurst(size, alpha, intensity) {
  const points = 5;
  const outerRadius = size * 2 * intensity;
  const innerRadius = size * 0.8;

  push();
  rotateZ(time * 3);

  for (let i = 0; i < points * 2; i++) {
    const angle = (i * PI) / points;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;

    push();
    translate(cos(angle) * radius * 0.5, sin(angle) * radius * 0.5, 0);

    const starColor = color(255, 255, 200);
    starColor.setAlpha(alpha * intensity);
    emissiveMaterial(starColor);
    sphere(size * 0.15, 3, 3);
    pop();
  }
  pop();
}

function drawAura() {
  push();
  noFill();
  rotateX(PI / 2);

  for (let i = 0; i < CONFIG.aura.rings; i++) {
    const ringColor = color(COLORS[i % COLORS.length]);
    ringColor.setAlpha(50 - i * 8);
    stroke(ringColor);
    strokeWeight(2.5 - i * 0.4);

    const radius = CONFIG.aura.baseRadius + i * CONFIG.aura.ringGap +
                   sin(time * 1.5 + i * 0.5) * 15;
    ellipse(0, 0, radius * 2, radius * 2, 48);
  }
  pop();
}

function drawTorusKnot() {
  push();
  rotateY(time * 0.2);
  rotateX(time * 0.15);
  noFill();

  const { p, q, strands, vertices } = CONFIG.torusKnot;

  for (let strand = 0; strand < strands; strand++) {
    const knotColor = color(COLORS[strand + 2]);
    knotColor.setAlpha(200);
    stroke(knotColor);
    strokeWeight(2.5 - strand * 0.7);

    beginShape();
    for (let i = 0; i <= vertices; i++) {
      const u = (i / vertices) * TWO_PI * 2;
      const r1 = 80;
      const r2 = 30 + sin(time * 2) * 8;

      const r = r1 + r2 * cos(q * u + strand * PI + time);
      const x = r * cos(p * u);
      const y = r * sin(p * u);
      const z = r2 * sin(q * u + strand * PI + time) * 2;

      curveVertex(x, y, z);
    }
    endShape();
  }
  pop();
}

function drawLotusFlower() {
  push();
  translate(0, 180, 0);
  rotateX(-PI / 6);
  rotateY(time * 0.1);
  noStroke();

  for (let layer = 0; layer < CONFIG.lotus.layers; layer++) {
    const petalCount = 6 + layer * 3;
    const layerRadius = CONFIG.lotus.baseRadius + layer * 30;

    for (let i = 0; i < petalCount; i++) {
      push();
      const angle = (i * TWO_PI) / petalCount + layer * 0.15 +
                    sin(time + layer) * 0.1;
      rotateY(angle);
      translate(layerRadius, 0, 0);
      rotateZ(PI / 4 + sin(time * 1.5 + i * 0.3) * 0.2 - layer * 0.15);
      rotateY(PI / 2);

      const petalColor = color(COLORS[layer + 2]);
      petalColor.setAlpha(180);
      emissiveMaterial(petalColor);

      scale(1, 0.3, 1);
      sphere(16 - layer * 2, 6, 5);
      pop();
    }
  }

  push();
  emissiveMaterial(COLORS[4]);
  sphere(12 + sin(time * 3) * 2, 6, 6);
  pop();

  pop();
}

function drawCrystalHeart() {
  push();
  rotateY(time * 0.35);
  rotateX(time * 0.2);
  rotateZ(sin(time * 0.5) * 0.1);

  noStroke();
  const pulse = 1 + sin(time * 4) * 0.12;

  emissiveMaterial(COLORS[2]);
  sphere(20 * pulse, 8, 8);

  const glowColor = color(COLORS[3]);
  glowColor.setAlpha(70);
  emissiveMaterial(glowColor);
  sphere(38 * pulse, 6, 6);

  stroke(COLORS[4]);
  strokeWeight(1.5);
  noFill();
  const merkabaSize = CONFIG.heart.merkaba + sin(time * 2) * 8;
  drawMerkaba(merkabaSize);

  push();
  rotateY(time * -0.3);
  rotateX(time * 0.2);
  stroke(COLORS[6]);
  strokeWeight(1);
  const icosaSize = CONFIG.heart.icosa + sin(time * 1.5) * 10;
  drawIcosahedron(icosaSize);
  pop();

  pop();
}

function drawMerkaba(size) {
  const h = size * 0.8;
  const vertices1 = [
    [0, -h, 0],
    [-size / 2, h / 2, size * 0.29],
    [size / 2, h / 2, size * 0.29],
    [0, h / 2, -size * 0.58]
  ];
  drawTetrahedron(vertices1);

  const vertices2 = [
    [0, h, 0],
    [-size / 2, -h / 2, -size * 0.29],
    [size / 2, -h / 2, -size * 0.29],
    [0, -h / 2, size * 0.58]
  ];
  drawTetrahedron(vertices2);
}

function drawTetrahedron(vertices) {
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const [x1, y1, z1] = vertices[i];
      const [x2, y2, z2] = vertices[j];
      line(x1, y1, z1, x2, y2, z2);
    }
  }
}

function drawIcosahedron(radius) {
  const phi = 1.618;
  const normalizer = sqrt(1 + phi * phi);

  const vertices = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
  ];

  const edges = [
    [0,1],[0,5],[0,7],[0,10],[0,11],[1,5],[1,7],[1,8],[1,9],
    [2,3],[2,4],[2,6],[2,10],[2,11],[3,4],[3,6],[3,8],[3,9],
    [4,5],[4,9],[4,11],[5,9],[5,11],[6,7],[6,8],[6,10],[7,8],
    [7,10],[8,9],[10,11]
  ];

  for (const [i1, i2] of edges) {
    const [x1, y1, z1] = vertices[i1];
    const [x2, y2, z2] = vertices[i2];
    line(
      (x1 / normalizer) * radius, (y1 / normalizer) * radius, (z1 / normalizer) * radius,
      (x2 / normalizer) * radius, (y2 / normalizer) * radius, (z2 / normalizer) * radius
    );
  }
}

function drawDNAHelixes() {
  push();
  rotateY(time * 0.12);
  noFill();

  const { vertices, connections, radius } = CONFIG.dna;

  const helixColor1 = color(COLORS[5]);
  helixColor1.setAlpha(180);
  stroke(helixColor1);
  strokeWeight(2);

  beginShape();
  for (let i = 0; i < vertices; i++) {
    const pct = i / vertices;
    const y = (pct - 0.5) * 700;
    const angle = pct * TWO_PI * 3 + time * 0.8;
    const r = radius + sin(pct * PI) * 40;
    curveVertex(cos(angle) * r, y, sin(angle) * r);
  }
  endShape();

  stroke(COLORS[6]);
  beginShape();
  for (let i = 0; i < vertices; i++) {
    const pct = i / vertices;
    const y = (pct - 0.5) * 700;
    const angle = pct * TWO_PI * 3 + PI + time * 0.8;
    const r = radius + sin(pct * PI) * 40;
    curveVertex(cos(angle) * r, y, sin(angle) * r);
  }
  endShape();

  stroke(COLORS[4]);
  strokeWeight(1);
  for (let i = 0; i < connections; i++) {
    const pct = i / connections;
    const y = (pct - 0.5) * 700;
    const angle = pct * TWO_PI * 3 + time * 0.8;
    const r = radius + sin(pct * PI) * 40;
    line(
      cos(angle) * r, y, sin(angle) * r,
      cos(angle + PI) * r, y, sin(angle + PI) * r
    );
  }
  pop();
}

function drawOrbitingMoons() {
  push();
  noStroke();

  for (let i = 0; i < CONFIG.moons.count; i++) {
    const angle = (i * TWO_PI) / CONFIG.moons.count + time * (0.3 + i * 0.05);
    const orbitRadius = CONFIG.moons.orbitRadius + sin(time + i * 0.8) * 30;
    const yOffset = cos(time * 0.6 + i) * 120;

    push();
    translate(cos(angle) * orbitRadius, yOffset, sin(angle) * orbitRadius);
    rotateY(time * 2 + i);
    rotateX(time + i);

    const moonColor = color(COLORS[i % COLORS.length]);
    emissiveMaterial(moonColor);

    const gemSize = 10 + sin(time * 2.5 + i) * 3;
    drawGem(gemSize);

    moonColor.setAlpha(40);
    emissiveMaterial(moonColor);
    sphere(gemSize * 1.8, 4, 4);
    pop();
  }
  pop();
}

function drawGem(size) {
  beginShape(TRIANGLES);
  const points = [
    [0, -size * 1.3, 0],
    [size, 0, 0],
    [0, 0, size],
    [-size, 0, 0],
    [0, 0, -size],
    [0, size * 0.5, 0]
  ];

  for (let i = 0; i < 4; i++) {
    vertex(...points[0]);
    vertex(...points[i + 1]);
    vertex(...points[(i + 1) % 4 + 1]);
  }

  for (let i = 0; i < 4; i++) {
    vertex(...points[5]);
    vertex(...points[(i + 1) % 4 + 1]);
    vertex(...points[i + 1]);
  }
  endShape();
}

function drawSparkles() {
  push();
  noStroke();

  for (let i = 0; i < CONFIG.sparkles.count; i++) {
    const seed = i * 137.5;
    const angle = (time * 0.5 + seed) % TWO_PI;
    const orbitRadius = 180 + sin(seed) * 150;
    const yOffset = sin(time * 0.7 + seed) * 350;

    const flicker = abs(sin(time * 8 + seed * 10));
    if (flicker > CONFIG.sparkles.threshold) {
      push();
      translate(cos(angle) * orbitRadius, yOffset, sin(angle) * orbitRadius);

      const sparkleColor = color(COLORS[4]);
      sparkleColor.setAlpha(180 * flicker);
      emissiveMaterial(sparkleColor);

      sphere(2 + flicker * 3, 4, 4);
      pop();
    }
  }
  pop();
}

function draw3DTunnel() {
  push();
  noFill();

  const { rings, segments, spacing } = CONFIG.tunnel;

  for (let ring = 0; ring < rings; ring++) {
    const z = ring * spacing - 1000 + (time * 100) % (spacing * rings);
    const ringProgress = ring / rings;

    // Tunnel rotation for spiral effect
    push();
    translate(0, 0, z);
    rotateZ(time * 0.3 + ring * 0.2);

    // Draw ring segments
    const radius = 200 + sin(time + ring * 0.5) * 50;
    const tunnelColor = color(COLORS[ring % COLORS.length]);
    const depthFade = map(abs(z), 0, 1000, 1, 0.1);
    tunnelColor.setAlpha(120 * depthFade);
    stroke(tunnelColor);
    strokeWeight(2 * depthFade);

    beginShape();
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * TWO_PI;
      const x = cos(angle) * radius;
      const y = sin(angle) * radius;
      vertex(x, y, 0);
    }
    endShape(CLOSE);

    // Connect rings for depth
    if (ring < rings - 1) {
      const nextZ = (ring + 1) * spacing - 1000 + (time * 100) % (spacing * rings);
      const nextRadius = 200 + sin(time + (ring + 1) * 0.5) * 50;

      strokeWeight(0.5 * depthFade);
      for (let i = 0; i < segments; i += 2) {
        const angle = (i / segments) * TWO_PI;
        const x1 = cos(angle) * radius;
        const y1 = sin(angle) * radius;
        const x2 = cos(angle) * nextRadius;
        const y2 = sin(angle) * nextRadius;

        line(x1, y1, 0, x2, y2, spacing);
      }
    }

    pop();
  }
  pop();
}

function drawFloatingCubes() {
  for (const cube of floatingCubes) {
    // Update cube rotations
    cube.rotationX += cube.speedX;
    cube.rotationY += cube.speedY;
    cube.rotationZ += cube.speedZ;

    // Floating drift motion with Perlin noise
    const driftX = noise(cube.noiseOffset, time * 0.2) * 2 - 1;
    const driftY = noise(cube.noiseOffset + 100, time * 0.2) * 2 - 1;
    const driftZ = noise(cube.noiseOffset + 200, time * 0.2) * 2 - 1;

    const posX = cube.x + driftX * 50;
    const posY = cube.y + driftY * 50;
    const posZ = cube.z + driftZ * 100;

    push();
    translate(posX, posY, posZ);
    rotateX(cube.rotationX);
    rotateY(cube.rotationY);
    rotateZ(cube.rotationZ);

    // Depth-based fog effect
    const distance = dist(0, 0, 0, posX, posY, posZ);
    const fogFactor = map(distance, CONFIG.depthFog.near, CONFIG.depthFog.far, 1, 0.2);

    // Wireframe cube
    stroke(COLORS[cube.colorIndex]);
    strokeWeight(1.5 * fogFactor);
    noFill();
    box(cube.size);

    // Inner glowing cube
    const innerColor = color(COLORS[cube.colorIndex]);
    innerColor.setAlpha(80 * fogFactor);
    noStroke();
    emissiveMaterial(innerColor);
    box(cube.size * 0.7);

    // Octahedron inside
    push();
    rotateX(time * 0.5);
    rotateY(time * 0.3);
    stroke(COLORS[(cube.colorIndex + 2) % COLORS.length]);
    strokeWeight(1 * fogFactor);
    noFill();
    drawOctahedron(cube.size * 0.4);
    pop();

    pop();
  }
}

function drawOctahedron(size) {
  const vertices = [
    [0, size, 0],
    [0, -size, 0],
    [size, 0, 0],
    [-size, 0, 0],
    [0, 0, size],
    [0, 0, -size]
  ];

  const faces = [
    [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
    [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]
  ];

  for (const face of faces) {
    beginShape();
    for (const i of face) {
      vertex(...vertices[i]);
    }
    endShape(CLOSE);
  }
}

function drawSpiralGalaxy() {
  push();
  rotateY(time * 0.05);
  rotateX(PI / 6);
  noStroke();

  for (const star of galaxyStars) {
    const angle = star.armAngle + star.t * star.spiralTightness + time * 0.2;
    const radius = star.radius;

    const x = cos(angle) * radius;
    const z = sin(angle) * radius;
    const y = star.yOffset + sin(star.t * PI * 2 + time) * 20;

    push();
    translate(x, y, z + star.depth);

    // Depth-based size and brightness
    const distance = dist(0, 0, 0, x, y, z + star.depth);
    const depthScale = map(distance, 0, 600, 1.5, 0.3);
    const brightness = map(distance, 0, 600, 220, 50);

    const starColor = color(COLORS[star.colorIndex]);
    starColor.setAlpha(brightness * (0.6 + sin(time * 3 + star.phaseOffset) * 0.4));
    emissiveMaterial(starColor);

    const finalSize = star.size * depthScale;
    sphere(finalSize, 4, 4);

    // Glow layer
    starColor.setAlpha(brightness * 0.3);
    emissiveMaterial(starColor);
    sphere(finalSize * 2, 3, 3);

    pop();
  }
  pop();
}

function drawDepthFog() {
  // Atmospheric depth particles
  push();
  noStroke();

  for (let i = 0; i < 50; i++) {
    const seed = i * 87.3;
    const x = (noise(seed, time * 0.1) - 0.5) * 800;
    const y = (noise(seed + 100, time * 0.1) - 0.5) * 800;
    const z = (noise(seed + 200, time * 0.1) - 0.5) * 600;

    const distance = dist(0, 0, 0, x, y, z);
    const fogIntensity = map(distance, CONFIG.depthFog.near, CONFIG.depthFog.far, 0, 1);

    if (fogIntensity > 0.3) {
      push();
      translate(x, y, z);

      const fogColor = color(COLORS[i % COLORS.length]);
      fogColor.setAlpha(fogIntensity * 30);
      emissiveMaterial(fogColor);

      sphere(3 + fogIntensity * 5, 3, 3);
      pop();
    }
  }
  pop();
}

function windowResized() {
  resizeCanvas(CONFIG.canvas.width, CONFIG.canvas.height);
}