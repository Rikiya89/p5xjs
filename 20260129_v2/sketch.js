
// Canvas dimensions
const W = 1080;
const H = 1920;

// Recording variables
let encoder = null;
let muxer = null;
let isRecording = false;
let recordingFrameCount = 0;
let recordingStartTime = 0;
const FPS = 60;
const MAX_DURATION = 15; // seconds
const MAX_FRAMES = FPS * MAX_DURATION; // 900 frames for 15 seconds

// Start recording with MP4 encoding
async function startRecording() {
  // Check for WebCodecs support
  if (typeof VideoEncoder === 'undefined') {
    alert('Your browser does not support WebCodecs API. Please use Chrome or Edge.');
    return;
  }

  isRecording = true;
  recordingFrameCount = 0;
  time = 0; // Reset animation time
  recordingStartTime = Date.now();

  // Initialize MP4 muxer
  muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: W,
      height: H
    },
    fastStart: 'in-memory'
  });

  // Initialize video encoder
  encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('Encoder error:', e)
  });

  encoder.configure({
    codec: 'avc1.640028',
    width: W,
    height: H,
    bitrate: 8_000_000,
    framerate: FPS
  });

  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('status').textContent = 'Recording...';
  document.getElementById('status').style.color = '#ff6b6b';
}

// Stop recording and download MP4
async function stopRecording() {
  if (!isRecording) return;

  isRecording = false;
  document.getElementById('status').textContent = 'Processing...';
  document.getElementById('status').style.color = '#84bae7';

  // Flush encoder and finalize muxer
  await encoder.flush();
  muxer.finalize();

  // Get the MP4 data
  let buffer = muxer.target.buffer;
  let blob = new Blob([buffer], { type: 'video/mp4' });

  // Download the file
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = 'silver_ratio_art.mp4';
  a.click();
  URL.revokeObjectURL(url);

  // Cleanup
  encoder = null;
  muxer = null;

  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
  document.getElementById('status').textContent = 'Download started!';
  document.getElementById('status').style.color = '#916ccc';

  setTimeout(() => {
    document.getElementById('status').textContent = 'Ready';
    document.getElementById('status').style.color = '#84bae7';
  }, 3000);
}

// Capture frame for MP4 encoding
function captureFrame() {
  if (!isRecording || !encoder) return;

  const canvas = document.querySelector('canvas');
  const timestamp = recordingFrameCount * (1_000_000 / FPS); // microseconds

  const frame = new VideoFrame(canvas, {
    timestamp: timestamp
  });

  encoder.encode(frame, { keyFrame: recordingFrameCount % 60 === 0 });
  frame.close();
}

// Art variables
let time = 0;
const palette = [
  "#362d78", "#523fa3", "#916ccc", "#bda1e5", "#c8c0e9",
  "#84bae7", "#516ad4", "#333f87", "#293039", "#283631"
];

// Mathematical ratios - the metallic means
const GOLDEN = (1 + Math.sqrt(5)) / 2;      // φ ≈ 1.618
const SILVER = 1 + Math.sqrt(2);             // δ ≈ 2.414
const BRONZE = (3 + Math.sqrt(13)) / 2;      // ≈ 3.303

// Golden angle in radians (used in phyllotaxis)
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SILVER_ANGLE = Math.PI * 2 / SILVER;
const BRONZE_ANGLE = Math.PI * 2 / BRONZE;

function setup() {
  createCanvas(W, H, WEBGL);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
  frameRate(60); // Lock frame rate for consistent recording
}

