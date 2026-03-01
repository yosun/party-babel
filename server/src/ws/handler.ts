import type { WebSocket } from 'ws';
import { ClientMessage } from '@party-babel/shared';
import {
  getOrCreateRoom,
  addUserToRoom,
  removeUserByConn,
  broadcastToRoom,
  getRoomState,
  getRoom,
} from './rooms.js';
import { commitDetector } from '../stt/commit-detector.js';
import { sttEngine, getEngineStatus, recordLatency } from '../stt/index.js';
import { translateForRoom } from '../translation/index.js';
import { extractAndPatch } from '../semantics/index.js';
import { recordUsage } from '../metering/usage.js';

const WS_MSG_RATE_LIMIT = 100; // max messages per second per connection
const rateCounts = new Map<string, { count: number; resetAt: number }>();

// Connection → user binding for security
const connUsers = new Map<string, { userId: string; roomId: string }>();

function checkRate(connId: string): boolean {
  const now = Date.now();
  let entry = rateCounts.get(connId);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 1000 };
    rateCounts.set(connId, entry);
  }
  entry.count++;
  return entry.count <= WS_MSG_RATE_LIMIT;
}

export function handleWsConnection(ws: WebSocket, connId: string, log: { info: (...args: any[]) => void; error: (...args: any[]) => void }): void {
  ws.on('message', async (raw) => {
    if (!checkRate(connId)) {
      ws.send(JSON.stringify({ type: 'error', code: 'RATE_LIMIT', message: 'Too many messages' }));
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      ws.send(JSON.stringify({ type: 'error', code: 'PARSE_ERROR', message: 'Invalid JSON' }));
      return;
    }

    const result = ClientMessage.safeParse(parsed);
    if (!result.success) {
      ws.send(JSON.stringify({
        type: 'error',
        code: 'VALIDATION_ERROR',
        message: result.error.issues.map(i => i.message).join('; '),
      }));
      return;
    }

    const msg = result.data;
    const corrId = `${connId}:${Date.now()}`;
    log.info({ corrId, type: msg.type, roomId: msg.roomId }, 'WS message');

    try {
      switch (msg.type) {
        case 'join_room': {
          const room = getOrCreateRoom(msg.roomId, msg.inputMode);
          addUserToRoom(room, {
            userId: msg.userId,
            displayName: msg.displayName,
            speakLang: msg.speakLang,
            targetLang: msg.targetLang,
            connId,
            ws,
          });
          connUsers.set(connId, { userId: msg.userId, roomId: msg.roomId });
          broadcastToRoom(msg.roomId, getRoomState(room));
          ws.send(JSON.stringify(getEngineStatus()));
          await sttEngine.startSession({ roomId: msg.roomId, speakerId: msg.userId, speakLang: msg.speakLang });
          break;
        }

        case 'audio_chunk': {
          // Validate userId matches connection binding
          const bound = connUsers.get(connId);
          if (!bound || bound.userId !== msg.userId) {
            ws.send(JSON.stringify({ type: 'error', code: 'AUTH', message: 'User ID mismatch' }));
            break;
          }
          const pcm16 = Buffer.from(msg.pcm16_base64, 'base64');
          if (msg.seq % 50 === 0) log.info({ seq: msg.seq, bytes: pcm16.length }, 'audio_chunk');
          // Guarantee alignment for Int16Array
          const ab = pcm16.buffer.slice(pcm16.byteOffset, pcm16.byteOffset + pcm16.byteLength);
          const int16 = new Int16Array(ab);
          sttEngine.pushAudioFrame({
            speakerId: msg.userId,
            pcm16: int16,
            tMs: Date.now(),
          });
          recordUsage(msg.roomId, msg.userId, pcm16.byteLength / 2 / 16000);
          break;
        }

        case 'set_target_lang': {
          const room = getRoom(msg.roomId);
          if (room) {
            const user = room.users.get(msg.userId);
            if (user) user.targetLang = msg.targetLang;
            broadcastToRoom(msg.roomId, getRoomState(room));
          }
          break;
        }

        case 'toggle_visualize': {
          const room = getRoom(msg.roomId);
          if (room) room.visualizeEnabled = msg.enabled;
          break;
        }

        case 'tag_speaker': {
          // Store speaker label for shared_mic mode post-processing
          log.info({ corrId, speakerLabel: msg.speakerLabel }, 'Speaker tagged');
          break;
        }

        case 'transcript_text': {
          const bound = connUsers.get(connId);
          if (!bound || bound.userId !== msg.userId) {
            ws.send(JSON.stringify({ type: 'error', code: 'AUTH', message: 'User ID mismatch' }));
            break;
          }
          if (msg.isFinal) {
            const startTs = Date.now();
            // Commit as utterance and translate
            const { nanoid } = await import('nanoid');
            const utteranceId = nanoid(16);
            const tNow = Date.now();

            // Then commit (skip delta for final — commit is what matters)
            broadcastToRoom(msg.roomId, {
              type: 'utterance_commit',
              roomId: msg.roomId,
              speakerId: msg.userId,
              utteranceId,
              text: msg.text,
              tStartMs: msg.tMs,
              tEndMs: tNow,
              langGuess: msg.langHint,
            });

            // Translate + semantics
            await translateForRoom(msg.roomId, msg.userId, utteranceId, msg.text, msg.langHint);
            const room = getRoom(msg.roomId);
            if (room?.visualizeEnabled) {
              await extractAndPatch(msg.roomId, utteranceId, msg.text);
            }

            // Track actual processing latency and push updated status
            recordLatency(Date.now() - startTs);
            ws.send(JSON.stringify(getEngineStatus()));
          } else {
            // Interim result — broadcast as delta
            broadcastToRoom(msg.roomId, {
              type: 'transcript_delta',
              roomId: msg.roomId,
              speakerId: msg.userId,
              text: msg.text,
              tMs: msg.tMs,
            });
          }
          break;
        }
      }
    } catch (err) {
      log.error({ corrId, err }, 'Error handling WS message');
      ws.send(JSON.stringify({ type: 'error', code: 'INTERNAL', message: 'Internal server error' }));
    }
  });

  ws.on('close', () => {
    rateCounts.delete(connId);
    connUsers.delete(connId);
    const removed = removeUserByConn(connId);
    if (removed) {
      log.info({ connId, ...removed }, 'User disconnected');
      sttEngine.stopSession({ speakerId: removed.userId });
      const room = getRoom(removed.roomId);
      if (room) broadcastToRoom(removed.roomId, getRoomState(room));
    }
  });

  ws.on('error', (err) => {
    log.error({ connId, err }, 'WS error');
  });
}

// ── Wire up STT engine callbacks ────────────────────────
commitDetector.onCommit(async (commit) => {
  const { roomId, speakerId, utteranceId, text, tStartMs, tEndMs, langGuess } = commit;

  // Broadcast utterance_commit
  broadcastToRoom(roomId, {
    type: 'utterance_commit',
    roomId,
    speakerId,
    utteranceId,
    text,
    tStartMs,
    tEndMs,
    langGuess,
  });

  // Translate for each unique target language in the room
  await translateForRoom(roomId, speakerId, utteranceId, text, langGuess);

  // Extract semantics and broadcast world_patch
  const room = getRoom(roomId);
  if (room?.visualizeEnabled) {
    await extractAndPatch(roomId, utteranceId, text);
  }
});
