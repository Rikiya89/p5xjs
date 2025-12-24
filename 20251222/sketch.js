// Theme Colors: Purple-Blue Winter Palette
const COLORS = {
  deep: '#362d78',
  royal: '#523fa3',
  violet: '#916ccc',
  lavender: '#bda1e5',
  pale: '#c8c0e9',
  sky: '#84bae7',
  cobalt: '#516ad4',
  midnight: '#333f87',
  shadow: '#293039',
  forest: '#283631'
};

let ornaments = [];
let snowflakes = [];
let stars = [];
let particles = [];
let ribbons = [];
let crystals = [];
let rotationAngle = 0;
let time = 0;

function setup() {
  createCanvas(720, 1280, WEBGL);
  
  // Generate floating ornaments
  for (let i = 0; i < 25; i++) {
    ornaments.push(new Ornament());
  }
  
  // Generate snowflakes
  for (let i = 0; i < 150; i++) {
    snowflakes.push(new Snowflake());
  }
  
  // Generate stars
  for (let i = 0; i < 80; i++) {
    stars.push(new Star());
  }
  
  // Generate magic particles
  for (let i = 0; i < 200; i++) {
    particles.push(new MagicParticle());
  }
  
  // Generate flowing ribbons
  for (let i = 0; i < 10; i++) {
    ribbons.push(new Ribbon(i));
  }
  
  // Generate ice crystals
  for (let i = 0; i < 15; i++) {
    crystals.push(new IceCrystal());
  }
}

function draw() {
  background(0);
  
  // Enhanced atmospheric lighting with dynamic movement
  ambientLight(30, 30, 50);
  
  // Rotating colored spotlights
  let light1X = sin(time * 0.001) * 350;
  let light1Z = cos(time * 0.001) * 350;
  pointLight(180, 120, 255, light1X, -350, light1Z);
  
  let light2X = cos(time * 0.0015) * 300;
  let light2Z = sin(time * 0.0015) * 300;
  pointLight(120, 180, 255, light2X, 100, light2Z);
  
  let light3X = sin(time * 0.0008 + PI) * 280;
  let light3Z = cos(time * 0.0008 + PI) * 280;
  pointLight(200, 150, 255, light3X, 0, light3Z);
  
  // Top mystical glow
  pointLight(255, 200, 255, 0, -450, 0);
  
  // Warm foundation glow
  pointLight(180, 140, 220, 0, 450, 100);
  
  // Gentle auto-rotation
  rotationAngle += 0.003;
  rotateY(rotationAngle);
  rotateX(sin(time * 0.0005) * 0.08);
  
  // Draw ribbons (mid-background)
  for (let ribbon of ribbons) {
    ribbon.update();
    ribbon.display();
  }
  
  // Draw central Christmas tree
  push();
  translate(0, 50, 0);
  drawChristmasTree();
  pop();
  
  // Draw ice crystals
  for (let crystal of crystals) {
    crystal.update();
    crystal.display();
  }
  
  // Draw ornaments
  for (let ornament of ornaments) {
    ornament.update();
    ornament.display();
  }
  
  // Draw snowflakes
  for (let flake of snowflakes) {
    flake.update();
    flake.display();
  }
  
  // Draw stars
  for (let star of stars) {
    star.update();
    star.display();
  }
  
  // Draw magic particles (foreground)
  for (let particle of particles) {
    particle.update();
    particle.display();
  }
  
  time++;
}

function drawAurora() {
  push();
  translate(0, -500, -200);
  rotateX(PI / 3);
  noStroke();
  
  for (let i = 0; i < 8; i++) {
    let wave = sin(time * 0.005 + i * 0.3) * 50;
    let alpha = map(sin(time * 0.008 + i), -1, 1, 20, 60);
    
    fill(red(color(COLORS.lavender)), green(color(COLORS.lavender)), blue(color(COLORS.lavender)), alpha);
    
    beginShape();
    for (let x = -400; x < 400; x += 30) {
      let y = sin(x * 0.01 + time * 0.003 + i) * 40 + wave;
      vertex(x, y);
    }
    vertex(400, 200);
    vertex(-400, 200);
    endShape(CLOSE);
  }
  pop();
}

