import { describe, it, expect } from 'vitest';
import { LocalHeuristicTranslator } from '../src/translation/heuristic.js';

describe('heuristic translation smoke', () => {
  const t = new LocalHeuristicTranslator();

  it('translates EN to EO', async () => {
    const r = await t.translate({ text: 'okay so I need to tell you the story of my life', srcLang: 'en', targetLang: 'eo' });
    console.log('EO:', r);
    expect(r).not.toContain('[EN');
    expect(r).toContain('mi');
  });

  it('translates EN to EO tech terms', async () => {
    const r = await t.translate({ text: 'the translation pipeline connects to the database', srcLang: 'en', targetLang: 'eo' });
    console.log('EO tech:', r);
    expect(r).toContain('traduko');
    expect(r).toContain('datumbazo');
  });

  it('translates EN to JA', async () => {
    const r = await t.translate({ text: 'first we need a gateway for audio transcription', srcLang: 'en', targetLang: 'ja' });
    console.log('JA:', r);
    expect(r).not.toContain('[EN');
  });

  it('translates EN to ES', async () => {
    const r = await t.translate({ text: 'the server uses Prisma and connects to PostgreSQL', srcLang: 'en', targetLang: 'es' });
    console.log('ES:', r);
    expect(r).toContain('servidor');
  });

  it('passes through same-language', async () => {
    const r = await t.translate({ text: 'hello world', srcLang: 'en', targetLang: 'en' });
    expect(r).toBe('hello world');
  });

  it('falls back to tagged for unsupported pair', async () => {
    const r = await t.translate({ text: 'test', srcLang: 'zh', targetLang: 'ko' });
    expect(r).toContain('ZH');
  });
});
