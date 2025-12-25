let particles = [];
let time = 0;
let flowField = [];
let cols, rows, layers;
let scl = 30;
let zoff = 0;
let trailBuffer;

function setup() {
    createCanvas(720, 1280, WEBGL);

    // Create graphics buffer for smooth trails
    trailBuffer = createGraphics(width, height);
    trailBuffer.background(0);

    cols = floor(width / scl);
    rows = floor(height / scl);
    layers = 20;

    // Initialize flow field
    flowField = new Array(cols * rows * layers);

    // Create particles with varied properties
    for (let i = 0; i < 1200; i++) {
        particles.push(new Particle());
    }
}

function draw() {
    background(0, 10);

    // Enhanced multi-point lighting for depth
    ambientLight(60);
    pointLight(255, 255, 255, 200, -200, 300);
    pointLight(150, 200, 255, -200, 200, 200);
    directionalLight(200, 200, 250, 0.25, 0.25, -1);

    // Update flow field using partial differentiation
    updateFlowField();

    // Draw 3D surface with enhanced details
    drawSurface();

    // Update and display particles with trails
    push();
    for (let particle of particles) {
        particle.follow(flowField);
        particle.update();
        particle.edges();
        particle.show();
    }
    pop();

    time += 0.008;
    zoff += 0.0015;
}

function updateFlowField() {
    let yoff = 0;
    for (let z = 0; z < layers; z++) {
        let xoff = 0;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                // Calculate partial derivatives
                // f/x and f/y to create vector field
                let dx = 0.1;
                let dy = 0.1;

                let f = noise(xoff, yoff, zoff);
                let fx = noise(xoff + dx, yoff, zoff);
                let fy = noise(xoff, yoff + dy, zoff);

                // Partial derivatives
                let dfx = (fx - f) / dx;
                let dfy = (fy - f) / dy;

                // Create rotation angle from gradient
                let angle = atan2(dfy, dfx);

                // Store in flow field
                let index = x + y * cols + z * cols * rows;
                flowField[index] = createVector(
                    cos(angle) * 0.5,
                    sin(angle) * 0.5,
                    (f - 0.5) * 2
                );

                xoff += 0.1;
            }
            yoff += 0.1;
        }
    }
}

function drawSurface() {
    push();
    rotateX(time * 0.3);
    rotateY(time * 0.2);

    let offset = 200;

    // Draw enhanced wire mesh surface using partial derivatives
    for (let y = 0; y < rows - 1; y++) {
        beginShape(TRIANGLE_STRIP);
        for (let x = 0; x < cols; x++) {
            let xoff = x * 0.15;
            let yoff1 = y * 0.15;
            let yoff2 = (y + 1) * 0.15;

            // Calculate height using noise and partial derivatives
            let n1 = noise(xoff, yoff1, zoff);
            let n2 = noise(xoff, yoff2, zoff);

            // Calculate partial derivatives in both directions
            let dx = 0.1;
            let dy = 0.1;
            let n1x = noise(xoff + dx, yoff1, zoff);
            let n2x = noise(xoff + dx, yoff2, zoff);
            let n1y = noise(xoff, yoff1 + dy, zoff);
            let n2y = noise(xoff, yoff2 + dy, zoff);

            let dfx1 = (n1x - n1) / dx;
            let dfx2 = (n2x - n2) / dx;
            let dfy1 = (n1y - n1) / dy;
            let dfy2 = (n2y - n2) / dy;

            // Use gradient magnitude for enhanced height variation
            let grad1 = sqrt(dfx1 * dfx1 + dfy1 * dfy1);
            let grad2 = sqrt(dfx2 * dfx2 + dfy2 * dfy2);

            let z1 = map(n1 + grad1 * 0.3, 0, 1, -offset, offset);
            let z2 = map(n2 + grad2 * 0.3, 0, 1, -offset, offset);

            let px1 = map(x, 0, cols, -width/2, width/2);
            let py1 = map(y, 0, rows, -height/2, height/2);
            let py2 = map(y + 1, 0, rows, -height/2, height/2);

            // Dynamic grayscale based on gradient and height
            let colorIntensity1 = map(grad1, 0, 0.5, 80, 255);
            let colorIntensity2 = map(grad2, 0, 0.5, 80, 255);

            stroke(colorIntensity1, 80);
            strokeWeight(0.8);
            noFill();

            vertex(px1, py1, z1);

            stroke(colorIntensity2, 80);
            vertex(px1, py2, z2);
        }
        endShape();
    }

    // Add subtle depth lines
    stroke(255, 255, 255, 20);
    strokeWeight(0.3);
    for (let x = 0; x < cols; x += 3) {
        beginShape();
        for (let y = 0; y < rows; y++) {
            let xoff = x * 0.15;
            let yoff = y * 0.15;
            let n = noise(xoff, yoff, zoff);

            let dx = 0.1;
            let dy = 0.1;
            let nx = noise(xoff + dx, yoff, zoff);
            let ny = noise(xoff, yoff + dy, zoff);
            let dfx = (nx - n) / dx;
            let dfy = (ny - n) / dy;
            let grad = sqrt(dfx * dfx + dfy * dfy);

            let z = map(n + grad * 0.3, 0, 1, -offset, offset);
            let px = map(x, 0, cols, -width/2, width/2);
            let py = map(y, 0, rows, -height/2, height/2);

            vertex(px, py, z);
        }
        endShape();
    }

    pop();
}