function draw() {
  background(20, 30, 12);

  // Update time
  time += 0.008;

  // Camera rotation based on golden ratio
  let camAngle = time * 0.3;
  let camRadius = 600;
  let camY = sin(time * 0.2) * 200;
  camera(
    cos(camAngle) * camRadius, camY, sin(camAngle) * camRadius,
    0, 0, 0,
    0, 1, 0
  );

  // Ambient and directional lighting
  ambientLight(60);
  directionalLight(255, 255, 255, 0.5, 1, -0.5);
  pointLight(200, 150, 255, 0, -300, 200);

  // Draw the three spiral systems
  push();
  drawGoldenSpiral();
  pop();

  push();
  drawSilverSpiral();
  pop();

  push();
  drawBronzeSpiral();
  pop();

  // Central core - pulsing sphere
  push();
  let coreSize = 30 + sin(time * 2) * 10;
  let coreCol = color(palette[5]);
  emissiveMaterial(coreCol);
  sphere(coreSize);
  pop();

  // Draw connecting geometry
  drawConnectingGeometry();

  // Handle recording
  if (isRecording) {
    captureFrame();
    recordingFrameCount++;

    // Use frame count for accurate video duration (not wall-clock time)
    let videoDuration = recordingFrameCount / FPS;
    document.getElementById('duration').textContent = videoDuration.toFixed(1);
    document.getElementById('frameCount').textContent = recordingFrameCount;

    // Stop based on frame count to ensure full 15 seconds of video
    if (recordingFrameCount >= MAX_FRAMES) {
      stopRecording();
    }
  }
}

// Golden ratio spiral - warm purple tones with multiple geometry types
function drawGoldenSpiral() {
  const numPoints = 200;

  for (let i = 0; i < numPoints; i++) {
    let t = i / numPoints;
    let angle = i * GOLDEN_ANGLE + time;
    let radius = pow(GOLDEN, i * 0.055) * 12;

    // 3D positioning using golden ratio
    let x = cos(angle) * radius;
    let z = sin(angle) * radius;
    let y = (i - numPoints / 2) * 2.5 + sin(time * 2 + i * 0.1) * 20;

    // Size based on golden progression
    let size = map(i, 0, numPoints, 6, 22) * (0.8 + 0.2 * sin(time + i * 0.1));

    push();
    translate(x, y, z);
    rotateY(angle);
    rotateX(time + i * 0.05);

    // Color from palette - purple range
    let colIndex = floor(map(sin(time + i * 0.05), -1, 1, 0, 4));
    let col = color(palette[colIndex]);
    ambientMaterial(col);
    specularMaterial(50);

    // Alternate between different geometries based on golden sequence
    let geoType = i % 5;
    if (geoType === 0) {
      // Golden ratio box
      box(size, size / GOLDEN, size / (GOLDEN * GOLDEN));
    } else if (geoType === 1) {
      // Tetrahedron
      drawTetrahedron(size * 0.8);
    } else if (geoType === 2) {
      // Stellated shape
      drawStellated(size * 0.6, 4);
    } else if (geoType === 3) {
      // Twisted prism
      drawTwistedPrism(size * 0.5, size * 0.8, 5);
    } else {
      // Icosahedron
      drawIcosahedron(size * 0.5);
    }
    pop();
  }

  // Secondary layer - smaller particles following Fibonacci sphere
  drawFibonacciSphere(180, 280, palette.slice(0, 4));
}

// Silver ratio spiral - cool blue tones with crystalline geometry
function drawSilverSpiral() {
  const numPoints = 160;

  for (let i = 0; i < numPoints; i++) {
    let t = i / numPoints;
    let angle = i * SILVER_ANGLE + time * 0.8 + PI;
    let radius = pow(SILVER, i * 0.042) * 10;

    // Offset positioning
    let x = cos(angle) * radius * 0.9;
    let z = sin(angle) * radius * 0.9;
    let y = (i - numPoints / 2) * 2.8 + cos(time * 1.5 + i * 0.08) * 25;

    let size = map(i, 0, numPoints, 5, 18) * (0.7 + 0.3 * cos(time * 1.2 + i * 0.12));

    push();
    translate(x, y, z);
    rotateZ(angle);
    rotateY(time * 0.7 + i * 0.04);

    // Color from palette - blue range
    let colIndex = floor(map(cos(time + i * 0.04), -1, 1, 4, 7));
    let col = color(palette[colIndex]);
    ambientMaterial(col);
    specularMaterial(80);

    // Alternate between crystalline geometries
    let geoType = i % 4;
    if (geoType === 0) {
      // Silver ratio octahedron
      drawOctahedron(size, size / SILVER);
    } else if (geoType === 1) {
      // Double pyramid (bipyramid)
      drawBipyramid(size * 0.6, size * 1.2, 6);
    } else if (geoType === 2) {
      // Crystal shard
      drawCrystalShard(size * 0.4, size * 1.5);
    } else {
      // Cuboctahedron-inspired
      drawCuboctahedron(size * 0.5);
    }
    pop();
  }

  // Secondary helix around silver spiral
  drawHelixRing(120, 350, SILVER_ANGLE, palette.slice(4, 7));
}

