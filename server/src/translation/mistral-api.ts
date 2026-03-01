import type { TranslationEngine } from './interface.js';
import { config } from '../config.js';

/**
 * MistralAPITranslator: uses Mistral's chat completion API for translation.
 */
export class MistralAPITranslator implements TranslationEngine {
  readonly name = 'mistral-api';

  async translate(opts: { text: string; srcLang?: string; targetLang: string; context?: string[] }): Promise<string> {
    const src = opts.srcLang || 'auto-detect';
    const contextStr = opts.context?.length ? `\nContext:\n${opts.context.join('\n')}` : '';
    const prompt = `Translate the following text from ${src} to ${opts.targetLang}. Return ONLY the translation, no explanations.${contextStr}\n\nText: ${opts.text}`;

    const resp = await fetch(`${config.MISTRAL_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: 'You are a professional translator. Output only the translated text.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Mistral API translation failed: ${resp.status}`);
    }

    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content?.trim() || opts.text;
  }
}
