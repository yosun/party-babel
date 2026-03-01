import type { StreamingSTTEngine } from './interface.js';
import { TransformersVoxtralEngine } from './transformers-engine.js';
import { VLLMRealtimeEngine } from './vllm-engine.js';
import { MistralAPIEngine } from './mistral-api-engine.js';
import { commitDetector } from './commit-detector.js';
import { broadcastToRoom } from '../ws/rooms.js';
import { config } from '../config.js';

function createEngine(): StreamingSTTEngine {
  if (config.MISTRAL_API_KEY) {
    console.log('[stt] Using Mistral API engine');
    return new MistralAPIEngine();
  }
  if (config.STT_ENGINE === 'vllm') {
    console.log('[stt] Using vLLM realtime engine');
    return new VLLMRealtimeEngine();
  }
  console.log('[stt] Using Transformers Voxtral engine');
  return new TransformersVoxtralEngine();
}

export const sttEngine = createEngine();

// Map speakerId -> roomId for routing
const speakerRoomMap = new Map<string, string>();

// Wrap startSession to track roomId
const origStart = sttEngine.startSession.bind(sttEngine);
sttEngine.startSession = async (opts) => {
  speakerRoomMap.set(opts.speakerId, opts.roomId);
  return origStart(opts);
};

const origStop = sttEngine.stopSession.bind(sttEngine);
sttEngine.stopSession = async (opts) => {
  speakerRoomMap.delete(opts.speakerId);
  return origStop(opts);
};

// Wire STT deltas into commit detector + broadcast
sttEngine.onDelta((event) => {
  const roomId = speakerRoomMap.get(event.speakerId);
  if (!roomId) return;

  // Broadcast transcript_delta
  broadcastToRoom(roomId, {
    type: 'transcript_delta',
    roomId,
    speakerId: event.speakerId,
    text: event.text,
    tMs: event.tMs,
  });

  // Feed into commit detector
  commitDetector.pushDelta(roomId, event.speakerId, event.text, event.tMs);
});

sttEngine.onFinal((event) => {
  const roomId = speakerRoomMap.get(event.speakerId);
  if (!roomId) return;

  commitDetector.pushFinal(
    roomId,
    event.speakerId,
    event.text,
    event.tStartMs,
    event.tEndMs,
    event.langGuess,
  );
});

sttEngine.onError((event) => {
  const roomId = speakerRoomMap.get(event.speakerId);
  if (roomId) {
    console.error(`[stt] Error for ${event.speakerId}:`, event.error.message);
  }
});

export function getEngineStatus() {
  const sttEngine = config.MISTRAL_API_KEY ? 'mistral-api' : config.STT_ENGINE;
  const translationEngine = config.MISTRAL_API_KEY
    ? 'mistral-api'
    : config.LOCAL_LLM_URL
      ? 'llm-http'
      : 'heuristic';
  return {
    type: 'engine_status' as const,
    sttEngine,
    translationEngine,
    latencyMs: config.TRANSCRIPTION_DELAY_MS,
    warnings: [] as string[],
  };
}
