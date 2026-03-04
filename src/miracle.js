import { SoundChip } from "./soundchip";
import { SMS } from "./sms";
import { showDebug, debugKeyPress } from "./debug";

let sms;

let running = false;

let canvas;
let ctx;
let imageData;
let fb8;
let fb32;

let soundChip;

const targetTimeout = 1000 / SMS.FRAMES_PER_SECOND;
let adjustedTimeout = targetTimeout;
let lastFrame = null;

export function cycleCallback(tstates) {
  soundChip.polltime(tstates);
}

function line() {
  if (sms.runLine(cycleCallback)) {
    running = false;
    showDebug(sms.pc);
  }
}

export function start() {
  sms.clearBreakpoint();
  if (running) return;
  running = true;
  document.getElementById("menu").className = "running";
  audio_enable(true);
  document.getElementById("debug").style.display = "none";
  run();
}

function run() {
  if (!running) {
    showDebug(sms.pc);
    return;
  }
  const now = Date.now();
  if (lastFrame) {
    // Try and tweak the timeout to achieve target frame rate.
    const timeSinceLast = now - lastFrame;
    if (timeSinceLast < 2 * targetTimeout) {
      // Ignore huge delays (e.g. trips in and out of the debugger)
      const diff = timeSinceLast - targetTimeout;
      adjustedTimeout -= 0.1 * diff;
      // Clamp to a sane range so adjustedTimeout can't drift negative (causing
      // run() to fire as fast as possible) or become uselessly large.
      adjustedTimeout = Math.max(
        1,
        Math.min(targetTimeout * 2, adjustedTimeout),
      );
    }
  }
  lastFrame = now;
  setTimeout(run, adjustedTimeout);

  try {
    for (let i = 0; i < SMS.SCAN_LINES_PER_FRAME && running; i++) line();
  } catch (e) {
    running = false;
    audio_enable(true);
    throw e;
  }
  if (running) audio_push_frame();
}

export function stop() {
  running = false;
  audio_enable(false);
}

let audioContext = null;
let _audioNode = null;
let _samplesPerFrame = 0;

function _showAudioBanner(msg) {
  const banner = document.getElementById("audio-warning");
  if (banner) {
    banner.textContent = msg;
    banner.style.display = "block";
  }
}

function _hideAudioBanner() {
  const banner = document.getElementById("audio-warning");
  if (banner) banner.style.display = "none";
}

function _checkAudioStatus() {
  if (!audioContext) return;
  if (audioContext.state === "suspended") {
    _showAudioBanner("🔈 Audio suspended — click here to enable sound");
  } else if (audioContext.state === "running") {
    _hideAudioBanner();
  }
}

function audio_init() {
  const AudioCtx =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : typeof webkitAudioContext !== "undefined"
        ? webkitAudioContext
        : null;

  if (!AudioCtx) {
    // No Web Audio API at all.
    soundChip = new SoundChip(10000, SMS.CPU_HZ);
    return;
  }

  audioContext = new AudioCtx();
  // Create soundChip immediately so audio_reset() works synchronously.
  soundChip = new SoundChip(audioContext.sampleRate, SMS.CPU_HZ);
  // Use floor so we never request more samples than the soundchip has actually
  // advanced (ceil would synthesise a phantom extra sample on non-integer rates
  // and cause long-term pitch drift). A fractional accumulator would be ideal
  // for exact rate matching but floor is safe and correct in practice.
  _samplesPerFrame = Math.floor(
    audioContext.sampleRate / SMS.FRAMES_PER_SECOND,
  );

  if (!audioContext.audioWorklet) {
    // AudioWorklet unavailable (non-secure context, old browser, etc.)
    console.log("AudioWorklet not available — no audio");
    _showAudioBanner(
      "⚠️ Audio unavailable — serve over https or use localhost",
    );
    audioContext.close();
    audioContext = null;
    _samplesPerFrame = 0; // Prevent audio_push_frame() doing work with no output
    return;
  }

  audioContext.onstatechange = () => _checkAudioStatus();
  _checkAudioStatus();

  // Async worklet setup; soundChip is already usable above.
  audioContext.audioWorklet
    .addModule("/audio-processor.js")
    .then(() => {
      _audioNode = new AudioWorkletNode(
        audioContext,
        "miracle-audio-processor",
        {
          numberOfOutputs: 1,
          outputChannelCount: [1],
          processorOptions: { samplesPerFrame: _samplesPerFrame },
        },
      );
      _audioNode.connect(audioContext.destination);
    })
    .catch((err) => {
      console.warn("Failed to load audio worklet:", err);
      _showAudioBanner("⚠️ Audio failed to load — see console for details");
      if (audioContext) audioContext.close();
      audioContext = null;
      _audioNode = null;
      _samplesPerFrame = 0; // Prevent audio_push_frame() doing work with no output
    });
}

