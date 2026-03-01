import { DEMO_SCRIPT } from '@party-babel/shared';
import { commitDetector } from './stt/commit-detector.js';
import { broadcastToRoom, getOrCreateRoom, addUserToRoom, getRoomState, getRoom } from './ws/rooms.js';
import { translateForRoom } from './translation/index.js';
import { extractAndPatch } from './semantics/index.js';
import { nanoid } from 'nanoid';

/**
 * Simulate a conversation: drives the same pipeline as real audio
 * (commit detector → translation → semantics) without a real mic.
 */
export function simulateConversation(roomId: string): void {
  // Create the room if needed
  const room = getOrCreateRoom(roomId, 'per_user_mic');
  room.visualizeEnabled = true;

  // Register simulated speakers (without real WS connections)
  const speakers = new Map<string, { displayName: string; speakLang: string }>();
  for (const u of DEMO_SCRIPT) {
    if (!speakers.has(u.speakerId)) {
      speakers.set(u.speakerId, { displayName: u.displayName, speakLang: u.speakLang });
    }
  }

  // Schedule each utterance
  for (const utterance of DEMO_SCRIPT) {
    setTimeout(async () => {
      const utteranceId = nanoid(16);
      const tMs = Date.now();

      // Broadcast transcript_delta (simulating live typing)
      broadcastToRoom(roomId, {
        type: 'transcript_delta',
        roomId,
        speakerId: utterance.speakerId,
        text: utterance.text,
        tMs,
      });

      // Broadcast utterance_commit
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

      // Translate for room
      await translateForRoom(roomId, utterance.speakerId, utteranceId, utterance.text, utterance.speakLang);

      // Extract semantics
      await extractAndPatch(roomId, utteranceId, utterance.text);
    }, utterance.delayMs);
  }
}