// Bronze ratio spiral - dark blue tones with organic geometry
function drawBronzeSpiral() {
  const numPoints = 140;

  for (let i = 0; i < numPoints; i++) {
    let t = i / numPoints;
    let angle = i * BRONZE_ANGLE + time * 0.6 + PI / 3;
    let radius = pow(BRONZE, i * 0.032) * 8;

    let x = cos(angle) * radius * 1.1;
    let z = sin(angle) * radius * 1.1;
    let y = (i - numPoints / 2) * 3 + sin(time * 1.8 + i * 0.15) * 30;

    let size = map(i, 0, numPoints, 4, 16) * (0.6 + 0.4 * sin(time * 0.9 + i * 0.08));

    push();
    translate(x, y, z);
    rotateX(angle);
    rotateZ(time * 0.5 + i * 0.06);

    // Color from palette - dark blue/purple range (no green)
    let colIndex = floor(map(sin(time * 0.8 + i * 0.06), -1, 1, 5, 8));
    colIndex = constrain(colIndex, 5, 7);
    let col = color(palette[colIndex]);
    ambientMaterial(col);
    specularMaterial(30);

    // Alternate between organic geometries
    let geoType = i % 5;
    if (geoType === 0) {
      // Bronze ratio torus
      drawRing(size, size / BRONZE);
    } else if (geoType === 1) {
      // Twisted torus knot segment
      drawTorusKnot(size * 0.4, size * 0.15, 2, 3);
    } else if (geoType === 2) {
      // Gyroid-inspired mesh
      drawGyroidCell(size * 0.7);
    } else if (geoType === 3) {
      // Organic blob
      drawOrganicBlob(size * 0.5, 3 + (i % 3));
    } else {
      // Antiprism
      drawAntiprism(size * 0.5, size * 0.8, 5);
    }
    pop();
  }

  // Outer ring of floating particles (dark blue/purple range, no green)
  drawOrbitingParticles(100, 400, palette.slice(5, 8));
}

// Custom octahedron for silver spiral
function drawOctahedron(w, h) {
  beginShape(TRIANGLES);
  // Top pyramid
  vertex(0, -h, 0);
  vertex(w/2, 0, w/2);
  vertex(w/2, 0, -w/2);

  vertex(0, -h, 0);
  vertex(w/2, 0, -w/2);
  vertex(-w/2, 0, -w/2);

  vertex(0, -h, 0);
  vertex(-w/2, 0, -w/2);
  vertex(-w/2, 0, w/2);

  vertex(0, -h, 0);
  vertex(-w/2, 0, w/2);
  vertex(w/2, 0, w/2);

  // Bottom pyramid
  vertex(0, h, 0);
  vertex(w/2, 0, -w/2);
  vertex(w/2, 0, w/2);

  vertex(0, h, 0);
  vertex(-w/2, 0, -w/2);
  vertex(w/2, 0, -w/2);

  vertex(0, h, 0);
  vertex(-w/2, 0, w/2);
  vertex(-w/2, 0, -w/2);

  vertex(0, h, 0);
  vertex(w/2, 0, w/2);
  vertex(-w/2, 0, w/2);
  endShape();
}