function drawChristmasTree() {
  // Enhanced tree with more detail
  let layers = 7;
  
  for (let i = 0; i < layers; i++) {
    push();
    let y = i * 55 - 120;
    let radius = map(i, 0, layers, 35, 200);
    
    translate(0, y, 0);
    
    // Tree foliage with enhanced gradient
    let treeColor = lerpColor(
      lerpColor(color(COLORS.forest), color(COLORS.cobalt), i / layers),
      color(COLORS.royal),
      sin(time * 0.01 + i) * 0.1 + 0.1
    );
    fill(treeColor);
    noStroke();
    
    // Main cone
    let detail = 12;
    beginShape(TRIANGLE_STRIP);
    for (let j = 0; j <= detail; j++) {
      let angle = map(j, 0, detail, 0, TWO_PI);
      let x = cos(angle) * radius;
      let z = sin(angle) * radius;
      vertex(x, 0, z);
      vertex(0, -60, 0);
    }
    endShape(CLOSE);
    
    // Decorative glowing orbs on tree
    for (let j = 0; j < 5; j++) {
      let lightAngle = time * 0.015 + j * TWO_PI / 5 + i;
      let lx = cos(lightAngle) * radius * 0.75;
      let lz = sin(lightAngle) * radius * 0.75;
      let ly = -25;
      
      push();
      translate(lx, ly, lz);
      
      let orbColors = [COLORS.lavender, COLORS.sky, COLORS.pale, COLORS.violet];
      let orbColor = orbColors[j % orbColors.length];
      
      // Outer glow
      fill(red(color(orbColor)), green(color(orbColor)), blue(color(orbColor)), 100);
      sphere(8);
      
      // Inner bright core
      fill(orbColor);
      emissiveMaterial(orbColor);
      sphere(5);
      pop();
    }
    
    // Sparkles
    for (let j = 0; j < 8; j++) {
      let sparkAngle = time * 0.02 + j * TWO_PI / 8 + i * 0.5;
      let sx = cos(sparkAngle) * radius * 0.9;
      let sz = sin(sparkAngle) * radius * 0.9;
      let sy = -15 + sin(time * 0.05 + j) * 10;
      
      push();
      translate(sx, sy, sz);
      fill(255, 255, 255, 200);
      sphere(2);
      pop();
    }
    pop();
  }
  
  // Enhanced trunk with texture
  push();
  translate(0, 265, 0);
  fill(COLORS.midnight);
  cylinder(22, 110, 12);
  
  // Trunk rings
  for (let i = 0; i < 3; i++) {
    push();
    translate(0, -30 + i * 30, 0);
    fill(COLORS.shadow);
    torus(24, 2, 12, 8);
    pop();
  }
  pop();
  
  // Magical 3D star on top
  push();
  translate(0, -190, 0);
  rotateY(time * 0.025);
  rotateX(sin(time * 0.01) * 0.15);
  
  // Outer glow layers
  for (let i = 3; i > 0; i--) {
    push();
    fill(255, 255, 200, 30 * i);
    noStroke();
    drawStar3D(40 + i * 8);
    pop();
  }
  
  // Main star body - front face
  fill(COLORS.sky);
  emissiveMaterial(255, 255, 150);
  specularMaterial(255, 255, 200);
  shininess(30);
  drawStar3D(35);
  
  // Star back face for 3D depth
  push();
  rotateY(PI);
  fill(COLORS.lavender);
  emissiveMaterial(200, 200, 255);
  drawStar3D(35);
  pop();
  
  // Star points sparkle particles
  for (let i = 0; i < 5; i++) {
    let angle = TWO_PI * i / 5 - PI / 2 + time * 0.025;
    let outerX = cos(angle) * 42;
    let outerY = sin(angle) * 42;
    
    push();
    translate(outerX, outerY, 0);
    fill(255, 255, 255, 220);
    noStroke();
    
    // Multi-point sparkle
    rotateZ(time * 0.05 + i);
    drawStar3D(6);
    pop();
    
    // Inner sparkles
    let innerAngle = TWO_PI * (i + 0.5) / 5 - PI / 2;
    let innerX = cos(innerAngle) * 20;
    let innerY = sin(innerAngle) * 20;
    
    push();
    translate(innerX, innerY, 5);
    fill(COLORS.pale);
    emissiveMaterial(COLORS.pale);
    drawStar3D(4);
    pop();
  }
  
  // Center crystal core
  push();
  fill(255, 255, 255, 200);
  emissiveMaterial(255, 255, 255);
  drawStar3D(8);
  pop();
  
  pop();
}

