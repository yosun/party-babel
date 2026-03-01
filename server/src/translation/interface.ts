export interface TranslationEngine {
  readonly name: string;
  translate(opts: {
    text: string;
    srcLang?: string;
    targetLang: string;
    context?: string[];
  }): Promise<string>;
}
