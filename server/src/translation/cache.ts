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
    // Evict oldest 25% — Map iterates in insertion order, so first entries are oldest
    const evictCount = MAX_CACHE_SIZE / 4;
    let i = 0;
    for (const key of cache.keys()) {
      if (i++ >= evictCount) break;
      cache.delete(key);
    }
  }
  cache.set(makeKey(utteranceId, targetLang, text), { translation, ts: Date.now() });
}
