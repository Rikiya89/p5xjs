// 3D Generative Art - Thank You 2025
// Black & White Theme with p5.js Text Effects

let particles = [];
let rings = [];
let time = 0;
let glowParticles = [];
let textParticles2025 = [];
let textParticlesThank = [];
let starParticles = [];
let trailPoints = [];

// =====================
// MAIN 3D SKETCH
// =====================
let spiralParticles = [];
let nebulaClouds = [];

let mainSketch = function(p) {
  p.setup = function() {
    let canvas = p.createCanvas(720, 1280, p.WEBGL);
    canvas.parent('main-canvas');

    // Particles - reduced count
    for (let i = 0; i < 120; i++) {
      particles.push(new Particle(p));
    }

    // Rings
    for (let i = 0; i < 5; i++) {
      rings.push(new GratitudeRing(p, i));
    }

    // Spiral particles - reduced
    for (let i = 0; i < 25; i++) {
      spiralParticles.push({
        angle: p.random(p.TWO_PI),
        radius: p.random(80, 200),
        y: p.random(-200, 200),
        speed: p.random(0.005, 0.015),
        size: p.random(1.5, 3),
        phase: p.random(p.TWO_PI)
      });
    }

    // Nebula clouds - reduced
    for (let i = 0; i < 6; i++) {
      nebulaClouds.push({
        x: p.random(-300, 300),
        y: p.random(-400, 400),
        z: p.random(-200, 200),
        size: p.random(40, 100),
        phase: p.random(p.TWO_PI)
      });
    }
  };

  p.draw = function() {
    p.background(0);

    // Subtle camera movement
    let camX = p.sin(time * 0.08) * 60;
    let camY = p.cos(time * 0.1) * 40;
    let camZ = 550 + p.sin(time * 0.05) * 30;
    p.camera(camX, camY, camZ, 0, 0, 0, 0, 1, 0);

    // Enhanced lighting
    p.ambientLight(50);
    p.directionalLight(255, 255, 255, 0.5, 0.5, -1);
    p.pointLight(255, 255, 255, 0, 0, 200);
    p.pointLight(200, 200, 200, p.sin(time) * 100, p.cos(time) * 100, 100);

    // Draw nebula clouds (background atmosphere)
    drawNebulaClouds(p);

    // Draw background starfield
    drawStarfield(p);

    for (let particle of particles) {
      particle.update(p);
      particle.display(p);
    }

    // Draw spiral particles
    drawSpiralParticles(p);

    for (let ring of rings) {
      ring.update(p);
      ring.display(p);
    }

    drawCentralStructure(p);
    drawConnections(p);
    drawFloatingElements(p);
    drawLightBeams(p);

    time += 0.015;
  };
};

