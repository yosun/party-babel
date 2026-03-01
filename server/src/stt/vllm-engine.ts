import type { StreamingSTTEngine, STTSessionOpts, AudioFrame, STTDeltaEvent, STTFinalEvent, STTErrorEvent } from './interface.js';
import { config } from '../config.js';

/**
 * VLLMRealtimeEngine: connects to a vLLM server serving Voxtral Realtime.
 * Communicates via HTTP POST with streaming response.
 */
export class VLLMRealtimeEngine implements StreamingSTTEngine {
  readonly name = 'vllm';
  private sessions = new Map<string, { roomId: string; controller?: AbortController }>();
  private deltaCallbacks: Array<(e: STTDeltaEvent) => void> = [];
  private finalCallbacks: Array<(e: STTFinalEvent) => void> = [];
  private errorCallbacks: Array<(e: STTErrorEvent) => void> = [];
  private audioBuffers = new Map<string, { chunks: Int16Array[]; tStartMs: number }>();

  async startSession(opts: STTSessionOpts): Promise<void> {
    this.sessions.set(opts.speakerId, { roomId: opts.roomId });
    this.audioBuffers.set(opts.speakerId, { chunks: [], tStartMs: Date.now() });
  }

  pushAudioFrame(frame: AudioFrame): void {
    const buf = this.audioBuffers.get(frame.speakerId);
    if (!buf) return;
    buf.chunks.push(frame.pcm16);

    // Batch and send every ~480ms worth of audio (7680 samples at 16kHz)
    const totalSamples = buf.chunks.reduce((s, c) => s + c.length, 0);
    if (totalSamples >= 7680) {
      this.processChunk(frame.speakerId, buf);
      this.audioBuffers.set(frame.speakerId, { chunks: [], tStartMs: Date.now() });
    }
  }

  private async processChunk(speakerId: string, buf: { chunks: Int16Array[]; tStartMs: number }): Promise<void> {
    const session = this.sessions.get(speakerId);
    if (!session) return;

    const totalLen = buf.chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Int16Array(totalLen);
    let offset = 0;
    for (const chunk of buf.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const pcmBase64 = Buffer.from(merged.buffer, merged.byteOffset, merged.byteLength).toString('base64');

    try {
      const controller = new AbortController();
      session.controller = controller;

      const resp = await fetch(config.VLLM_REALTIME_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: pcmBase64,
          sample_rate: 16000,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`vLLM returned ${resp.status}: ${await resp.text()}`);
      }

      const text = await resp.text();
      // Parse streaming SSE or plain text response
      const lines = text.split('\n').filter(l => l.trim());
      let fullText = '';

      for (const line of lines) {
        const cleaned = line.startsWith('data: ') ? line.slice(6) : line;
        try {
          const parsed = JSON.parse(cleaned);
          if (parsed.text) {
            fullText += parsed.text;
            for (const cb of this.deltaCallbacks) {
              cb({ speakerId, text: parsed.text, tMs: Date.now() });
            }
          }
        } catch {
          // Plain text response
          fullText += cleaned;
          for (const cb of this.deltaCallbacks) {
            cb({ speakerId, text: cleaned, tMs: Date.now() });
          }
        }
      }

      if (fullText.trim()) {
        for (const cb of this.finalCallbacks) {
          cb({
            speakerId,
            text: fullText.trim(),
            tStartMs: buf.tStartMs,
            tEndMs: Date.now(),
          });
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        for (const cb of this.errorCallbacks) {
          cb({ speakerId, error: err });
        }
      }
    }
  }

  async stopSession(opts: { speakerId: string }): Promise<void> {
    const session = this.sessions.get(opts.speakerId);
    if (session?.controller) session.controller.abort();
    this.sessions.delete(opts.speakerId);
    this.audioBuffers.delete(opts.speakerId);
  }

  onDelta(cb: (event: STTDeltaEvent) => void): void { this.deltaCallbacks.push(cb); }
  onFinal(cb: (event: STTFinalEvent) => void): void { this.finalCallbacks.push(cb); }
  onError(cb: (event: STTErrorEvent) => void): void { this.errorCallbacks.push(cb); }
}
