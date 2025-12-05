let time = 0;
let basePairs = [];
let numBasePairs = 80;
let helixRadius = 120;
let helixHeight = 1000;
let nucleotides = [];
let enzymes = [];

function setup() {
  createCanvas(720, 1280, WEBGL);
  
  // Create base pairs along the DNA helix
  for (let i = 0; i < numBasePairs; i++) {
    let t = i / numBasePairs;
    basePairs.push({
      index: i,
      t: t,
      type: floor(random(4)), // 0: A-T, 1: T-A, 2: G-C, 3: C-G
      phase: random(TWO_PI),
      opening: 0 // For DNA unzipping effect
    });
  }
  
  // Create floating nucleotides
  for (let i = 0; i < 50; i++) {
    nucleotides.push({
      x: random(-400, 400),
      y: random(-600, 600),
      z: random(-400, 400),
      type: floor(random(4)),
      rotation: random(TWO_PI),
      speed: random(0.005, 0.015),
      size: random(8, 15)
    });
  }
  
  // Create enzyme particles
  for (let i = 0; i < 30; i++) {
    enzymes.push({
      angle: random(TWO_PI),
      height: random(-helixHeight/2, helixHeight/2),
      radius: random(150, 250),
      speed: random(0.002, 0.008),
      size: random(10, 20),
      phase: random(TWO_PI)
    });
  }
}

function draw() {
  background(0);
  
  // Sophisticated lighting
  ambientLight(70);
  directionalLight(255, 255, 255, 0.3, -1, 0.2);
  pointLight(255, 255, 255, 200, -400, 300);
  pointLight(200, 200, 200, -200, 400, -300);
  pointLight(180, 180, 180, 0, 0, 500);
  
  // Dynamic camera orbit
  let camX = sin(time * 0.0008) * 350;
  let camZ = cos(time * 0.0008) * 350;
  let camY = sin(time * 0.0005) * 150;
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);
  
  // Draw the double helix
  drawDoubleHelix();
  
  // Draw base pairs
  drawBasePairs();
  
  // Draw sugar-phosphate backbone decorations
  drawBackboneDecorations();
  
  // Draw floating nucleotides
  drawNucleotides();
  
  // Draw enzyme particles
  drawEnzymes();
  
  // Draw molecular grid
  drawMolecularGrid();
  
  // Draw chromosome structure in background
  drawChromosomeStructure();
  
  time++;
}

function drawDoubleHelix() {
  push();
  
  let turns = 6;
  let segments = 200;
  
  // First strand with enhanced visualization
  noFill();
  stroke(255, 150);
  strokeWeight(3);
  
  beginShape();
  for (let i = 0; i <= segments; i++) {
    let t = i / segments;
    let angle = t * turns * TWO_PI + time * 0.008;
    let y = map(t, 0, 1, -helixHeight/2, helixHeight/2);
    let r = helixRadius + sin(time * 0.01 + t * TWO_PI * 2) * 8;
    
    let x = cos(angle) * r;
    let z = sin(angle) * r;
    vertex(x, y, z);
  }
  endShape();
  
  // Second strand
  beginShape();
  for (let i = 0; i <= segments; i++) {
    let t = i / segments;
    let angle = t * turns * TWO_PI + PI + time * 0.008;
    let y = map(t, 0, 1, -helixHeight/2, helixHeight/2);
    let r = helixRadius + sin(time * 0.01 + t * TWO_PI * 2) * 8;
    
    let x = cos(angle) * r;
    let z = sin(angle) * r;
    vertex(x, y, z);
  }
  endShape();
  
  // Draw glow around strands
  stroke(255, 40);
  strokeWeight(8);
  
  beginShape();
  for (let i = 0; i <= segments; i++) {
    let t = i / segments;
    let angle = t * turns * TWO_PI + time * 0.008;
    let y = map(t, 0, 1, -helixHeight/2, helixHeight/2);
    let r = helixRadius + sin(time * 0.01 + t * TWO_PI * 2) * 8;
    
    let x = cos(angle) * r;
    let z = sin(angle) * r;
    vertex(x, y, z);
  }
  endShape();
  
  beginShape();
  for (let i = 0; i <= segments; i++) {
    let t = i / segments;
    let angle = t * turns * TWO_PI + PI + time * 0.008;
    let y = map(t, 0, 1, -helixHeight/2, helixHeight/2);
    let r = helixRadius + sin(time * 0.01 + t * TWO_PI * 2) * 8;
    
    let x = cos(angle) * r;
    let z = sin(angle) * r;
    vertex(x, y, z);
  }
  endShape();
  
  pop();
}

