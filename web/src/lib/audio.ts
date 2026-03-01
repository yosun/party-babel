/**
 * Audio capture utilities: captures mic audio, resamples to 16kHz mono,
 * and provides PCM s16le base64 frames via AudioWorklet.
 */

const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
    this._frameSize = 1600; // default 100ms at 16kHz
    this.port.onmessage = (e) => {
      if (e.data.frameSize) this._frameSize = e.data.frameSize;
    };
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    const merged = new Float32Array(this._buffer.length + input.length);
    merged.set(this._buffer);
    merged.set(input, this._buffer.length);
    this._buffer = merged;
    while (this._buffer.length >= this._frameSize) {
      const frame = this._buffer.slice(0, this._frameSize);
      this._buffer = this._buffer.slice(this._frameSize);
      this.port.postMessage(frame);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

export async function startAudioCapture(
  onFrame: (pcm16_base64: string, seq: number) => void,
  frameMs: number = 100,
): Promise<{ stop: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  const ctx = new AudioContext({ sampleRate: 16000 });
  // Ensure the context is running (browsers may suspend by default)
  if (ctx.state !== 'running') {
    console.warn('[audio] AudioContext state:', ctx.state, '— resuming');
    await ctx.resume();
  }
  console.warn('[audio] AudioContext ready, sampleRate:', ctx.sampleRate);

  const source = ctx.createMediaStreamSource(stream);
  const frameSize = Math.round(16000 * frameMs / 1000);

  // Register AudioWorklet from inline code
  const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
  const workletUrl = URL.createObjectURL(blob);
  await ctx.audioWorklet.addModule(workletUrl);
  URL.revokeObjectURL(workletUrl);

  const workletNode = new AudioWorkletNode(ctx, 'pcm-processor');
  workletNode.port.postMessage({ frameSize });

  let seq = 0;
  workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
    const int16 = float32ToInt16(e.data);
    const base64 = arrayBufferToBase64(int16.buffer as ArrayBuffer);
    if (seq % 50 === 0) console.warn('[audio] frame', seq, 'len:', int16.length);
    onFrame(base64, seq++);
  };

  source.connect(workletNode);
  // Connect to destination so the audio graph stays active
  workletNode.connect(ctx.destination);

  console.warn('[audio] Capture started, frameSize:', frameSize);
  return {
    stop: () => {
      console.warn('[audio] Capture stopped after', seq, 'frames');
      workletNode.disconnect();
      source.disconnect();
      ctx.close();
      stream.getTracks().forEach(t => t.stop());
    },
  };
}

function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