// Custom ring/torus for bronze spiral
function drawRing(outerR, innerR) {
  let segments = 8;
  let tubeSegments = 6;
  let tubeR = (outerR - innerR) / 2;
  let centerR = innerR + tubeR;

  for (let i = 0; i < segments; i++) {
    let theta1 = map(i, 0, segments, 0, TWO_PI);
    let theta2 = map(i + 1, 0, segments, 0, TWO_PI);

    beginShape(TRIANGLE_STRIP);
    for (let j = 0; j <= tubeSegments; j++) {
      let phi = map(j, 0, tubeSegments, 0, TWO_PI);

      let x1 = (centerR + tubeR * cos(phi)) * cos(theta1);
      let y1 = tubeR * sin(phi);
      let z1 = (centerR + tubeR * cos(phi)) * sin(theta1);

      let x2 = (centerR + tubeR * cos(phi)) * cos(theta2);
      let y2 = tubeR * sin(phi);
      let z2 = (centerR + tubeR * cos(phi)) * sin(theta2);

      vertex(x1, y1, z1);
      vertex(x2, y2, z2);
    }
    endShape();
  }
}

// Connecting geometry between spirals
function drawConnectingGeometry() {
  let numConnections = 48;

  for (let i = 0; i < numConnections; i++) {
    let angle = (i / numConnections) * TWO_PI + time * 0.5;
    let radius = 150 + sin(time * 2 + i * 0.3) * 50;
    let y = sin(time + i * 0.5) * 150;

    push();
    translate(cos(angle) * radius, y, sin(angle) * radius);
    rotateY(angle + time);
    rotateX(time * 0.3);

    // Alternate between ratios for sizing
    let ratioSelect = i % 3;
    let ratio = ratioSelect === 0 ? GOLDEN : (ratioSelect === 1 ? SILVER : BRONZE);
    let size = 8 + sin(time * 3 + i) * 4;

    // Use only first 9 colors (exclude green at index 9)
    let colIndex = (i + floor(time * 2)) % 9;
    let col = color(palette[colIndex]);

    ambientMaterial(red(col), green(col), blue(col));

    // Varied connecting shapes
    if (i % 4 === 0) {
      sphere(size / ratio);
    } else if (i % 4 === 1) {
      drawTetrahedron(size / ratio);
    } else if (i % 4 === 2) {
      box(size / ratio);
    } else {
      drawOctahedron(size / ratio, size / (ratio * 1.5));
    }
    pop();
  }
}

// ==================== NEW GEOMETRY FUNCTIONS ====================

// Tetrahedron - simplest Platonic solid
function drawTetrahedron(size) {
  let h = size * sqrt(2/3);
  let r = size / sqrt(3);

  beginShape(TRIANGLES);
  // Base triangle
  let v0 = [r, h/2, 0];
  let v1 = [-r/2, h/2, r * sqrt(3)/2];
  let v2 = [-r/2, h/2, -r * sqrt(3)/2];
  let v3 = [0, -h/2, 0];

  // Face 1
  vertex(v0[0], v0[1], v0[2]);
  vertex(v1[0], v1[1], v1[2]);
  vertex(v3[0], v3[1], v3[2]);
  // Face 2
  vertex(v1[0], v1[1], v1[2]);
  vertex(v2[0], v2[1], v2[2]);
  vertex(v3[0], v3[1], v3[2]);
  // Face 3
  vertex(v2[0], v2[1], v2[2]);
  vertex(v0[0], v0[1], v0[2]);
  vertex(v3[0], v3[1], v3[2]);
  // Face 4 (base)
  vertex(v0[0], v0[1], v0[2]);
  vertex(v2[0], v2[1], v2[2]);
  vertex(v1[0], v1[1], v1[2]);
  endShape();
}

// Stellated shape - star-like polyhedron
function drawStellated(size, points) {
  let innerR = size * 0.4;
  let outerR = size;

  for (let i = 0; i < points; i++) {
    let angle1 = (i / points) * TWO_PI;
    let angle2 = ((i + 1) / points) * TWO_PI;
    let midAngle = (angle1 + angle2) / 2;

    beginShape(TRIANGLES);
    // Outer spike
    vertex(cos(midAngle) * outerR, 0, sin(midAngle) * outerR);
    vertex(cos(angle1) * innerR, size * 0.3, sin(angle1) * innerR);
    vertex(cos(angle2) * innerR, size * 0.3, sin(angle2) * innerR);

    vertex(cos(midAngle) * outerR, 0, sin(midAngle) * outerR);
    vertex(cos(angle2) * innerR, -size * 0.3, sin(angle2) * innerR);
    vertex(cos(angle1) * innerR, -size * 0.3, sin(angle1) * innerR);
    endShape();
  }
}

