
// Recording variables
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordingFrameCount = 0;
let recordingStartTime = 0;
const FPS = 60;
const MAX_DURATION = 15; // seconds
const MAX_FRAMES = FPS * MAX_DURATION;

// Start recording
function startRecording() {
  isRecording = true;
  recordingFrameCount = 0;
  recordedChunks = [];
  time = 0; // Reset animation
  recordingStartTime = Date.now();

  // Get canvas stream
  const canvas = document.querySelector('canvas');
  const stream = canvas.captureStream(FPS);

  // Try to use the best available codec
  let options = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 };

  // Check if vp9 is supported, otherwise use vp8
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 8000000 };
  }

  mediaRecorder = new MediaRecorder(stream, options);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '2d_grid_art.webm';
    a.click();
    URL.revokeObjectURL(url);

    document.getElementById('status').textContent = 'Download started! Convert to MP4 if needed.';
    document.getElementById('status').style.color = '#4caf50';

    setTimeout(() => {
      document.getElementById('status').textContent = 'Ready';
      document.getElementById('status').style.color = '#84bae7';
    }, 3000);
  };

  mediaRecorder.start();

  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('status').textContent = 'Recording...';
  document.getElementById('status').style.color = '#ff6b6b';
}

// Stop recording
function stopRecording() {
  if (mediaRecorder && isRecording) {
    isRecording = false;
    mediaRecorder.stop();

    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('status').textContent = 'Processing...';
    document.getElementById('status').style.color = '#84bae7';
  }
}

// Art variables
const W = 1080;
const H = 1920;
const TILE_SIZE = 120;
const COLS = W / TILE_SIZE;
const ROWS = H / TILE_SIZE;

let tiles = [];
let time = 0;

function setup() {
  createCanvas(W, H);
  frameRate(FPS);

  // Initialize tiles with random patterns
  for (let i = 0; i < ROWS; i++) {
    tiles[i] = [];
    for (let j = 0; j < COLS; j++) {
      tiles[i][j] = {
        type: floor(random(14)), // 14 different tile patterns
        rotation: random(4) * HALF_PI,
        speed: random(0.005, 0.02) * (random() > 0.5 ? 1 : -1),
        phase: random(TWO_PI)
      };
    }
  }
}

function draw() {
  background(255);

  // Draw grid of tiles
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      let x = j * TILE_SIZE;
      let y = i * TILE_SIZE;
      let tile = tiles[i][j];

      push();
      translate(x + TILE_SIZE/2, y + TILE_SIZE/2);

      // Animate rotation
      let currentRotation = tile.rotation + sin(time + tile.phase) * HALF_PI;
      rotate(currentRotation);

      // Draw tile pattern
      drawTilePattern(tile.type, TILE_SIZE);

      pop();
    }
  }

  time += 0.01;

  // Handle recording
  if (isRecording) {
    recordingFrameCount++;
    let elapsedSeconds = (Date.now() - recordingStartTime) / 1000;

    document.getElementById('frameCount').textContent = recordingFrameCount;
    document.getElementById('duration').textContent = elapsedSeconds.toFixed(1);

    if (elapsedSeconds >= MAX_DURATION) {
      stopRecording();
    }
  }
}

