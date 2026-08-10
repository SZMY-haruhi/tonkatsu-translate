import type { TranslationProvider } from './types';

export type DeepLPlan = 'free' | 'pro';

export type DeepLProviderConfig = {
  apiKey: string;
  /** Free plan must use api-free.deepl.com */
  plan?: DeepLPlan;
  fetchImpl?: typeof fetch;
};

export const DEEPL_FREE_ENDPOINT = 'https://api-free.deepl.com/v2/translate';
export const DEEPL_PRO_ENDPOINT = 'https://api.deepl.com/v2/translate';

/** Infer free vs pro from DeepL key suffix (`:fx` = free). */
export function inferDeepLPlan(apiKey: string, explicit?: DeepLPlan): DeepLPlan {
  if (explicit === 'free' || explicit === 'pro') return explicit;
  return apiKey.trim().endsWith(':fx') ? 'free' : 'pro';
}

export function deeplEndpoint(plan: DeepLPlan): string {
  return plan === 'free' ? DEEPL_FREE_ENDPOINT : DEEPL_PRO_ENDPOINT;
}

/** Map UI / BCP-47 codes to DeepL lang codes. */
export function mapDeepLTargetLang(code: string): string {
  const normalized = code.trim().toLowerCase();
  if (normalized === 'zh-tw' || normalized === 'zh-hant') return 'ZH-HANT';
  if (normalized.startsWith('zh')) return 'ZH';
  if (normalized.startsWith('en')) return 'EN';
  if (normalized.startsWith('ja')) return 'JA';
  if (normalized.startsWith('ko')) return 'KO';
  if (normalized.startsWith('de')) return 'DE';
  if (normalized.startsWith('fr')) return 'FR';
  if (normalized.startsWith('es')) return 'ES';
  if (normalized.startsWith('pt')) return 'PT-BR';
  if (normalized.includes('-')) return normalized.split('-')[0]!.toUpperCase();
  return normalized.toUpperCase();
}

export function mapDeepLSourceLang(code: string | 'auto'): string | undefined {
  if (!code || code === 'auto') return undefined;
  const target = mapDeepLTargetLang(code);
  // Source codes are usually without regional variant (EN not EN-US).
  if (target.startsWith('ZH')) return 'ZH';
  if (target.startsWith('EN')) return 'EN';
  if (target.startsWith('PT')) return 'PT';
  return target;
}

export function createDeepLProvider(config: DeepLProviderConfig): TranslationProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const apiKey = config.apiKey.trim();
  const plan = inferDeepLPlan(apiKey, config.plan);
  const endpoint = deeplEndpoint(plan);

  async function translate(input: {
    texts: string[];
    sourceLang: string | 'auto';
    targetLang: string;
  }): Promise<string[]> {
    if (input.texts.length === 0) return [];
    if (!apiKey) {
      throw new Error('请填写 DeepL API Key。');
    }

    const body: Record<string, unknown> = {
      text: input.texts,
      target_lang: mapDeepLTargetLang(input.targetLang),
    };
    const source = mapDeepLSourceLang(input.sourceLang);
    if (source) body.source_lang = source;

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      const detail = errBody ? `: ${errBody.slice(0, 200)}` : '';
      throw new Error(`DeepL HTTP ${response.status} ${response.statusText}${detail}`);
    }

    const data = (await response.json()) as {
      translations?: Array<{ text?: string }>;
    };
    const translations = data.translations;
    if (!Array.isArray(translations) || translations.length !== input.texts.length) {
      throw new Error(
        `DeepL returned ${translations?.length ?? 0} translations, expected ${input.texts.length}`,
      );
    }
    return translations.map((item, index) => {
      if (typeof item?.text !== 'string') {
        throw new Error(`DeepL translation[${index}] missing text`);
      }
      return item.text;
    });
  }

  return {
    id: 'deepl',
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
