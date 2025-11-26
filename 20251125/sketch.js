let cols, t = 0;
let particles = [];

function setup() {
  createCanvas(720, 1280, WEBGL);
  cols = ['#362d78','#523fa3','#916ccc','#bda1e5','#c8c0e9','#84bae7','#516ad4','#333f87','#293039','#283631'];
  
  // Reduced particles: 60 -> 30
  for (let i = 0; i < 30; i++) {
    particles.push({
      a: random(TWO_PI),
      r: random(280, 450),
      y: random(-400, 400),
      s: random(0.1, 0.4),
      sz: random(3, 6),
      c: random(cols),
      py: random(100)
    });
  }
}

function draw() {
  background(8, 6, 18);
  
  let camX = sin(t * 0.15) * 420;
  let camY = cos(t * 0.1) * 200 + sin(t * 0.2) * 50;
  let camZ = 580 + sin(t * 0.08) * 120;
  camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);
  
  // Simplified lighting: 3 -> 2 lights
  ambientLight(35, 30, 55);
  pointLight(255, 160, 255, 250, -400, 300);
  pointLight(80, 150, 255, -250, 200, -200);
  
  drawCosmicDust();
  drawAura();
  drawTorusKnot();
  drawLotusFlower();
  drawCrystalHeart();
  drawDNAHelixes();
  drawOrbitingMoons();
  drawSparkles();
  
  t += 0.008;
}

function drawCosmicDust() {
  noStroke();
  for (let p of particles) {
    p.a += p.s * 0.01;
    p.y += sin(t + p.py) * 0.3;
    
    push();
    translate(cos(p.a) * p.r, p.y, sin(p.a) * p.r);
    let c = color(p.c);
    c.setAlpha(100 + sin(t * 2 + p.py) * 50);
    emissiveMaterial(c);
    sphere(p.sz, 4, 4); // Reduced: 5,5 -> 4,4
    pop();
  }
}

function drawAura() {
  push();
  noFill();
  rotateX(PI/2);
  
  // Reduced rings: 8 -> 5
  for (let i = 0; i < 5; i++) {
    let c = color(cols[i % cols.length]);
    c.setAlpha(50 - i * 8);
    stroke(c);
    strokeWeight(2.5 - i * 0.4);
    
    let r = 160 + i * 35 + sin(t * 1.5 + i * 0.5) * 15;
    ellipse(0, 0, r * 2, r * 2, 48); // Reduced: 80 -> 48
  }
  pop();
}

function drawTorusKnot() {
  push();
  rotateY(t * 0.2);
  rotateX(t * 0.15);
  noFill();
  
  let p = 3, q = 2;
  
  // Reduced strands: 3 -> 2
  for (let strand = 0; strand < 2; strand++) {
    let c = color(cols[strand + 2]);
    c.setAlpha(200);
    stroke(c);
    strokeWeight(2.5 - strand * 0.7);
    
    beginShape();
    // Reduced vertices: 150 -> 80
    for (let i = 0; i <= 80; i++) {
      let u = i / 80 * TWO_PI * 2;
      let r1 = 80, r2 = 30 + sin(t * 2) * 8;
      
      let r = r1 + r2 * cos(q * u + strand * PI + t);
      let x = r * cos(p * u);
      let y = r * sin(p * u);
      let z = r2 * sin(q * u + strand * PI + t) * 2;
      
      curveVertex(x, y, z);
    }
    endShape();
  }
  pop();
}

function drawLotusFlower() {
  push();
  translate(0, 180, 0);
  rotateX(-PI/6);
  rotateY(t * 0.1);
  noStroke();
  
  // Reduced layers: 3 -> 2
  for (let layer = 0; layer < 2; layer++) {
    let petals = 6 + layer * 3; // Reduced petals
    let layerR = 45 + layer * 30;
    
    for (let i = 0; i < petals; i++) {
      push();
      let angle = i * TWO_PI / petals + layer * 0.15 + sin(t + layer) * 0.1;
      rotateY(angle);
      translate(layerR, 0, 0);
      rotateZ(PI/4 + sin(t * 1.5 + i * 0.3) * 0.2 - layer * 0.15);
      rotateY(PI/2);
      
      let c = color(cols[layer + 2]);
      c.setAlpha(180);
      emissiveMaterial(c);
      
      scale(1, 0.3, 1);
      sphere(16 - layer * 2, 6, 5); // Reduced: 8,6 -> 6,5
      pop();
    }
  }
  
  push();
  emissiveMaterial(cols[4]);
  sphere(12 + sin(t * 3) * 2, 6, 6); // Reduced: 8,8 -> 6,6
  pop();
  
  pop();
}

function drawCrystalHeart() {
  push();
  rotateY(t * 0.35);
  rotateX(t * 0.2);
  rotateZ(sin(t * 0.5) * 0.1);
  
  noStroke();
  let pulse = 1 + sin(t * 4) * 0.12;
  
  // Reduced glow layers: 3 -> 2
  emissiveMaterial(cols[2]);
  sphere(20 * pulse, 8, 8);
  
  let c1 = color(cols[3]);
  c1.setAlpha(70);
  emissiveMaterial(c1);
  sphere(38 * pulse, 6, 6);
  
  // Merkaba
  stroke(cols[4]);
  strokeWeight(1.5);
  noFill();
  let s = 55 + sin(t * 2) * 8;
  drawMerkaba(s);
  
  // Outer icosahedron
  push();
  rotateY(t * -0.3);
  rotateX(t * 0.2);
  stroke(cols[6]);
  strokeWeight(1);
  drawIcosa(85 + sin(t * 1.5) * 10);
  pop();
  
  pop();
}