// =====================
// TEXT EFFECTS SKETCH (2D)
// =====================
let textSketch = function(p) {

  p.setup = function() {
    let canvas = p.createCanvas(720, 1280);
    canvas.parent('text-canvas');
    p.textAlign(p.CENTER, p.CENTER);

    // Create floating glow particles
    for (let i = 0; i < 35; i++) {
      glowParticles.push({
        x: p.random(720),
        y: p.random(1280),
        size: p.random(1, 3),
        speed: p.random(0.2, 0.6),
        phase: p.random(p.TWO_PI),
        brightness: p.random(80, 150)
      });
    }

    // Create particles for "2025" text - more particles, varied orbits
    for (let i = 0; i < 45; i++) {
      textParticles2025.push({
        angle: p.random(p.TWO_PI),
        radius: p.random(60, 180),
        speed: p.random(0.003, 0.018),
        size: p.random(1.5, 4),
        phase: p.random(p.TWO_PI),
        yOffset: p.random(-35, 35),
        trail: [],
        maxTrail: p.floor(p.random(5, 12))
      });
    }

    // Create particles for "THANK YOU" text
    for (let i = 0; i < 35; i++) {
      textParticlesThank.push({
        x: p.random(-180, 180),
        y: p.random(0, 80),
        baseY: p.random(0, 80),
        speed: p.random(0.4, 1.0),
        size: p.random(1.5, 3),
        phase: p.random(p.TWO_PI),
        brightness: p.random(150, 255)
      });
    }

    // Create star/sparkle particles
    for (let i = 0; i < 20; i++) {
      starParticles.push({
        x: p.random(100, 620),
        y: p.random(200, 1100),
        size: p.random(2, 5),
        phase: p.random(p.TWO_PI),
        twinkleSpeed: p.random(2, 5),
        rotation: p.random(p.TWO_PI)
      });
    }
  };

  p.draw = function() {
    p.clear();

    // Draw background stars first
    drawStars(p);

    // Draw floating particles
    drawGlowParticles(p);

    // Draw "2025" with effects
    draw2025(p);

    // Draw "THANK YOU" with effects
    drawThankYou(p);

    // Draw subtitle with wave
    drawSubtitle(p);

    // Draw decorative lines
    drawLines(p);

    // Draw corners
    drawCorners(p);
  };

  function drawStars(p) {
    for (let star of starParticles) {
      let twinkle = (p.sin(time * star.twinkleSpeed + star.phase) + 1) / 2;
      let alpha = twinkle * 200 + 30;
      let size = star.size * (0.5 + twinkle * 0.5);

      p.push();
      p.translate(star.x, star.y);
      p.rotate(star.rotation + time * 0.2);

      // Draw 4-point star
      p.noStroke();
      p.fill(255, alpha);

      // Horizontal line
      p.ellipse(0, 0, size * 3, size * 0.5);
      // Vertical line
      p.ellipse(0, 0, size * 0.5, size * 3);
      // Center glow
      p.fill(255, alpha * 0.5);
      p.ellipse(0, 0, size * 2, size * 2);
      p.fill(255, alpha);
      p.ellipse(0, 0, size, size);

      p.pop();
    }
  }

  function draw2025(p) {
    let x = 360;
    let y = 100;
    let baseSize = 100;

    // Gentle floating motion
    let floatY = p.sin(time * 1.2) * 4;

    // Rotating halo/aura effect behind text
    p.push();
    p.translate(x, y + floatY);
    for (let ring = 0; ring < 3; ring++) {
      let ringRadius = 120 + ring * 30;
      let ringAlpha = 25 - ring * 6;
      p.noFill();
      p.stroke(255, ringAlpha);
      p.strokeWeight(1 + (2 - ring) * 0.5);
      p.beginShape();
      for (let a = 0; a <= p.TWO_PI; a += 0.1) {
        let wobble = p.sin(a * 6 + time * 2 - ring) * 8;
        let r = ringRadius + wobble;
        p.vertex(p.cos(a) * r, p.sin(a) * r * 0.4);
      }
      p.endShape(p.CLOSE);
    }
    p.pop();

    // Pulsing circular aura
    let pulseSize = 150 + p.sin(time * 1.5) * 20;
    for (let i = 4; i >= 0; i--) {
      let auraAlpha = 8 - i * 1.5;
      p.noStroke();
      p.fill(255, auraAlpha);
      p.ellipse(x, y + floatY, pulseSize + i * 25, (pulseSize + i * 25) * 0.5);
    }

    // Draw particle trails first (behind particles)
    for (let pt of textParticles2025) {
      if (pt.trail.length > 1) {
        for (let i = 0; i < pt.trail.length - 1; i++) {
          let alpha = p.map(i, 0, pt.trail.length - 1, 10, 60);
          let weight = p.map(i, 0, pt.trail.length - 1, 0.3, 1.5);
          p.stroke(255, alpha);
          p.strokeWeight(weight);
          p.line(pt.trail[i].x, pt.trail[i].y, pt.trail[i + 1].x, pt.trail[i + 1].y);
        }
      }
    }

    // Draw orbiting particles around text
    for (let pt of textParticles2025) {
      pt.angle += pt.speed;

      let px = x + p.cos(pt.angle) * pt.radius;
      let py = y + floatY + p.sin(pt.angle * 0.5) * 25 + pt.yOffset;

      // Store trail
      pt.trail.push({ x: px, y: py });
      if (pt.trail.length > pt.maxTrail) {
        pt.trail.shift();
      }

      let alpha = 180 + p.sin(time * 2 + pt.phase) * 70;
      let size = pt.size + p.sin(time * 3 + pt.phase) * 1.2;

      // Particle with glow
      p.noStroke();
      p.fill(255, alpha * 0.2);
      p.ellipse(px, py, size * 4, size * 4);
      p.fill(255, alpha * 0.5);
      p.ellipse(px, py, size * 2, size * 2);
      p.fill(255, alpha);
      p.ellipse(px, py, size, size);

      // Connect inner particles with lines to center
      if (pt.radius < 100) {
        p.stroke(255, alpha * 0.15);
        p.strokeWeight(0.5);
        p.line(px, py, x, y + floatY);
      }
    }

    // Draw connections between nearby particles
    p.stroke(255, 25);
    p.strokeWeight(0.4);
    for (let i = 0; i < textParticles2025.length; i++) {
      for (let j = i + 1; j < textParticles2025.length; j++) {
        let pt1 = textParticles2025[i];
        let pt2 = textParticles2025[j];
        let px1 = x + p.cos(pt1.angle) * pt1.radius;
        let py1 = y + floatY + p.sin(pt1.angle * 0.5) * 25 + pt1.yOffset;
        let px2 = x + p.cos(pt2.angle) * pt2.radius;
        let py2 = y + floatY + p.sin(pt2.angle * 0.5) * 25 + pt2.yOffset;

        let d = p.dist(px1, py1, px2, py2);
        if (d < 50) {
          let alpha = p.map(d, 0, 50, 40, 0);
          p.stroke(255, alpha);
          p.line(px1, py1, px2, py2);
        }
      }
    }

    // Enhanced light rays with gradient - more rays with varying lengths
    p.push();
    p.translate(x, y + floatY);
    for (let i = 0; i < 24; i++) {
      let angle = p.map(i, 0, 24, 0, p.TWO_PI) + time * 0.15;
      let rayLength = 60 + p.sin(time * 2.5 + i * 0.7) * 40 + (i % 2) * 30;

      // Gradient ray
      for (let j = 0; j < rayLength; j += 2) {
        let rayAlpha = p.map(j, 0, rayLength, 40, 0) * (0.7 + p.sin(time * 3 + i) * 0.3);
        p.stroke(255, rayAlpha);
        p.strokeWeight(1.5 - j / rayLength);
        let rx = p.cos(angle) * j;
        let ry = p.sin(angle) * j;
        p.point(rx, ry);
      }
    }
    p.pop();

    // Outer glow layers - more layers for smoother effect
    p.noStroke();
    p.fill(255, 12);
    p.textSize(baseSize + 25);
    p.textStyle(p.BOLD);
    p.text("2025", x, y + floatY);

    p.fill(255, 18);
    p.textSize(baseSize + 18);
    p.text("2025", x, y + floatY);

    p.fill(255, 30);
    p.textSize(baseSize + 12);
    p.text("2025", x, y + floatY);

    p.fill(255, 50);
    p.textSize(baseSize + 6);
    p.text("2025", x, y + floatY);

    p.fill(255, 80);
    p.textSize(baseSize + 3);
    p.text("2025", x, y + floatY);

    // Multiple shimmer effects moving across
    for (let s = 0; s < 2; s++) {
      let shimmerPos = ((time * 0.4 + s * 1.5) % 4) - 1;
      if (shimmerPos >= 0 && shimmerPos <= 1) {
        let shimmerAlpha = 180 * (1 - Math.abs(shimmerPos - 0.5) * 2);
        p.fill(255, shimmerAlpha);
        p.textSize(baseSize + 2);
        p.text("2025", x + (shimmerPos - 0.5) * 15, y + floatY);
      }
    }

    // Main crisp text
    p.fill(255);
    p.textSize(baseSize);
    p.textStyle(p.BOLD);
    p.text("2025", x, y + floatY);

    // Enhanced inner sparkles on text with starburst effect
    for (let i = 0; i < 8; i++) {
      let sparkX = x + p.map(i, 0, 7, -110, 110);
      let sparkY = y + floatY + p.sin(time * 4 + i * 2) * 12;
      let sparkAlpha = 200 + p.sin(time * 5 + i * 3) * 55;
      let sparkSize = 2.5 + p.sin(time * 4 + i) * 1.5;

      if (p.sin(time * 2.5 + i * 1.2) > 0.2) {
        // Starburst glow
        p.fill(255, sparkAlpha * 0.2);
        p.ellipse(sparkX, sparkY, sparkSize * 6, sparkSize * 6);
        p.fill(255, sparkAlpha * 0.5);
        p.ellipse(sparkX, sparkY, sparkSize * 3, sparkSize * 3);
        p.fill(255, sparkAlpha);
        p.ellipse(sparkX, sparkY, sparkSize, sparkSize);

        // Cross sparkle with diagonal
        p.stroke(255, sparkAlpha * 0.7);
        p.strokeWeight(0.6);
        let crossLen = 5 + p.sin(time * 6 + i) * 2;
        p.line(sparkX - crossLen, sparkY, sparkX + crossLen, sparkY);
        p.line(sparkX, sparkY - crossLen, sparkX, sparkY + crossLen);
        // Diagonal cross
        p.stroke(255, sparkAlpha * 0.4);
        p.strokeWeight(0.4);
        let diagLen = crossLen * 0.7;
        p.line(sparkX - diagLen, sparkY - diagLen, sparkX + diagLen, sparkY + diagLen);
        p.line(sparkX - diagLen, sparkY + diagLen, sparkX + diagLen, sparkY - diagLen);
      }
    }

    // Animated underline with wave
    let lineWidth = 260;
    let lineY = y + floatY + 58;
    let lineAlpha = 200 + p.sin(time * 2) * 50;

    // Gradient line effect with smoother wave
    for (let i = -lineWidth/2; i <= lineWidth/2; i += 1.5) {
      let segAlpha = lineAlpha * (1 - Math.pow(Math.abs(i) / (lineWidth / 2), 1.5));
      p.stroke(255, segAlpha);
      p.strokeWeight(2.5 - Math.abs(i) / (lineWidth / 2) * 1.5);
      p.point(x + i, lineY + p.sin(time * 3 + i * 0.03) * 2);
    }

    // Glowing dots at line ends with extra sparkle
    p.noStroke();
    for (let i = 4; i >= 0; i--) {
      let dotAlpha = lineAlpha / (i + 1);
      let dotSize = 5 + i * 4;
      p.fill(255, dotAlpha * 0.4);
      p.ellipse(x - lineWidth/2, lineY, dotSize, dotSize);
      p.ellipse(x + lineWidth/2, lineY, dotSize, dotSize);
    }
    p.fill(255, lineAlpha);
    p.ellipse(x - lineWidth/2, lineY, 6, 6);
    p.ellipse(x + lineWidth/2, lineY, 6, 6);

    // Sparkle at line ends
    let endSparkle = 0.5 + p.sin(time * 4) * 0.5;
    p.stroke(255, lineAlpha * endSparkle);
    p.strokeWeight(0.5);
    p.line(x - lineWidth/2 - 6, lineY, x - lineWidth/2 + 6, lineY);
    p.line(x - lineWidth/2, lineY - 6, x - lineWidth/2, lineY + 6);
    p.line(x + lineWidth/2 - 6, lineY, x + lineWidth/2 + 6, lineY);
    p.line(x + lineWidth/2, lineY - 6, x + lineWidth/2, lineY + 6);
  }

  function drawThankYou(p) {
    let x = 360;
    let y = 1170;
    let baseSize = 50;

    // Gentle floating motion
    let floatY = p.sin(time * 1.2 + p.PI) * 3;

    // Pulsing aura behind text
    let pulseSize = 200 + p.sin(time * 1.8) * 25;
    for (let i = 3; i >= 0; i--) {
      let auraAlpha = 10 - i * 2;
      p.noStroke();
      p.fill(255, auraAlpha);
      p.ellipse(x, y + floatY, pulseSize + i * 40, (pulseSize + i * 40) * 0.25);
    }

    // Light rays emanating upward (like hope/gratitude rising)
    p.push();
    p.translate(x, y + floatY);
    for (let i = 0; i < 16; i++) {
      let angle = p.map(i, 0, 16, -p.PI * 0.8, -p.PI * 0.2); // Mostly upward
      let rayLength = 50 + p.sin(time * 2 + i * 0.8) * 30;

      // Gradient ray
      for (let j = 0; j < rayLength; j += 2) {
        let rayAlpha = p.map(j, 0, rayLength, 35, 0) * (0.6 + p.sin(time * 2.5 + i) * 0.4);
        p.stroke(255, rayAlpha);
        p.strokeWeight(1.2 - j / rayLength * 0.8);
        p.point(p.cos(angle) * j, p.sin(angle) * j);
      }
    }
    p.pop();

    // Draw rising particles (like sparks rising)
    for (let pt of textParticlesThank) {
      // Move particle up
      pt.y -= pt.speed;

      // Reset when too high
      if (pt.y < -30) {
        pt.y = pt.baseY + 80;
        pt.x = p.random(-180, 180);
      }

      let px = x + pt.x + p.sin(time * 2 + pt.phase) * 8;
      let py = y + floatY - pt.y;

      // Fade out as it rises
      let fadeAlpha = p.map(pt.y, 0, 100, pt.brightness, 0);
      fadeAlpha = p.max(0, fadeAlpha);

      let size = pt.size * p.map(pt.y, 0, 100, 1, 0.2);

      // Particle with enhanced glow
      p.noStroke();
      p.fill(255, fadeAlpha * 0.15);
      p.ellipse(px, py, size * 5, size * 5);
      p.fill(255, fadeAlpha * 0.4);
      p.ellipse(px, py, size * 2.5, size * 2.5);
      p.fill(255, fadeAlpha);
      p.ellipse(px, py, size, size);

      // Tiny trail below particle
      if (pt.y < 60) {
        p.stroke(255, fadeAlpha * 0.3);
        p.strokeWeight(0.5);
        p.line(px, py, px + p.sin(time * 3 + pt.phase) * 2, py + size * 3);
      }
    }

    // Soft outer glow - more layers for smoother effect
    p.noStroke();
    p.fill(255, 10);
    p.textSize(baseSize + 15);
    p.textStyle(p.BOLD);
    p.text("THANK YOU", x, y + floatY);

    p.fill(255, 18);
    p.textSize(baseSize + 10);
    p.text("THANK YOU", x, y + floatY);

    p.fill(255, 30);
    p.textSize(baseSize + 6);
    p.text("THANK YOU", x, y + floatY);

    p.fill(255, 55);
    p.textSize(baseSize + 3);
    p.text("THANK YOU", x, y + floatY);

    p.fill(255, 85);
    p.textSize(baseSize + 1);
    p.text("THANK YOU", x, y + floatY);

    // Shimmer effect moving across
    let shimmerPos = ((time * 0.35) % 3.5) - 0.5;
    if (shimmerPos >= 0 && shimmerPos <= 1) {
      let shimmerAlpha = 160 * (1 - Math.abs(shimmerPos - 0.5) * 2);
      p.fill(255, shimmerAlpha);
      p.textSize(baseSize + 1);
      p.text("THANK YOU", x + (shimmerPos - 0.5) * 20, y + floatY);
    }

    // Main crisp text
    p.fill(255);
    p.textSize(baseSize);
    p.textStyle(p.BOLD);
    p.text("THANK YOU", x, y + floatY);

    // Inner sparkles on the text itself
    for (let i = 0; i < 6; i++) {
      let sparkX = x + p.map(i, 0, 5, -120, 120);
      let sparkY = y + floatY + p.sin(time * 3.5 + i * 1.5) * 8;
      let sparkAlpha = 180 + p.sin(time * 4 + i * 2) * 75;
      let sparkSize = 2 + p.sin(time * 3 + i) * 1;

      if (p.sin(time * 2 + i * 1.3) > 0.3) {
        p.noStroke();
        p.fill(255, sparkAlpha * 0.3);
        p.ellipse(sparkX, sparkY, sparkSize * 4, sparkSize * 4);
        p.fill(255, sparkAlpha);
        p.ellipse(sparkX, sparkY, sparkSize, sparkSize);

        // Cross sparkle
        p.stroke(255, sparkAlpha * 0.6);
        p.strokeWeight(0.5);
        let cLen = 4 + p.sin(time * 5 + i) * 2;
        p.line(sparkX - cLen, sparkY, sparkX + cLen, sparkY);
        p.line(sparkX, sparkY - cLen, sparkX, sparkY + cLen);
      }
    }

    // Enhanced sparkles orbiting around text
    for (let i = 0; i < 14; i++) {
      let angle = p.map(i, 0, 14, 0, p.TWO_PI) + time * 0.25;
      let sparkleRadius = 150 + p.sin(time * 1.5 + i * 0.7) * 25;
      let sparkleX = x + p.cos(angle) * sparkleRadius;
      let sparkleY = y + floatY + p.sin(angle) * 15;

      let sparkleAlpha = 100 + p.sin(time * 3 + i * 1.8) * 80;
      let sparkleSize = 2 + p.sin(time * 2.5 + i) * 1.5;

      // Star sparkle with glow
      p.noStroke();
      p.fill(255, sparkleAlpha * 0.2);
      p.ellipse(sparkleX, sparkleY, sparkleSize * 5, sparkleSize * 5);
      p.fill(255, sparkleAlpha * 0.5);
      p.ellipse(sparkleX, sparkleY, sparkleSize * 2.5, sparkleSize * 2.5);
      p.fill(255, sparkleAlpha);
      p.ellipse(sparkleX, sparkleY, sparkleSize, sparkleSize);

      // Cross effect for some sparkles
      if (i % 2 === 0) {
        p.stroke(255, sparkleAlpha * 0.6);
        p.strokeWeight(0.5);
        let crossSize = sparkleSize * 2.5;
        p.line(sparkleX - crossSize, sparkleY, sparkleX + crossSize, sparkleY);
        p.line(sparkleX, sparkleY - crossSize, sparkleX, sparkleY + crossSize);
      }
    }

    // Connecting lines between some orbiting particles
    p.stroke(255, 15);
    p.strokeWeight(0.3);
    for (let i = 0; i < 14; i += 2) {
      let angle1 = p.map(i, 0, 14, 0, p.TWO_PI) + time * 0.25;
      let angle2 = p.map((i + 2) % 14, 0, 14, 0, p.TWO_PI) + time * 0.25;
      let r1 = 150 + p.sin(time * 1.5 + i * 0.7) * 25;
      let r2 = 150 + p.sin(time * 1.5 + ((i + 2) % 14) * 0.7) * 25;
      let x1 = x + p.cos(angle1) * r1;
      let y1 = y + floatY + p.sin(angle1) * 15;
      let x2 = x + p.cos(angle2) * r2;
      let y2 = y + floatY + p.sin(angle2) * 15;
      p.line(x1, y1, x2, y2);
    }
  }

  function drawSubtitle(p) {
    let txt = "for an amazing year";
    let y = 1225;
    let x = 360;

    // Gentle float
    let floatY = p.sin(time * 1.5) * 2;

    // Draw each letter with slight wave
    p.textSize(18);
    p.textStyle(p.ITALIC);
    let totalWidth = p.textWidth(txt);
    let startX = x - totalWidth / 2;

    for (let i = 0; i < txt.length; i++) {
      let charX = startX + p.textWidth(txt.substring(0, i));
      let charY = y + floatY + p.sin(time * 2 + i * 0.3) * 2;
      let charAlpha = 180 + p.sin(time * 1.5 + i * 0.2) * 40;

      // Glow
      p.fill(255, charAlpha * 0.3);
      p.text(txt[i], charX, charY);

      // Main
      p.fill(255, charAlpha);
      p.text(txt[i], charX, charY);
    }
  }

  function drawLines(p) {
    // Line above THANK YOU - animated wave
    let lineAlpha = 180 + p.sin(time * 2) * 40;
    let lineWidth = 220;
    let lineY = 1115;

    // Wavy line
    p.noFill();
    for (let i = -lineWidth/2; i <= lineWidth/2; i += 2) {
      let fade = 1 - Math.pow(Math.abs(i) / (lineWidth / 2), 2);
      let waveY = p.sin(time * 3 + i * 0.04) * 2;
      p.stroke(255, lineAlpha * fade);
      p.strokeWeight(1.5);
      p.point(360 + i, lineY + waveY);
    }

    // Glowing dots at ends
    p.noStroke();
    for (let i = 2; i >= 0; i--) {
      let dotAlpha = lineAlpha / (i + 1);
      let dotSize = 4 + i * 3;
      p.fill(255, dotAlpha * 0.4);
      p.ellipse(360 - lineWidth/2, lineY, dotSize, dotSize);
      p.ellipse(360 + lineWidth/2, lineY, dotSize, dotSize);
    }
    p.fill(255, lineAlpha);
    p.ellipse(360 - lineWidth/2, lineY, 5, 5);
    p.ellipse(360 + lineWidth/2, lineY, 5, 5);
  }

  function drawGlowParticles(p) {
    for (let gp of glowParticles) {
      gp.y -= gp.speed;
      gp.x += p.sin(time + gp.phase) * 0.4;

      if (gp.y < -10) {
        gp.y = 1290;
        gp.x = p.random(720);
      }

      let alpha = gp.brightness + p.sin(time * 2 + gp.phase) * 40;
      let size = gp.size + p.sin(time * 3 + gp.phase) * 0.8;

      // Enhanced soft glow with multiple layers
      p.noStroke();
      p.fill(255, alpha * 0.1);
      p.ellipse(gp.x, gp.y, size * 6, size * 6);
      p.fill(255, alpha * 0.25);
      p.ellipse(gp.x, gp.y, size * 3, size * 3);
      p.fill(255, alpha * 0.6);
      p.ellipse(gp.x, gp.y, size * 1.5, size * 1.5);
      p.fill(255, alpha);
      p.ellipse(gp.x, gp.y, size, size);
    }
  }

  function drawCorners(p) {
    let cornerSize = 55;
    let margin = 30;

    // Each corner pulses at different times
    let corners = [
      { x: margin, y: margin, dx: 1, dy: 1, phase: 0 },
      { x: 720 - margin, y: margin, dx: -1, dy: 1, phase: 0.5 },
      { x: margin, y: 1280 - margin, dx: 1, dy: -1, phase: 1 },
      { x: 720 - margin, y: 1280 - margin, dx: -1, dy: -1, phase: 1.5 }
    ];

    for (let c of corners) {
      let alpha = 100 + p.sin(time * 1.5 + c.phase * p.PI) * 60;

      p.stroke(255, alpha);
      p.strokeWeight(1.5);
      p.noFill();

      // Draw corner lines
      p.line(c.x, c.y, c.x, c.y + cornerSize * c.dy);
      p.line(c.x, c.y, c.x + cornerSize * c.dx, c.y);

      // Glowing dot at corner
      p.noStroke();
      p.fill(255, alpha * 0.3);
      p.ellipse(c.x, c.y, 10, 10);
      p.fill(255, alpha);
      p.ellipse(c.x, c.y, 4, 4);
    }
  }
};

