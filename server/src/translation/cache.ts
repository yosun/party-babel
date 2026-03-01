/** Translation cache: keyed by (utteranceId, targetLang, textHash) */

import { createHash } from 'node:crypto';

interface CacheEntry {
  translation: string;
  ts: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 10_000;

function makeKey(utteranceId: string, targetLang: string, text: string): string {
  const textHash = createHash('sha256').update(text).digest('hex').slice(0, 12);
  return `${utteranceId}:${targetLang}:${textHash}`;
}

export function getCachedTranslation(utteranceId: string, targetLang: string, text: string): string | undefined {
  return cache.get(makeKey(utteranceId, targetLang, text))?.translation;
}

export function setCachedTranslation(utteranceId: string, targetLang: string, text: string, translation: string): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entries
    const entries = Array.from(cache.entries()).sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < MAX_CACHE_SIZE / 4; i++) {
      cache.delete(entries[i][0]);
    }
  }
  cache.set(makeKey(utteranceId, targetLang, text), { translation, ts: Date.now() });
}