// Twisted prism
function drawTwistedPrism(radius, height, sides) {
  let twist = PI / 4;

  for (let i = 0; i < sides; i++) {
    let angle1 = (i / sides) * TWO_PI;
    let angle2 = ((i + 1) / sides) * TWO_PI;

    beginShape(TRIANGLE_STRIP);
    // Bottom vertex
    vertex(cos(angle1) * radius, height/2, sin(angle1) * radius);
    // Top vertex (twisted)
    vertex(cos(angle1 + twist) * radius, -height/2, sin(angle1 + twist) * radius);
    // Bottom next
    vertex(cos(angle2) * radius, height/2, sin(angle2) * radius);
    // Top next (twisted)
    vertex(cos(angle2 + twist) * radius, -height/2, sin(angle2 + twist) * radius);
    endShape();
  }
}

// Icosahedron - 20-faced Platonic solid
function drawIcosahedron(size) {
  let phi = GOLDEN;
  let vertices = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
  ];

  // Normalize and scale
  for (let v of vertices) {
    let len = sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    v[0] = v[0] / len * size;
    v[1] = v[1] / len * size;
    v[2] = v[2] / len * size;
  }

  let faces = [
    [0,11,5], [0,5,1], [0,1,7], [0,7,10], [0,10,11],
    [1,5,9], [5,11,4], [11,10,2], [10,7,6], [7,1,8],
    [3,9,4], [3,4,2], [3,2,6], [3,6,8], [3,8,9],
    [4,9,5], [2,4,11], [6,2,10], [8,6,7], [9,8,1]
  ];

  beginShape(TRIANGLES);
  for (let f of faces) {
    vertex(vertices[f[0]][0], vertices[f[0]][1], vertices[f[0]][2]);
    vertex(vertices[f[1]][0], vertices[f[1]][1], vertices[f[1]][2]);
    vertex(vertices[f[2]][0], vertices[f[2]][1], vertices[f[2]][2]);
  }
  endShape();
}

// Bipyramid - two pyramids joined at base
function drawBipyramid(radius, height, sides) {
  for (let i = 0; i < sides; i++) {
    let angle1 = (i / sides) * TWO_PI;
    let angle2 = ((i + 1) / sides) * TWO_PI;

    beginShape(TRIANGLES);
    // Top pyramid
    vertex(0, -height/2, 0);
    vertex(cos(angle1) * radius, 0, sin(angle1) * radius);
    vertex(cos(angle2) * radius, 0, sin(angle2) * radius);
    // Bottom pyramid
    vertex(0, height/2, 0);
    vertex(cos(angle2) * radius, 0, sin(angle2) * radius);
    vertex(cos(angle1) * radius, 0, sin(angle1) * radius);
    endShape();
  }
}

// Crystal shard - elongated hexagonal prism with pointed ends
function drawCrystalShard(radius, height) {
  let sides = 6;
  let tipHeight = height * 0.3;

  for (let i = 0; i < sides; i++) {
    let angle1 = (i / sides) * TWO_PI;
    let angle2 = ((i + 1) / sides) * TWO_PI;

    beginShape(TRIANGLES);
    // Top tip
    vertex(0, -height/2, 0);
    vertex(cos(angle1) * radius, -height/2 + tipHeight, sin(angle1) * radius);
    vertex(cos(angle2) * radius, -height/2 + tipHeight, sin(angle2) * radius);

    // Middle section (quad as two triangles)
    vertex(cos(angle1) * radius, -height/2 + tipHeight, sin(angle1) * radius);
    vertex(cos(angle1) * radius, height/2 - tipHeight, sin(angle1) * radius);
    vertex(cos(angle2) * radius, -height/2 + tipHeight, sin(angle2) * radius);

    vertex(cos(angle2) * radius, -height/2 + tipHeight, sin(angle2) * radius);
    vertex(cos(angle1) * radius, height/2 - tipHeight, sin(angle1) * radius);
    vertex(cos(angle2) * radius, height/2 - tipHeight, sin(angle2) * radius);

    // Bottom tip
    vertex(0, height/2, 0);
    vertex(cos(angle2) * radius, height/2 - tipHeight, sin(angle2) * radius);
    vertex(cos(angle1) * radius, height/2 - tipHeight, sin(angle1) * radius);
    endShape();
  }
}

