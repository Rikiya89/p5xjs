let time = 0;
let particles = [];
let numParticles = 250;
let goldenRatio = (1 + Math.sqrt(5)) / 2;
let phi = goldenRatio;
let pg; // Graphics buffer
let chakraPoints = [];
let lotusLayers = [];

function setup() {
  createCanvas(720, 1280);
  pg = createGraphics(720, 1280);
  pg.background(0);
  
  // Initialize particles
  for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle(i));
  }
  
  // Create 7 chakra energy centers
  for (let i = 0; i < 7; i++) {
    chakraPoints.push({
      y: map(i, 0, 6, height * 0.2, height * 0.8),
      radius: 70,
      phase: random(TWO_PI),
      petals: [4, 6, 10, 12, 16, 96, 1000][i],
      name: ['Muladhara', 'Svadhisthana', 'Manipura', 'Anahata', 'Vishuddha', 'Ajna', 'Sahasrara'][i]
    });
  }
  
  // Lotus petal layers for beauty
  for (let i = 0; i < 8; i++) {
    lotusLayers.push({
      radius: 100 + i * 45,
      petals: 8 + i * 4,
      rotation: random(TWO_PI),
      speed: (i % 2 === 0 ? 0.001 : -0.001)
    });
  }
}

function draw() {
  // Smooth fade
  pg.fill(0, 12);
  pg.noStroke();
  pg.rect(0, 0, width, height);
  
  image(pg, 0, 0);
  
  // Draw main sacred elements
  push();
  translate(width/2, height/2);
  
  drawCentralLotus();
  drawSacredCircles();
  drawStarTetrahedron();
  drawFlowerOfLifeEnhanced();
  
  pop();
  
  // Draw vertical chakra system
  drawChakraColumn();
  
  // Particles as energy flow
  for (let particle of particles) {
    particle.update();
    particle.display();
  }
  
  // Beautiful overlays
  drawEnergyRings();
  drawSacredSpiralArms();
  
  time++;
}

class Particle {
  constructor(index) {
    this.index = index;
    this.angle = (index / numParticles) * TWO_PI * phi * 5;
    this.radius = Math.sqrt(index) * 8;
    this.baseRadius = this.radius;
    this.size = random(1, 3);
    this.speed = random(0.001, 0.005);
    this.phase = random(TWO_PI);
    this.history = [];
    this.maxHistory = 20;
    this.brightness = random(220, 255);
  }
  
  update() {
    this.angle += this.speed;
    
    // Gentle breathing
    let breath = sin(time * 0.01 + this.phase) * 40;
    this.radius = this.baseRadius + breath;
    
    let x = width/2 + cos(this.angle) * this.radius;
    let y = height/2 + sin(this.angle) * this.radius;
    
    this.history.push({x: x, y: y});
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }
  
  display() {
    // Smooth trails
    pg.noFill();
    for (let i = 1; i < this.history.length; i++) {
      let alpha = map(i, 0, this.history.length, 0, 150);
      pg.stroke(this.brightness, alpha);
      pg.strokeWeight(this.size * map(i, 0, this.history.length, 0.3, 1));
      pg.line(
        this.history[i-1].x, this.history[i-1].y,
        this.history[i].x, this.history[i].y
      );
    }
    
    // Bright particle
    if (this.history.length > 0) {
      let pos = this.history[this.history.length - 1];
      pg.noStroke();
      pg.fill(this.brightness, 200);
      pg.circle(pos.x, pos.y, this.size * 2.5);
    }
  }
}

function drawCentralLotus() {
  push();
  
  for (let layer of lotusLayers) {
    layer.rotation += layer.speed;
    
    push();
    rotate(layer.rotation);
    
    noFill();
    stroke(255, 40);
    strokeWeight(1.5);
    
    // Draw beautiful lotus petals
    for (let i = 0; i < layer.petals; i++) {
      let angle = TWO_PI / layer.petals * i;
      let petalLength = layer.radius;
      
      push();
      rotate(angle);
      
      // Petal shape using bezier curves
      beginShape();
      vertex(0, 0);
      bezierVertex(
        petalLength * 0.3, -petalLength * 0.2,
        petalLength * 0.6, -petalLength * 0.3,
        petalLength, 0
      );
      bezierVertex(
        petalLength * 0.6, petalLength * 0.3,
        petalLength * 0.3, petalLength * 0.2,
        0, 0
      );
      endShape();
      
      pop();
    }
    
    // Decorative circle at layer radius
    stroke(255, 20);
    strokeWeight(1);
    circle(0, 0, layer.radius * 2);
    
    pop();
  }
  
  // Central jewel
  noStroke();
  fill(255, 100);
  circle(0, 0, 40);
  fill(255, 200);
  circle(0, 0, 20);
  fill(255, 255);
  circle(0, 0, 8);
  
  pop();
}

function drawSacredCircles() {
  push();
  
  let baseRadius = 150;
  
  // Six-fold pattern
  for (let i = 0; i < 6; i++) {
    let angle = TWO_PI / 6 * i;
    let pulse = sin(time * 0.01 + i) * 10;
    let x = cos(angle) * (baseRadius + pulse);
    let y = sin(angle) * (baseRadius + pulse);
    
    noFill();
    stroke(255, 60);
    strokeWeight(2);
    circle(x, y, baseRadius * 1.5);
    
    // Inner decoration
    stroke(255, 30);
    strokeWeight(1);
    circle(x, y, baseRadius);
  }
  
  // Center circle
  stroke(255, 80);
  strokeWeight(2.5);
  circle(0, 0, baseRadius * 1.5);
  
  pop();
}

