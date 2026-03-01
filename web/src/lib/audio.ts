/**
 * Audio capture utilities: captures mic audio, resamples to 16kHz mono,
 * and provides PCM s16le base64 frames.
 */

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
  const source = ctx.createMediaStreamSource(stream);
  const bufferSize = Math.round(16000 * frameMs / 1000);

  // Use ScriptProcessorNode (deprecated but universally supported)
  const processor = ctx.createScriptProcessor(
    nearestPow2(bufferSize),
    1,
    1,
  );

  let seq = 0;

  processor.onaudioprocess = (e) => {
    const float32 = e.inputBuffer.getChannelData(0);
    const int16 = float32ToInt16(float32);
    const base64 = arrayBufferToBase64(int16.buffer as ArrayBuffer);
    onFrame(base64, seq++);
  };

  source.connect(processor);
  processor.connect(ctx.destination);

  return {
    stop: () => {
      processor.disconnect();
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

function nearestPow2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(256, n))));
}
