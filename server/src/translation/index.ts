import type { TranslationEngine } from './interface.js';
import { LocalHeuristicTranslator } from './heuristic.js';
import { LocalLLMHttpTranslator } from './llm-http.js';
import { MistralAPITranslator } from './mistral-api.js';
import { getCachedTranslation, setCachedTranslation } from './cache.js';
import { getRoom, broadcastToRoom } from '../ws/rooms.js';
import { config } from '../config.js';

function createTranslationEngine(): TranslationEngine {
  if (config.MISTRAL_API_KEY) {
    console.log('[translation] Using Mistral API translator');
    return new MistralAPITranslator();
  }
  if (config.LOCAL_LLM_URL) {
    console.log('[translation] Using LLM HTTP translator');
    return new LocalLLMHttpTranslator();
  }
  console.log('[translation] Using heuristic translator');
  return new LocalHeuristicTranslator();
}

const engine = createTranslationEngine();

/**
 * Translate a committed utterance for each unique target language in the room.
 * Deduplicates by (utteranceId, targetLang).
 */
export async function translateForRoom(
  roomId: string,
  speakerId: string,
  utteranceId: string,
  text: string,
  srcLang?: string,
): Promise<void> {
  const room = getRoom(roomId);
  if (!room) return;

  // Collect unique target languages (excluding speaker's own language)
  const targetLangs = new Set<string>();
  for (const user of room.users.values()) {
    if (user.targetLang && user.targetLang !== srcLang) {
      targetLangs.add(user.targetLang);
    }
  }

  // Translate in parallel
  const promises = Array.from(targetLangs).map(async (targetLang) => {
    // Check cache first
    const cached = getCachedTranslation(utteranceId, targetLang, text);
    if (cached) {
      broadcastTranslation(roomId, speakerId, utteranceId, targetLang, cached);
      return;
    }

    try {
      const translated = await engine.translate({ text, srcLang, targetLang });
      setCachedTranslation(utteranceId, targetLang, text, translated);
      broadcastTranslation(roomId, speakerId, utteranceId, targetLang, translated);
    } catch (err) {
      console.error(`[translation] Error translating to ${targetLang}:`, err);
    }
  });

  await Promise.allSettled(promises);
}

function broadcastTranslation(
  roomId: string,
  speakerId: string,
  utteranceId: string,
  targetLang: string,
  text: string,
): void {
  broadcastToRoom(roomId, {
    type: 'translation_commit',
    roomId,
    speakerId,
    utteranceId,
    targetLang,
    text,
  });
}

export { engine as translationEngine };