// =====================
// 3D CLASSES
// =====================
class Particle {
  constructor(p) {
    this.pos = p.createVector(
      p.random(-250, 250),
      p.random(-300, 300),
      p.random(-150, 150)
    );
    this.vel = p.createVector(
      p.random(-0.25, 0.25),
      p.random(-0.3, 0.3),
      p.random(-0.1, 0.1)
    );
    this.size = p.random(2, 4.5);
    this.brightness = p.random(150, 255);
    this.phase = p.random(p.TWO_PI);
  }

  update(p) {
    this.pos.add(this.vel);
    this.pos.x += p.sin(time + this.phase) * 0.12;
    this.pos.z += p.cos(time * 0.5 + this.phase) * 0.08;

    if (this.pos.y < -320 || this.pos.y > 320) this.vel.y *= -1;
    if (this.pos.x < -270 || this.pos.x > 270) this.vel.x *= -1;
  }

  display(p) {
    p.push();
    p.translate(this.pos.x, this.pos.y, this.pos.z);
    let pulse = 1 + p.sin(time * 2 + this.phase) * 0.12;
    let s = this.size * pulse;
    p.noStroke();
    p.fill(this.brightness + p.sin(time * 2 + this.phase) * 20);
    p.sphere(s);
    p.pop();
  }
}

