import type { TranslationProvider } from '@tonkatsu-translate/provider';
import { makeCacheKey } from './cache';
import type { TranslationCache } from './types';

export async function translateTextsWithCache(options: {
  texts: string[];
  targetLang: string;
  model: string;
  sourceLang: string | 'auto';
  provider: TranslationProvider;
  cache: TranslationCache;
  batchSize?: number;
}): Promise<string[]> {
  const {
    texts,
    targetLang,
    model,
    sourceLang,
    provider,
    cache,
    batchSize = 20,
  } = options;

  const results = new Array<string>(texts.length);
  const missIndexes: number[] = [];

  texts.forEach((text, index) => {
    const key = makeCacheKey(text, targetLang, model, sourceLang);
    const hit = cache.get(key);
    if (hit !== undefined) {
      results[index] = hit;
    } else {
      missIndexes.push(index);
    }
  });

  for (let i = 0; i < missIndexes.length; i += batchSize) {
    const slice = missIndexes.slice(i, i + batchSize);
    const batchTexts = slice.map((index) => texts[index]!);
    const translated = await provider.translate({
      texts: batchTexts,
      sourceLang,
      targetLang,
    });

    translated.forEach((value, offset) => {
      const index = slice[offset]!;
      const original = texts[index]!;
      cache.set(makeCacheKey(original, targetLang, model, sourceLang), value);
      results[index] = value;
    });
  }

  return results;
}