function drawStar3D(size) {
  beginShape();
  for (let i = 0; i < 5; i++) {
    let angle = TWO_PI * i / 5 - PI / 2;
    let x = cos(angle) * size;
    let y = sin(angle) * size;
    vertex(x, y, 0);
    
    angle = TWO_PI * (i + 0.5) / 5 - PI / 2;
    x = cos(angle) * size * 0.4;
    y = sin(angle) * size * 0.4;
    vertex(x, y, 0);
  }
  endShape(CLOSE);
}

class Ornament {
  constructor() {
    this.pos = createVector(
      random(-320, 320),
      random(-450, 450),
      random(-320, 320)
    );
    this.vel = createVector(0, random(0.2, 0.6), 0);
    this.size = random(12, 30);
    this.rotSpeed = random(0.008, 0.025);
    this.rotation = random(TWO_PI);
    this.wobble = random(TWO_PI);
    this.colorIndex = floor(random(5));
    this.colors = [COLORS.royal, COLORS.violet, COLORS.lavender, COLORS.sky, COLORS.cobalt];
  }
  
  update() {
    this.pos.add(this.vel);
    this.rotation += this.rotSpeed;
    this.wobble += 0.02;
    this.pos.x += sin(this.wobble) * 0.5;
    this.pos.z += cos(this.wobble) * 0.5;
    
    if (this.pos.y > 640) {
      this.pos.y = -640;
      this.pos.x = random(-320, 320);
      this.pos.z = random(-320, 320);
    }
  }
  
  display() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    rotateY(this.rotation);
    rotateX(this.rotation * 0.7);
    
    // Glow effect
    fill(red(color(this.colors[this.colorIndex])), 
         green(color(this.colors[this.colorIndex])), 
         blue(color(this.colors[this.colorIndex])), 80);
    sphere(this.size + 5);
    
    // Main ornament
    fill(this.colors[this.colorIndex]);
    specularMaterial(this.colors[this.colorIndex]);
    shininess(30);
    sphere(this.size);
    
    // Ornament cap
    translate(0, -this.size - 2, 0);
    fill(COLORS.midnight);
    specularMaterial(150);
    shininess(20);
    cylinder(this.size * 0.25, this.size * 0.35);
    
    // Top hook
    translate(0, -this.size * 0.25, 0);
    torus(this.size * 0.15, 1.5);
    pop();
  }
}

class Snowflake {
  constructor() {
    this.pos = createVector(
      random(-450, 450),
      random(-700, 700),
      random(-450, 450)
    );
    this.vel = createVector(
      random(-0.3, 0.3),
      random(0.4, 1.2),
      random(-0.3, 0.3)
    );
    this.size = random(2, 7);
    this.rotation = random(TWO_PI);
    this.rotSpeed = random(-0.03, 0.03);
    this.opacity = random(150, 255);
  }
  
  update() {
    this.pos.add(this.vel);
    this.rotation += this.rotSpeed;
    
    if (this.pos.y > 700) {
      this.pos.y = -700;
      this.pos.x = random(-450, 450);
      this.pos.z = random(-450, 450);
    }
  }
  
  display() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    rotateZ(this.rotation);
    
    fill(255, 255, 255, this.opacity);
    noStroke();
    
    // Enhanced snowflake with 6 arms
    for (let i = 0; i < 6; i++) {
      push();
      rotate(PI / 3 * i);
      rect(0, -this.size * 0.3, this.size * 2.5, this.size * 0.6);
      rect(this.size * 0.8, -this.size * 0.8, this.size, this.size * 0.4);
      rect(this.size * 0.8, this.size * 0.4, this.size, this.size * 0.4);
      pop();
    }
    pop();
  }
}

class Star {
  constructor() {
    this.pos = createVector(
      random(-400, 400),
      random(-650, -100),
      random(-400, -50)
    );
    this.size = random(2, 10);
    this.brightness = random(100, 255);
    this.twinkleSpeed = random(0.015, 0.04);
    this.phase = random(TWO_PI);
  }
  
  update() {
    this.brightness = 120 + sin(time * this.twinkleSpeed + this.phase) * 135;
  }
  
  display() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    
    // Outer glow
    fill(red(color(COLORS.sky)), green(color(COLORS.sky)), blue(color(COLORS.sky)), this.brightness * 0.3);
    sphere(this.size * 2);
    
    // Core
    fill(255, 255, 255, this.brightness);
    emissiveMaterial(200, 200, 255, this.brightness);
    noStroke();
    sphere(this.size);
    pop();
  }
}

