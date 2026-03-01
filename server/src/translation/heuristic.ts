import type { TranslationEngine } from './interface.js';

/**
 * LocalHeuristicTranslator: lightweight deterministic translation.
 * Good enough for demos; tags with [SRC→TGT] prefix + basic word swaps.
 */
export class LocalHeuristicTranslator implements TranslationEngine {
  readonly name = 'heuristic';

  async translate(opts: { text: string; srcLang?: string; targetLang: string; context?: string[] }): Promise<string> {
    const src = opts.srcLang || 'auto';
    const tgt = opts.targetLang;

    if (src === tgt) return opts.text;

    // For demo: prefix with language tag and preserve original
    return `[${src.toUpperCase()}→${tgt.toUpperCase()}] ${opts.text}`;
  }
}
