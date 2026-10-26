// Capture — every way an MP4 leaves this sketch. WebCodecs H.264 + mp4-muxer@5.1.3, same as the rest of the series.
//  · exportAnimation()  the Reel: frames 0–239 rendered by index, deterministic and loop-exact (E / Export button).
//  · startRecording() / stopRecording()  live capture of whatever is on screen — orbit, sliders, speed —
//    timestamped by recorded frame count, auto-stops at one loop length like 20261020. Not loop-exact:
//    use Export for the posted Reel (R / Rec button).
// Uses W, H, FPS, LOOP, canvasEl, exporting, exportFrame and the UI helpers from sketch.js.
const REC_MAX_FRAMES = LOOP;
let recording = false, recEncoder = null, recMuxer = null, recFrameCount = 0, recDensity = 1, recError = null;

// ── Export: exactly LOOP frames, rendered by index, never by wall clock ─────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pickEncoderConfig() {
  // 1080×1920 at 60 fps needs H.264 level 4.2 (0x2A); level 4.0 (0x28) only covers it up to 30 fps.
  for (const codec of ["avc1.64002a", "avc1.640032", "avc1.640028", "avc1.4d002a"]) {
    const config = { codec, width: W, height: H, bitrate: 18_000_000, framerate: FPS };
    try { if ((await VideoEncoder.isConfigSupported(config)).supported) return config; } catch (e) { /* try next */ }
  }
  throw new Error("no H.264 encoder for " + W + "×" + H);
}
async function exportAnimation() {
  if (exporting || recording) return;
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") { setStatus("WebCodecs unavailable — use Chrome / Edge", "#f66"); return; }
  if (typeof Mp4Muxer === "undefined") { setStatus("mp4-muxer failed to load", "#f66"); return; }
  const density = pixelDensity();
  let encoder = null, encodeError = null, encoded = 0;
  exporting = true;
  window.__lastExport = null;
  lockUI(true);
  noLoop();
  try {
    if (density !== 1) pixelDensity(1);
    if (canvasEl.width !== W || canvasEl.height !== H) throw new Error("canvas is " + canvasEl.width + "×" + canvasEl.height);
    const config = await pickEncoderConfig();
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: "avc", width: W, height: H },
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });
    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { encodeError = e; },
    });
    encoder.configure(config);
    for (let f = 0; f < LOOP; f++) {
      if (encodeError) throw encodeError;
      exportFrame = f;
      redraw();
      const frame = new VideoFrame(canvasEl, { timestamp: Math.round(f * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
      encoder.encode(frame, { keyFrame: f % FPS === 0 });
      frame.close();
      encoded++;
      while (encoder.encodeQueueSize > 4) await sleep(1);
      if (f % 6 === 0 || f === LOOP - 1) {
        el("progressFill").style.width = ((f + 1) / LOOP * 100).toFixed(1) + "%";
        setStatus("Exporting " + (f + 1) + " / " + LOOP, "#fff");
        setText("frameInfo", f);
        await sleep(0);
      }
    }
    await encoder.flush();
    if (encodeError) throw encodeError;
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url;
    a.download = "boys_surface_" + getTimestamp() + ".mp4";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    window.__lastExport = { ok: true, frames: encoded, width: W, height: H, fps: FPS, codec: config.codec, bytes: blob.size };
    setStatus("Exported " + encoded + " frames · " + W + "×" + H + " · " + FPS + " fps", "#fff");
  } catch (err) {
    console.error("EXPORT", err);
    window.__lastExport = { ok: false, frames: encoded, error: String(err && err.message || err) };
    setStatus("Export failed: " + (err && err.message || err), "#f66");
  } finally {
    if (encoder && encoder.state !== "closed") encoder.close();
    exporting = false;
    if (density !== 1) pixelDensity(density);
    el("progressFill").style.width = "0%";
    lockUI(false);
    syncUI();
    loop();
  }
}

function getTimestamp() {
  const d = new Date(), pad = (v) => String(v).padStart(2, "0");
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "_" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}

window.exportAnimation = exportAnimation;


// ── Live recording: whatever draw() shows, one encoded frame per draw ──────────────────────────────
function toggleRecording() { recording ? stopRecording() : startRecording(); }
async function startRecording() {
  if (recording || exporting) return;
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") { setStatus("WebCodecs unavailable — use Chrome / Edge", "#f66"); return; }
  if (typeof Mp4Muxer === "undefined") { setStatus("mp4-muxer failed to load", "#f66"); return; }
  recDensity = pixelDensity();
  try {
    if (recDensity !== 1) pixelDensity(1);
    if (canvasEl.width !== W || canvasEl.height !== H) throw new Error("canvas is " + canvasEl.width + "×" + canvasEl.height);
    const config = await pickEncoderConfig();
    recMuxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: "avc", width: W, height: H },
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });
    recEncoder = new VideoEncoder({
      output: (chunk, meta) => recMuxer.addVideoChunk(chunk, meta),
      error: (e) => { recError = e; },
    });
    recEncoder.configure(config);
  } catch (err) {
    console.error("REC", err);
    recEncoder = recMuxer = null;
    if (recDensity !== 1) pixelDensity(recDensity);
    setStatus("Record failed: " + (err && err.message || err), "#f66");
    return;
  }
  // Start the take on frame 0 (the hero frame), like 20261020's recStartFrame reset; the next draw() is frame 0.
  previewFrame = 0;
  playing = true;
  recFrameCount = 0;
  recError = null;
  recording = true;
  window.__lastRecording = null;
  syncUI();
  setStatus("● Recording…", "#f66");
}

// Called from draw() right after renderScene(), so the frame is complete and the caption is on it.
function captureFrame() {
  if (!recording || !recEncoder) return;
  if (recError) { stopRecording(); return; }
  const frame = new VideoFrame(canvasEl, { timestamp: Math.round(recFrameCount * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
  recEncoder.encode(frame, { keyFrame: recFrameCount % FPS === 0 });
  frame.close();
  recFrameCount++;
  if (recFrameCount % 6 === 0) {
    el("progressFill").style.width = (recFrameCount / REC_MAX_FRAMES * 100).toFixed(1) + "%";
    setStatus("● Recording " + (recFrameCount / FPS).toFixed(1) + " s", "#f66");
  }
  if (recFrameCount >= REC_MAX_FRAMES) stopRecording();
}

async function stopRecording() {
  if (!recording) return;
  recording = false;
  const encoder = recEncoder, muxer = recMuxer, frames = recFrameCount;
  recEncoder = recMuxer = null;
  try {
    if (recError) throw recError;
    setStatus("Finalizing…", "#ccc");
    await encoder.flush();
    if (recError) throw recError;
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url;
    a.download = "boys_surface_live_" + getTimestamp() + ".mp4";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    window.__lastRecording = { ok: true, frames, width: W, height: H, fps: FPS, bytes: blob.size };
    setStatus("Recorded " + frames + " frames · " + (frames / FPS).toFixed(1) + " s", "#fff");
  } catch (err) {
    console.error("REC", err);
    window.__lastRecording = { ok: false, frames, error: String(err && err.message || err) };
    setStatus("Record failed: " + (err && err.message || err), "#f66");
  } finally {
    if (encoder && encoder.state !== "closed") encoder.close();
    if (recDensity !== 1) pixelDensity(recDensity);
    el("progressFill").style.width = "0%";
    syncUI();
  }
}

window.startRecording = startRecording;
window.stopRecording = stopRecording;
