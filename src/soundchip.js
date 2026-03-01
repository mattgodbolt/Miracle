// Pre-computed volume table (shared across all instances).
// 16 levels, −2 dB per step; level 15 is silence.
// Values are pre-scaled by 1/4 (four channels mixed).
const VOLUME_TABLE = (() => {
  const t = new Float64Array(16);
  let f = 1.0;
  for (let i = 0; i < 15; ++i) {
    t[i] = f / 4;
    f *= Math.pow(10, -0.1);
  }
  // t[15] left as 0 (silence) by default
  return t;
})();

const MAX_BUFFER_SIZE = 4096;

export class SoundChip {
  // Exposed for browser-console debugging (read-only intent).
  registers;
  volume;

  #sampleDecrement;
  #samplesPerCycle;
  #register;
  #counter;
  #outputBit;
  #lfsr = 1 << 15;
  #useWhiteNoise = true;
  #enabled = true;
  #cyclesPending = 0;
  #residual = 0;
  #position = 0;
  #buffer;
  #latchedChannel = 0;

  constructor(sampleRate, cpuHz) {
    const soundchipFreq = 3546893.0 / 16.0; // PAL
    this.#sampleDecrement = soundchipFreq / sampleRate;
    this.#samplesPerCycle = sampleRate / cpuHz;

    this.#register = new Int32Array(4);
    this.#counter = new Float64Array(4);
    this.#outputBit = new Uint8Array(4);
    this.volume = new Float64Array(4);
    this.registers = this.#register; // alias for debug

    this.#buffer = new Float64Array(MAX_BUFFER_SIZE);
  }

  // -------------------------------------------------------------------------
  // Tone channels (0–2)
  // -------------------------------------------------------------------------

  #toneChannel(channel, out, offset, length) {
    const reg = this.#register[channel],
      vol = this.volume[channel];
    // For jsbeeb 0 is treated as 1024. However, I found this
    // made things like Altered Beast's background music have
    // a low note play in the background.
    if (reg <= 1) {
      for (let i = 0; i < length; ++i) out[i + offset] += vol;
      return;
    }
    for (let i = 0; i < length; ++i) {
      this.#counter[channel] -= this.#sampleDecrement;
      if (this.#counter[channel] < 0) {
        this.#counter[channel] += reg;
        this.#outputBit[channel] ^= 1;
      }
      out[i + offset] += this.#outputBit[channel] ? vol : -vol;
    }
  }

  // -------------------------------------------------------------------------
  // Noise channel (3)
  // -------------------------------------------------------------------------

  #shiftLfsr() {
    if (this.#useWhiteNoise) {
      const bit = (this.#lfsr & 1) ^ ((this.#lfsr & 8) >> 3);
      this.#lfsr = (this.#lfsr >> 1) | (bit << 15);
    } else {
      this.#lfsr >>= 1;
      if (this.#lfsr === 0) this.#lfsr = 1 << 15;
    }
  }

  #noisePoked() {
    this.#useWhiteNoise = !!(this.#register[3] & 4);
    this.#lfsr = 1 << 15;
  }

  #addFor(channel) {
    switch (this.#register[channel] & 3) {
      case 0:
        return 0x10;
      case 1:
        return 0x20;
      case 2:
        return 0x40;
      case 3:
        return this.#register[channel - 1]; // tone-linked
    }
  }

  #noiseChannel(channel, out, offset, length) {
    const add = this.#addFor(channel),
      vol = this.volume[channel];
    for (let i = 0; i < length; ++i) {
      this.#counter[channel] -= this.#sampleDecrement;
      if (this.#counter[channel] < 0) {
        this.#counter[channel] += add;
        this.#outputBit[channel] ^= 1;
        if (this.#outputBit[channel]) this.#shiftLfsr();
      }
      out[i + offset] += this.#lfsr & 1 ? vol : -vol;
    }
  }

  // -------------------------------------------------------------------------
  // Rendering pipeline
  // -------------------------------------------------------------------------

  #generate(out, offset, length) {
    for (let i = 0; i < length; ++i) out[i + offset] = 0;
    if (!this.#enabled) return;
    for (let ch = 0; ch < 3; ++ch) this.#toneChannel(ch, out, offset, length);
    this.#noiseChannel(3, out, offset, length);
  }

  #advance(time) {
    const num = time * this.#samplesPerCycle + this.#residual;
    let rounded = num | 0;
    this.#residual = num - rounded;
    if (this.#position + rounded >= MAX_BUFFER_SIZE)
      rounded = MAX_BUFFER_SIZE - this.#position;
    if (rounded === 0) return;
    this.#generate(this.#buffer, this.#position, rounded);
    this.#position += rounded;
  }

  #catchUp() {
    if (this.#cyclesPending) this.#advance(this.#cyclesPending);
    this.#cyclesPending = 0;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  polltime(cycles) {
    this.#cyclesPending += cycles;
  }

  render(out, offset, length) {
    this.#catchUp();
    const fromBuffer = Math.min(this.#position, length);
    for (let i = 0; i < fromBuffer; ++i) out[offset + i] = this.#buffer[i];
    offset += fromBuffer;
    length -= fromBuffer;
    this.#buffer.copyWithin(0, fromBuffer, this.#position);
    this.#position -= fromBuffer;
    if (length !== 0) this.#generate(out, offset, length);
  }

  poke(value) {
    this.#catchUp();
    const latchData = !!(value & 0x80);
    if (latchData) this.#latchedChannel = (value >> 5) & 3;
    if ((value & 0x90) === 0x90) {
      // Volume setting
      this.volume[this.#latchedChannel] = VOLUME_TABLE[value & 0x0f];
    } else {
      // Data of some sort.
      if (this.#latchedChannel === 3) {
        // For noise channel we always update the bottom bits of the register.
        this.#register[3] = value & 0x0f;
        this.#noisePoked();
      } else if (latchData) {
        // Low 4 bits
        this.#register[this.#latchedChannel] =
          (this.#register[this.#latchedChannel] & ~0x0f) | (value & 0x0f);
      } else {
        // High bits
        this.#register[this.#latchedChannel] =
          (this.#register[this.#latchedChannel] & 0x0f) | ((value & 0x3f) << 4);
      }
    }
  }

  reset() {
    for (let i = 0; i < 3; ++i) {
      this.#counter[i] = this.volume[i] = this.#register[i] = 0;
    }
    this.#noisePoked();
    this.#advance(100000);
    this.#cyclesPending = 0;
  }

  enable(e) {
    this.#enabled = e;
  }

  mute() {
    this.#enabled = false;
  }

  unmute() {
    this.#enabled = true;
  }
}
