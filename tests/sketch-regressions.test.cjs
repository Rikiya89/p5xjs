const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function loadSketch(folder, globals = {}) {
  const context = vm.createContext(globals);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', folder, 'sketch.js'), 'utf8'), context);
  return context;
}

for (const folder of ['20260205', '20260219', '20260406']) {
  test(`${folder} retains its p5 initialization and animation entry points`, () => {
    const sketch = loadSketch(folder);
    assert.equal(typeof sketch.setup, 'function');
    assert.equal(typeof sketch.draw, 'function');
  });
}

test('20260406 captures an HTML canvas directly and advances frame timestamps', () => {
  const canvas = {}; // HTMLCanvasElement has no transferToImageBitmap method.
  const frames = [];
  const encoded = [];
  const sketch = loadSketch('20260406', {
    document: { querySelector: () => canvas },
    VideoFrame: class {
      constructor(source, options) {
        assert.equal(source, canvas);
        this.options = options;
        this.closed = false;
        frames.push(this);
      }
      close() { this.closed = true; }
    },
    testEncoder: { encode: (frame, options) => encoded.push({ frame, options }) },
  });
  vm.runInContext('encoder = testEncoder; recording = true;', sketch);
  sketch.captureFrame();
  sketch.captureFrame();
  assert.equal(encoded.length, 2);
  assert.equal(frames[0].options.timestamp, 0);
  assert.equal(frames[1].options.timestamp, 1_000_000 / 60);
  assert.equal(encoded[0].options.keyFrame, true);
  assert.ok(frames.every(frame => frame.closed));
  assert.equal(vm.runInContext('recFrameCount', sketch), 2);
});
