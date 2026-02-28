/*global sampleRate, AudioWorkletProcessor, registerProcessor*/
/**
 * AudioWorkletProcessor for Miracle.
 * Accepts Float32Array buffers pushed from the main thread and outputs them.
 * Holds a small FIFO queue; drops oldest data if the queue grows too large.
 */
class MiracleAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this._queue = [];
    this._queueSamples = 0;
    this._lastSample = 0;
    // Cap queue at ~250ms to prevent runaway buffering
    this._maxQueueSamples = Math.ceil(sampleRate * 0.25);

    this.port.onmessage = (event) => {
      const buf = event.data.buffer;
      this._queue.push({ data: buf, offset: 0 });
      this._queueSamples += buf.length;
      // Drop oldest entries when over budget
      while (
        this._queueSamples > this._maxQueueSamples &&
        this._queue.length > 0
      ) {
        const dropped = this._queue.shift();
        this._queueSamples -= dropped.data.length - dropped.offset;
      }
    };
  }

  process(_inputs, outputs) {
    const channel = outputs[0][0];
    for (let i = 0; i < channel.length; i++) {
      if (this._queue.length > 0) {
        const item = this._queue[0];
        this._lastSample = item.data[item.offset++];
        this._queueSamples--;
        if (item.offset >= item.data.length) {
          this._queue.shift();
        }
      }
      // If queue is empty, repeat last sample (avoids clicks)
      channel[i] = this._lastSample;
    }
    return true;
  }
}

registerProcessor("miracle-audio-processor", MiracleAudioProcessor);