class MagicParticle {
  constructor() {
    this.pos = createVector(
      random(-350, 350),
      random(-600, 600),
      random(-200, 200)
    );
    this.vel = createVector(
      random(-0.5, 0.5),
      random(-1, 1),
      random(-0.5, 0.5)
    );
    this.size = random(1, 4);
    this.life = random(100, 255);
    this.fadeSpeed = random(0.5, 2);
    this.colorIndex = floor(random(4));
    this.colors = [COLORS.lavender, COLORS.pale, COLORS.sky, COLORS.violet];
  }
  
  update() {
    this.pos.add(this.vel);
    this.life -= this.fadeSpeed;
    
    if (this.life <= 0 || this.pos.y > 700 || this.pos.y < -700) {
      this.pos = createVector(
        random(-350, 350),
        random(-600, 600),
        random(-200, 200)
      );
      this.life = random(100, 255);
    }
  }
  
  display() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    
    fill(red(color(this.colors[this.colorIndex])), 
         green(color(this.colors[this.colorIndex])), 
         blue(color(this.colors[this.colorIndex])), 
         this.life);
    noStroke();
    sphere(this.size);
    pop();
  }
}

class Ribbon {
  constructor(index) {
    this.index = index;
    this.points = [];
    this.numPoints = 30;
    this.radius = 250 + index * 20;
    this.yOffset = -200 + index * 80;
    this.speed = 0.001 + index * 0.0002;
    this.colorIndex = index % 3;
    this.colors = [COLORS.royal, COLORS.violet, COLORS.sky];
    
    for (let i = 0; i < this.numPoints; i++) {
      this.points.push(createVector(0, 0, 0));
    }
  }
  
  update() {
    for (let i = 0; i < this.numPoints; i++) {
      let angle = map(i, 0, this.numPoints, 0, TWO_PI) + time * this.speed;
      let x = cos(angle) * this.radius;
      let z = sin(angle) * this.radius;
      let y = this.yOffset + sin(angle * 3 + time * 0.005) * 30;
      
      this.points[i].set(x, y, z);
    }
  }
  
  display() {
    push();
    noFill();
    stroke(red(color(this.colors[this.colorIndex])), 
           green(color(this.colors[this.colorIndex])), 
           blue(color(this.colors[this.colorIndex])), 
           100);
    strokeWeight(3);
    
    beginShape();
    for (let point of this.points) {
      vertex(point.x, point.y, point.z);
    }
    endShape(CLOSE);
    pop();
  }
}

class IceCrystal {
  constructor() {
    this.pos = createVector(
      random(-300, 300),
      random(-400, 400),
      random(-200, 200)
    );
    this.rotation = createVector(
      random(TWO_PI),
      random(TWO_PI),
      random(TWO_PI)
    );
    this.rotSpeed = createVector(
      random(0.005, 0.015),
      random(0.005, 0.015),
      random(0.005, 0.015)
    );
    this.size = random(15, 35);
    this.drift = random(TWO_PI);
  }
  
  update() {
    this.rotation.add(this.rotSpeed);
    this.drift += 0.01;
    this.pos.x += sin(this.drift) * 0.3;
    this.pos.z += cos(this.drift) * 0.3;
  }
  
  display() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    rotateX(this.rotation.x);
    rotateY(this.rotation.y);
    rotateZ(this.rotation.z);
    
    fill(COLORS.pale);
    specularMaterial(200, 220, 255);
    shininess(50);
    
    // Octahedron (crystal shape)
    beginShape(TRIANGLES);
    let s = this.size;
    
    // Top pyramid
    vertex(0, -s, 0);
    vertex(s, 0, 0);
    vertex(0, 0, s);
    
    vertex(0, -s, 0);
    vertex(0, 0, s);
    vertex(-s, 0, 0);
    
    vertex(0, -s, 0);
    vertex(-s, 0, 0);
    vertex(0, 0, -s);
    
    vertex(0, -s, 0);
    vertex(0, 0, -s);
    vertex(s, 0, 0);
    
    // Bottom pyramid
    vertex(0, s, 0);
    vertex(0, 0, s);
    vertex(s, 0, 0);
    
    vertex(0, s, 0);
    vertex(-s, 0, 0);
    vertex(0, 0, s);
    
    vertex(0, s, 0);
    vertex(0, 0, -s);
    vertex(-s, 0, 0);
    
    vertex(0, s, 0);
    vertex(s, 0, 0);
    vertex(0, 0, -s);
    
    endShape();
    pop();
  }
}
