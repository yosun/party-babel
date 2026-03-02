import { DEMO_SCRIPT } from '@voxtral-flow/shared';
import { broadcastToRoom, getOrCreateRoom, addUserToRoom } from './ws/rooms.js';
import { translateForRoom } from './translation/index.js';
import { extractAndPatch } from './semantics/index.js';
import { nanoid } from 'nanoid';
import type { WebSocket } from 'ws';

/**
 * Simulate a conversation: drives the same pipeline as real audio
 * (commit detector → translation → semantics) without a real mic.
 */
export function simulateConversation(roomId: string): void {
  const room = getOrCreateRoom(roomId, 'per_user_mic');
  room.visualizeEnabled = true;

  // Add simulated speakers to the room so translations actually find target languages
  const added = new Set<string>();
  for (const u of DEMO_SCRIPT) {
    if (!added.has(u.speakerId)) {
      added.add(u.speakerId);
      addUserToRoom(room, {
        userId: u.speakerId,
        displayName: u.displayName,
        speakLang: u.speakLang,
        targetLang: u.targetLang ?? u.speakLang,
        connId: `sim-${u.speakerId}`,
        ws: { readyState: 0, send() {} } as unknown as WebSocket,
      });
    }
  }

  // Schedule each utterance
  for (const utterance of DEMO_SCRIPT) {
    setTimeout(() => {
      const utteranceId = nanoid(16);
      const tMs = Date.now();

      broadcastToRoom(roomId, {
        type: 'transcript_delta',
        roomId,
        speakerId: utterance.speakerId,
        text: utterance.text,
        tMs,
      });

      broadcastToRoom(roomId, {
        type: 'utterance_commit',
        roomId,
        speakerId: utterance.speakerId,
        utteranceId,
        text: utterance.text,
        tStartMs: tMs,
        tEndMs: tMs + 1500,
        langGuess: utterance.speakLang,
      });

      // Fire-and-forget with proper error handling
      Promise.all([
        translateForRoom(roomId, utterance.speakerId, utteranceId, utterance.text, utterance.speakLang),
        extractAndPatch(roomId, utteranceId, utterance.text),
      ]).catch(err => console.error('[simulate] Error:', err));
    }, utterance.delayMs);
  }
}
