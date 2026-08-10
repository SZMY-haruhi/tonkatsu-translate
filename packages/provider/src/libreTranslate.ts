import type { TranslationProvider } from './types';

export type LibreTranslateProviderConfig = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

/** Map BCP-47-ish codes to LibreTranslate codes. */
export function mapLibreLang(code: string): string {
  const normalized = code.trim().toLowerCase();
  if (!normalized || normalized === 'auto') return 'auto';
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('pt')) return 'pt';
  if (normalized.includes('-')) return normalized.split('-')[0]!;
  return normalized;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function createLibreTranslateProvider(
  config: LibreTranslateProviderConfig,
): TranslationProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const endpoint = `${normalizeBaseUrl(config.baseUrl)}/translate`;

  async function translate(input: {
    texts: string[];
    sourceLang: string | 'auto';
    targetLang: string;
  }): Promise<string[]> {
    if (input.texts.length === 0) return [];

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: input.texts,
        source: mapLibreLang(input.sourceLang),
        target: mapLibreLang(input.targetLang),
        format: 'text',
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const detail = body ? `: ${body.slice(0, 200)}` : '';
      throw new Error(
        `LibreTranslate HTTP ${response.status} ${response.statusText}${detail}`,
      );
    }

    const data = (await response.json()) as {
      translatedText?: string | string[];
      error?: string;
    };

    if (data.error) {
      throw new Error(data.error);
    }

    const translated = data.translatedText;
    if (typeof translated === 'string') {
      if (input.texts.length !== 1) {
        throw new Error('LibreTranslate returned one string for multiple inputs');
      }
      return [translated];
    }

    if (
      !Array.isArray(translated) ||
      !translated.every((item) => typeof item === 'string')
    ) {
      throw new Error('LibreTranslate response missing translatedText array');
    }

    if (translated.length !== input.texts.length) {
      throw new Error(
        `LibreTranslate returned ${translated.length} translations, expected ${input.texts.length}`,
      );
    }

    return translated;
  }

  return {
    id: 'libretranslate',
    translate,
    async testConnection() {
      try {
        await translate({
          texts: ['ping'],
          sourceLang: 'en',
          targetLang: 'zh',
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

/** Prefer self-hosted LibreTranslate; community mirrors are often unreliable. */
export const DEFAULT_LIBRETRANSLATE_URL = 'http://localhost:5000';
