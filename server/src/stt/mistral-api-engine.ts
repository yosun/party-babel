import type { StreamingSTTEngine, STTSessionOpts, AudioFrame, STTDeltaEvent, STTFinalEvent, STTErrorEvent } from './interface.js';
import { config } from '../config.js';

/**
 * MistralAPIEngine: uses Mistral's cloud API for speech-to-text.
 * Batches PCM frames, encodes to WAV, sends to /v1/audio/transcriptions.
 */
export class MistralAPIEngine implements StreamingSTTEngine {
  readonly name = 'mistral-api';
  private sessions = new Map<string, { roomId: string; speakLang?: string }>();
  private deltaCallbacks: Array<(e: STTDeltaEvent) => void> = [];
  private finalCallbacks: Array<(e: STTFinalEvent) => void> = [];
  private errorCallbacks: Array<(e: STTErrorEvent) => void> = [];
  private audioBuffers = new Map<string, { chunks: Int16Array[]; tStartMs: number }>();

  async startSession(opts: STTSessionOpts): Promise<void> {
    this.sessions.set(opts.speakerId, { roomId: opts.roomId, speakLang: opts.speakLang });
    this.audioBuffers.set(opts.speakerId, { chunks: [], tStartMs: Date.now() });
  }

  pushAudioFrame(frame: AudioFrame): void {
    const buf = this.audioBuffers.get(frame.speakerId);
    if (!buf) return;
    buf.chunks.push(frame.pcm16);

    // Batch every ~480ms of audio (7680 samples at 16kHz)
    const totalSamples = buf.chunks.reduce((s, c) => s + c.length, 0);
    if (totalSamples >= 7680) {
      this.processChunk(frame.speakerId, buf).catch(err => {
        for (const cb of this.errorCallbacks) {
          cb({ speakerId: frame.speakerId, error: err instanceof Error ? err : new Error(String(err)) });
        }
      });
      this.audioBuffers.set(frame.speakerId, { chunks: [], tStartMs: Date.now() });
    }
  }

  private async processChunk(speakerId: string, buf: { chunks: Int16Array[]; tStartMs: number }): Promise<void> {
    const session = this.sessions.get(speakerId);
    if (!session) return;

    // Merge PCM chunks
    const totalLen = buf.chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Int16Array(totalLen);
    let offset = 0;
    for (const chunk of buf.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Encode as WAV (16kHz, mono, 16-bit PCM)
    const wavBuffer = encodeWav(merged, 16000);

    try {
      const formData = new FormData();
      formData.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
      formData.append('model', 'mistral-small-latest');

      const resp = await fetch(`${config.MISTRAL_API_URL}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.MISTRAL_API_KEY}`,
        },
        body: formData,
      });

      if (!resp.ok) {
        throw new Error(`Mistral API transcription failed: ${resp.status} ${await resp.text()}`);
      }

      const data = await resp.json() as { text?: string };
      const text = data.text?.trim();

      if (text) {
        for (const cb of this.deltaCallbacks) {
          cb({ speakerId, text, tMs: Date.now() });
        }
        for (const cb of this.finalCallbacks) {
          cb({
            speakerId,
            text,
            tStartMs: buf.tStartMs,
            tEndMs: Date.now(),
          });
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        for (const cb of this.errorCallbacks) {
          cb({ speakerId, error: err });
        }
      }
    }
  }

  async stopSession(opts: { speakerId: string }): Promise<void> {
    // Flush remaining audio
    const buf = this.audioBuffers.get(opts.speakerId);
    if (buf && buf.chunks.length > 0) {
      await this.processChunk(opts.speakerId, buf);
    }
    this.sessions.delete(opts.speakerId);
    this.audioBuffers.delete(opts.speakerId);
  }

  onDelta(cb: (event: STTDeltaEvent) => void): void { this.deltaCallbacks.push(cb); }
  onFinal(cb: (event: STTFinalEvent) => void): void { this.finalCallbacks.push(cb); }
  onError(cb: (event: STTErrorEvent) => void): void { this.errorCallbacks.push(cb); }
}

/** Encode raw PCM s16le samples into a WAV buffer */
function encodeWav(samples: Int16Array, sampleRate: number): ArrayBuffer {
  const byteLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + byteLength);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + byteLength, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);           // chunk size
  view.setUint16(20, 1, true);            // PCM format
  view.setUint16(22, 1, true);            // mono
  view.setUint32(24, sampleRate, true);    // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);            // block align
  view.setUint16(34, 16, true);           // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, byteLength, true);

  // Write samples
  const output = new Int16Array(buffer, 44);
  output.set(samples);

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
