import type { TranslationEngine } from './interface.js';
import { config } from '../config.js';

/**
 * LocalLLMHttpTranslator: calls a configurable OpenAI-compatible endpoint.
 * Provides high-quality translation via a local LLM.
 */
export class LocalLLMHttpTranslator implements TranslationEngine {
  readonly name = 'llm-http';

  async translate(opts: { text: string; srcLang?: string; targetLang: string; context?: string[] }): Promise<string> {
    const src = opts.srcLang || 'auto-detect';
    const contextStr = opts.context?.length ? `\nContext:\n${opts.context.join('\n')}` : '';
    const prompt = `Translate the following text from ${src} to ${opts.targetLang}. Return ONLY the translation, no explanations.${contextStr}\n\nText: ${opts.text}`;

    const resp = await fetch(`${config.LOCAL_LLM_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'default',
        messages: [
          { role: 'system', content: 'You are a professional translator. Output only the translated text.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      throw new Error(`LLM translation failed: ${resp.status}`);
    }

    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content?.trim() || opts.text;
  }
}