class GratitudeRing {
  constructor(p, index) {
    this.index = index;
    this.baseRadius = 70 + index * 25;
    this.y = -60 + index * 24;
    this.rotationSpeed = 0.004 * (index % 2 === 0 ? 1 : -1);
    this.rotation = p.random(p.TWO_PI);
    this.segments = 48;
  }

  update(p) {
    this.rotation += this.rotationSpeed;
  }

  display(p) {
    p.push();
    p.translate(0, this.y + p.sin(time * 0.7 + this.index) * 8, 0);
    p.rotateY(this.rotation);
    p.rotateX(p.PI / 2);

    p.noFill();
    let brightness = 120 + p.sin(time * 1.2 + this.index) * 30;
    p.stroke(brightness);
    p.strokeWeight(0.7);

    p.beginShape();
    for (let i = 0; i <= this.segments; i++) {
      let angle = p.map(i, 0, this.segments, 0, p.TWO_PI);
      let wobble = p.sin(angle * 4 + time * 1.2) * 4;
      let r = this.baseRadius + wobble;
      let x = p.cos(angle) * r;
      let y = p.sin(angle) * r;
      p.vertex(x, y, p.sin(angle * 2 + time) * 6);
    }
    p.endShape(p.CLOSE);

    for (let i = 0; i < 5; i++) {
      let angle = p.map(i, 0, 5, 0, p.TWO_PI) + time * 0.2;
      p.push();
      p.translate(p.cos(angle) * this.baseRadius, p.sin(angle) * this.baseRadius, 0);
      p.noStroke();
      p.fill(brightness + 15);
      p.sphere(1.8);
      p.pop();
    }

    p.pop();
  }
}

