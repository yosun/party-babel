import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StreamingSTTEngine, STTSessionOpts, AudioFrame, STTDeltaEvent, STTFinalEvent, STTErrorEvent } from './interface.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface WorkerSession {
  roomId: string;
  speakerId: string;
  speakLang?: string;
}

/**
 * TransformersVoxtralEngine: spawns a Python worker that does real
 * Voxtral inference via HuggingFace Transformers.
 * IPC: newline-delimited JSON over stdin/stdout.
 */
export class TransformersVoxtralEngine implements StreamingSTTEngine {
  readonly name = 'transformers';
  private worker: ChildProcess | null = null;
  private sessions = new Map<string, WorkerSession>();
  private deltaCallbacks: Array<(e: STTDeltaEvent) => void> = [];
  private finalCallbacks: Array<(e: STTFinalEvent) => void> = [];
  private errorCallbacks: Array<(e: STTErrorEvent) => void> = [];
  private workerReady = false;

  constructor() {
    this.spawnWorker();
  }

  private spawnWorker(): void {
    const workerPath = path.resolve(__dirname, '../../workers/voxtral_worker.py');

    this.worker = spawn('python3', [workerPath], {
      env: {
        ...process.env,
        VOXTRAL_MODEL_ID: config.VOXTRAL_MODEL_ID,
        TRANSCRIPTION_DELAY_MS: String(config.TRANSCRIPTION_DELAY_MS),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (this.worker.stdout) {
      const rl = createInterface({ input: this.worker.stdout });
      rl.on('line', (line) => {
        try {
          const msg = JSON.parse(line);
          this.handleWorkerMessage(msg);
        } catch {
          // ignore non-JSON output
        }
      });
    }

    if (this.worker.stderr) {
      this.worker.stderr.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text.includes('WORKER_READY')) {
          this.workerReady = true;
        }
        if (text && !text.includes('WORKER_READY')) {
          // Log stderr but don't treat as fatal
          console.error(`[voxtral-worker] ${text}`);
        }
      });
    }

    this.worker.on('exit', (code) => {
      console.error(`[voxtral-worker] exited with code ${code}`);
      this.workerReady = false;
      // Retry after a delay
      setTimeout(() => this.spawnWorker(), 5000);
    });

    this.worker.on('error', (err) => {
      console.error(`[voxtral-worker] spawn error:`, err.message);
      this.workerReady = false;
    });
  }

  private handleWorkerMessage(msg: { type: string; speakerId: string; text?: string; tMs?: number; tStartMs?: number; tEndMs?: number; langGuess?: string }): void {
    switch (msg.type) {
      case 'delta':
        for (const cb of this.deltaCallbacks) {
          cb({ speakerId: msg.speakerId, text: msg.text || '', tMs: msg.tMs || Date.now() });
        }
        break;
      case 'final':
        for (const cb of this.finalCallbacks) {
          cb({
            speakerId: msg.speakerId,
            text: msg.text || '',
            tStartMs: msg.tStartMs || 0,
            tEndMs: msg.tEndMs || Date.now(),
            langGuess: msg.langGuess,
          });
        }
        break;
      case 'error':
        for (const cb of this.errorCallbacks) {
          cb({ speakerId: msg.speakerId, error: new Error(msg.text || 'Worker error') });
        }
        break;
    }
  }

  private sendToWorker(msg: object): void {
    if (this.worker?.stdin?.writable) {
      this.worker.stdin.write(JSON.stringify(msg) + '\n');
    }
  }

  async startSession(opts: STTSessionOpts): Promise<void> {
    this.sessions.set(opts.speakerId, {
      roomId: opts.roomId,
      speakerId: opts.speakerId,
      speakLang: opts.speakLang,
    });
    this.sendToWorker({
      type: 'start_session',
      speakerId: opts.speakerId,
      speakLang: opts.speakLang,
    });
  }

  pushAudioFrame(frame: AudioFrame): void {
    const pcm16Buf = Buffer.from(frame.pcm16.buffer, frame.pcm16.byteOffset, frame.pcm16.byteLength);
    this.sendToWorker({
      type: 'audio',
      speakerId: frame.speakerId,
      pcm16_base64: pcm16Buf.toString('base64'),
      sample_rate: 16000,
      tMs: frame.tMs,
    });
  }

  async stopSession(opts: { speakerId: string }): Promise<void> {
    this.sessions.delete(opts.speakerId);
    this.sendToWorker({ type: 'stop_session', speakerId: opts.speakerId });
  }

  onDelta(cb: (event: STTDeltaEvent) => void): void { this.deltaCallbacks.push(cb); }
  onFinal(cb: (event: STTFinalEvent) => void): void { this.finalCallbacks.push(cb); }
  onError(cb: (event: STTErrorEvent) => void): void { this.errorCallbacks.push(cb); }

  isReady(): boolean { return this.workerReady; }
}