function drawMerkaba(s) {
  let h = s * 0.8;
  let v1 = [[0,-h,0],[-s/2,h/2,s*0.29],[s/2,h/2,s*0.29],[0,h/2,-s*0.58]];
  drawTetra(v1);
  let v2 = [[0,h,0],[-s/2,-h/2,-s*0.29],[s/2,-h/2,-s*0.29],[0,-h/2,s*0.58]];
  drawTetra(v2);
}

function drawTetra(v) {
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      line(v[i][0],v[i][1],v[i][2],v[j][0],v[j][1],v[j][2]);
    }
  }
}

function drawIcosa(r) {
  let phi = 1.618, n = sqrt(1 + phi*phi);
  let v = [[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]];
  let e = [[0,1],[0,5],[0,7],[0,10],[0,11],[1,5],[1,7],[1,8],[1,9],[2,3],[2,4],[2,6],[2,10],[2,11],[3,4],[3,6],[3,8],[3,9],[4,5],[4,9],[4,11],[5,9],[5,11],[6,7],[6,8],[6,10],[7,8],[7,10],[8,9],[10,11]];
  for (let ed of e) {
    let a = v[ed[0]], b = v[ed[1]];
    line(a[0]/n*r,a[1]/n*r,a[2]/n*r,b[0]/n*r,b[1]/n*r,b[2]/n*r);
  }
}

function drawDNAHelixes() {
  push();
  rotateY(t * 0.12);
  noFill();
  
  // Reduced to 1 helix with simpler rendering
  let c = color(cols[5]);
  c.setAlpha(180);
  stroke(c);
  strokeWeight(2);
  
  beginShape();
  // Reduced: 80 -> 50 vertices
  for (let i = 0; i < 50; i++) {
    let pct = i / 50;
    let y = (pct - 0.5) * 700;
    let angle = pct * TWO_PI * 3 + t * 0.8;
    let r = 130 + sin(pct * PI) * 40;
    curveVertex(cos(angle) * r, y, sin(angle) * r);
  }
  endShape();
  
  // Second helix
  stroke(cols[6]);
  beginShape();
  for (let i = 0; i < 50; i++) {
    let pct = i / 50;
    let y = (pct - 0.5) * 700;
    let angle = pct * TWO_PI * 3 + PI + t * 0.8;
    let r = 130 + sin(pct * PI) * 40;
    curveVertex(cos(angle) * r, y, sin(angle) * r);
  }
  endShape();
  
  // Reduced connection bars: 16 -> 8
  stroke(cols[4]);
  strokeWeight(1);
  for (let i = 0; i < 8; i++) {
    let pct = i / 8;
    let y = (pct - 0.5) * 700;
    let angle = pct * TWO_PI * 3 + t * 0.8;
    let r = 130 + sin(pct * PI) * 40;
    line(cos(angle)*r, y, sin(angle)*r, cos(angle+PI)*r, y, sin(angle+PI)*r);
  }
  pop();
}

function drawOrbitingMoons() {
  push();
  noStroke();
  
  // Reduced: 7 -> 5 moons
  for (let i = 0; i < 5; i++) {
    let angle = i * TWO_PI / 5 + t * (0.3 + i * 0.05);
    let r = 200 + sin(t + i * 0.8) * 30;
    let y = cos(t * 0.6 + i) * 120;
    
    push();
    translate(cos(angle) * r, y, sin(angle) * r);
    rotateY(t * 2 + i);
    rotateX(t + i);
    
    let c = color(cols[i % cols.length]);
    emissiveMaterial(c);
    
    let s = 10 + sin(t * 2.5 + i) * 3;
    drawGem(s);
    
    // Simplified halo
    c.setAlpha(40);
    emissiveMaterial(c);
    sphere(s * 1.8, 4, 4);
    pop();
  }
  pop();
}

function drawGem(s) {
  beginShape(TRIANGLES);
  let pts = [[0,-s*1.3,0],[s,0,0],[0,0,s],[-s,0,0],[0,0,-s],[0,s*0.5,0]];
  for (let i = 0; i < 4; i++) {
    vertex(pts[0][0],pts[0][1],pts[0][2]);
    vertex(pts[i+1][0],pts[i+1][1],pts[i+1][2]);
    vertex(pts[(i+1)%4+1][0],pts[(i+1)%4+1][1],pts[(i+1)%4+1][2]);
  }
  for (let i = 0; i < 4; i++) {
    vertex(pts[5][0],pts[5][1],pts[5][2]);
    vertex(pts[(i+1)%4+1][0],pts[(i+1)%4+1][1],pts[(i+1)%4+1][2]);
    vertex(pts[i+1][0],pts[i+1][1],pts[i+1][2]);
  }
  endShape();
}

function drawSparkles() {
  push();
  noStroke();
  
  // Reduced: 20 -> 12 sparkles
  for (let i = 0; i < 12; i++) {
    let seed = i * 137.5;
    let a = (t * 0.5 + seed) % TWO_PI;
    let r = 180 + sin(seed) * 150;
    let y = sin(t * 0.7 + seed) * 350;
    
    let flicker = abs(sin(t * 8 + seed * 10));
    if (flicker > 0.75) { // Higher threshold = fewer visible
      push();
      translate(cos(a) * r, y, sin(a) * r);
      let c = color(cols[4]);
      c.setAlpha(180 * flicker);
      emissiveMaterial(c);
      sphere(2 + flicker * 3, 4, 4);
      pop();
    }
  }
  pop();
}

function windowResized() {
  resizeCanvas(720, 1280);
}