function audio_push_frame() {
  if (!_samplesPerFrame) return;
  const buf = new Float32Array(_samplesPerFrame);
  // Always drain the soundchip's internal buffer every frame, regardless of
  // whether the worklet is ready yet. Skipping render() allows pending cycles
  // to accumulate and overflow the soundchip's internal cap, causing desynced
  // audio once the worklet eventually initialises.
  soundChip.render(buf, 0, buf.length);
  // Only push to the worklet while the context is actually running and the
  // node is ready. While suspended or still initialising we drain (above) but
  // discard the samples — otherwise they'd queue up and cause latency on resume.
  if (_audioNode && audioContext && audioContext.state === "running") {
    // Transfer the underlying ArrayBuffer to avoid a copy.
    _audioNode.port.postMessage({ buffer: buf }, [buf.buffer]);
  }
}

export function audio_enable(enable) {
  soundChip.enable(enable);
  // Only resume the AudioContext when actually enabling audio; calling
  // resume() while disabling would wrongly hide the suspended banner.
  if (enable && audioContext) audioContext.resume();
}

export function miracle_init(smsInstance) {
  sms = smsInstance;
  canvas = document.getElementById("screen");
  ctx = canvas.getContext("2d");
  if (ctx.getImageData) {
    imageData = ctx.getImageData(0, 0, 256, 192);
    fb8 = imageData.data;
    fb32 = new Uint32Array(fb8.buffer);
  } else {
    alert("Unsupported browser...");
    // Unsupported....
  }

  audio_init();
  sms.init(canvas, fb32, paintScreen, soundChip);
  miracle_reset();

  // Scale the canvas to fill its container while maintaining the native aspect ratio.
  // ResizeObserver fires whenever the container's size changes (initial layout,
  // window resize, panel show/hide, etc.) — more reliable than a one-shot setTimeout.
  function resizeCanvas() {
    const border = parseInt(window.getComputedStyle(canvas).borderWidth) || 0;
    const container = canvas.parentElement;
    const scale = Math.min(
      (container.clientWidth - border * 2) / canvas.width,
      (container.clientHeight - border * 2) / canvas.height,
    );
    if (scale > 0) {
      canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
      canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
    }
  }
  new ResizeObserver(resizeCanvas).observe(canvas.parentElement);
  resizeCanvas();

  document.onkeydown = keyDown;
  document.onkeyup = keyUp;
  document.onkeypress = keyPress;

  const audioBanner = document.getElementById("audio-warning");
  if (audioBanner) {
    audioBanner.addEventListener("click", () => {
      if (audioContext) audioContext.resume();
    });
  }
}

export function miracle_reset() {
  //inputMode = 7;
  sms.reset();
}

const keys = {
  87: 1, // W = JP1 up
  83: 2, // S = JP1 down
  65: 4, // A = JP1 left
  68: 8, // D = JP1 right
  32: 16, // Space = JP1 fire 1
  13: 32, // Enter = JP1 fire 2

  38: 1, // Arrow keys
  40: 2,
  37: 4,
  39: 8,
  90: 16, // Z/Y and X for fire
  89: 16,
  88: 32,

  82: 1 << 12, // R for reset button
};

function keyCode(evt) {
  return evt.which || evt.charCode || evt.keyCode;
}

function keyDown(evt) {
  if (!running) return;
  const key = keys[keyCode(evt)];
  if (key) {
    sms.joystick &= ~key;
    if (!evt.metaKey) {
      evt.preventDefault();
      return;
    }
  }
  switch (evt.keyCode) {
    case 80: // 'P' for pause
      sms.nmi();
      break;
    case 8: // 'Backspace' is debug
      breakpoint();
      evt.preventDefault();
      break;
  }
}

function keyUp(evt) {
  if (!running) return;
  const key = keys[keyCode(evt)];
  if (key) {
    sms.joystick |= key;
    if (!evt.metaKey) {
      evt.preventDefault();
    }
  }
}

function keyPress(evt) {
  if (!running) {
    return debugKeyPress(keyCode(evt));
  }
  if (!evt.metaKey) {
    evt.preventDefault();
  }
}

function paintScreen() {
  ctx.putImageData(imageData, 0, 0);
}

function breakpoint() {
  sms.triggerBreakpoint();
  audio_enable(false);
}
