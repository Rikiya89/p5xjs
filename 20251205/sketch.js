let particles = [];
let numParticles = 200;
let time = 0;
let waves = [];

function setup() {
  createCanvas(720, 1280, WEBGL);
  
  // Create flowing particles in elegant patterns
  for (let i = 0; i < numParticles; i++) {
    let angle = (i / numParticles) * TWO_PI * 3;
    let radius = 200;
    particles.push({
      angle: angle,
      radius: radius + random(-50, 50),
      yOffset: random(-400, 400),
      size: random(3, 15),
      speed: random(0.003, 0.01),
      verticalSpeed: random(-0.3, 0.3),
      orbitSpeed: random(0.002, 0.008),
      phase: random(TWO_PI),
      radiusPhase: random(TWO_PI),
      brightness: random(200, 255)
    });
  }
  
  // Create wave layers
  for (let i = 0; i < 5; i++) {
    waves.push({
      radius: 100 + i * 50,
      speed: 0.01 + i * 0.002,
      offset: random(TWO_PI)
    });
  }
}

function draw() {
  background(0);
  
  // Sophisticated lighting
  ambientLight(80);
  pointLight(255, 255, 255, 0, -300, 300);
  pointLight(200, 200, 200, 300, 200, -200);
  pointLight(150, 150, 150, -300, 0, 200);
  
  // Slow, elegant rotation
  rotateY(time * 0.002);
  rotateX(sin(time * 0.001) * 0.2);
  
  // Draw elegant wave structures
  push();
  noFill();
  strokeWeight(1);
  for (let wave of waves) {
    stroke(255, 40);
    beginShape();
    for (let a = 0; a < TWO_PI; a += 0.1) {
      let r = wave.radius + sin(a * 4 + time * wave.speed + wave.offset) * 20;
      let x = cos(a) * r;
      let z = sin(a) * r;
      let y = sin(a * 3 + time * wave.speed * 0.5) * 30;
      vertex(x, y, z);
    }
    endShape(CLOSE);
  }
  pop();
  
  // Draw flowing connections with elegance
  stroke(255, 15);
  strokeWeight(0.5);
  for (let i = 0; i < particles.length; i++) {
    let p1 = particles[i];
    let x1 = cos(p1.angle) * p1.radius;
    let z1 = sin(p1.angle) * p1.radius;
    let y1 = p1.yOffset + sin(time * 0.01 + p1.phase) * 50;
    
    for (let j = i + 1; j < particles.length; j++) {
      if (random(1) > 0.98) {
        let p2 = particles[j];
        let x2 = cos(p2.angle) * p2.radius;
        let z2 = sin(p2.angle) * p2.radius;
        let y2 = p2.yOffset + sin(time * 0.01 + p2.phase) * 50;
        
        let d = dist(x1, y1, z1, x2, y2, z2);
        if (d < 200) {
          let alpha = map(d, 0, 200, 40, 0);
          stroke(255, alpha);
          line(x1, y1, z1, x2, y2, z2);
        }
      }
    }
  }
  
  // Draw particles with refined shapes
  for (let p of particles) {
    push();
    
    // Calculate position with flowing motion
    let x = cos(p.angle) * (p.radius + sin(time * 0.005 + p.radiusPhase) * 30);
    let z = sin(p.angle) * (p.radius + sin(time * 0.005 + p.radiusPhase) * 30);
    let y = p.yOffset + sin(time * 0.01 + p.phase) * 50;
    
    translate(x, y, z);
    
    // Elegant rotation
    rotateY(p.angle + time * p.orbitSpeed);
    rotateX(time * p.orbitSpeed * 0.5);
    rotateZ(time * p.orbitSpeed * 0.3);
    
    // Gradient-like effect with size
    noStroke();
    fill(p.brightness);
    
    // Mix of refined shapes
    let shapeType = floor(p.size / 5);
    if (shapeType === 0) {
      sphere(p.size * 0.6);
    } else if (shapeType === 1) {
      box(p.size * 0.8);
    } else {
      // Elegant torus
      torus(p.size * 0.5, p.size * 0.15, 12, 8);
    }
    
    // Add subtle glow effect
    stroke(255, 100);
    strokeWeight(0.5);
    noFill();
    sphere(p.size * 1.2);
    
    pop();
    
    // Update particle
    p.angle += p.speed;
    p.yOffset += p.verticalSpeed;
    
    // Smooth wrapping
    if (p.yOffset > 640) p.yOffset = -640;
    if (p.yOffset < -640) p.yOffset = 640;
  }
  
  // Central elegant structure with multiple layers
  push();
  noFill();
  strokeWeight(1);
  
  // Rotating inner core
  rotateY(time * 0.008);
  rotateX(time * 0.005);
  stroke(255, 120);
  sphere(120, 24, 16);
  
  // Middle layer with opposite rotation
  rotateY(-time * 0.012);
  rotateZ(time * 0.006);
  stroke(255, 80);
  torus(140, 20, 24, 16);
  
  // Outer layer
  rotateX(time * 0.007);
  stroke(255, 50);
  torus(180, 15, 24, 16);
  
  // Geometric accents
  rotateY(HALF_PI);
  rotateX(time * 0.009);
  stroke(255, 40);
  box(200, 2, 2);
  box(2, 200, 2);
  box(2, 2, 200);
  
  pop();
  
  // Floating rings around the scene
  for (let i = 0; i < 3; i++) {
    push();
    rotateX(HALF_PI);
    rotateZ(time * (0.003 + i * 0.001));
    translate(0, 0, -300 + i * 300);
    noFill();
    stroke(255, 30);
    strokeWeight(1);
    circle(0, 0, 300 + i * 100);
    pop();
  }
  
  time++;
}
