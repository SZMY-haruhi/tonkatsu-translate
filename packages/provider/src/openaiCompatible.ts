import type {
  OpenAICompatibleProviderConfig,
  TranslationProvider,
} from './types';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function tryParseJson(text: string): unknown {
  return JSON.parse(text);
}

/** Pull a JSON array out of noisy model output (markdown, preface, etc.). */
function extractJsonArrayText(content: string): string {
  const stripped = stripCodeFence(content);
  if (stripped.startsWith('[')) return stripped;

  const start = stripped.indexOf('[');
  const end = stripped.lastIndexOf(']');
  if (start >= 0 && end > start) {
    return stripped.slice(start, end + 1);
  }
  throw new Error('Provider returned non-JSON translation content');
}

function parseTranslations(content: string, expected: number): string[] {
  let parsed: unknown;
  try {
    parsed = tryParseJson(extractJsonArrayText(content));
  } catch {
    // Common model slip: trailing commas inside arrays.
    try {
      const repaired = extractJsonArrayText(content).replace(/,\s*([\]}])/g, '$1');
      parsed = tryParseJson(repaired);
    } catch {
      throw new Error('Provider returned non-JSON translation content');
    }
  }

  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('Provider JSON must be an array of strings');
  }

  if (parsed.length !== expected) {
    throw new Error(
      `Provider returned ${parsed.length} translations, expected ${expected}`,
    );
  }

  return parsed;
}

/** Qwen3 / Qwen3.5 hybrid-thinking models often fill reasoning_content and leave content empty. */
function shouldDisableThinking(model: string): boolean {
  return /qwen3/i.test(model);
}

function extractMessageContent(message: {
  content?: unknown;
  reasoning_content?: unknown;
}): string {
  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content;
  }
  if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
    return message.reasoning_content;
  }
  throw new Error('Provider response missing message content');
}

export function buildTranslationSystemPrompt(input: {
  sourceLang: string | 'auto';
  targetLang: string;
  count: number;
  strict: boolean;
  doNotTranslate?: string[];
}): string {
  const sourceHint =
    !input.sourceLang || input.sourceLang === 'auto'
      ? 'auto-detect the source language'
      : `treat the source language as ${input.sourceLang}`;

  const keepRules =
    'Preserve person names, team names, gamertags, @handles, and obvious acronyms/abbreviations unchanged. Do not translate or transliterate them.';

  const glossary = (input.doNotTranslate ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 80);
  const glossaryRule =
    glossary.length > 0
      ? ` Also keep these glossary terms exactly unchanged: ${glossary.join(', ')}.`
      : '';

  if (input.strict) {
    return `You are a translation engine. ${sourceHint}. Translate each input string into ${input.targetLang}. ${keepRules}${glossaryRule} Output MUST be a raw JSON array of strings with exactly ${input.count} items in the same order. No markdown fences, no keys, no commentary, no trailing commas.`;
  }

  return `You are a translation engine. ${sourceHint}. Translate each input string into ${input.targetLang}. ${keepRules}${glossaryRule} Reply with ONLY a JSON array of strings, same length/order as inputs. No markdown.`;
}

export function createOpenAICompatibleProvider(
  config: OpenAICompatibleProviderConfig,
): TranslationProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const endpoint = `${baseUrl}/chat/completions`;

  async function requestOnce(
    input: {
      texts: string[];
      sourceLang: string | 'auto';
      targetLang: string;
    },
    strict: boolean,
  ): Promise<string[]> {
    const system = buildTranslationSystemPrompt({
      sourceLang: input.sourceLang,
      targetLang: input.targetLang,
      count: input.texts.length,
      strict,
      doNotTranslate: config.doNotTranslate,
    });
    const user = JSON.stringify(input.texts);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey.trim()) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const payload: Record<string, unknown> = {
      model: config.model,
      temperature: strict ? 0 : 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };
    if (shouldDisableThinking(config.model)) {
      payload.enable_thinking = false;
    }

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const detail = body ? `: ${body.slice(0, 200)}` : '';
      throw new Error(`Provider HTTP ${response.status} ${response.statusText}${detail}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string; reasoning_content?: string };
      }>;
    };
    const content = extractMessageContent(data.choices?.[0]?.message ?? {});
    return parseTranslations(content, input.texts.length);
  }

  async function translate(input: {
    texts: string[];
    sourceLang: string | 'auto';
    targetLang: string;
  }): Promise<string[]> {
    if (input.texts.length === 0) return [];

    try {
      return await requestOnce(input, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (
        message.includes('non-JSON') ||
        message.includes('Provider JSON') ||
        message.includes('expected')
      ) {
        return requestOnce(input, true);
      }
      throw error;
    }
  }

  return {
    id: 'openai-compatible',
    translate,
    async testConnection() {
      try {
        await translate({
          texts: ['ping'],
          sourceLang: 'auto',
          targetLang: 'en',
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