// Cuboctahedron - Archimedean solid
function drawCuboctahedron(size) {
  let s = size;

  // Square faces (6)
  let squareFaces = [
    [[s,0,0], [0,s,0], [-s,0,0], [0,-s,0]],
    [[s,0,0], [0,0,s], [-s,0,0], [0,0,-s]],
    [[0,s,0], [0,0,s], [0,-s,0], [0,0,-s]],
    [[s,0,0], [0,s,0], [0,0,s]],
    [[s,0,0], [0,0,-s], [0,s,0]],
    [[-s,0,0], [0,0,s], [0,s,0]],
    [[-s,0,0], [0,s,0], [0,0,-s]],
    [[s,0,0], [0,-s,0], [0,0,s]],
    [[s,0,0], [0,0,-s], [0,-s,0]],
    [[-s,0,0], [0,-s,0], [0,0,s]],
    [[-s,0,0], [0,0,-s], [0,-s,0]]
  ];

  beginShape(TRIANGLES);
  for (let face of squareFaces) {
    if (face.length === 4) {
      // Split quad into two triangles
      vertex(face[0][0], face[0][1], face[0][2]);
      vertex(face[1][0], face[1][1], face[1][2]);
      vertex(face[2][0], face[2][1], face[2][2]);
      vertex(face[0][0], face[0][1], face[0][2]);
      vertex(face[2][0], face[2][1], face[2][2]);
      vertex(face[3][0], face[3][1], face[3][2]);
    } else {
      vertex(face[0][0], face[0][1], face[0][2]);
      vertex(face[1][0], face[1][1], face[1][2]);
      vertex(face[2][0], face[2][1], face[2][2]);
    }
  }
  endShape();
}

// Torus knot segment
function drawTorusKnot(R, r, p, q) {
  let segments = 24;
  let tubeSegments = 6;

  for (let i = 0; i < segments; i++) {
    let t1 = map(i, 0, segments, 0, TWO_PI);
    let t2 = map(i + 1, 0, segments, 0, TWO_PI);

    beginShape(TRIANGLE_STRIP);
    for (let j = 0; j <= tubeSegments; j++) {
      let phi = map(j, 0, tubeSegments, 0, TWO_PI);

      for (let t of [t1, t2]) {
        let x = (R + r * cos(q * t)) * cos(p * t) + r * cos(phi) * cos(p * t);
        let y = r * sin(phi);
        let z = (R + r * cos(q * t)) * sin(p * t) + r * cos(phi) * sin(p * t);
        vertex(x, y, z);
      }
    }
    endShape();
  }
}

// Gyroid-inspired cell
function drawGyroidCell(size) {
  let res = 3;
  let s = size / res;

  for (let i = 0; i < res; i++) {
    for (let j = 0; j < res; j++) {
      let x = (i - res/2) * s;
      let z = (j - res/2) * s;
      let y = sin(x * 2 + time) * cos(z * 2 + time) * s * 0.5;

      push();
      translate(x, y, z);
      box(s * 0.6);
      pop();
    }
  }
}