function drawCentralStructure(p) {
  p.push();
  p.rotateY(time * 0.18);
  p.rotateX(p.sin(time * 0.12) * 0.04);

  // Inner rotating ring of cubes
  p.push();
  p.rotateX(p.PI / 2);
  p.noFill();
  p.stroke(255);
  p.strokeWeight(0.4);

  for (let i = 0; i < 16; i++) {
    let angle = p.map(i, 0, 16, 0, p.TWO_PI);
    p.push();
    p.rotateZ(angle);
    p.translate(45, 0, 0);
    p.rotateY(time * 1.2 + angle);
    p.rotateX(time * 0.8);
    p.box(3.5 + p.sin(time * 2 + angle) * 0.8);
    p.pop();
  }
  p.pop();

  // Second layer - counter-rotating
  p.push();
  p.rotateX(p.PI / 2);
  p.rotateZ(-time * 0.5);
  p.noFill();
  p.stroke(180);
  p.strokeWeight(0.3);

  for (let i = 0; i < 12; i++) {
    let angle = p.map(i, 0, 12, 0, p.TWO_PI);
    p.push();
    p.rotateZ(angle);
    p.translate(32, 0, 0);
    p.rotateY(-time * 1.5 + angle);
    p.box(2.5 + p.sin(time * 2.5 + angle) * 0.5);
    p.pop();
  }
  p.pop();

  // Orbiting spheres at different angles
  p.push();
  p.rotateY(time * 0.3);
  p.rotateZ(time * 0.15);
  p.noFill();
  p.stroke(150);
  p.strokeWeight(0.6);

  for (let i = 0; i < 8; i++) {
    p.push();
    p.rotateY(i * p.PI / 4);
    p.rotateX(p.PI / 4 + p.sin(time + i) * 0.2);
    let size = 25 + p.sin(time * 1.5 + i) * 5;
    p.line(0, 0, 0, size, 0, 0);
    p.translate(size, 0, 0);
    p.noStroke();
    p.fill(180 + p.sin(time * 2 + i) * 40);
    p.sphere(2.5);
    p.pop();
  }
  p.pop();

  // Vertical axis with spheres
  p.push();
  p.rotateX(time * 0.1);
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    p.push();
    let yPos = i * 12 + p.sin(time * 2 + i) * 3;
    p.translate(0, yPos, 0);
    p.noStroke();
    let brightness = 150 + p.sin(time * 3 + i * 0.5) * 50;
    p.fill(brightness, 150);
    p.sphere(3 + p.sin(time * 2 + i) * 1);
    p.fill(brightness);
    p.sphere(1.5);
    p.pop();
  }
  p.pop();

  // DNA-like helix around center - reduced
  p.push();
  for (let i = 0; i < 18; i++) {
    let t = i / 30;
    let helixY = p.map(i, 0, 30, -40, 40);
    let helixAngle = t * p.TWO_PI * 2 + time;
    let helixR = 20 + p.sin(time + i * 0.2) * 3;

    p.push();
    p.translate(p.cos(helixAngle) * helixR, helixY, p.sin(helixAngle) * helixR);
    p.noStroke();
    p.fill(120 + p.sin(time * 2 + i * 0.3) * 40);
    p.sphere(1.2);
    p.pop();

    // Second strand
    p.push();
    p.translate(p.cos(helixAngle + p.PI) * helixR, helixY, p.sin(helixAngle + p.PI) * helixR);
    p.noStroke();
    p.fill(100 + p.sin(time * 2 + i * 0.3) * 30);
    p.sphere(1);
    p.pop();
  }
  p.pop();

  // Core - smaller with subtle glow
  p.noStroke();
  p.fill(255, 60);
  p.sphere(6 + p.sin(time * 1.5) * 1);
  p.fill(255, 120);
  p.sphere(4 + p.sin(time * 1.5) * 0.8);
  p.fill(255);
  p.sphere(2.5 + p.sin(time * 1.5) * 0.3);

  p.pop();
}