function drawBasePairs() {
  let turns = 6;
  
  for (let bp of basePairs) {
    push();
    
    let angle = bp.t * turns * TWO_PI + time * 0.008;
    let y = map(bp.t, 0, 1, -helixHeight/2, helixHeight/2);
    let r = helixRadius + sin(time * 0.01 + bp.t * TWO_PI * 2) * 8;
    
    // Calculate positions of both bases
    let x1 = cos(angle) * r;
    let z1 = sin(angle) * r;
    
    let x2 = cos(angle + PI) * r;
    let z2 = sin(angle + PI) * r;
    
    // DNA unzipping wave effect
    let unzipWave = sin(time * 0.02 - bp.index * 0.3);
    if (unzipWave > 0.7) {
      bp.opening = lerp(bp.opening, 1, 0.1);
    } else {
      bp.opening = lerp(bp.opening, 0, 0.05);
    }
    
    let separation = bp.opening * 50;
    x1 += cos(angle) * separation;
    z1 += sin(angle) * separation;
    x2 += cos(angle + PI) * separation;
    z2 += sin(angle + PI) * separation;
    
    // Draw connecting rung
    stroke(255, 100 - bp.opening * 50);
    strokeWeight(2);
    line(x1, y, z1, x2, y, z2);
    
    // Draw base pair nucleotides
    // Base 1
    push();
    translate(x1, y, z1);
    rotateY(angle);
    rotateX(time * 0.01 + bp.phase);
    
    noStroke();
    fill(255, 180);
    
    // Different shapes for different base types
    if (bp.type === 0 || bp.type === 1) {
      // Adenine/Thymine - pentagon
      drawPentagon(12);
    } else {
      // Guanine/Cytosine - hexagon
      drawHexagon(12);
    }
    
    // Glow
    fill(255, 50);
    if (bp.type === 0 || bp.type === 1) {
      drawPentagon(20);
    } else {
      drawHexagon(20);
    }
    
    pop();
    
    // Base 2 (complementary)
    push();
    translate(x2, y, z2);
    rotateY(angle + PI);
    rotateX(time * 0.01 + bp.phase);
    
    noStroke();
    fill(255, 180);
    
    // Complementary base
    if (bp.type === 0 || bp.type === 1) {
      drawPentagon(12);
    } else {
      drawHexagon(12);
    }
    
    fill(255, 50);
    if (bp.type === 0 || bp.type === 1) {
      drawPentagon(20);
    } else {
      drawHexagon(20);
    }
    
    pop();
    
    pop();
  }
}

function drawPentagon(size) {
  beginShape();
  for (let i = 0; i < 5; i++) {
    let angle = TWO_PI / 5 * i - HALF_PI;
    let x = cos(angle) * size;
    let y = sin(angle) * size;
    vertex(x, y, 0);
  }
  endShape(CLOSE);
}

function drawHexagon(size) {
  beginShape();
  for (let i = 0; i < 6; i++) {
    let angle = TWO_PI / 6 * i;
    let x = cos(angle) * size;
    let y = sin(angle) * size;
    vertex(x, y, 0);
  }
  endShape(CLOSE);
}

function drawBackboneDecorations() {
  push();
  
  let turns = 6;
  let segments = 80;
  
  for (let i = 0; i < segments; i++) {
    let t = i / segments;
    let angle = t * turns * TWO_PI + time * 0.008;
    let y = map(t, 0, 1, -helixHeight/2, helixHeight/2);
    let r = helixRadius + sin(time * 0.01 + t * TWO_PI * 2) * 8;
    
    // Sugar molecules
    push();
    let x = cos(angle) * r;
    let z = sin(angle) * r;
    translate(x, y, z);
    
    noStroke();
    fill(255, 100);
    sphere(6, 8, 6);
    
    pop();
    
    // Phosphate groups
    push();
    x = cos(angle + PI) * r;
    z = sin(angle + PI) * r;
    translate(x, y, z);
    
    noStroke();
    fill(255, 100);
    sphere(6, 8, 6);
    
    pop();
  }
  
  pop();
}

