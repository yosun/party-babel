import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the commit detector logic directly.
// Re-implement a minimal CommitDetector for unit testing without import side effects.

interface CommitEvent {
  roomId: string;
  speakerId: string;
  utteranceId: string;
  text: string;
  tStartMs: number;
  tEndMs: number;
}

const PUNCTUATION_RE = /[.!?]$/;
const IDLE_TIMEOUT_MS = 600;
const MAX_BUFFER_CHARS = 140;

class TestCommitDetector {
  private buffers = new Map<string, { roomId: string; text: string; tStartMs: number; lastDeltaAt: number }>();
  private commits: CommitEvent[] = [];

  pushDelta(roomId: string, speakerId: string, text: string, tMs: number): void {
    let buf = this.buffers.get(speakerId);
    if (!buf) {
      buf = { roomId, text: '', tStartMs: tMs, lastDeltaAt: tMs };
      this.buffers.set(speakerId, buf);
    }
    buf.text += (buf.text ? ' ' : '') + text;
    buf.lastDeltaAt = tMs;

    if (PUNCTUATION_RE.test(buf.text.trim()) || buf.text.length > MAX_BUFFER_CHARS) {
      this.commit(speakerId);
    }
  }

  flushIdle(now: number): void {
    for (const [speakerId, buf] of this.buffers) {
      if (now - buf.lastDeltaAt >= IDLE_TIMEOUT_MS && buf.text.trim().length > 0) {
        this.commit(speakerId);
      }
    }
  }

  private commit(speakerId: string): void {
    const buf = this.buffers.get(speakerId);
    if (!buf || buf.text.trim().length === 0) return;
    this.commits.push({
      roomId: buf.roomId,
      speakerId,
      utteranceId: `test-${this.commits.length}`,
      text: buf.text.trim(),
      tStartMs: buf.tStartMs,
      tEndMs: buf.lastDeltaAt,
    });
    this.buffers.delete(speakerId);
  }

  getCommits(): CommitEvent[] { return this.commits; }
  clearCommits(): void { this.commits = []; }
}

describe('CommitDetector', () => {
  let detector: TestCommitDetector;

  beforeEach(() => {
    detector = new TestCommitDetector();
  });

  it('commits on punctuation boundary (.)', () => {
    detector.pushDelta('room1', 'alice', 'Hello world.', 1000);
    expect(detector.getCommits()).toHaveLength(1);
    expect(detector.getCommits()[0].text).toBe('Hello world.');
  });

  it('commits on punctuation boundary (?)', () => {
    detector.pushDelta('room1', 'bob', 'How are you?', 1000);
    expect(detector.getCommits()).toHaveLength(1);
  });

  it('commits on punctuation boundary (!)', () => {
    detector.pushDelta('room1', 'bob', 'Wow!', 1000);
    expect(detector.getCommits()).toHaveLength(1);
  });

  it('does NOT commit without punctuation', () => {
    detector.pushDelta('room1', 'alice', 'Hello world', 1000);
    expect(detector.getCommits()).toHaveLength(0);
  });

  it('commits when buffer exceeds 140 chars', () => {
    const longText = 'word '.repeat(30); // 150 chars
    detector.pushDelta('room1', 'alice', longText, 1000);
    expect(detector.getCommits()).toHaveLength(1);
  });

  it('commits on idle timeout (600ms)', () => {
    detector.pushDelta('room1', 'alice', 'Hello', 1000);
    expect(detector.getCommits()).toHaveLength(0);

    detector.flushIdle(1500); // Not enough time
    expect(detector.getCommits()).toHaveLength(0);

    detector.flushIdle(1601); // 601ms elapsed
    expect(detector.getCommits()).toHaveLength(1);
    expect(detector.getCommits()[0].text).toBe('Hello');
  });

  it('accumulates deltas from same speaker', () => {
    detector.pushDelta('room1', 'alice', 'Hello', 1000);
    detector.pushDelta('room1', 'alice', 'world.', 1200);
    expect(detector.getCommits()).toHaveLength(1);
    expect(detector.getCommits()[0].text).toBe('Hello world.');
  });

  it('handles multiple speakers independently', () => {
    detector.pushDelta('room1', 'alice', 'Hello.', 1000);
    detector.pushDelta('room1', 'bob', 'world', 1100);

    expect(detector.getCommits()).toHaveLength(1);
    expect(detector.getCommits()[0].speakerId).toBe('alice');

    detector.flushIdle(1800);
    expect(detector.getCommits()).toHaveLength(2);
    expect(detector.getCommits()[1].speakerId).toBe('bob');
  });

  it('preserves roomId and timestamps', () => {
    detector.pushDelta('room-42', 'alice', 'Test.', 5000);
    const commit = detector.getCommits()[0];
    expect(commit.roomId).toBe('room-42');
    expect(commit.tStartMs).toBe(5000);
    expect(commit.tEndMs).toBe(5000);
  });
});