// Organic blob using spherical harmonics approximation
function drawOrganicBlob(size, complexity) {
  push();
  let detail = 8;

  for (let i = 0; i < detail; i++) {
    for (let j = 0; j < detail; j++) {
      let theta = map(i, 0, detail, 0, PI);
      let phi = map(j, 0, detail, 0, TWO_PI);

      let r = size * (1 + 0.3 * sin(complexity * theta) * cos(complexity * phi + time));

      let x = r * sin(theta) * cos(phi);
      let y = r * cos(theta);
      let z = r * sin(theta) * sin(phi);

      push();
      translate(x, y, z);
      sphere(size * 0.15);
      pop();
    }
  }
  pop();
}

// Antiprism - two polygons connected by triangles
function drawAntiprism(radius, height, sides) {
  let twist = PI / sides;

  for (let i = 0; i < sides; i++) {
    let angle1 = (i / sides) * TWO_PI;
    let angle2 = ((i + 1) / sides) * TWO_PI;
    let midAngle = angle1 + twist;

    beginShape(TRIANGLES);
    // Upper triangle
    vertex(cos(angle1) * radius, -height/2, sin(angle1) * radius);
    vertex(cos(angle2) * radius, -height/2, sin(angle2) * radius);
    vertex(cos(midAngle) * radius, height/2, sin(midAngle) * radius);

    // Lower triangle
    vertex(cos(midAngle) * radius, height/2, sin(midAngle) * radius);
    vertex(cos(angle2) * radius, -height/2, sin(angle2) * radius);
    vertex(cos(midAngle + TWO_PI/sides) * radius, height/2, sin(midAngle + TWO_PI/sides) * radius);
    endShape();
  }
}

// Fibonacci sphere distribution for particles
function drawFibonacciSphere(count, radius, colors) {
  let goldenAngle = PI * (3 - sqrt(5));

  for (let i = 0; i < count; i++) {
    let t = i / count;
    let inclination = acos(1 - 2 * t);
    let azimuth = goldenAngle * i + time * 0.5;

    let x = sin(inclination) * cos(azimuth) * radius;
    let y = cos(inclination) * radius;
    let z = sin(inclination) * sin(azimuth) * radius;

    let pulseSize = 2 + sin(time * 3 + i * 0.1) * 1;

    push();
    translate(x, y, z);
    let col = color(colors[i % colors.length]);
    ambientMaterial(col);
    sphere(pulseSize);
    pop();
  }
}

// Helix ring secondary structure
function drawHelixRing(count, radius, angle, colors) {
  for (let i = 0; i < count; i++) {
    let t = i / count;
    let theta = t * TWO_PI * 3 + time;
    let helixAngle = i * angle + time * 0.7;

    let x = cos(theta) * radius * 0.8;
    let z = sin(theta) * radius * 0.8;
    let y = sin(helixAngle) * 80;

    let size = 3 + sin(time * 2 + i * 0.15) * 1.5;

    push();
    translate(x, y, z);
    rotateY(theta);
    let col = color(colors[i % colors.length]);
    ambientMaterial(col);

    if (i % 3 === 0) {
      drawOctahedron(size, size * 0.7);
    } else {
      box(size, size * 0.5, size * 0.5);
    }
    pop();
  }
}

// Orbiting particles for outer ring
function drawOrbitingParticles(count, radius, colors) {
  for (let i = 0; i < count; i++) {
    let orbitAngle = (i / count) * TWO_PI + time * 0.3;
    let verticalOffset = sin(time + i * 0.2) * 100;
    let radiusVariation = radius + sin(time * 2 + i * 0.4) * 30;

    let x = cos(orbitAngle) * radiusVariation;
    let z = sin(orbitAngle) * radiusVariation;
    let y = verticalOffset;

    let size = 2 + sin(time * 4 + i * 0.3) * 1;

    push();
    translate(x, y, z);
    rotateY(time + i);
    rotateX(time * 0.5);

    let col = color(colors[i % colors.length]);
    ambientMaterial(col);

    if (i % 4 === 0) {
      drawTetrahedron(size * 2);
    } else if (i % 4 === 1) {
      sphere(size);
    } else if (i % 4 === 2) {
      drawRing(size * 1.5, size * 0.5);
    } else {
      box(size);
    }
    pop();
  }
}