function drawTilePattern(type, size) {
  let s = size;
  let hs = s / 2;

  noFill();
  stroke(0);
  strokeWeight(2);

  switch(type) {
    case 0: // Quarter circles
      fill(0);
      noStroke();
      arc(-hs, -hs, s, s, 0, HALF_PI);
      arc(hs, hs, s, s, PI, PI + HALF_PI);
      break;

    case 1: // Diagonal split
      fill(0);
      noStroke();
      triangle(-hs, -hs, hs, -hs, -hs, hs);
      triangle(hs, -hs, hs, hs, -hs, hs);
      break;

    case 2: // Concentric circles
      noFill();
      stroke(0);
      for (let i = 1; i <= 3; i++) {
        circle(0, 0, (s * i) / 3);
      }
      break;

    case 3: // Diamond
      fill(0);
      noStroke();
      quad(0, -hs, hs, 0, 0, hs, -hs, 0);
      break;

    case 4: // Cross pattern
      fill(0);
      noStroke();
      rectMode(CENTER);
      rect(0, 0, s, s/3);
      rect(0, 0, s/3, s);
      break;

    case 5: // Arcs pattern
      noFill();
      stroke(0);
      strokeWeight(3);
      arc(-hs, -hs, s, s, 0, HALF_PI);
      arc(hs, -hs, s, s, HALF_PI, PI);
      arc(hs, hs, s, s, PI, PI + HALF_PI);
      arc(-hs, hs, s, s, PI + HALF_PI, TWO_PI);
      break;

    case 6: // Nested squares
      noFill();
      stroke(0);
      strokeWeight(2);
      rectMode(CENTER);
      for (let i = 1; i <= 4; i++) {
        rect(0, 0, (s * i) / 4);
      }
      break;

    case 7: // Radial lines
      stroke(0);
      strokeWeight(2);
      for (let i = 0; i < 8; i++) {
        let angle = (TWO_PI / 8) * i;
        let x2 = cos(angle) * hs;
        let y2 = sin(angle) * hs;
        line(0, 0, x2, y2);
      }
      break;

    case 8: // Triangular fan
      fill(0);
      noStroke();
      for (let i = 0; i < 4; i++) {
        if (i % 2 === 0) {
          let angle = (TWO_PI / 4) * i;
          push();
          rotate(angle);
          triangle(0, 0, hs, 0, hs/2, -hs);
          pop();
        }
      }
      break;

    case 9: // Hexagon
      fill(0);
      noStroke();
      beginShape();
      for (let i = 0; i < 6; i++) {
        let angle = (TWO_PI / 6) * i - HALF_PI;
        let x = cos(angle) * hs * 0.7;
        let y = sin(angle) * hs * 0.7;
        vertex(x, y);
      }
      endShape(CLOSE);
      break;

    case 10: // Zigzag pattern
      stroke(0);
      strokeWeight(3);
      noFill();
      let steps = 4;
      let stepSize = s / steps;
      beginShape();
      for (let i = 0; i <= steps; i++) {
        let x = -hs + (i * stepSize);
        let y = (i % 2 === 0) ? -hs : hs;
        vertex(x, y);
      }
      endShape();
      break;

    case 11: // Checkerboard
      fill(0);
      noStroke();
      rectMode(CORNER);
      let squares = 3;
      let sqSize = s / squares;
      for (let i = 0; i < squares; i++) {
        for (let j = 0; j < squares; j++) {
          if ((i + j) % 2 === 0) {
            rect(-hs + i * sqSize, -hs + j * sqSize, sqSize, sqSize);
          }
        }
      }
      break;

    case 12: // Striped triangles
      fill(0);
      noStroke();
      triangle(-hs, -hs, 0, -hs, -hs, 0);
      triangle(0, 0, hs, 0, hs, hs);
      triangle(-hs, 0, 0, 0, 0, hs);
      triangle(0, -hs, hs, -hs, hs, 0);
      break;

    case 13: // Corner circles
      fill(0);
      noStroke();
      let r = s * 0.4;
      circle(-hs, -hs, r);
      circle(hs, -hs, r);
      circle(hs, hs, r);
      circle(-hs, hs, r);
      break;
  }
}

// Regenerate pattern on click
function mousePressed() {
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      tiles[i][j] = {
        type: floor(random(14)),
        rotation: random(4) * HALF_PI,
        speed: random(0.005, 0.02) * (random() > 0.5 ? 1 : -1),
        phase: random(TWO_PI)
      };
    }
  }
}

// Keyboard controls
function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('grid_art', 'png');
  }
  if (key === ' ') {
    mousePressed(); // Regenerate on spacebar
  }
}