function drawNucleotides() {
  for (let nucleotide of nucleotides) {
    push();
    
    translate(nucleotide.x, nucleotide.y, nucleotide.z);
    
    nucleotide.rotation += nucleotide.speed;
    rotateX(nucleotide.rotation);
    rotateY(nucleotide.rotation * 0.7);
    rotateZ(nucleotide.rotation * 0.5);
    
    // Drift motion
    nucleotide.x += sin(time * 0.005 + nucleotide.rotation) * 0.5;
    nucleotide.y += cos(time * 0.003 + nucleotide.rotation) * 0.3;
    nucleotide.z += sin(time * 0.004 + nucleotide.rotation) * 0.4;
    
    // Wrap around
    if (nucleotide.x > 500) nucleotide.x = -500;
    if (nucleotide.x < -500) nucleotide.x = 500;
    if (nucleotide.y > 700) nucleotide.y = -700;
    if (nucleotide.y < -700) nucleotide.y = 700;
    if (nucleotide.z > 500) nucleotide.z = -500;
    if (nucleotide.z < -500) nucleotide.z = 500;
    
    noStroke();
    fill(255, 120);
    
    if (nucleotide.type < 2) {
      drawPentagon(nucleotide.size);
    } else {
      drawHexagon(nucleotide.size);
    }
    
    fill(255, 40);
    if (nucleotide.type < 2) {
      drawPentagon(nucleotide.size * 1.5);
    } else {
      drawHexagon(nucleotide.size * 1.5);
    }
    
    pop();
  }
}

function drawEnzymes() {
  for (let enzyme of enzymes) {
    push();
    
    enzyme.angle += enzyme.speed;
    let pulse = sin(time * 0.01 + enzyme.phase) * 20;
    
    let x = cos(enzyme.angle) * enzyme.radius;
    let y = enzyme.height + pulse;
    let z = sin(enzyme.angle) * enzyme.radius;
    
    translate(x, y, z);
    
    rotateY(time * 0.015);
    rotateX(time * 0.01);
    
    // Enzyme as complex shape
    noFill();
    stroke(255, 100);
    strokeWeight(1.5);
    
    // Irregular polyhedron
    let size = enzyme.size;
    for (let i = 0; i < 8; i++) {
      let angle = TWO_PI / 8 * i;
      let x1 = cos(angle) * size;
      let z1 = sin(angle) * size;
      let x2 = cos(angle + TWO_PI / 8) * size;
      let z2 = sin(angle + TWO_PI / 8) * size;
      
      line(x1, -size * 0.5, z1, x2, -size * 0.5, z2);
      line(x1, size * 0.5, z1, x2, size * 0.5, z2);
      line(x1, -size * 0.5, z1, x1, size * 0.5, z1);
    }
    
    // Core
    noStroke();
    fill(255, 80);
    sphere(size * 0.6, 8, 6);
    
    pop();
  }
}

function drawMolecularGrid() {
  push();
  
  noFill();
  stroke(255, 15);
  strokeWeight(0.5);
  
  // Spherical containment field
  for (let lat = 0; lat < 8; lat++) {
    let radius = 450;
    let y = map(lat, 0, 8, -radius, radius);
    let r = sqrt(radius * radius - y * y);
    
    push();
    translate(0, y, 0);
    rotateX(HALF_PI);
    circle(0, 0, r * 2);
    pop();
  }
  
  for (let lon = 0; lon < 12; lon++) {
    let angle = TWO_PI / 12 * lon;
    push();
    rotateY(angle);
    rotateX(HALF_PI);
    circle(0, 0, 900);
    pop();
  }
  
  pop();
}

function drawChromosomeStructure() {
  push();
  
  translate(0, 0, -300);
  
  noFill();
  stroke(255, 20);
  strokeWeight(1);
  
  // X-shaped chromosome in background
  for (let arm = 0; arm < 4; arm++) {
    push();
    rotateZ(HALF_PI * arm + time * 0.001);
    
    beginShape();
    for (let i = 0; i < 30; i++) {
      let t = i / 30;
      let x = t * 200;
      let y = sin(t * TWO_PI * 2 + time * 0.01) * 30;
      vertex(x, y, 0);
    }
    endShape();
    
    pop();
  }
  
  pop();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('dna_helix', 'png');
  }
}
