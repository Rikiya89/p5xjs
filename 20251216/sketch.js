// 3D Organic Flow - Monochrome Elegance
// Optimized with beautiful flowing animations

let tendrils = [];
let numTendrils = 60;
let time = 0;
let bloomParticles = [];
let coreParticles = [];

function setup() {
  createCanvas(720, 1280, WEBGL);
  
  // Organic tendrils with varied origins
  for (let i = 0; i < numTendrils; i++) {
    let theta = (i / numTendrils) * TWO_PI + random(-0.2, 0.2);
    let phi = random(-PI * 0.35, PI * 0.35);
    let startR = random(25, 70);
    
    tendrils.push({
      phase: i * 0.25 + random(0.5),
      thickness: random(2.5, 5.5),
      length: floor(random(25, 40)),
      noiseOffsetX: i * 73.7,
      noiseOffsetY: i * 91.3,
      noiseOffsetZ: i * 67.9,
      luminance: 0.4 + random(0.6),
      startX: cos(theta) * cos(phi) * startR,
      startY: sin(phi) * startR * 2.5,
      startZ: sin(theta) * cos(phi) * startR,
      waveSpeed: random(0.8, 1.5), // Individual wave animation
      spiralSpeed: random(0.5, 1.2) // Individual spiral
    });
  }
  
  // Bloom particles with trails
  for (let i = 0; i < 40; i++) {
    bloomParticles.push({
      x: random(-400, 400),
      y: random(-600, 600),
      z: random(-300, 300),
      size: random(2, 4),
      phase: random(TWO_PI),
      speed: random(0.4, 1.0),
      brightness: random(0.4, 0.9),
      orbitRadius: random(50, 200), // Orbit animation
      orbitSpeed: random(0.3, 0.8)
    });
  }
  
  // Core particles with pulsing
  for (let i = 0; i < 20; i++) {
    let r = random(50, 110);
    let theta = random(TWO_PI);
    let phi = random(-PI, PI);
    coreParticles.push({
      baseX: r * cos(theta) * cos(phi),
      baseY: r * sin(phi),
      baseZ: r * sin(theta) * cos(phi),
      size: random(3, 5),
      phase: random(TWO_PI),
      orbitSpeed: random(0.3, 0.5) * (random() > 0.5 ? 1 : -1),
      pulseSpeed: random(1.5, 2.5) // Individual pulse
    });
  }
  
  noStroke();
}

function draw() {
  // Animated background fade
  let bgPulse = 5 + sin(time * 0.5) * 3;
  background(bgPulse, bgPulse, bgPulse);
  
  // Dynamic camera with smooth easing
  let camRadius = 600 + sin(time * 0.12) * 60 + cos(time * 0.08) * 40;
  let camTheta = time * 0.09 + sin(time * 0.05) * 0.3;
  let camY = sin(time * 0.07) * 150 + cos(time * 0.11) * 80;
  let camLookY = sin(time * 0.06) * 30; // Camera target moves too
  
  camera(
    camRadius * cos(camTheta),
    camY,
    camRadius * sin(camTheta),
    0, camLookY, 0,
    0, 1, 0
  );
  
  // Animated lighting
  ambientLight(15 + sin(time * 0.8) * 5);
  
  // Pulsing key light
  let keyBright = 250 + sin(time * 1.2) * 30;
  directionalLight(keyBright, keyBright, keyBright, 0.4, -0.8, -0.5);
  directionalLight(50, 50, 50, -0.5, 0.3, 0.5);
  
  // Orbiting point lights (multiple!)
  let lx1 = sin(time * 0.18) * 250;
  let ly1 = cos(time * 0.14) * 120;
  let lz1 = cos(time * 0.22) * 180;
  pointLight(255, 255, 255, lx1, ly1, lz1);
  
  // Second orbiting light (opposite direction)
  let lx2 = sin(time * -0.15 + PI) * 200;
  let ly2 = cos(time * -0.12 + PI) * 100;
  let lz2 = cos(time * -0.19 + PI) * 150;
  pointLight(180, 180, 180, lx2, ly2, lz2);
  
  // Render with beautiful animations
  drawTendrils();
  drawCore();
  drawCoreConstellation();
  drawBloomParticles();
  
  time += 0.060;
}

function drawCore() {
  // Breathing pulse animation
  let pulse = 1 + sin(time * 1.2) * 0.2 + cos(time * 0.8) * 0.1;
  let pulse2 = 1 + sin(time * 1.8 + 1) * 0.15;
  
  // Rotating outer glow with multiple layers
  push();
  rotateY(time * 0.15);
  rotateX(sin(time * 0.2) * 0.3);
  rotateZ(time * 0.1);
  
  let glowBright = 40 + sin(time * 1.5) * 20;
  specularMaterial(glowBright);
  ambientMaterial(glowBright * 0.5);
  emissiveMaterial(glowBright * 0.4);
  shininess(100);
  sphere(50 * pulse);
  pop();
  
  // Inner core with complex rotation
  push();
  rotateY(time * 0.25);
  rotateX(time * 0.18 + sin(time * 0.3) * 0.4);
  rotateZ(-time * 0.12);
  
  let coreBright = 240 + sin(time * 2) * 15;
  specularMaterial(coreBright);
  ambientMaterial(coreBright * 0.4);
  emissiveMaterial(coreBright * 0.6);
  shininess(200);
  sphere(18 * pulse2);
  pop();
}

