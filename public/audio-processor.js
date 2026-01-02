// Minimal AudioWorklet processor that collects float samples and posts them to main thread.

class AudioProcessor extends AudioWorkletProcessor {
    // target buffer length before posting
    constructor() {
        super();
        this.bufferSize = 1200; // ~50ms @24kHz (actual ms depends on sampleRate)
        this._buffer = new Float32Array(this.bufferSize);
        this._index = 0;
    }

    process(inputs) {
        const input = inputs[0];
        if (input && input[0]) {
            const channelData = input[0];
            for (let i = 0; i < channelData.length; i++) {
                this._buffer[this._index++] = channelData[i];
                if (this._index >= this.bufferSize) {
                    // Post a copy of the float32 buffer to main thread
                    this.port.postMessage(this._buffer.slice(0).buffer, [this._buffer.slice(0).buffer]);
                    this._index = 0;
                }
            }
        }
        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