function drawConnections(p) {
  // Particle to particle connections
  p.strokeWeight(0.3);
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      let d = p5.Vector.dist(particles[i].pos, particles[j].pos);
      if (d < 50) {
        let alpha = p.map(d, 0, 50, 90, 0);
        // Add subtle pulsing to connections
        alpha *= (0.7 + p.sin(time * 2 + i * 0.1) * 0.3);
        p.stroke(255, alpha);
        p.line(
          particles[i].pos.x, particles[i].pos.y, particles[i].pos.z,
          particles[j].pos.x, particles[j].pos.y, particles[j].pos.z
        );
      }
    }
  }

  // Connect some particles to center with faint lines
  p.strokeWeight(0.15);
  for (let i = 0; i < particles.length; i += 8) {
    let d = particles[i].pos.mag();
    if (d < 150) {
      let alpha = p.map(d, 0, 150, 30, 0) * (0.5 + p.sin(time + i) * 0.5);
      p.stroke(255, alpha);
      p.line(particles[i].pos.x, particles[i].pos.y, particles[i].pos.z, 0, 0, 0);
    }
  }
}

function drawFloatingElements(p) {
  // Main floating orbs - reduced
  for (let i = 0; i < 8; i++) {
    p.push();
    let angle = p.map(i, 0, 12, 0, p.TWO_PI);
    let r = 120 + p.sin(time * 0.25 + i * 0.3) * 25;
    let x = p.cos(angle + time * 0.08) * r;
    let z = p.sin(angle + time * 0.08) * r;
    let y = p.sin(time * 0.4 + i) * 120;

    p.translate(x, y, z);
    p.noStroke();

    // Small particle
    let brightness = 150 + p.sin(time + i * 0.4) * 40;
    p.fill(brightness + 30);
    p.sphere(2 + p.sin(time + i) * 0.6);
    p.pop();
  }

  // Corner clusters with trails
  let corners = [
    {x: -140, y: -120}, {x: 140, y: -120},
    {x: -140, y: 120}, {x: 140, y: 120}
  ];

  for (let i = 0; i < corners.length; i++) {
    p.push();
    let c = corners[i];
    let floatY = p.sin(time * 0.4 + i * p.PI/2) * 15;
    p.translate(c.x, c.y + floatY, 0);

    // Main sphere - smaller
    p.noStroke();
    p.fill(180 + p.sin(time * 1.2 + i) * 25);
    p.sphere(3 + p.sin(time * 1.5 + i) * 0.8);

    // Orbiting particles
    for (let j = 0; j < 5; j++) {
      p.push();
      let oa = p.map(j, 0, 5, 0, p.TWO_PI) + time * 1.2;
      let orbitR = 12 + p.sin(time * 2 + j) * 3;
      p.translate(p.cos(oa) * orbitR, p.sin(oa) * orbitR, p.sin(oa * 2) * 5);
      p.fill(140 + p.sin(time * 3 + j) * 30);
      p.sphere(1.5);
      p.pop();
    }
    p.pop();
  }

  // Floating geometric shapes - reduced
  for (let i = 0; i < 4; i++) {
    p.push();
    let angle = p.map(i, 0, 6, 0, p.TWO_PI) + time * 0.05;
    let r = 180 + p.sin(time * 0.3 + i) * 30;
    let x = p.cos(angle) * r;
    let z = p.sin(angle) * r;
    let y = p.cos(time * 0.25 + i * 0.5) * 150;

    p.translate(x, y, z);
    p.rotateX(time * 0.5 + i);
    p.rotateY(time * 0.3 + i * 0.5);

    p.noFill();
    p.stroke(100 + p.sin(time + i) * 40);
    p.strokeWeight(0.5);

    if (i % 3 === 0) {
      p.box(8 + p.sin(time * 2 + i) * 2);
    } else if (i % 3 === 1) {
      // Octahedron-like shape
      p.beginShape(p.TRIANGLES);
      let s = 6 + p.sin(time * 2 + i) * 1.5;
      p.vertex(0, -s, 0);
      p.vertex(s, 0, 0);
      p.vertex(0, 0, s);
      p.vertex(0, -s, 0);
      p.vertex(0, 0, s);
      p.vertex(-s, 0, 0);
      p.vertex(0, s, 0);
      p.vertex(0, 0, s);
      p.vertex(s, 0, 0);
      p.vertex(0, s, 0);
      p.vertex(-s, 0, 0);
      p.vertex(0, 0, s);
      p.endShape();
    } else {
      // Tetrahedron
      let s = 7 + p.sin(time * 2 + i) * 2;
      p.beginShape(p.TRIANGLES);
      p.vertex(0, -s, 0);
      p.vertex(s, s/2, 0);
      p.vertex(-s, s/2, 0);
      p.endShape();
    }
    p.pop();
  }
}

