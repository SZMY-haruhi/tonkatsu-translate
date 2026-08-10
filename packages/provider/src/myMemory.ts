import type { TranslationProvider } from './types';

export type MyMemoryProviderConfig = {
  fetchImpl?: typeof fetch;
};

export const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';
const MAX_QUERY_BYTES = 450;

/** MyMemory requires an explicit source language, so auto mode uses a small script heuristic. */
export function inferMyMemorySourceLang(text: string): string {
  if (/[\u3040-\u30ff]/u.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/u.test(text)) return 'ko';
  if (/[\u3400-\u9fff]/u.test(text)) return 'zh-CN';
  if (/[\u0400-\u04ff]/u.test(text)) return 'ru';
  if (/[\u0600-\u06ff]/u.test(text)) return 'ar';
  if (/[\u0900-\u097f]/u.test(text)) return 'hi';
  if (/[\u0e00-\u0e7f]/u.test(text)) return 'th';
  return 'en';
}

function mapMyMemoryLang(code: string): string {
  const normalized = code.trim();
  if (!normalized) return 'en';
  if (normalized.toLowerCase() === 'zh-cn') return 'zh-CN';
  if (normalized.toLowerCase() === 'zh-tw') return 'zh-TW';
  return normalized;
}

function splitUtf8(text: string, maxBytes: number): string[] {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let chunk = '';
  let bytes = 0;

  for (const character of text) {
    const size = encoder.encode(character).length;
    if (chunk && bytes + size > maxBytes) {
      chunks.push(chunk);
      chunk = '';
      bytes = 0;
    }
    chunk += character;
    bytes += size;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export function createMyMemoryProvider(
  config: MyMemoryProviderConfig = {},
): TranslationProvider {
  const fetchImpl = config.fetchImpl ?? fetch;

  async function translateChunk(
    text: string,
    sourceLang: string | 'auto',
    targetLang: string,
  ): Promise<string> {
    const source =
      sourceLang === 'auto'
        ? inferMyMemorySourceLang(text)
        : mapMyMemoryLang(sourceLang);
    const params = new URLSearchParams({
      q: text,
      langpair: `${source}|${mapMyMemoryLang(targetLang)}`,
      mt: '1',
    });
    const response = await fetchImpl(`${MYMEMORY_ENDPOINT}?${params.toString()}`);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const detail = body ? `: ${body.slice(0, 200)}` : '';
      throw new Error(
        `MyMemory HTTP ${response.status} ${response.statusText}${detail}`,
      );
    }

    const data = (await response.json()) as {
      responseData?: { translatedText?: unknown };
      responseStatus?: number | string;
      responseDetails?: string;
    };
    const status = Number(data.responseStatus ?? 200);
    if (status >= 400) {
      throw new Error(data.responseDetails || `MyMemory API ${status}`);
    }
    const translated = data.responseData?.translatedText;
    if (typeof translated !== 'string') {
      throw new Error('MyMemory response missing translatedText');
    }
    return translated;
  }

  async function translate(input: {
    texts: string[];
    sourceLang: string | 'auto';
    targetLang: string;
  }): Promise<string[]> {
    const translations: string[] = [];
    for (const text of input.texts) {
      const chunks = splitUtf8(text, MAX_QUERY_BYTES);
      const translatedChunks: string[] = [];
      for (const chunk of chunks) {
        translatedChunks.push(
          await translateChunk(chunk, input.sourceLang, input.targetLang),
        );
      }
      translations.push(translatedChunks.join(''));
    }
    return translations;
  }

  return {
    id: 'mymemory',
    translate,
    async testConnection() {
      try {
        await translate({
          texts: ['ping'],
          sourceLang: 'en',
          targetLang: 'zh-CN',
        });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'Connection failed',
        };
      }
    },
  };
}
