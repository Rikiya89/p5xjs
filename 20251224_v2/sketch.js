let particles = [];
let time = 0;
let flowField = [];
let cols, rows, layers;
let scl = 30;
let zoff = 0;

function setup() {
    createCanvas(720, 1280, WEBGL);

    cols = floor(width / scl);
    rows = floor(height / scl);
    layers = 20;

    // Initialize flow field
    flowField = new Array(cols * rows * layers);

    // Create particles
    for (let i = 0; i < 800; i++) {
        particles.push(new Particle());
    }
}

function draw() {
    background(0);

    // Lighting
    ambientLight(100);
    pointLight(255, 255, 255, 0, 0, 400);

    // Update flow field using partial differentiation
    updateFlowField();

    // Update and display particles
    for (let particle of particles) {
        particle.follow(flowField);
        particle.update();
        particle.edges();
        particle.show();
    }

    // Draw 3D surface based on partial derivatives
    drawSurface();

    time += 0.01;
    zoff += 0.001;
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

    stroke(255, 50);
    strokeWeight(0.5);
    noFill();

    let offset = 200;

    // Draw wire mesh surface using partial derivatives
    for (let y = 0; y < rows - 1; y++) {
        beginShape(TRIANGLE_STRIP);
        for (let x = 0; x < cols; x++) {
            let xoff = x * 0.15;
            let yoff1 = y * 0.15;
            let yoff2 = (y + 1) * 0.15;

            // Calculate height using noise and partial derivatives
            let n1 = noise(xoff, yoff1, zoff);
            let n2 = noise(xoff, yoff2, zoff);

            // Use partial derivatives to modify height
            let dx = 0.1;
            let n1x = noise(xoff + dx, yoff1, zoff);
            let n2x = noise(xoff + dx, yoff2, zoff);

            let dfx1 = (n1x - n1) / dx;
            let dfx2 = (n2x - n2) / dx;

            let z1 = map(n1 + dfx1 * 0.5, 0, 1, -offset, offset);
            let z2 = map(n2 + dfx2 * 0.5, 0, 1, -offset, offset);

            let px1 = map(x, 0, cols, -width/2, width/2);
            let py1 = map(y, 0, rows, -height/2, height/2);
            let py2 = map(y + 1, 0, rows, -height/2, height/2);

            vertex(px1, py1, z1);
            vertex(px1, py2, z2);
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
        this.maxSpeed = 2;
        this.prevPos = this.pos.copy();
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
    }

    show() {
        stroke(255, 150);
        strokeWeight(1);
        line(this.prevPos.x, this.prevPos.y, this.prevPos.z,
             this.pos.x, this.pos.y, this.pos.z);
        this.updatePrev();
    }
}
