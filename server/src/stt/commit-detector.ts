import { nanoid } from 'nanoid';

export interface CommitEvent {
  roomId: string;
  speakerId: string;
  utteranceId: string;
  text: string;
  tStartMs: number;
  tEndMs: number;
  langGuess?: string;
}

interface SpeakerBuffer {
  roomId: string;
  speakerId: string;
  text: string;
  tStartMs: number;
  lastDeltaAt: number;
}

type CommitCallback = (event: CommitEvent) => void | Promise<void>;

const PUNCTUATION_RE = /[.!?]$/;
const IDLE_TIMEOUT_MS = 600;
const MAX_BUFFER_CHARS = 140;
const FLUSH_CHECK_INTERVAL_MS = 200;

class CommitDetector {
  private buffers = new Map<string, SpeakerBuffer>();
  private callbacks: CommitCallback[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startFlushTimer();
  }

  onCommit(cb: CommitCallback): void {
    this.callbacks.push(cb);
  }

  /** Called from STT engine on each delta */
  pushDelta(roomId: string, speakerId: string, text: string, tMs: number): void {
    let buf = this.buffers.get(speakerId);
    if (!buf) {
      buf = { roomId, speakerId, text: '', tStartMs: tMs, lastDeltaAt: tMs };
      this.buffers.set(speakerId, buf);
    }
    buf.text += (buf.text ? ' ' : '') + text;
    buf.lastDeltaAt = tMs;
    buf.roomId = roomId;

    // Check punctuation boundary or buffer overflow
    if (PUNCTUATION_RE.test(buf.text.trim()) || buf.text.length > MAX_BUFFER_CHARS) {
      this.commit(speakerId);
    }
  }

  /** Called from STT engine on final segment */
  pushFinal(roomId: string, speakerId: string, text: string, tStartMs: number, tEndMs: number, langGuess?: string): void {
    // Commit any buffered text plus the final
    const buf = this.buffers.get(speakerId);
    const fullText = buf ? (buf.text + ' ' + text).trim() : text;
    const startMs = buf ? buf.tStartMs : tStartMs;

    this.buffers.delete(speakerId);

    if (fullText.length === 0) return;

    const event: CommitEvent = {
      roomId,
      speakerId,
      utteranceId: nanoid(16),
      text: fullText,
      tStartMs: startMs,
      tEndMs,
      langGuess,
    };
    this.emit(event);
  }

  /** Force-commit a speaker buffer (e.g., on disconnect) */
  flush(speakerId: string): void {
    if (this.buffers.has(speakerId)) {
      this.commit(speakerId);
    }
  }

  private commit(speakerId: string): void {
    const buf = this.buffers.get(speakerId);
    if (!buf || buf.text.trim().length === 0) {
      this.buffers.delete(speakerId);
      return;
    }

    const event: CommitEvent = {
      roomId: buf.roomId,
      speakerId,
      utteranceId: nanoid(16),
      text: buf.text.trim(),
      tStartMs: buf.tStartMs,
      tEndMs: buf.lastDeltaAt,
    };
    this.buffers.delete(speakerId);
    this.emit(event);
  }

  private emit(event: CommitEvent): void {
    for (const cb of this.callbacks) {
      try {
        const result = cb(event);
        if (result instanceof Promise) {
          result.catch(() => {});
        }
      } catch {
        // swallow sync callback errors to not break the pipeline
      }
    }
  }

  private startFlushTimer(): void {
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const [speakerId, buf] of this.buffers) {
        if (now - buf.lastDeltaAt >= IDLE_TIMEOUT_MS && buf.text.trim().length > 0) {
          this.commit(speakerId);
        }
      }
    }, FLUSH_CHECK_INTERVAL_MS);
  }

  destroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.buffers.clear();
  }
}

export const commitDetector = new CommitDetector();