function drawCoreConstellation() {
  for (let i = 0; i < coreParticles.length; i++) {
    let p = coreParticles[i];
    
    // Complex orbital motion
    let angle = time * p.orbitSpeed + p.phase;
    let wobble = sin(time * 1.5 + p.phase) * 12;
    let wobble2 = cos(time * 0.9 + p.phase * 1.5) * 8;
    
    let x = p.baseX * cos(angle) - p.baseZ * sin(angle) + wobble;
    let y = p.baseY + cos(time * 0.8 + p.phase) * 15 + wobble2;
    let z = p.baseX * sin(angle) + p.baseZ * cos(angle) + sin(time * 0.7 + p.phase) * 10;
    
    // Individual pulsing animation
    let brightness = 100 + sin(time * p.pulseSpeed + p.phase * 3) * 80;
    let sizePulse = 1 + sin(time * p.pulseSpeed * 1.3 + p.phase) * 0.3;
    
    push();
    translate(x, y, z);
    
    // Rotating particles
    rotateY(time * 0.5 + p.phase);
    rotateX(time * 0.3);
    
    specularMaterial(brightness);
    ambientMaterial(brightness * 0.3);
    emissiveMaterial(brightness * 0.2);
    shininess(80);
    sphere(p.size * sizePulse);
    pop();
  }
}

function drawTendrils() {
  let growthForce = 14;
  
  for (let t = 0; t < numTendrils; t++) {
    let td = tendrils[t];
    
    let x = td.startX;
    let y = td.startY;
    let z = td.startZ;
    
    // Multiple wave animations
    let breathe = 1 + sin(time * 1.2 * td.waveSpeed + td.phase) * 0.12;
    let breathe2 = 1 + cos(time * 0.8 * td.waveSpeed + td.phase * 2) * 0.08;
    let timeShift = time * 0.25;
    
    for (let i = 0; i < td.length; i++) {
      let ns = 0.01;
      
      let nx = noise(x * ns + td.noiseOffsetX, y * ns, timeShift) * 2 - 1;
      let ny = noise(y * ns + td.noiseOffsetY, z * ns, timeShift) * 2 - 1;
      let nz = noise(z * ns + td.noiseOffsetZ, x * ns, timeShift) * 2 - 1;
      
      // Enhanced spiral with wave motion
      let spiral = sin(i * 0.15 + td.phase + time * td.spiralSpeed * 0.5) * 2;
      let wave = cos(i * 0.12 + time * td.waveSpeed) * 1.5;
      
      x += nx * growthForce + spiral;
      y += ny * growthForce + wave;
      z += nz * growthForce + cos(i * 0.15 + td.phase + time * td.spiralSpeed * 0.5) * 2;
      
      let progress = i / td.length;
      let taper = 1 - progress * progress * 0.7;
      
      // Animated brightness traveling along tentacles
      let travelWave = sin(progress * TWO_PI - time * 2 + td.phase) * 0.3 + 0.7;
      let baseBright = td.luminance * 255;
      let fadeOut = 1 - progress * 0.5;
      let pulse = 0.85 + sin(time * 1.5 + i * 0.1 + td.phase) * 0.15;
      let brightness = baseBright * fadeOut * pulse * travelWave;
      
      // Individual segment size variation
      let segmentPulse = 1 + sin(time * 2 + i * 0.2 + td.phase * 3) * 0.1;
      
      push();
      translate(x, y, z);
      
      // Subtle rotation per segment
      rotateY(sin(i * 0.1 + time * 0.5) * 0.2);
      
      specularMaterial(brightness);
      ambientMaterial(brightness * 0.2);
      emissiveMaterial(brightness * 0.15);
      shininess(70);
      sphere(td.thickness * taper * breathe * breathe2 * segmentPulse);
      pop();
    }
  }
}

function drawBloomParticles() {
  for (let i = 0; i < bloomParticles.length; i++) {
    let p = bloomParticles[i];
    
    // Orbital motion around center
    let orbitAngle = time * p.orbitSpeed + p.phase;
    let orbitX = cos(orbitAngle) * p.orbitRadius * 0.3;
    let orbitZ = sin(orbitAngle) * p.orbitRadius * 0.3;
    
    // Floating motion
    let t = time * p.speed;
    p.x += sin(t + p.phase) * 0.3 + orbitX * 0.01;
    p.y += cos(t * 0.7 + p.phase) * 0.25 + sin(time * 0.4) * 0.1;
    p.z += cos(t + p.phase * 1.3) * 0.3 + orbitZ * 0.01;
    
    // Boundary wrap
    if (p.x > 400) p.x = -400;
    if (p.x < -400) p.x = 400;
    if (p.y > 600) p.y = -600;
    if (p.y < -600) p.y = 600;
    if (p.z > 300) p.z = -300;
    if (p.z < -300) p.z = 300;
    
    // Complex twinkling animation
    let twinkle = sin(time * 2 + p.phase * 6) * 0.4 + 0.6;
    let twinkle2 = cos(time * 3 + p.phase * 4) * 0.2 + 0.8;
    let brightness = p.brightness * twinkle * twinkle2 * 90;
    
    // Pulsing size
    let sizePulse = 0.8 + sin(time * 2.5 + p.phase * 5) * 0.2;
    
    push();
    translate(p.x, p.y, p.z);
    
    // Particles rotate individually
    rotateY(time * 0.5 + p.phase);
    rotateX(time * 0.3 + p.phase * 2);
    
    ambientMaterial(brightness * 0.5);
    specularMaterial(brightness);
    emissiveMaterial(brightness * 0.3);
    sphere(p.size * sizePulse);
    pop();
  }
}

function windowResized() {
  resizeCanvas(720, 1280);
}