function drawStarTetrahedron() {
  push();
  rotate(time * 0.003);
  
  let size = 180;
  
  noFill();
  stroke(255, 70);
  strokeWeight(2);
  
  // Upward triangle
  beginShape();
  for (let i = 0; i < 3; i++) {
    let angle = TWO_PI / 3 * i - HALF_PI;
    let x = cos(angle) * size;
    let y = sin(angle) * size;
    vertex(x, y);
  }
  endShape(CLOSE);
  
  // Downward triangle
  push();
  rotate(PI);
  stroke(255, 70);
  beginShape();
  for (let i = 0; i < 3; i++) {
    let angle = TWO_PI / 3 * i - HALF_PI;
    let x = cos(angle) * size;
    let y = sin(angle) * size;
    vertex(x, y);
  }
  endShape(CLOSE);
  pop();
  
  // Center star points
  stroke(255, 100);
  strokeWeight(3);
  for (let i = 0; i < 6; i++) {
    let angle = TWO_PI / 6 * i;
    let x = cos(angle) * size * 0.4;
    let y = sin(angle) * size * 0.4;
    point(x, y);
  }
  
  // Central point
  noStroke();
  fill(255, 150);
  circle(0, 0, 15);
  
  pop();
}

function drawFlowerOfLifeEnhanced() {
  push();
  rotate(time * 0.0005);
  
  let radius = 60;
  
  noFill();
  stroke(255, 50);
  strokeWeight(1.5);
  
  // Central circle
  circle(0, 0, radius * 2);
  
  // First ring
  for (let i = 0; i < 6; i++) {
    let angle = TWO_PI / 6 * i;
    let x = cos(angle) * radius;
    let y = sin(angle) * radius;
    circle(x, y, radius * 2);
    
    // Connection points
    noStroke();
    fill(255, 80);
    circle(x, y, 6);
  }
  
  // Second ring
  stroke(255, 35);
  strokeWeight(1.5);
  for (let i = 0; i < 12; i++) {
    let angle = TWO_PI / 12 * i;
    let x = cos(angle) * radius * 1.732;
    let y = sin(angle) * radius * 1.732;
    circle(x, y, radius * 2);
  }
  
  pop();
}

function drawChakraColumn() {
  push();
  
  for (let i = 0; i < chakraPoints.length; i++) {
    let chakra = chakraPoints[i];
    let pulse = sin(time * 0.012 + chakra.phase) * 8;
    
    push();
    translate(width/2, chakra.y);
    rotate(time * 0.002 * (i % 2 === 0 ? 1 : -1));
    
    // Outer glow
    noStroke();
    fill(255, 15);
    circle(0, 0, (chakra.radius + pulse) * 3);
    
    // Main chakra circle
    noFill();
    stroke(255, 80);
    strokeWeight(2.5);
    circle(0, 0, (chakra.radius + pulse) * 2);
    
    // Inner circle
    stroke(255, 60);
    strokeWeight(1.5);
    circle(0, 0, (chakra.radius + pulse) * 1.3);
    
    // Draw petals
    if (chakra.petals < 100) {
      stroke(255, 50);
      strokeWeight(1);
      for (let p = 0; p < chakra.petals; p++) {
        let angle = TWO_PI / chakra.petals * p;
        let x1 = cos(angle) * chakra.radius * 0.7;
        let y1 = sin(angle) * chakra.radius * 0.7;
        let x2 = cos(angle) * (chakra.radius + pulse);
        let y2 = sin(angle) * (chakra.radius + pulse);
        line(x1, y1, x2, y2);
        
        // Petal tips
        noStroke();
        fill(255, 70);
        circle(x2, y2, 5);
      }
    } else {
      // Crown chakra - radiating lines
      stroke(255, 40);
      strokeWeight(0.8);
      for (let a = 0; a < TWO_PI; a += PI / 36) {
        let x = cos(a) * chakra.radius;
        let y = sin(a) * chakra.radius;
        line(0, 0, x, y);
      }
    }
    
    // Center jewel
    noStroke();
    fill(255, 120);
    circle(0, 0, 20 + pulse * 0.5);
    fill(255, 220);
    circle(0, 0, 10);
    fill(255, 255);
    circle(0, 0, 4);
    
    pop();
  }
  
  // Vertical connecting energy line
  stroke(255, 40);
  strokeWeight(2);
  for (let i = 0; i < chakraPoints.length - 1; i++) {
    line(width/2, chakraPoints[i].y, width/2, chakraPoints[i+1].y);
  }
  
  pop();
}

function drawEnergyRings() {
  push();
  translate(width/2, height/2);
  
  for (let i = 0; i < 6; i++) {
    let phase = (time * 0.015 + i * 1) % TWO_PI;
    let radius = 150 + sin(phase) * 150;
    let alpha = map(sin(phase), -1, 1, 20, 60);
    
    noFill();
    stroke(255, alpha);
    strokeWeight(2);
    circle(0, 0, radius * 2);
  }
  
  pop();
}

function drawSacredSpiralArms() {
  push();
  translate(width/2, height/2);
  rotate(time * 0.002);
  
  noFill();
  stroke(255, 40);
  strokeWeight(2);
  
  // Three spiral arms
  for (let arm = 0; arm < 3; arm++) {
    push();
    rotate(TWO_PI / 3 * arm);
    
    beginShape();
    for (let i = 0; i < 80; i++) {
      let angle = i * 0.15;
      let radius = i * 4;
      let x = cos(angle) * radius;
      let y = sin(angle) * radius;
      
      let wave = sin(i * 0.2 + time * 0.02) * 10;
      x += cos(angle + HALF_PI) * wave;
      y += sin(angle + HALF_PI) * wave;
      
      vertex(x, y);
    }
    endShape();
    
    pop();
  }
  
  pop();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('spiritual_mandala', 'png');
  }
  if (key === 'c' || key === 'C') {
    pg.background(0);
  }
}