class Particle {
    constructor() {
        this.pos = createVector(
            random(-width/2, width/2),
            random(-height/2, height/2),
            random(-200, 200)
        );
        this.vel = createVector(0, 0, 0);
        this.acc = createVector(0, 0, 0);
        this.maxSpeed = random(1.5, 3);
        this.prevPos = this.pos.copy();
        this.history = [];
        this.maxHistory = 20;
        this.hue = random(255);
        this.alpha = random(100, 200);
    }

    follow(vectors) {
        let x = floor(map(this.pos.x, -width/2, width/2, 0, cols));
        let y = floor(map(this.pos.y, -height/2, height/2, 0, rows));
        let z = floor(map(this.pos.z, -200, 200, 0, layers));

        x = constrain(x, 0, cols - 1);
        y = constrain(y, 0, rows - 1);
        z = constrain(z, 0, layers - 1);

        let index = x + y * cols + z * cols * rows;
        let force = vectors[index];

        if (force) {
            this.applyForce(force);
        }
    }

    applyForce(force) {
        this.acc.add(force);
    }

    update() {
        this.vel.add(this.acc);
        this.vel.limit(this.maxSpeed);
        this.pos.add(this.vel);
        this.acc.mult(0);

        // Store position history for smooth trails
        this.history.push(this.pos.copy());
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    edges() {
        if (this.pos.x > width/2) {
            this.pos.x = -width/2;
            this.updatePrev();
        }
        if (this.pos.x < -width/2) {
            this.pos.x = width/2;
            this.updatePrev();
        }
        if (this.pos.y > height/2) {
            this.pos.y = -height/2;
            this.updatePrev();
        }
        if (this.pos.y < -height/2) {
            this.pos.y = height/2;
            this.updatePrev();
        }
        if (this.pos.z > 200) {
            this.pos.z = -200;
            this.updatePrev();
        }
        if (this.pos.z < -200) {
            this.pos.z = 200;
            this.updatePrev();
        }
    }

    updatePrev() {
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;
        this.prevPos.z = this.pos.z;
        this.history = [];
    }

    show() {
        // Draw smooth gradient trail in grayscale
        noFill();
        beginShape();
        for (let i = 0; i < this.history.length; i++) {
            let pos = this.history[i];
            let alpha = map(i, 0, this.history.length, 0, this.alpha);

            // Dynamic grayscale based on velocity and position
            let velocityMag = this.vel.mag();
            let brightness = map(velocityMag, 0, this.maxSpeed, 180, 255);
            let depthBrightness = map(pos.z, -200, 200, 0.7, 1.0);

            let finalBrightness = brightness * depthBrightness;

            stroke(finalBrightness, alpha);
            strokeWeight(map(i, 0, this.history.length, 0.3, 1.5));
            vertex(pos.x, pos.y, pos.z);
        }
        endShape();

        // Draw glowing particle head in white
        push();
        translate(this.pos.x, this.pos.y, this.pos.z);
        noStroke();

        // Outer glow
        fill(255, 30);
        sphere(3);

        // Core
        fill(255, this.alpha);
        sphere(1.5);
        pop();

        this.updatePrev();
    }
}
