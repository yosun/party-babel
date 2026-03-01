import type { StreamingSTTEngine } from './interface.js';
import { TransformersVoxtralEngine } from './transformers-engine.js';
import { VLLMRealtimeEngine } from './vllm-engine.js';
import { MistralAPIEngine } from './mistral-api-engine.js';
import { commitDetector } from './commit-detector.js';
import { broadcastToRoom } from '../ws/rooms.js';
import { config } from '../config.js';

/** Whether Mistral API was tested and found working */
let mistralApiValid = false;
const engineWarnings: string[] = [];

/** Test the Mistral API key with a lightweight models endpoint */
async function validateMistralKey(): Promise<boolean> {
  try {
    const resp = await fetch(`${config.MISTRAL_API_URL}/v1/models`, {
      headers: { 'Authorization': `Bearer ${config.MISTRAL_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) return true;
    console.error(`[stt] Mistral API key invalid — ${resp.status} ${resp.statusText}`);
    return false;
  } catch (err) {
    console.error('[stt] Mistral API unreachable:', (err as Error).message);
    return false;
  }
}

function createLocalSTTEngine(): StreamingSTTEngine {
  if (config.STT_ENGINE === 'vllm') {
    console.log('[stt] Using vLLM realtime engine');
    return new VLLMRealtimeEngine();
  }
  console.log('[stt] Using Transformers Voxtral engine (local)');
  return new TransformersVoxtralEngine();
}

function createEngine(): StreamingSTTEngine {
  // Placeholder — will be replaced by initEngines() if Mistral validates
  if (config.MISTRAL_API_KEY) {
    // Start with Mistral optimistically; initEngines() will swap if invalid
    return new MistralAPIEngine();
  }
  return createLocalSTTEngine();
}

export let sttEngine: StreamingSTTEngine = createEngine();

/**
 * Called once at startup. Validates Mistral key; if invalid, swaps to local.
 * Must be called before the server starts accepting connections.
 */
export async function initEngines(): Promise<void> {
  if (!config.MISTRAL_API_KEY) return;

  mistralApiValid = await validateMistralKey();
  if (mistralApiValid) {
    console.log('[stt] ✓ Mistral API key validated — using cloud engines');
    return;
  }

  // Key failed — swap to local
  const warning = 'Mistral API key is invalid or unreachable — falling back to local engines';
  console.warn(`[stt] ⚠ ${warning}`);
  engineWarnings.push(warning);
  sttEngine = createLocalSTTEngine();
  wireEngine();
}

// Map speakerId -> roomId for routing
const speakerRoomMap = new Map<string, string>();

function wireEngine() {
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

    broadcastToRoom(roomId, {
      type: 'transcript_delta',
      roomId,
      speakerId: event.speakerId,
      text: event.text,
      tMs: event.tMs,
    });

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
}

// Wire the initial engine
wireEngine();

export function isMistralApiValid(): boolean {
  return mistralApiValid;
}

// Track actual processing latency (moving average)
const latencySamples: number[] = [];
const MAX_LATENCY_SAMPLES = 20;

export function recordLatency(ms: number): void {
  latencySamples.push(ms);
  if (latencySamples.length > MAX_LATENCY_SAMPLES) latencySamples.shift();
}

function avgLatency(): number {
  if (latencySamples.length === 0) return 0;
  return Math.round(latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length);
}

export function getEngineStatus() {
  const useMistral = config.MISTRAL_API_KEY && mistralApiValid;
  const sttName = useMistral ? 'mistral-api' : 'browser';
  const translationName = useMistral
    ? 'mistral-api'
    : config.LOCAL_LLM_URL
      ? 'llm-http'
      : 'heuristic';
  return {
    type: 'engine_status' as const,
    sttEngine: sttName,
    translationEngine: translationName,
    latencyMs: avgLatency(),
    warnings: [...engineWarnings],
  };
}