// New: Draw nebula clouds as small particle clusters
function drawNebulaClouds(p) {
  for (let cloud of nebulaClouds) {
    p.push();
    p.translate(cloud.x, cloud.y, cloud.z - 100);
    p.noStroke();

    // Small scattered particles - reduced
    for (let i = 0; i < 5; i++) {
      let angle = i * p.TWO_PI / 8 + time * 0.2 + cloud.phase;
      let r = 15 + p.sin(time * 0.5 + i + cloud.phase) * 8;
      let px = p.cos(angle) * r;
      let py = p.sin(angle * 0.7) * r * 0.5;
      let pz = p.sin(angle) * r;

      let alpha = 40 + p.sin(time * 0.8 + cloud.phase + i) * 20;
      p.fill(255, alpha);
      p.sphere(1.5 + p.sin(time + i) * 0.5);
    }
    p.pop();
  }
}

// New: Draw starfield background
function drawStarfield(p) {
  p.push();
  p.noStroke();

  // Static-ish stars in the far background - reduced
  for (let i = 0; i < 40; i++) {
    let seed = i * 137.5; // Golden angle for distribution
    let theta = seed;
    let phi = p.acos(1 - 2 * ((i + 0.5) / 80));
    let r = 400;

    let x = r * p.sin(phi) * p.cos(theta);
    let y = r * p.sin(phi) * p.sin(theta) * 1.5; // Stretch vertically
    let z = r * p.cos(phi);

    let twinkle = 0.5 + p.sin(time * 2 + i * 0.3) * 0.5;
    let brightness = (80 + i % 50) * twinkle;

    p.push();
    p.translate(x, y, z);
    p.fill(brightness);
    p.sphere(0.8 + twinkle * 0.5);
    p.pop();
  }
  p.pop();
}

// New: Draw spiral particles
function drawSpiralParticles(p) {
  for (let sp of spiralParticles) {
    sp.angle += sp.speed;
    sp.y += p.sin(time + sp.phase) * 0.3;

    if (sp.y > 220) sp.y = -220;
    if (sp.y < -220) sp.y = 220;

    let x = p.cos(sp.angle) * sp.radius;
    let z = p.sin(sp.angle) * sp.radius;

    p.push();
    p.translate(x, sp.y, z);

    let brightness = 120 + p.sin(time * 2 + sp.phase) * 50;
    p.noStroke();

    // Core only - no big glow
    p.fill(brightness + 40);
    p.sphere(sp.size);
    p.pop();

    // Trail effect - smaller
    for (let t = 1; t <= 3; t++) {
      let trailAngle = sp.angle - t * 0.08;
      let tx = p.cos(trailAngle) * sp.radius;
      let tz = p.sin(trailAngle) * sp.radius;

      p.push();
      p.translate(tx, sp.y - t * 2, tz);
      p.noStroke();
      p.fill(brightness - t * 30, 100 - t * 25);
      p.sphere(sp.size * (1 - t * 0.25));
      p.pop();
    }
  }
}

// New: Draw light beams
function drawLightBeams(p) {
  p.push();

  // Rotating light beams from center - reduced
  for (let i = 0; i < 4; i++) {
    let angle = p.map(i, 0, 4, 0, p.TWO_PI) + time * 0.1;

    p.push();
    p.rotateY(angle);
    p.rotateX(p.PI / 6);

    // Draw beam as a series of fading points - reduced
    p.noStroke();
    for (let j = 0; j < 50; j++) {
      let dist = j * 3;
      let alpha = p.map(j, 0, 80, 60, 0);
      let size = p.map(j, 0, 80, 2, 0.5);
      let wave = p.sin(time * 3 + j * 0.1) * 3;

      p.push();
      p.translate(dist, wave, 0);
      p.fill(255, alpha * (0.5 + p.sin(time * 2 + i + j * 0.05) * 0.5));
      p.sphere(size);
      p.pop();
    }
    p.pop();
  }

  // Vertical energy column - reduced
  p.push();
  p.rotateY(time * 0.2);
  for (let j = -120; j <= 120; j += 15) {
    let alpha = p.map(Math.abs(j), 0, 150, 50, 10);
    let size = p.map(Math.abs(j), 0, 150, 3, 1);
    let wobble = p.sin(time * 2 + j * 0.05) * 5;

    p.push();
    p.translate(wobble, j, wobble);
    p.noStroke();
    p.fill(255, alpha);
    p.sphere(size);
    p.pop();
  }
  p.pop();

  p.pop();
}

// Initialize both sketches
new p5(mainSketch);
new p5(textSketch);
